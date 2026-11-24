#!/usr/bin/env python3
"""Isolated synthetic checks for the *new* multidisc scan_set decision branch.

Reads only staged index_scanner.py candidate; executes JUST scan_set in a sandboxed
namespace of synthetic helper functions. No media/DB/HTTP and no deployed module.
No re-test of qualified tag/rename/save/restore paths.
"""
import ast
import json
import re
from pathlib import Path
from tempfile import TemporaryDirectory

SOURCE=Path("/tmp/vinyl-multidisc-candidate-20261124/index_scanner.py.candidate")
EXPECTED_SHA="602b70816efe34b8ebfd26eabd98973928758d65d41edbcf93c84dae3d4b06b3"

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,
                                 "db_writes":0,"operating_media_writes":0}))

def main():
    import hashlib
    if not SOURCE.is_file() or SOURCE.is_symlink():
        hold("staged_scanner_not_found")
    raw=SOURCE.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=EXPECTED_SHA:
        hold("candidate_sha_mismatch")
    tree=ast.parse(raw)
    funcs=[n for n in ast.walk(tree) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name=="scan_set"]
    if len(funcs)!=1:
        hold("scan_set_not_unique")
    fn=funcs[0]
    src=ast.Module(body=[fn],type_ignores=[])
    ast.fix_missing_locations(src)

    def disc_number(name):
        m=re.fullmatch(r"(?:cd|disc|disk|디스크)\s*[-_. ]*(\d+)(?:\s*[-_:]\s*.+)?",name,re.I)
        return int(m.group(1)) if m and int(m.group(1))>0 else None

    results=[]
    with TemporaryDirectory(prefix="vinyl_multidisc_isolated_") as tmp:
        parent=Path(tmp)/"album"
        parent.mkdir()
        discs=[parent/"CD1",parent/"DISK2"]
        for d in discs:d.mkdir()

        sources={}
        def scan(child,*args,**kwargs):
            return sources[str(child)]
        def folder_hints(name):
            return {"title":"","original_year":None}
        ns={"disc_number":disc_number,"scan":scan,"folder_hints":folder_hints,
            "Path":Path,"thumbnail":lambda *a,**kw:None}
        exec(compile(src,str(SOURCE),"exec"),ns)
        combine=ns["scan_set"]

        def album(d,title="20th Anniversary Greatest Hits 名作",artist="김종서"):
            return {"relative_path":".","title":title,"artist":artist,"tracks":[{"path":str(d/"01.flac"),"title":"test"}],
                    "physical_files":[{"path":str(d/"01.flac")}],"attachments":[],
                    "size":1,"format":"FLAC","original_year":"2007"}

        def test(name, records, expect_album, expect_reason=None):
            sources.clear()
            for d,a in zip(discs,records):
                sources[str(d)]={"albums":[a] if a else [],"errors":[]}
            result=combine(parent,"classified-music",discs,covers=False)
            ok=bool(result["albums"]) is expect_album
            if expect_reason:
                ok=ok and any(e.get("error")==expect_reason for e in result["errors"])
            if expect_album:
                a=result["albums"][0]
                ok=ok and a["disc_count"]==2 and [t["disc"] for t in a["tracks"]]==[1,2]
                ok=ok and [t["subfolder"] for t in a["tracks"]]==["CD1","DISK2"]
            results.append({"case":name,"pass":bool(ok)})
            if not ok:hold("synthetic_case_failed:"+name)

        test("same_title_and_artist_merge", [album(discs[0]),album(discs[1])],True)
        test("different_title_hold", [album(discs[0]),album(discs[1],title="Different Album")],
             False,"disc_album_identity_mismatch")
        test("different_artist_hold", [album(discs[0]),album(discs[1],artist="Other Artist")],
             False,"disc_album_identity_mismatch")
        test("incomplete_disc_hold", [album(discs[0]),None],False,"incomplete_disc_set")
        test("empty_title_hold", [album(discs[0],title=""),album(discs[1],title="")],
             False,"disc_album_identity_mismatch")
    print(json.dumps({"state":"MULTIDISC_NEW_BRANCH_ISOLATED_PASS",
                      "cases":results,"operating_media_writes":0,"db_writes":0,
                      "native_index_qualification":"PENDING",
                      "operating_merge":"NOT_AUTHORIZED"},ensure_ascii=False,indent=2))
main()
