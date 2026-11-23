#!/usr/bin/env python3
"""Stage exactly two Tag Editor lease handling modules from current qualified mounts.
No running container / catalog / audio / receipt mutations.
"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
BASE=Path("/volume1/docker/music-gateway")
STAGE=BASE/"tag-editor-leasebusy-409-stage-20261123"
CONTAINER="music-gateway-music-gateway-1"
NAMES=("server.py","tag_cover_http.py")
EIGHT=("server.py","index_engine.py","catalog_lease.py","tag_cover_http.py","tag_phase2c.py","tag_cover_h.py","tag_rename_writer.py","tag_native_index.py")
BEFORE_GUARD="runtime_guard=lambda: _vr_catalog_lease(INDEX.dbpath).acquire(blocking=False)"
AFTER_GUARD="runtime_guard=lambda: _vr_catalog_lease(INDEX.dbpath).acquire(blocking=True, timeout=5)"
BEFORE_CATCH="        _safe_apply_error_log(route,exc)\n        return h.reply(400,cover.hold('save_validation_or_file_conflict'))"
AFTER_CATCH="""        from catalog_lease import LeaseBusy
        if isinstance(exc,LeaseBusy):
            return h.reply(409,cover.hold('catalog_lease_busy_retry_later'))
        _safe_apply_error_log(route,exc)
        return h.reply(400,cover.hold('save_validation_or_file_conflict'))"""
def command(args):
 p=subprocess.run(args,text=True,capture_output=True)
 if p.returncode:raise RuntimeError("HOLD "+args[0]+" "+p.stderr[-800:])
 return p.stdout
def hashbytes(b):return hashlib.sha256(b).hexdigest()
def replace_once(text,old,new,name):
 if text.count(old)!=1:raise RuntimeError("HOLD patch_anchor:"+name)
 return text.replace(old,new)
def main():
 if os.geteuid()!=0 or STAGE.exists():raise RuntimeError("HOLD root_required_or_stage_exists")
 info=json.loads(command(["docker","inspect",CONTAINER]))[0]
 if not info["State"]["Running"] or info["Config"]["User"]!="1026:100":raise RuntimeError("HOLD container_contract")
 mounts={m["Destination"]:m for m in info["Mounts"]}
 receipt_root=Path(mounts["/tag-editor-backups"]["Source"])
 proof=json.loads((receipt_root/"fullsave-native-qualified.json").read_text())
 if proof.get("schema")!="fullsave-native-qualification-v1" or proof.get("state")!="PASS" or set(proof.get("hashes",{}))!=set(EIGHT):
  raise RuntimeError("HOLD live_receipt_invalid")
 sources={}
 for name in EIGHT:
  m=mounts.get("/app/"+name)
  if not m or m.get("Type")!="bind" or m.get("RW"):
   raise RuntimeError("HOLD module_mount:"+name)
  raw=Path(m["Source"]).read_bytes()
  if hashbytes(raw)!=proof["hashes"][name]:raise RuntimeError("HOLD live_hash:"+name)
  sources[name]=raw
 server=sources["server.py"].decode()
 handler=sources["tag_cover_http.py"].decode()
 if "def _safe_apply_error_log(route, exc)" not in handler:raise RuntimeError("HOLD no_installed_diagnostic")
 if "class LeaseBusy(ValueError)" not in sources["catalog_lease.py"].decode():raise RuntimeError("HOLD lease_contract_changed")
 updated={
  "server.py":replace_once(server,BEFORE_GUARD,AFTER_GUARD,"server_guard"),
  "tag_cover_http.py":replace_once(handler,BEFORE_CATCH,AFTER_CATCH,"handler_409")
 }
 for name,content in updated.items():compile(content,name,"exec")
 STAGE.mkdir(mode=0o755)
 for name,content in updated.items():
  p=STAGE/name
  p.write_text(content);p.chmod(0o644)
 manifest={"state":"LEASEBUSY_409_STAGE_ONLY_NOT_INSTALLED","module_names":list(NAMES),
  "source_sha256":{n:proof["hashes"][n] for n in NAMES},
  "candidate_sha256":{n:hashbytes(updated[n].encode()) for n in NAMES},
  "original_receipt_sha256":hashbytes((receipt_root/"fullsave-native-qualified.json").read_bytes()),
  "production_changes":0}
 (STAGE/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 (STAGE/"manifest.json").chmod(0o600)
 print(json.dumps(manifest,ensure_ascii=False))
if __name__=="__main__":
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
