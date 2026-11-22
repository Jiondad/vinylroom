#!/usr/bin/env python3
"""Stage only the authenticated Tag Editor HTTP400 diagnostics source.

Current receipt must match all eight running modules; no production write.
"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
BASE=Path("/volume1/docker/music-gateway")
STAGE=BASE/"tag-editor-http400-stage-20261122"
CONTAINER="music-gateway-music-gateway-1"
NAME="tag_cover_http.py"
EIGHT=("server.py","index_engine.py","catalog_lease.py","tag_cover_http.py","tag_phase2c.py","tag_cover_h.py","tag_rename_writer.py","tag_native_index.py")
ANCHOR="    except (ValueError,TypeError,KeyError,OSError,cover.base.sqlite3.Error):return h.reply(400,cover.hold('save_validation_or_file_conflict'))"
HELPER='''def _safe_apply_error_log(route, exc):
    """Record only safe exception metadata. No auth token, path or user payload."""
    import sys
    import traceback
    try:
        frames=traceback.extract_tb(exc.__traceback__)
        frame=frames[-1] if frames else None
        payload={
            'event':'TAG_EDITOR_APPLY_HTTP_ERROR',
            'route':route if route in _SAVE_ROUTES else 'unknown',
            'exception_type':type(exc).__name__,
            'errno':getattr(exc,'errno',None),
            'source':Path(frame.filename).name if frame else 'unknown',
            'function':frame.name if frame else 'unknown',
            'line':frame.lineno if frame else 0,
            'message_sha256':hashlib.sha256(str(exc).encode('utf-8','replace')).hexdigest()[:16],
        }
        print(json.dumps(payload,ensure_ascii=False,sort_keys=True),file=sys.stderr,flush=True)
    except Exception:
        pass


'''
REPLACEMENT="    except (ValueError,TypeError,KeyError,OSError,cover.base.sqlite3.Error) as exc:\n        _safe_apply_error_log(route,exc)\n        return h.reply(400,cover.hold('save_validation_or_file_conflict'))"
def run(args):
 p=subprocess.run(args,text=True,capture_output=True)
 if p.returncode:raise RuntimeError("HOLD command_failed:"+p.stderr[-800:])
 return p.stdout
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 if os.geteuid()!=0:raise RuntimeError("HOLD root_required")
 if STAGE.exists():raise RuntimeError("HOLD stage_exists_do_not_overwrite")
 info=json.loads(run(["docker","inspect",CONTAINER]))[0]
 if not info["State"]["Running"] or info["Config"]["User"]!="1026:100":raise RuntimeError("HOLD live_container_contract")
 mounts={m["Destination"]:m for m in info["Mounts"]}
 proof=json.loads(run(["docker","exec",CONTAINER,"python3","-c",
    "import json,pathlib;print(json.dumps(json.loads(pathlib.Path('/tag-editor-backups/fullsave-native-qualified.json').read_text())))"]))
 if proof.get("schema")!="fullsave-native-qualification-v1" or proof.get("state")!="PASS" or set(proof.get("hashes",{}))!=set(EIGHT):raise RuntimeError("HOLD original_receipt_invalid")
 for name in EIGHT:
  m=mounts.get("/app/"+name)
  if not m or m.get("Type")!="bind" or m.get("RW"):raise RuntimeError("HOLD source_mount_invalid:"+name)
  if sha(Path(m["Source"]).read_bytes())!=proof["hashes"][name]:raise RuntimeError("HOLD original_sha_mismatch:"+name)
 source=Path(mounts["/app/"+NAME]["Source"]).read_text()
 if source.count(ANCHOR)!=1 or source.count("def handle(h,index,music_root,origin,post=False):")!=2 or "def _safe_apply_error_log(route, exc):" in source:
  raise RuntimeError("HOLD diagnostic_patch_anchor_mismatch")
 p=source.rfind("def handle(h,index,music_root,origin,post=False):")
 updated=(source[:p]+HELPER+source[p:]).replace(ANCHOR,REPLACEMENT)
 compile(updated,NAME,"exec")
 STAGE.mkdir(mode=0o755)
 dest=STAGE/NAME
 dest.write_text(updated);dest.chmod(0o644)
 manifest={"state":"APPLY400_DIAGNOSTIC_STAGE_ONLY_NOT_INSTALLED",
   "module_names":[NAME],"source_sha256":{NAME:proof["hashes"][NAME]},
   "candidate_sha256":{NAME:sha(updated.encode())},"production_changes":0}
 (STAGE/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 (STAGE/"manifest.json").chmod(0o600)
 print(json.dumps(manifest,ensure_ascii=False))
if __name__=="__main__":
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
