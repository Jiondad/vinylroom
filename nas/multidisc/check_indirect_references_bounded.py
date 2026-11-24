#!/usr/bin/env python3
"""Bounded read-only indirect reference audit for one multidisc Catalog merge.

Do not scan albums/tracks or repeat previous checks. For small JSON/side tables,
inspect up to a fixed number of rows and indicate incompleteness explicitly.
Never print raw playlist payloads, personal information, or audit details.
"""
import json
import sqlite3
from pathlib import Path

DB = Path("/data/catalog.sqlite3")
IDS = ("5d7db58a-641f-42cd-84d4-15b77c396e76",
       "3a18d47b-9263-4c72-b9db-9bdd71181e55")
TARGETS = (
    ("personal_playlists", "data", 2000),
    ("category_references", "payload", 2000),
    ("trusted_autofill_audit", "album_id", 2000)
)
MAX_FIELD_BYTES = 1_000_000

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,"catalog_writes":0,
                                 "media_writes":0},ensure_ascii=False))

def q(n):
    return '"' + n.replace('"','""') + '"'

def main():
    if not DB.is_file() or DB.is_symlink():hold("catalog_not_found")
    db=sqlite3.connect(DB.resolve().as_uri()+"?mode=ro", uri=True,timeout=2)
    db.row_factory=sqlite3.Row
    db.execute("PRAGMA query_only=ON")
    db.execute("PRAGMA busy_timeout=1500")
    results=[]
    try:
        for table,column,limit in TARGETS:
            columns={r["name"] for r in db.execute("PRAGMA table_info("+q(table)+")")}
            if column not in columns:
                results.append({"table":table,"state":"HOLD_COLUMN_MISSING"})
                continue
            # Bounded by number of retrieved rows, not only number of matches.
            cursor=db.execute("SELECT "+q(column)+" AS value FROM "+q(table)+" LIMIT ?", (limit+1,))
            fetched=0
            matched={i:0 for i in IDS}
            too_large=0
            for r in cursor:
                fetched+=1
                if fetched>limit:break
                value=r["value"]
                if value is None:continue
                if isinstance(value,bytes):
                    if len(value)>MAX_FIELD_BYTES:too_large+=1;continue
                    value=value.decode("utf-8",errors="replace")
                else:
                    value=str(value)
                if len(value.encode("utf-8"))>MAX_FIELD_BYTES:too_large+=1;continue
                for i in IDS:
                    if i in value:matched[i]+=1
            complete=(fetched<=limit and too_large==0)
            results.append({"table":table,"column":column,"rows_inspected":min(fetched,limit),
                            "scan_complete":complete,
                            "match_rows_by_uuid":matched,
                            "skipped_oversized_rows":too_large,
                            "state":"SCOPED_COMPLETE" if complete else "HOLD_PARTIAL"})
        print(json.dumps({"state":"READ_ONLY_INDIRECT_REFERENCE_CHECK",
            "targets":results,"caution":"String matches only; positive matches require semantic review; partial is never zero.",
            "catalog_writes":0,"media_writes":0,"migration_execution":"NOT_AUTHORIZED"
        },ensure_ascii=False,indent=2))
    finally:db.close()
main()
