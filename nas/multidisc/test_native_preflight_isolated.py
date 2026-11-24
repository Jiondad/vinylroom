#!/usr/bin/env python3
"""Run only newly changed NativeAlbumIndex.preflight paths against fake DB and temp dirs.

Candidate-only, no live module imports, no service, Catalog or media writes.
"""
import ast
import hashlib
import json
import re
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

SOURCE=Path("/tmp/vinyl-multidisc-candidate-20261124/tag_native_index.py.candidate")
EXPECTED="699effa78701cd63aa775aea9a76ef264a42ace529449437bafb811d0a043373"
UUID="5d7db58a-641f-42cd-84d4-15b77c396e76"

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,
        "db_writes":0,"operating_media_writes":0}))

if not SOURCE.is_file() or SOURCE.is_symlink() or hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=EXPECTED:
    hold("candidate_missing_or_hash_mismatch")
tree=ast.parse(SOURCE.read_text(encoding="utf-8"))
matches=[n for n in ast.walk(tree) if isinstance(n,ast.ClassDef) and n.name=="NativeAlbumIndex"]
if len(matches)!=1:hold("native_class_not_unique")
methods=[n for n in matches[0].body if isinstance(n,ast.FunctionDef) and n.name=="preflight"]
if len(methods)!=1:hold("preflight_not_unique")
module=ast.Module(body=methods,type_ignores=[])
ast.fix_missing_locations(module)
cases=[]
with TemporaryDirectory(prefix="vinyl_native_multidisc_") as tmp:
    parent=Path(tmp)/"album"
    parent.mkdir()
    class Cursor:
        def __init__(self,rows):self.rows=rows
        def __iter__(self):return iter(self.rows)
        def fetchall(self):return self.rows
    class FakeDB:
        def __init__(self,rows):self.rows=rows
        def __enter__(self):return self
        def __exit__(self,*args):return False
        def execute(self,sql,args=()):
            if "FROM jobs" in sql:return Cursor([])
            if "FROM albums" in sql:return Cursor(self.rows)
            raise AssertionError("Unexpected query")
    selected={"rows":[],"issues":[],"calls":[]}
    def inventory(dbpath,root,album_id,**kwargs):
        selected["calls"].append(kwargs)
        return {"id":album_id},[{"file":"CD1/01.flac"}],selected["issues"]
    ns={"base":SimpleNamespace(inventory=inventory),"json":json,"Path":Path}
    exec(compile(module,str(SOURCE),"exec"),ns)
    preflight=ns["preflight"]
    def disc_number(name):
        m=re.fullmatch(r"(?:cd|disc|disk|디스크)\s*[-_. ]*(\d+)",name,re.I)
        return int(m.group(1)) if m else None
    index=SimpleNamespace(stopping=SimpleNamespace(is_set=lambda:False),
        active=False,jobs=SimpleNamespace(empty=lambda:True),
        meta=lambda name:"1",folder=lambda p:parent,root=Path(tmp),
        dbpath="synthetic",scanner=SimpleNamespace(disc_number=disc_number),
        db=lambda:FakeDB(selected["rows"]))
    owner=SimpleNamespace(index=index)

    def case(name,dirs,rows,expected_allow,expected_error=None):
        for d in list(parent.iterdir()):
            if d.is_dir():d.rmdir()
        for d in dirs:(parent/d).mkdir()
        selected["rows"]=rows
        selected["issues"]=[]
        selected["calls"]=[]
        error=None
        try:preflight(owner,UUID,"album")
        except Exception as e:error=str(e)
        if expected_error:
            ok=error==expected_error and not selected["calls"]
        else:
            ok=error is None and selected["calls"]==[{"allow_auxiliary_disc_dirs":expected_allow}]
        cases.append({"case":name,"pass":ok})
        if not ok:hold("case_failed:"+name+":"+str(error)+":"+str(selected["calls"]))

    representative={"id":UUID,"path":"album","missing":0,"hidden":0}
    case("merged_cd1_disk2_parent",["CD1","DISK2"],[representative],True)
    case("single_album_no_disc",[],[representative],False)
    case("single_cd_child_not_merged",["CD1"],[representative],False)
    case("active_sibling_protected",["CD1","CD2"],[representative,
         {"id":"3a18d47b-9263-4c72-b9db-9bdd71181e55",
          "path":"album/CD2","missing":0,"hidden":0}],True,
         "native_album_scope_not_single_active_album")
    case("archived_sibling_allowed",["CD1","CD2"],[representative,
         {"id":"3a18d47b-9263-4c72-b9db-9bdd71181e55",
          "path":"album/CD2","missing":1,"hidden":0}],True)

print(json.dumps({"state":"MULTIDISC_NATIVE_PREFLIGHT_ISOLATED_PASS","cases":cases,
    "db_writes":0,"operating_media_writes":0,"production_install":"NOT_AUTHORIZED",
    "writer_end_to_end":"NOT_TESTED"},ensure_ascii=False,indent=2))
