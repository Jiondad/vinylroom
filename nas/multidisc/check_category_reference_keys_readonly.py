#!/usr/bin/env python3
"""Read-only, two-key category evidence check for the Kim Jong-seo multidisc pilot.

Only inspect category_references by the two already-known category_albums.key values.
Fail closed when no indexed key lookup exists; do not scan unbounded payload rows.
No modification to NAS, Catalog, categories, audit, or media.
"""
import json
import sqlite3
from pathlib import Path

DB = Path("/data/catalog.sqlite3")
KEYS = (
    "8f9cf87f180a184400bec19ba21bb58655c324ba349b7ff1a0973e78ecc4d01c",
    "e8ef8de27051a9ac3681412d06845bd962425ac9612011fa04e80bd4b37ddc2a",
)
ALBUMS = (
    "5d7db58a-641f-42cd-84d4-15b77c396e76",
    "3a18d47b-9263-4c72-b9db-9bdd71181e55",
)

def q(name):
    return '"' + name.replace('"','""') + '"'

def finish(state, **kw):
    print(json.dumps({"state":state, **kw,
        "catalog_writes":0,"media_writes":0,
        "migration_execution":"NOT_AUTHORIZED"},
        ensure_ascii=False,indent=2))

def indexed_columns(db,table):
    out=[]
    for idx in db.execute("PRAGMA index_list("+q(table)+")"):
        c=[r["name"] for r in db.execute("PRAGMA index_info("+q(idx["name"])+")")]
        if c:out.append(c)
    return out

if not DB.is_file() or DB.is_symlink():
    finish("HOLD_DB_UNAVAILABLE")
    raise SystemExit(0)
db=sqlite3.connect(DB.resolve().as_uri()+"?mode=ro",uri=True,timeout=2)
db.row_factory=sqlite3.Row
db.execute("PRAGMA query_only=ON")
db.execute("PRAGMA busy_timeout=1500")
try:
    table="category_references"
    cols=[r["name"] for r in db.execute("PRAGMA table_info("+q(table)+")")]
    indices=indexed_columns(db,table)
    possible=[c for c in ("key","category_key","reference_key") if c in cols]
    indexed=[c for c in possible if any(ind and ind[0]==c for ind in indices)]
    if not indexed:
        finish("HOLD_NO_INDEXED_CATEGORY_KEY",
            table=table,columns=cols,indexes=indices,
            reason="No safe two-key lookup. Do not infer clean from 2000-row partial scan.")
    else:
        col=indexed[0]
        matches=[]
        # Bound each lookup by 11 rows; do not return raw metadata/payload.
        for key in KEYS:
            rows=db.execute("SELECT * FROM "+q(table)+" WHERE "+q(col)+"=? LIMIT 11",(key,)).fetchall()
            out={"key":key,"rows_seen":min(len(rows),10),"truncated":len(rows)>10,
                 "uuid_occurrences":{a:0 for a in ALBUMS}}
            for r in rows[:10]:
                for c in cols:
                    if c not in ("payload","data","metadata","detail","album_id","album_uuid"):
                        continue
                    v=r[c]
                    if v is None:continue
                    v=str(v)
                    if len(v)>1_000_000:
                        out["large_payload_skipped"]=True
                        continue
                    for album in ALBUMS:
                        out["uuid_occurrences"][album]+=v.count(album)
            matches.append(out)
        finish("READ_ONLY_CATEGORY_KEY_REFERENCES",
            key_column=col,matched=matches,
            note="The two key-scoped rows alone do not prove no indirect UUID refs elsewhere.")
finally:
    db.close()
