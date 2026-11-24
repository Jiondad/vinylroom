#!/usr/bin/env python3
"""Invoke installed delta coordinator, with the existing catalog file lease.
No analysis, no direct SQL writes or cursor adjustment. Refuse new backlog IDs.
"""
import ast,contextlib,inspect,json,sqlite3,sys,os
from pathlib import Path
sys.path.insert(0,"/app")
from ai_metadata.delta_sync import DeltaCoordinator
from ai_metadata import auto_sync
C=Path("/data/catalog.sqlite3")
A=Path("/data/ai-metadata/ai-metadata-v1.sqlite3")
IDS={"5d7db58a-641f-42cd-84d4-15b77c396e76","3a18d47b-9263-4c72-b9db-9bdd71181e55","bfdadf5f-f513-4099-8de4-3ffef88cb49c"}
def ro(p):return sqlite3.connect(p.as_uri()+"?mode=ro",uri=True,timeout=3)
def hold(s,**extra):
    print(json.dumps({"state":"HOLD","reason":s,**extra},ensure_ascii=False));raise SystemExit(1)
# Use the installed Observer's native coordinator and guard, not an invented lock.
# Constructor must not start threads. Inspect the installed source contract first.
src=inspect.getsource(auto_sync.Observer.__init__)
if any(x in src for x in (".start(",".tick(",".run(",".ingest(")):hold("observer_constructor_not_passive")
obs=auto_sync.Observer(C,A)
co=getattr(obs,"coordinator",None)
if not isinstance(co,DeltaCoordinator) or co.index_guard is None:hold("existing_delta_coordinator_unavailable")
if Path(co.catalog)!=C or Path(co.ai)!=A:hold("unexpected_coordinator_database")
def scope():
    with ro(A) as a,ro(C) as c:
        cursor=a.execute("SELECT seq FROM ai_sync_delta_cursor WHERE id=1").fetchone()
        if not cursor:raise ValueError("verified_delta_baseline_required")
        pending={r[0] for r in c.execute("SELECT DISTINCT album_id FROM catalog_changes WHERE seq>?",(cursor[0],))}
        if not pending<=IDS:raise ValueError("unexpected_pending_ids")
        return cursor[0],pending
# Wrap the existing guard so the scope check is inside the real lease.
original=co.index_guard
@contextlib.contextmanager
def guarded():
    with original():
        scope()
        yield
co.index_guard=guarded
try:
    before,pending=scope()
    result=co.run(commit_guard=lambda:scope())
except (ValueError,sqlite3.Error,OSError) as e:hold(str(e))
print(json.dumps({"state":"MULTIDISC_AI_DELTA_RESULT","before_cursor":before,"pending_ids":sorted(pending),"result":result},ensure_ascii=False,indent=2,default=str))
if result.get("state")!="completed":raise SystemExit(1)
with ro(A) as a:
    rows=dict(a.execute("SELECT id,active FROM albums WHERE id IN (?,?)",("5d7db58a-641f-42cd-84d4-15b77c396e76","3a18d47b-9263-4c72-b9db-9bdd71181e55")))
    cursor=a.execute("SELECT seq FROM ai_sync_delta_cursor WHERE id=1").fetchone()[0]
ok=rows=={"5d7db58a-641f-42cd-84d4-15b77c396e76":1,"3a18d47b-9263-4c72-b9db-9bdd71181e55":0} and cursor>=6181
print(json.dumps({"state":"MULTIDISC_AI_DELTA_PASS" if ok else "HOLD","active":rows,"cursor":cursor,"gemini_calls":result.get("gemini_calls_made"),"catalog_writes":0,"media_writes":0},indent=2))
if not ok:raise SystemExit(1)
