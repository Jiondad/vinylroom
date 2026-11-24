#!/usr/bin/env python3
"""Read only: target the known AI DB and inspect existing sync reconciliation.
No AI requests, no sync execution, no database or media modifications.
"""
import ast,json,sqlite3
from pathlib import Path
P=Path("/data/ai-metadata/ai-metadata-v1.sqlite3")
IDS=("5d7db58a-641f-42cd-84d4-15b77c396e76","3a18d47b-9263-4c72-b9db-9bdd71181e55")
def q(s):return '"'+s.replace('"','""')+'"'
def hold(msg):raise SystemExit(json.dumps({"state":"HOLD","reason":msg,"writes":0}))
if not P.is_file() or P.is_symlink():hold("expected_ai_db_unavailable")
db=sqlite3.connect(P.resolve().as_uri()+"?mode=ro",uri=True,timeout=2)
db.execute("PRAGMA query_only=ON")
out={"state":"MULTIDISC_AI_RECONCILIATION_READ_ONLY","database":str(P),"refs":{},"sync_source_locations":[],"writes":0}
try:
    for table in ("ai_sync_items","field_selection_reviews","gemini_call_album_scope"):
        cols=[r[1] for r in db.execute("PRAGMA table_info("+q(table)+")")]
        if "album_id" not in cols:
            out["refs"][table]={"state":"TABLE_OR_COLUMN_MISSING"};continue
        # Single bounded read per table; count matching IDs only.
        import time
        deadline=time.monotonic()+3
        db.set_progress_handler(lambda:int(time.monotonic()>deadline),10000)
        try:
            rows=db.execute("SELECT album_id,count(*) FROM "+q(table)+" WHERE album_id IN (?,?) GROUP BY album_id",IDS).fetchall()
            out["refs"][table]={"counts":dict(rows)}
        except sqlite3.Error as ex:out["refs"][table]={"state":"HOLD_READ","error":str(ex)}
        finally:db.set_progress_handler(None,0)
finally:db.close()
# Inspect only source files. Do not print environment variables, configs, or secrets.
for p in sorted(Path("/app").glob("*.py")):
    if p.is_symlink() or not p.is_file() or p.stat().st_size>2000000:continue
    src=p.read_text(encoding="utf-8",errors="replace")
    if not any(s in src for s in ("ai_sync_sources","ai_sync_items","ai-metadata-v1.sqlite3")):continue
    try:tree=ast.parse(src)
    except SyntaxError:continue
    for n in ast.walk(tree):
        if not isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):continue
        body=ast.get_source_segment(src,n) or ""
        low=body.lower()
        if not any(s in low for s in ("ai_sync_sources","ai_sync_items")):continue
        if not any(s in low for s in ("active","missing","fingerprint","reconcile")):continue
        out["sync_source_locations"].append({"file":p.name,"function":n.name,"line":n.lineno,"end":n.end_lineno,
            "markers":[s for s in ("active=0","active = 0","missing","fingerprint","ai_sync_sources","ai_sync_items") if s in low]})
        if len(out["sync_source_locations"])>=40:break
    if len(out["sync_source_locations"])>=40:break
print(json.dumps(out,ensure_ascii=False,indent=2))
