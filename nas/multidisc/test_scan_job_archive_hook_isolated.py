#!/usr/bin/env python3
"""Exercise the EXACT staged scan_job disc-archive AST block in an in-memory DB.

This targeted test isolates the newly added block, not the full scanner.
The native track_search candidate's synchronize is imported ONLY from its AST
into a synthetic module, then the archive loop is executed unchanged in memory.
No /app modifications, operational DB opening, media files, or service calls.
"""
import ast
import hashlib
import json
import sqlite3
import sys
import types
from pathlib import Path

STAGE=Path("/tmp/vinyl-multidisc-search-stage-20261124")
INDEX=STAGE/"index_engine.py.candidate"
TRACK=STAGE/"track_search.py.candidate"
EXPECTED={
 "index_engine.py.candidate":"7057f502aba53c3519f2df6ae28df6b838ef88bc43dc046d768728d2290ab2c5",
 "track_search.py.candidate":"fb5e9bc51bc3854c7ddee3b2e1d222c61a07bd078cd8d0beb02a3e23de19fc86",
}
REP="5d7db58a-641f-42cd-84d4-15b77c396e76"
OLD="3a18d47b-9263-4c72-b9db-9bdd71181e55"

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,
         "catalog_writes":0,"media_writes":0},ensure_ascii=False))

def read_verified(path):
    if not path.is_file() or path.is_symlink():hold("candidate_unavailable:"+path.name)
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=EXPECTED[path.name]:
        hold("candidate_hash_mismatch:"+path.name)
    return ast.parse(raw.decode("utf-8"))

track_tree=read_verified(TRACK)
idx_tree=read_verified(INDEX)
functions=[n for n in track_tree.body if isinstance(n,ast.FunctionDef)
           and n.name in ("sql_value","synchronize")]
if {f.name for f in functions}!={"sql_value","synchronize"}:
    hold("native_sync_functions_missing")
unit=ast.Module(body=functions,type_ignores=[])
ast.fix_missing_locations(unit)
mod=types.ModuleType("track_search")
mod.__dict__["json"]=json
exec(compile(unit,str(TRACK),"exec"),mod.__dict__)

scan_jobs=[n for n in ast.walk(idx_tree)
           if isinstance(n,ast.FunctionDef) and n.name=="scan_job"]
if len(scan_jobs)!=1:hold("scan_job_missing")
# Select only the exact existing per-disc archival loop within scan_job.
loops=[n for n in ast.walk(scan_jobs[0]) if isinstance(n,ast.For)
       and isinstance(n.target,ast.Name) and n.target.id=="row"
       and isinstance(n.iter,ast.Name) and n.iter.id=="disc_rows"
       and any(isinstance(x,ast.Call) and
               isinstance(x.func,ast.Attribute) and x.func.attr=="execute"
               for x in ast.walk(n))]
if len(loops)!=1:hold("disc_archive_loop_not_unique")
loop=loops[0]
text=ast.unparse(loop)
if ("synchronize(db, norm, row['id'])" not in text
        or "UPDATE albums SET missing=1 WHERE id=?" not in text):
    hold("archive_hook_not_in_same_loop")
block=ast.Module(body=[loop],type_ignores=[])
ast.fix_missing_locations(block)
code=compile(block,str(INDEX),"exec")

db=sqlite3.connect(":memory:")
db.row_factory=sqlite3.Row
try:
    db.execute("CREATE TABLE albums(id TEXT PRIMARY KEY, data TEXT, missing INTEGER NOT NULL, hidden INTEGER NOT NULL)")
    db.execute("CREATE TABLE track_search_v1(album_id TEXT NOT NULL,track_index INTEGER NOT NULL,title,duration,title_key TEXT NOT NULL,PRIMARY KEY(album_id,track_index))")
    db.execute("CREATE TABLE track_search_dirty_v1(album_id TEXT PRIMARY KEY)")
    def tracks(n):return json.dumps({"tracks":[{"title":"Track "+str(i+1),"duration":60} for i in range(n)]})
    db.execute("INSERT INTO albums VALUES(?,?,0,0)",(REP,tracks(27)))
    db.execute("INSERT INTO albums VALUES(?,?,0,0)",(OLD,tracks(13)))
    db.executemany("INSERT INTO track_search_v1 VALUES(?,?,?,?,?)",
        [(REP,i,"Track",60,"track") for i in range(27)]
        +[(OLD,i,"Track",60,"track") for i in range(13)])

    # Python import inside original scan_job block resolves to this synthetic
    # candidate module; never import operational /app/track_search.py.
    real=sys.modules.get("track_search")
    sys.modules["track_search"]=mod
    try:
        scope={"db":db,
               "disc_rows":[{"id":REP},{"id":OLD}],
               "saved_id":REP,
               "self":types.SimpleNamespace(track_search_enabled=True),
               "norm":str.casefold}
        exec(code,scope)
    finally:
        if real is None:sys.modules.pop("track_search",None)
        else:sys.modules["track_search"]=real

    rows={r["id"]:r["missing"] for r in db.execute("SELECT id,missing FROM albums")}
    search=dict(db.execute("SELECT album_id,COUNT(*) FROM track_search_v1 GROUP BY album_id"))
    dirty=list(db.execute("SELECT album_id FROM track_search_dirty_v1"))
    if rows!={REP:0,OLD:1} or search!={REP:27} or dirty:
        hold("archive_hook_execution_unexpected:"+repr((rows,search,dirty)))
    print(json.dumps({"state":"MULTIDISC_SCAN_JOB_ARCHIVE_HOOK_ISOLATED_PASS",
        "executed_source":"exact staged scan_job for-row AST",
        "candidate_native_sync":"exact staged synchronize AST",
        "album_missing_after":rows,"search_rows_after":search,
        "pending_search_dirty":len(dirty),
        "category_audit_and_media":"NOT_TOUCHED",
        "full_scan_job_execution":"NOT_TESTED",
        "operating_catalog_writes":0,"operating_media_writes":0,
        "production_install":"NOT_AUTHORIZED"},ensure_ascii=False,indent=2))
finally:db.close()
