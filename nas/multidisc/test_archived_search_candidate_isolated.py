#!/usr/bin/env python3
"""Isolated candidate check: archived CD search cannot be repopulated.

Only executes candidate synchronize AST against :memory: SQLite. Ensures the
index_engine candidate contains the single archive hook, syntax checked.
No operational Catalog, music or installed source writes.
"""
import ast
import json
import sqlite3
from pathlib import Path

ROOT=Path("/tmp/vinyl-multidisc-search-stage-20261124")
TRACK=ROOT/"track_search.py.candidate"
INDEX=ROOT/"index_engine.py.candidate"
REP="5d7db58a-641f-42cd-84d4-15b77c396e76"
OLD="3a18d47b-9263-4c72-b9db-9bdd71181e55"

def fail(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,"catalog_writes":0,"media_writes":0}))

if any(not f.is_file() or f.is_symlink() for f in (TRACK,INDEX)):
    fail("candidate_missing")
code=TRACK.read_text(encoding="utf-8")
tree=ast.parse(code)
if len([n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="synchronize"])!=1:
    fail("sync_function_missing")
funcs=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ("synchronize","sql_value")]
unit=ast.Module(body=funcs,type_ignores=[])
ast.fix_missing_locations(unit)
ns={"json":json}
exec(compile(unit,str(TRACK),"exec"),ns)
sync=ns["synchronize"]
idx=INDEX.read_text(encoding="utf-8")
ast.parse(idx)
must=("INSERT OR IGNORE INTO track_search_dirty_v1 VALUES(?)",
      "synchronize(db,norm,row['id'])",
      "UPDATE albums SET missing=1 WHERE id=?")
if any(idx.count(s)!=1 for s in must):
    fail("archive_hook_missing_or_repeated")

db=sqlite3.connect(":memory:")
try:
    db.execute("CREATE TABLE albums(id TEXT PRIMARY KEY,data TEXT,missing INTEGER NOT NULL,hidden INTEGER NOT NULL)")
    db.execute("CREATE TABLE track_search_v1(album_id TEXT,track_index INTEGER,title,duration,title_key TEXT,PRIMARY KEY(album_id,track_index))")
    db.execute("CREATE TABLE track_search_dirty_v1(album_id TEXT PRIMARY KEY)")
    track=lambda n:json.dumps({"tracks":[{"title":"track"+str(x),"duration":90} for x in range(n)]})
    db.execute("INSERT INTO albums VALUES(?,?,0,0)",(REP,track(27)))
    db.execute("INSERT INTO albums VALUES(?,?,1,0)",(OLD,track(13)))
    db.executemany("INSERT INTO track_search_v1 VALUES(?,?,?,?,?)",
        [(REP,i,"track",90,"track") for i in range(14)]
        +[(OLD,i,"track",90,"track") for i in range(13)])
    db.executemany("INSERT INTO track_search_dirty_v1 VALUES(?)",[(REP,),(OLD,)])
    sync(db,str.casefold,REP)
    sync(db,str.casefold,OLD)
    def counts():
        return dict(db.execute("SELECT album_id,COUNT(*) FROM track_search_v1 GROUP BY album_id"))
    first=counts()
    if first!={REP:27}:fail("archived_id_still_searchable")
    db.execute("INSERT INTO track_search_dirty_v1 VALUES(?)",(OLD,))
    sync(db,str.casefold)
    after=counts()
    if after!={REP:27}:fail("archived_id_repopulated")
    print(json.dumps({"state":"MULTIDISC_ARCHIVE_SEARCH_ISOLATED_PASS",
        "after_archive":first,"after_repeated_sync":after,
        "candidate_index_hook":"AST_AND_ANCHOR_VERIFIED_ONLY",
        "actual_scan_job_integration":"NOT_TESTED",
        "catalog_writes":0,"media_writes":0,
        "production_install":"NOT_AUTHORIZED"},ensure_ascii=False,indent=2))
finally:
    db.close()
