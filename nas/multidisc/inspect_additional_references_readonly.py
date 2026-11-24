#!/usr/bin/env python3
"""Read-only reference topology check for one Kim Jong-seo multidisc merge.

Intentionally DOES NOT recheck the previously passed album/disc guards.
No scan, no migration, no network, no DB/media writes. Only schema introspection
and indexed, single-album lookup of *additional* ID reference columns.
"""
import json
import sqlite3
from pathlib import Path

DB = Path("/data/catalog.sqlite3")
CD1 = "5d7db58a-641f-42cd-84d4-15b77c396e76"
CD2 = "3a18d47b-9263-4c72-b9db-9bdd71181e55"
KNOWN = {"category_albums", "track_search_v1", "catalog_changes"}
LIKELY_ID = {"album_id", "album_uuid", "source_album_id", "target_album_id",
             "reference_album_id", "albumid"}
TEXT_HINTS = ("playlist", "favorite", "bookmark", "queue", "ai_", "category")
MAX_INDEXED_TABLES = 40

def quote(name):
    return '"' + name.replace('"', '""') + '"'

def main():
    if not DB.is_file() or DB.is_symlink():
        raise SystemExit("HOLD: catalog path unavailable")
    db = sqlite3.connect(DB.resolve().as_uri()+"?mode=ro", uri=True, timeout=2)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA query_only=ON")
    db.execute("PRAGMA busy_timeout=1500")
    try:
        tables = [r["name"] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        referenced, uncertain, counted = [], [], 0
        for table in tables:
            cols = [r["name"] for r in db.execute(
                "PRAGMA table_info(" + quote(table) + ")")]
            idcols = [c for c in cols if c.lower() in LIKELY_ID]
            if not idcols:
                if any(h in table.lower() for h in TEXT_HINTS):
                    uncertain.append({"table":table,"reason":"no_direct_album_id_column",
                                      "candidate_fields":[c for c in cols
                                          if any(x in c.lower() for x in
                                             ("data","payload","json","items","album"))][:12]})
                continue
            idx_cols = []
            for idx in db.execute("PRAGMA index_list(" + quote(table) + ")"):
                index_name=idx["name"]
                details=[r["name"] for r in db.execute(
                    "PRAGMA index_info(" + quote(index_name) + ")")]
                if details: idx_cols.append(details)
            for col in idcols:
                indexed=any(idx[0] == col for idx in idx_cols)
                item={"table":table,"column":col,"indexed":indexed}
                if table in KNOWN:
                    item["state"]="COUNT_ALREADY_VERIFIED_EARLIER"
                elif not indexed:
                    item["state"]="NOT_COUNTED_UNINDEXED"
                    uncertain.append({"table":table,"column":col,
                                      "reason":"unindexed_reference_requires_scoped_review"})
                elif counted >= MAX_INDEXED_TABLES:
                    item["state"]="NOT_COUNTED_LIMIT"
                else:
                    try:
                        rows=db.execute(
                            "SELECT "+quote(col)+" AS album_ref,COUNT(*) AS n FROM "+
                            quote(table)+" WHERE "+quote(col)+" IN (?,?) "+
                            "GROUP BY "+quote(col), (CD1, CD2)).fetchall()
                    except sqlite3.Error as exc:
                        item["state"]="NOT_COUNTED_SQL_ERROR"
                        item["error"]=type(exc).__name__
                    else:
                        item["state"]="READ_ONLY_COUNTED"
                        item["counts"]={r["album_ref"]:r["n"] for r in rows}
                        counted += 1
                referenced.append(item)
        print(json.dumps({
            "state":"READ_ONLY_MULTIDISC_REFERENCE_TOPOLOGY",
            "target":"Kim Jong-seo 名作",
            "representative_uuid":CD1,
            "archived_uuid":CD2,
            "direct_reference_columns":referenced,
            "possible_indirect_references":uncertain,
            "known_counts_reused_from_prior_receipt":{
                "category_albums":{CD1:1,CD2:1},
                "track_search_v1":{CD1:14,CD2:13},
                "catalog_changes":{CD1:14,CD2:13}
            },
            "interpretation":"Topology only; indirect JSON, other DBs and frontend links not proven",
            "catalog_writes":0,"media_writes":0,
            "migration_execution":"NOT_AUTHORIZED"
        },ensure_ascii=False,indent=2))
    finally:
        db.close()

if __name__=="__main__":
    main()
