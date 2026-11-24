#!/usr/bin/env python3
"""One scoped read-only inspection of remaining AI and protected metadata.
No scans, source modifications, network, or database writes.
"""
import json, sqlite3
from pathlib import Path
ROOT=Path("/data")
IDS=("5d7db58a-641f-42cd-84d4-15b77c396e76","3a18d47b-9263-4c72-b9db-9bdd71181e55")
KEYS=("e8ef8de27051a9ac3681412d06845bd962425ac9612011fa04e80bd4b37ddc2a","8f9cf87f180a184400bec19ba21bb58655c324ba349b7ff1a0973e78ecc4d01c")
def open_ro(p):
    if not p.is_file() or p.is_symlink():raise ValueError("unsafe_database_path")
    db=sqlite3.connect(p.resolve().as_uri()+"?mode=ro",uri=True,timeout=2)
    db.row_factory=sqlite3.Row
    db.execute("PRAGMA query_only=ON")
    return db
def q(s):return '"'+s.replace('"','""')+'"'
def cols(db,t):return [r["name"] for r in db.execute("PRAGMA table_info("+q(t)+")")]
def decode(v):
    if isinstance(v,str):
        try:return json.loads(v)
        except ValueError:return v
    return v
def safe_meta(obj):
    fields=("artist","title","category","category_source","genre","genres","album_type","release_type","manual_fields","protected","category_reference","label","label_source","notes","source_id")
    result={k:obj[k] for k in fields if k in obj}
    if "category_reference" in result:
        ref=result["category_reference"]
        result["category_reference"]={k:ref[k] for k in ("key","category","source") if k in ref} if isinstance(ref,dict) else None
    if "notes" in result:result["notes_present"]=bool(result.pop("notes"))
    return result
result={"state":"MULTIDISC_METADATA_AI_READ_ONLY","catalog_writes":0,"ai_writes":0,"media_writes":0,"migration":"NOT_AUTHORIZED"}
with open_ro(ROOT/"catalog.sqlite3") as db:
    result["catalog_metadata"]=[]
    for row in db.execute("SELECT id,data FROM albums WHERE id IN (?,?)",IDS):
        obj=json.loads(row["data"])
        result["catalog_metadata"].append({"id":row["id"],"metadata":safe_meta(obj)})
    result["category_evidence"]=[]
    for row in db.execute("SELECT key,state,result FROM category_references WHERE key IN (?,?)",KEYS):
        val=decode(row["result"])
        result["category_evidence"].append({"key":row["key"],"state":row["state"],"result_summary":{k:val[k] for k in ("category","source","is_live") if k in val} if isinstance(val,dict) else None})
# Bounded discovery of SQLite files in /data and two levels below; no symlink following.
candidates=[]
for p in ROOT.glob("*"):
    if p.is_file() and not p.is_symlink():candidates.append(p)
    elif p.is_dir() and not p.is_symlink():
        candidates.extend(x for x in p.glob("*") if x.is_file() and not x.is_symlink())
        for sub in p.glob("*"):
            if sub.is_dir() and not sub.is_symlink():
                candidates.extend(x for x in sub.glob("*") if x.is_file() and not x.is_symlink())
ai=[]
for p in sorted(set(candidates)):
    if p==ROOT/"catalog.sqlite3" or p.suffix.lower() not in (".db",".sqlite",".sqlite3"):continue
    if "backup" in str(p).lower() or "snapshot" in str(p).lower():continue
    try:
        with open_ro(p) as db:
            tables={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {"albums","ai_sync_sources","ai_sync_runs"}.issubset(tables):continue
            item={"path":str(p),"albums":[],"direct_references":[]}
            allowed=("id","artist","title","state","active","protected","changed_fields","payload")
            fields=[c for c in allowed if c in cols(db,"albums")]
            for row in db.execute("SELECT "+",".join(map(q,fields))+" FROM albums WHERE id IN (?,?)",IDS):
                record={k:decode(row[k]) for k in fields if k!="payload"}
                if "payload" in fields:
                    payload=decode(row["payload"])
                    record["payload_metadata"]=safe_meta(payload) if isinstance(payload,dict) else None
                item["albums"].append(record)
            for table in sorted(tables):
                for col in cols(db,table):
                    if col not in ("album_id","album_uuid","source_album_id","target_album_id"):continue
                    # Only perform indexed lookup; report any unindexed relation explicitly.
                    indexes=[list(db.execute("PRAGMA index_info("+q(i["name"])+")")) for i in db.execute("PRAGMA index_list("+q(table)+")")]
                    if not any(ix and ix[0]["name"]==col for ix in indexes):
                        item["direct_references"].append({"table":table,"column":col,"state":"UNINDEXED_NOT_READ"})
                        continue
                    rows=db.execute("SELECT "+q(col)+",count(*) FROM "+q(table)+" WHERE "+q(col)+" IN (?,?) GROUP BY "+q(col),IDS).fetchall()
                    item["direct_references"].append({"table":table,"column":col,"counts":dict(map(tuple,rows))})
            ai.append(item)
    except (sqlite3.Error,ValueError,OSError) as e:
        result.setdefault("discovery_errors",[]).append({"path":str(p),"error":type(e).__name__})
result["ai_database_candidates"]=ai
result["ai_discovery_status"]="ONE_CANDIDATE" if len(ai)==1 else "HOLD_DATABASE_SELECTION"
result["qualification"]="EVIDENCE_ONLY_NOT_RECONCILED"
print(json.dumps(result,ensure_ascii=False,indent=2,default=str))
