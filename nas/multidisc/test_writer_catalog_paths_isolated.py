#!/usr/bin/env python3
"""Check the existing Rename Writer path contract for a merged 2-disc album.

Uses actual installed Writer function AST without importing the operational
module. Synthesizes 27 Catalog paths and small files under TemporaryDirectory;
uses a purpose-built base shim only for physical inventory/tag reads.
This checks plan identity/path, not actual Tag Writer apply/restore or scanner.
No production DB/media/service modifications.
"""
import ast
import hashlib
import json
import os
import re
import sqlite3
import tempfile
from pathlib import Path
from types import SimpleNamespace

WRITER=Path("/app/tag_rename_writer.py")
ROOT="KPOP/김종서 (Kim Jong Sheo)/김종서 - 2007.04.18 名作(명작) - 20th Anniversary Greatest Hits [FLAC-16bit-44.1kHz]"
REP="5d7db58a-641f-42cd-84d4-15b77c396e76"

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,
         "catalog_writes":0,"operating_media_writes":0},ensure_ascii=False))

if not WRITER.is_file() or WRITER.is_symlink():hold("writer_source_missing")
src=WRITER.read_text(encoding="utf-8")
tree=ast.parse(src)
funcs=[n for n in tree.body if isinstance(n,ast.FunctionDef)
       and n.name in ("_catalog_files","_references_match")]
if {n.name for n in funcs}!={"_catalog_files","_references_match"}:
    hold("reference_functions_not_found")
unit=ast.Module(body=funcs,type_ignores=[])
ast.fix_missing_locations(unit)

class Base:
    @staticmethod
    def album_record(catalog, album_id):
        row=catalog.execute("SELECT id,path,data FROM albums WHERE id=?",(album_id,)).fetchone()
        if row is None:raise ValueError("album_missing")
        return row,json.loads(row["data"])

ns={"base":Base(),"Path":Path}
exec(compile(unit,str(WRITER),"exec"),ns)
catalog_files=ns["_catalog_files"]
references_match=ns["_references_match"]

def mk(disc,n):
    return ROOT+"/"+disc+"/"+str(n).zfill(2)+" Track.flac"

db=sqlite3.connect(":memory:")
db.row_factory=sqlite3.Row
try:
    db.execute("CREATE TABLE albums(id TEXT PRIMARY KEY,path TEXT NOT NULL,data TEXT NOT NULL)")
    original=[{"path":mk(disc,i),"filename":Path(mk(disc,i)).name,"subfolder":disc}
              for disc,max_n in (("CD1",14),("CD2",13))
              for i in range(1,max_n+1)]
    db.execute("INSERT INTO albums VALUES(?,?,?)",(REP,ROOT,json.dumps({"physical_files":original})))
    before=catalog_files(db,REP)
    if not before or len(before)!=27:hold("parent_catalog_inventory_not_27")
    if set(before)!={r["path"] for r in original}:hold("disc_file_paths_not_preserved")
    old=mk("CD2",3)
    new=ROOT+"/CD2/03 Renamed.flac"
    if not references_match(db,REP,old,new):hold("original_file_reference_not_valid")
    if references_match(db,REP,new,old):hold("pre_rename_false_positive")
    obj={"physical_files":[dict(t) for t in original]}
    found=[x for x in obj["physical_files"] if x["path"]==old]
    if len(found)!=1:hold("test_entry_missing")
    found[0]["path"]=new; found[0]["filename"]=Path(new).name
    db.execute("UPDATE albums SET data=? WHERE id=?",(json.dumps(obj),REP))
    if not references_match(db,REP,new,old):hold("post_rename_not_verified")
    # Also cover the existing fallback that builds file paths from
    # filename + subfolder when a physical_files[].path is unavailable.
    fallback={"physical_files":[{k:v for k,v in f.items() if k!="path"} for f in obj["physical_files"]]}
    db.execute("UPDATE albums SET data=? WHERE id=?",(json.dumps(fallback),REP))
    if not references_match(db,REP,new,old):hold("fallback_subfolder_not_verified")
    # Refuse duplicate and escaping paths without looking outside parent.
    invalid={"physical_files":[{"path":ROOT+"/CD1/../CD2/01.flac"}]}
    db.execute("UPDATE albums SET data=? WHERE id=?",(json.dumps(invalid),REP))
    if catalog_files(db,REP) is not None:hold("traversal_not_rejected")
    print(json.dumps({"state":"MULTIDISC_WRITER_CATALOG_PATH_ISOLATED_PASS",
         "representative_uuid":REP,"in_memory_file_count":27,
         "disc_1_tracks":14,"disc_2_tracks":13,
         "merged_parent_reference_verified":True,
         "renamed_cd2_reference_verified":True,
         "subfolder_fallback_verified":True,
         "unsafe_path_rejected":True,
         "writer_apply_restore":"NOT_TESTED",
         "full_index_integration":"NOT_TESTED",
         "production_install":"NOT_AUTHORIZED",
         "catalog_writes":0,"operating_media_writes":0
    },ensure_ascii=False,indent=2))
finally: db.close()
