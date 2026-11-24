#!/usr/bin/env python3
"""Isolated in-memory demonstration of existing track_search.synchronize behavior.

Read ONLY /app/track_search.py source. Execute just synchronize() AST with
in-memory SQLite and synthetic albums. Never import the live index, scan audio,
or open production DB. Also print the bounded original scan_job archival block
for a future pinpoint patch. This test is only for the NEW CD archive edge.
"""
import ast
import hashlib
import json
import sqlite3
from pathlib import Path

TRACK=Path("/app/track_search.py")
INDEX=Path("/app/index_engine.py")
CD1="5d7db58a-641f-42cd-84d4-15b77c396e76"
CD2="3a18d47b-9263-4c72-b9db-9bdd71181e55"

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,"db_writes":0,"media_writes":0}))

def build_sync():
    if not TRACK.is_file() or TRACK.is_symlink():hold("track_search_source_not_found")
    raw=TRACK.read_text(encoding="utf-8")
    tree=ast.parse(raw)
    funcs=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ("synchronize","sql_value")]
    if {n.name for n in funcs}!={"synchronize","sql_value"}:hold("sync_functions_not_found")
    fragment=ast.Module(body=funcs,type_ignores=[])
    ast.fix_missing_locations(fragment)
    ns={"json":json}
    exec(compile(fragment,str(TRACK),"exec"),ns)
    return ns["synchronize"],hashlib.sha256(raw.encode("utf-8")).hexdigest()

def show_archive_block():
    if not INDEX.is_file() or INDEX.is_symlink():hold("index_engine_source_not_found")
    source=INDEX.read_text(encoding="utf-8")
    tree=ast.parse(source)
    funcs=[n for n in ast.walk(tree) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name=="scan_job"]
    if len(funcs)!=1:hold("scan_job_not_unique")
    lines=source.splitlines()
    node=funcs[0]
    markers=[i for i in range(node.lineno-1,node.end_lineno)
             if ("disc_rows" in lines[i] or "merged_disc_records" in lines[i]
                 or ("missing" in lines[i] and ("UPDATE" in lines[i] or "execute(" in lines[i])))]
    print("\n=== SCAN_JOB_ARCHIVE_SOURCE ===")
    shown=set()
    for i in markers[:12]:
        for j in range(max(node.lineno-1,i-6),min(node.end_lineno,i+8)):
            if j not in shown:
                print(f"{j+1:04} {lines[j]}")
                shown.add(j)
    print("SCAN_JOB_MATCHES:",len(markers))

def memory_case(sync):
    db=sqlite3.connect(":memory:")
    try:
        db.execute("CREATE TABLE albums(id TEXT PRIMARY KEY,path TEXT,missing INTEGER NOT NULL,data TEXT NOT NULL)")
        db.execute("CREATE TABLE track_search_v1(album_id TEXT NOT NULL,track_index INTEGER NOT NULL,title,duration,title_key TEXT NOT NULL,PRIMARY KEY(album_id,track_index))")
        db.execute("CREATE TABLE track_search_dirty_v1(album_id TEXT PRIMARY KEY)")
        db.execute("""CREATE TRIGGER dirty_on_data AFTER UPDATE OF data ON albums
                      WHEN json_extract(OLD.data,'$.tracks') IS NOT json_extract(NEW.data,'$.tracks')
                      BEGIN INSERT OR IGNORE INTO track_search_dirty_v1 VALUES(NEW.id); END""")
        def tracks(n):return [{"title":"Song "+str(i),"duration":90} for i in range(1,n+1)]
        original14=json.dumps({"tracks":tracks(14)})
        original13=json.dumps({"tracks":tracks(13)})
        combined27=json.dumps({"tracks":tracks(27)})
        db.executemany("INSERT INTO albums VALUES(?,?,0,?)",[
            (CD1,"Album/CD1",original14),(CD2,"Album/CD2",original13)])
        db.executemany("INSERT INTO track_search_v1 VALUES(?,?,?,?,?)",[
            (CD1,i,"Song "+str(i+1),90,"song "+str(i+1)) for i in range(14)] +
            [(CD2,i,"Song "+str(i+1),90,"song "+str(i+1)) for i in range(13)])
        # Mimic native Index.put(): canonical album data update triggers dirty row,
        # and old CD2 becomes missing WITHOUT data change.
        db.execute("UPDATE albums SET path=?,data=? WHERE id=?",("Album",combined27,CD1))
        db.execute("UPDATE albums SET missing=1 WHERE id=?",(CD2,))
        n=sync(db,lambda s:str(s).casefold(),CD1)
        if n != 1:hold("unexpected_sync_count")
        before=dict(db.execute("SELECT album_id,COUNT(*) FROM track_search_v1 GROUP BY album_id"))
        if before!={CD1:27,CD2:13}:hold("unexpected_native_sync_result:"+repr(before))
        # Proposed specific correction: remove stale CD2 SEARCH rows only,
        # keeping albums, categories and audit histories intact, in memory.
        db.execute("DELETE FROM track_search_v1 WHERE album_id=?",(CD2,))
        db.execute("DELETE FROM track_search_dirty_v1 WHERE album_id=?",(CD2,))
        after=dict(db.execute("SELECT album_id,COUNT(*) FROM track_search_v1 GROUP BY album_id"))
        if after!={CD1:27}:hold("cleanup_model_failed:"+repr(after))
        print(json.dumps({
            "state":"MULTIDISC_ARCHIVED_SEARCH_EDGE_REPRODUCED",
            "actual_synchronize_result_before_cleanup":before,
            "isolated_target_search_result_after_cleanup":after,
            "original_cd2_album_retained":bool(db.execute("SELECT 1 FROM albums WHERE id=? AND missing=1",(CD2,)).fetchone()),
            "change_audit_and_categories":"NOT_TOUCHED",
            "operation":"IN_MEMORY_SIMULATION_ONLY",
            "actual_scan_job_integration":"NOT_TESTED",
            "catalog_writes":0,"media_writes":0,"production_install":"NOT_AUTHORIZED"
        },ensure_ascii=False,indent=2))
    finally:db.close()

sync,hash_value=build_sync()
print("TRACK_SEARCH_SOURCE_SHA256:",hash_value)
memory_case(sync)
show_archive_block()
print("READ_ONLY_COMPLETE")
