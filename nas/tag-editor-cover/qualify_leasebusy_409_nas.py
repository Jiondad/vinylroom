#!/usr/bin/env python3
"""Scoped qualification: reuse prior audio/restore evidence; check only changed lease behavior.
No running NAS service, music, catalog, receipt, or Docker changes.
"""
import ast,hashlib,json,os,sqlite3,subprocess,sys,tempfile,threading,time,types,urllib.parse
from pathlib import Path
BASE=Path("/volume1/docker/music-gateway")
STAGE=BASE/"tag-editor-leasebusy-409-stage-20261123"
CONTAINER="music-gateway-music-gateway-1"
EIGHT=("server.py","index_engine.py","catalog_lease.py","tag_cover_http.py","tag_phase2c.py","tag_cover_h.py","tag_rename_writer.py","tag_native_index.py")
NAMES=("server.py","tag_cover_http.py")
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(args):
 p=subprocess.run(args,text=True,capture_output=True)
 if p.returncode:raise RuntimeError("HOLD cmd_failed:"+p.stderr[-700:])
 return p.stdout
def main():
 if os.geteuid()!=0:raise RuntimeError("HOLD root_required")
 manifest=json.loads((STAGE/"manifest.json").read_text())
 if manifest.get("state")!="LEASEBUSY_409_STAGE_ONLY_NOT_INSTALLED" or manifest.get("production_changes")!=0 or set(manifest.get("module_names",[]))!=set(NAMES):raise RuntimeError("HOLD manifest_invalid")
 info=json.loads(run(["docker","inspect",CONTAINER]))[0]
 if not info["State"]["Running"] or info["Config"]["User"]!="1026:100":raise RuntimeError("HOLD container_contract")
 mounts={m["Destination"]:m for m in info["Mounts"]}
 root=Path(mounts["/tag-editor-backups"]["Source"]);receipt=root/"fullsave-native-qualified.json"
 old=json.loads(receipt.read_text())
 if sha(receipt)!=manifest["original_receipt_sha256"] or old.get("state")!="PASS" or set(old.get("hashes",{}))!=set(EIGHT):raise RuntimeError("HOLD prior_receipt_mismatch")
 for name in EIGHT:
  m=mounts.get("/app/"+name)
  if not m or m.get("Type")!="bind" or m.get("RW") or sha(m["Source"])!=old["hashes"][name]:raise RuntimeError("HOLD running_module_mismatch:"+name)
 for name in NAMES:
  if sha(STAGE/name)!=manifest["candidate_sha256"][name]:raise RuntimeError("HOLD staged_candidate_changed:"+name)
 original_server=Path(mounts["/app/server.py"]["Source"]).read_text()
 original_handler=Path(mounts["/app/tag_cover_http.py"]["Source"]).read_text()
 server=(STAGE/"server.py").read_text()
 handler=(STAGE/"tag_cover_http.py").read_text()
 oldguard="runtime_guard=lambda: _vr_catalog_lease(INDEX.dbpath).acquire(blocking=False)"
 newguard="runtime_guard=lambda: _vr_catalog_lease(INDEX.dbpath).acquire(blocking=True, timeout=5)"
 oldcatch="        _safe_apply_error_log(route,exc)\n        return h.reply(400,cover.hold('save_validation_or_file_conflict'))"
 newcatch="""        from catalog_lease import LeaseBusy
        if isinstance(exc,LeaseBusy):
            return h.reply(409,cover.hold('catalog_lease_busy_retry_later'))
        _safe_apply_error_log(route,exc)
        return h.reply(400,cover.hold('save_validation_or_file_conflict'))"""
 if original_server.count(oldguard)!=1 or server!=original_server.replace(oldguard,newguard):raise RuntimeError("HOLD server_non_scoped_difference")
 if original_handler.count(oldcatch)!=1 or handler!=original_handler.replace(oldcatch,newcatch):raise RuntimeError("HOLD handler_non_scoped_difference")
 ast.parse(server); tree=ast.parse(handler)
 cases=[]
 # Execute exact server lambda with a fake Catalog lease, verifying the intended bounded wait contract.
 server_tree=ast.parse(server)
 keywords=[k.value for n in ast.walk(server_tree) if isinstance(n,ast.Call) for k in n.keywords if k.arg=="runtime_guard"]
 if len(keywords)!=1:raise RuntimeError("HOLD runtime_guard_contract_changed")
 events=[]
 class FakeLease:
  def acquire(self,blocking=False,timeout=None):
   events.append((blocking,timeout));return object()
 fn=eval(compile(ast.Expression(keywords[0]),"server.py","eval"),{"_vr_catalog_lease":lambda db:FakeLease(),"INDEX":types.SimpleNamespace(dbpath="/isolated/fixture.db")})
 fn()
 if events!=[(True,5)]:raise RuntimeError("HOLD bounded_guard_wrong:"+repr(events))
 cases.append("guard_blocks_with_five_second_bound")
 # Exercise the actual handler source in-process using a fake request that raises
 # before touching any runtime state or receiving any authentication tokens.
 handles=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=="handle"]
 if len(handles)<2:raise RuntimeError("HOLD handler_not_found")
 scope={"urlsplit":urllib.parse.urlsplit,"_SAVE_ROUTES":{"/v2/admin/tag-cover/tag-apply"},
        "_READONLY_HANDLE":lambda *args:None,
        "cover":types.SimpleNamespace(hold=lambda reason:{"state":"HOLD","reason":reason},base=types.SimpleNamespace(sqlite3=sqlite3)),
        "_safe_apply_error_log":lambda route,exc:None}
 exec(compile(ast.Module(body=[handles[-1]],type_ignores=[]),"tag_cover_http.py","exec"),scope)
 class FakeHandler:
  path="/v2/admin/tag-cover/tag-apply"
  def __init__(self,error):self.error=error
  def index_admin(self):raise self.error
  def reply(self,status,body):return {"http":status,"body":body}
 import importlib.util
 spec=importlib.util.spec_from_file_location("catalog_lease",mounts["/app/catalog_lease.py"]["Source"])
 module=importlib.util.module_from_spec(spec);sys.modules["catalog_lease"]=module;spec.loader.exec_module(module)
 busy=scope["handle"](FakeHandler(module.LeaseBusy("catalog_lease_busy")),None,None,None)
 invalid=scope["handle"](FakeHandler(ValueError("invalid_save_request")),None,None,None)
 if busy["http"]!=409 or busy["body"]["reason"]!="catalog_lease_busy_retry_later":raise RuntimeError("HOLD busy_is_not_http409")
 if invalid["http"]!=400 or invalid["body"]["reason"]!="save_validation_or_file_conflict":raise RuntimeError("HOLD other_errors_changed")
 cases.extend(("leasebusy_maps_to_http409","non_lease_validation_stays_http400"))
 q=STAGE/"qualification"
 if q.exists():raise RuntimeError("HOLD qualification_already_exists")
 q.mkdir(mode=0o700)
 new=json.loads(json.dumps(old))
 new["hashes"].update(manifest["candidate_sha256"])
 new["scoped_patch"]={"state":"PASS","new_checks":cases,"prior_fullsave_evidence_reused":True,
  "prior_source_receipt_sha256":manifest["original_receipt_sha256"],
  "new_audio_tests_executed":0,"operating_media_writes":0,"operating_db_writes":0,
  "note":"Only server lease acquisition and handler error mapping changed; 13 earlier audio tests not rerun."}
 (q/"qualification.json").write_text(json.dumps(new,ensure_ascii=False,indent=2))
 (q/"qualification.json").chmod(0o600)
 print(json.dumps({"state":"SCOPED_LEASE_FIX_QUALIFIED_NOT_INSTALLED","new_cases":cases,
  "prior_audio_cases_reused":len(old.get("cases",[])),"operating_media_writes":0,"operating_db_writes":0,
  "qualification_file":str(q/"qualification.json")},ensure_ascii=False))
if __name__=="__main__":
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
