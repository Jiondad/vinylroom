#!/usr/bin/env python3
"""Build a minimal in-memory preservation fixture for ONE multidisc UUID pair.

Reads production Catalog in SQLite mode=ro and uses an isolated :memory: DB.
This is a reference-integrity *fixture*, not a real Index.scan_job integration test.
No media read, no external calls, no production DB or source writes.
"""
import json
import sqlite3
from pathlib import Path

DB=Path("/data/catalog.sqlite3")
REP="5d7db58a-641f-42cd-84d4-15b77c396e76"
OLD="3a18d47b-9263-4c72-b9db-9bdd71181e55"
REP_KEY="e8ef8de27051a9ac3681412d06845bd962425ac9612011fa04e80bd4b37ddc2a"
OLD_KEY="8f9cf87f180a184400bec19ba21bb58655c324ba349b7ff1a0973e78ecc4d01c"
PARENT=("KPOP/김종서 (Kim Jong Sheo)/김종서 - 2007.04.18 名作(명작) - "
        "20th Anniversary Greatest Hits [FLAC-16bit-44.1kHz]")
TABLES=("albums","category_albums","category_references","track_search_v1","catalog_changes")

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,
        "catalog_writes":0,"media_writes":0},ensure_ascii=False))
def q(s):
    return '"'+s.replace('"','""')+'"'

def collect(db,table,where,args):
    rows=db.execute("SELECT * FROM "+q(table)+" WHERE "+where,args).fetchall()
    return [tuple(row) for row in rows]

def main():
    if not DB.is_file() or DB.is_symlink():hold("catalog_not_found")
    src=sqlite3.connect(DB.resolve().as_uri()+"?mode=ro",uri=True,timeout=2)
    src.row_factory=sqlite3.Row
    src.execute("PRAGMA query_only=ON")
    dest=sqlite3.connect(":memory:")
    dest.row_factory=sqlite3.Row
    try:
        # Copy only the five relevant table shapes. Actual Index.put and full
        # migration are intentionally NOT invoked in this preservation fixture.
        schema={}
        for name in TABLES:
            row=src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",(name,)).fetchone()
            if row is None or not row["sql"]:hold("schema_missing:"+name)
            schema[name]=row["sql"]
        for name in TABLES:
            try:dest.execute(schema[name])
            except sqlite3.Error as ex:hold("fixture_schema_unsupported:"+name+":"+type(ex).__name__)

        selections={
            "albums":('id IN (?,?)',(REP,OLD)),
            "category_albums":('album_id IN (?,?)',(REP,OLD)),
            "category_references":('key IN (?,?)',(REP_KEY,OLD_KEY)),
            "track_search_v1":('album_id IN (?,?)',(REP,OLD)),
            "catalog_changes":('album_id IN (?,?)',(REP,OLD)),
        }
        counts={}
        for name in TABLES:
            clause,params=selections[name]
            rows=collect(src,name,clause,params)
            cols=[r["name"] for r in src.execute("PRAGMA table_info("+q(name)+")")]
            if not cols:hold("columns_missing:"+name)
            placeholders=",".join("?" for _ in cols)
            quoted=",".join(q(c) for c in cols)
            dest.executemany("INSERT INTO "+q(name)+"("+quoted+") VALUES("+placeholders+")",rows)
            counts[name]=len(rows)
        if counts!={"albums":2,"category_albums":2,"category_references":2,
                    "track_search_v1":27,"catalog_changes":27}:
            hold("fixture_counts_not_expected:"+json.dumps(counts))
        original=dest.execute("SELECT id,path,missing FROM albums WHERE id=?",(REP,)).fetchone()
        archived=dest.execute("SELECT id,path,missing FROM albums WHERE id=?",(OLD,)).fetchone()
        if (not original or not archived or original["path"]!=PARENT+"/CD1"
            or archived["path"]!=PARENT+"/CD2" or original["missing"] or archived["missing"]):
            hold("existing_album_identity_changed")

        # Simulate ONLY the expected identity transition, not index scanning or
        # category reconciliation. SQLite changes remain entirely in memory.
        dest.execute("UPDATE albums SET path=? WHERE id=?",(PARENT,REP))
        dest.execute("UPDATE albums SET missing=1 WHERE id=?",(OLD,))
        active=dest.execute(
            "SELECT id FROM albums WHERE missing=0 AND path IN (?,?,?)",
            (PARENT,PARENT+"/CD1",PARENT+"/CD2")).fetchall()
        if [r["id"] for r in active]!=[REP]:hold("representative_transition_failed")
        remaining={t:dest.execute("SELECT COUNT(*) FROM "+q(t)).fetchone()[0]
                   for t in TABLES}
        if remaining!=counts:hold("reference_rows_changed_in_fixture")
        category_links=[dict(r) for r in dest.execute(
            "SELECT album_id,key FROM category_albums ORDER BY album_id")]
        if {x["album_id"]:x["key"] for x in category_links}!={REP:REP_KEY,OLD:OLD_KEY}:
            hold("category_evidence_mapping_changed")

        print(json.dumps({
            "state":"ISOLATED_REFERENCE_PRESERVATION_PASS",
            "scope":"two album records / five scoped tables / in-memory only",
            "source_counts":counts,"in_memory_counts_after_identity_change":remaining,
            "representative_uuid":REP,"archived_uuid":OLD,
            "category_keys_preserved":True,
            "catalog_changes_preserved":True,
            "actual_scan_set_or_index_put":"NOT_TESTED",
            "track_search_retarget":"NOT_IMPLEMENTED",
            "category_reconciliation":"NOT_IMPLEMENTED",
            "writer_end_to_end":"NOT_TESTED",
            "production_deploy":"NOT_AUTHORIZED",
            "catalog_writes":0,"media_writes":0
        },ensure_ascii=False,indent=2))
    finally:
        dest.close()
        src.close()
if __name__=="__main__":main()
