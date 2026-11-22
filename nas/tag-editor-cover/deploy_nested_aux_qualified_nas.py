#!/usr/bin/env python3
"""Guarded deployment of a requalified *two-file* Tag Editor read-only patch.

PREVIEW does no operational writes. APPLY explicitly recreates only the existing
music gateway service and atomically exchanges its validated qualification
receipt; automatic rollback restores both the original compose chain + receipt
if a deployment/health/capability check fails.

No direct production music or catalog writes. The preflight mode is read-only.\nThis is an operator-triggered
maintenance operation and NOT a general installer or qualification bypass.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import time
import urllib.request

BASE=Path("/volume1/docker/music-gateway")
STAGE=BASE/"tag-editor-nested-aux-stage-20261122"
CONTAINER="music-gateway-music-gateway-1"
NAMES=("tag_phase2c.py","tag_cover_http.py")
EIGHT=("server.py","index_engine.py","catalog_lease.py","tag_cover_http.py",
       "tag_phase2c.py","tag_cover_h.py","tag_rename_writer.py","tag_native_index.py")
EXPECTED_NEW={
 "tag_phase2c.py":"e09c2cc41faef459a2aea995ab0e090578c01c0e9310d23424f7d7e4f431c317",
 "tag_cover_http.py":"f5f5bf4ef6586b8cccde315e0fed5307437a8604f44cf01c26d71713c2931065",
}
PROOF_NAME="fullsave-native-qualified.json"
OVERLAY=STAGE/"compose.nested-aux-qualified.json"
BACKUP=STAGE/"original-qualified-receipt.json"
STATE=STAGE/"upgrade-state.json"


def hold(message):
    raise RuntimeError("HOLD "+message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def command(args):
    p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if p.returncode:hold("command_failed:"+args[0]+":"+p.stderr[-900:])
    return p.stdout

def inspect():
    info=json.loads(command(["docker","inspect",CONTAINER]))[0]
    if not info["State"]["Running"] or info["Config"]["User"]!="1026:100" or not info["HostConfig"]["ReadonlyRootfs"]:
        hold("unexpected_container_contract")
    mounts={m["Destination"]:m for m in info["Mounts"]}
    labels=info["Config"]["Labels"]
    chain=labels["com.docker.compose.project.config_files"].split(",")
    project=labels["com.docker.compose.project"]
    service=labels["com.docker.compose.service"]
    if not chain or not chain[-1].endswith("compose.fullsave-native.json"):
        hold("expected_existing_fullsave_overlay_missing")
    if len(chain)!=9 or len(set(chain))!=9:hold("unexpected_compose_chain_length")
    if mounts.get("/tag-editor-backups",{}).get("Type")!="bind":hold("qualification_backup_mount_not_bind")
    for name in EIGHT:
        m=mounts.get("/app/"+name)
        if not m or m.get("Type")!="bind" or m.get("RW"):
            hold("qualified_module_mount_changed:"+name)
    return info,mounts,chain,project,service

def compose_command(chain,project):
    cmd=["docker","compose","-p",project]
    for path in chain:cmd.extend(("-f",path))
    return cmd

def load_proof(mounts,chain):
    root=Path(mounts["/tag-editor-backups"]["Source"])
    proof=root/PROOF_NAME
    if root.is_symlink() or proof.is_symlink() or not proof.is_file():
        hold("qualification_receipt_not_regular")
    if root.stat().st_uid!=1026 or stat.S_IMODE(root.stat().st_mode)!=0o700:
        hold("qualification_folder_owner_or_mode")
    if proof.stat().st_uid!=1026 or stat.S_IMODE(proof.stat().st_mode)!=0o600:
        hold("qualification_receipt_owner_or_mode")
    raw=proof.read_bytes()
    existing=json.loads(raw)
    if existing.get("schema")!="fullsave-native-qualification-v1" or existing.get("state")!="PASS" or set(existing.get("hashes",{}))!=set(EIGHT):
        hold("original_qualification_not_pass")
    return root,proof,raw,existing

def check_target(info,mounts,chain,project,service):
    stage=json.loads((STAGE/"manifest.json").read_text())
    if stage.get("state")!="NESTED_AUX_STAGE_ONLY_NOT_INSTALLED":hold("bad_stage_state")
    new=json.loads((STAGE/"qualification"/"qualification.json").read_text())
    if new.get("schema")!="fullsave-native-qualification-v1" or new.get("state")!="PASS":
        hold("missing_new_fixture_proof")
    if len(new.get("cases",[]))!=13 or len(new.get("native_job_ids",[]))!=2 or new.get("operating_media_writes")!=0 or new.get("operating_db_writes")!=0:
        hold("new_fixture_proof_incomplete")
    root,proof,raw,original=load_proof(mounts,chain)
    for name in EIGHT:
        m=mounts["/app/"+name]
        digest=sha(Path(m["Source"]).read_bytes())
        if digest!=original["hashes"][name]:hold("live_source_receipt_mismatch:"+name)
        expected_new=EXPECTED_NEW.get(name,digest)
        if new["hashes"].get(name)!=expected_new:hold("new_proof_source_mismatch:"+name)
    for name in NAMES:
        file=STAGE/name
        if sha(file.read_bytes())!=EXPECTED_NEW[name]:hold("staged_candidate_mismatch:"+name)
        if stat.S_IMODE(file.stat().st_mode)!=0o644:hold("staged_candidate_permission_mismatch:"+name)
    # Preserve every existing service setting and all but two source paths.
    before=json.loads(command(compose_command(chain,project)+["config","--format","json"]))
    if service not in before["services"]:hold("service_missing_from_compose")
    old_mounts={v["target"]:v for v in before["services"][service].get("volumes",[])}
    for name in NAMES:
        if old_mounts.get("/app/"+name,{}).get("source")!=mounts["/app/"+name]["Source"]:
            hold("compose_bind_mount_mismatch:"+name)
    change={"services":{service:{"volumes":[{"type":"bind","source":str(STAGE/name),
          "target":"/app/"+name,"read_only":True} for name in NAMES]}}}
    # Verify a temporary overlay's merged compose model without writing to stage.
    with tempfile.TemporaryDirectory(prefix="nested-aux-compose-") as tmp:
        temp=Path(tmp)/"overlay.json"
        temp.write_text(json.dumps(change))
        after=json.loads(command(compose_command(chain+[str(temp)],project)+["config","--format","json"]))
    if set(before["services"])!=set(after["services"]):hold("compose_services_changed")
    for n in before["services"]:
        lhs=before["services"][n];rhs=after["services"][n]
        if n!=service:
            if lhs!=rhs:hold("other_service_compose_changed:"+n)
            continue
        la=dict(lhs);ra=dict(rhs)
        lm={v["target"]:v for v in la.pop("volumes",[])}
        rm={v["target"]:v for v in ra.pop("volumes",[])}
        if la!=ra or set(lm)!=set(rm):hold("other_service_setting_or_mount_changed")
        for target in lm:
            if target not in {"/app/"+k for k in NAMES}:
                if lm[target]!=rm[target]:hold("unrelated_mount_changed:"+target)
            else:
                oldv=dict(lm[target]);newv=dict(rm[target])
                oldv.pop("source");newv.pop("source")
                if oldv!=newv or rm[target]["source"]!=str(STAGE/target.split("/")[-1]):
                    hold("candidate_mount_not_only_change:"+target)
    return root,proof,raw,new,change


def idle_check():
    # Exact pre-existing service lease, read-only; fail-closed on any uncertainty.
    code="""import os,sqlite3,json,fcntl,pathlib
p=pathlib.Path(os.environ.get('INDEX_DATA_PATH','/data')).resolve()
assert p==pathlib.Path('/data') or pathlib.Path('/data') in p.parents,'data_mount_changed'
fd=os.open(str(p/'catalog-whole-job.lock'),os.O_RDONLY|os.O_NOFOLLOW)
try:
 fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 db=sqlite3.connect('file:'+str(p/'catalog.sqlite3')+'?mode=ro',uri=True)
 try:
  assert not any(json.loads(r[0]).get('state') in ('queued','running') for r in db.execute('SELECT data FROM jobs ORDER BY rowid DESC LIMIT 500')),'index_job_pending'
 finally:db.close()
finally:os.close(fd)
print('MAINTENANCE_IDLE_OBSERVED')"""
    if "MAINTENANCE_IDLE_OBSERVED" not in command(["docker","exec",CONTAINER,"python3","-c",code]):
        hold("maintenance_not_idle")

def atomic_receipt(root,target,content):
    # Always create a new 1026-owned 0600 file in the *same* directory and replace.
    fd,name=tempfile.mkstemp(prefix=".qualified-switch-",dir=str(root))
    try:
        with os.fdopen(fd,"wb") as f:
            f.write(content);f.flush();os.fsync(f.fileno())
        os.chown(name,1026,100)
        os.chmod(name,0o600)
        os.replace(name,target)
        dirfd=os.open(str(root),os.O_RDONLY|os.O_DIRECTORY)
        try:os.fsync(dirfd)
        finally:os.close(dirfd)
    finally:
        if os.path.exists(name):os.unlink(name)

def check_health_capability():
    for attempt in range(20):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8787/health",timeout=3) as r:
                if r.status==200:break
        except (OSError,TimeoutError):pass
        time.sleep(1)
    else:hold("health_not_200")
    # Verify actual server-side qualification, not a network-authenticated API.
    code="""import json,tag_cover_http as h
from pathlib import Path
p=Path('/tag-editor-backups')
proof=h._fullsave_receipt(p)
caps=h.save_capabilities()
print(json.dumps({'receipt':bool(proof),'full_tags':bool(proof and proof.get('state')=='PASS'),'live_tags':caps.get('live_tags')}))"""
    status=json.loads(command(["docker","exec",CONTAINER,"python3","-c",code]))
    if not status.get("full_tags") or not status.get("live_tags"):
        hold("new_receipt_not_accepted_by_runtime")
    return status

def write_state(payload):
    if STATE.exists():hold("upgrade_state_already_exists")
    with STATE.open("x") as f:
        json.dump(payload,f,indent=2);f.flush();os.fsync(f.fileno())
    STATE.chmod(0o600)

def do_apply():
    if os.geteuid()!=0:hold("root_required")
    if STATE.exists() or BACKUP.exists() or OVERLAY.exists():
        hold("upgrade_already_attempted_do_not_repeat")
    info,mounts,chain,project,service=inspect()
    root,receipt,original,new,overlay=check_target(info,mounts,chain,project,service)
    idle_check()
    # The backup is an owner-only copy and not an attempt to rewrite old qualification.
    with BACKUP.open("xb") as f:
        f.write(original);f.flush();os.fsync(f.fileno())
    BACKUP.chmod(0o600)
    OVERLAY.write_text(json.dumps(overlay,indent=2))
    OVERLAY.chmod(0o600)
    state={"state":"SWITCH_STARTED","old_compose":chain,"project":project,
           "service":service,"old_proof_sha":sha(original),
           "new_proof_sha":sha(json.dumps(new,indent=2).encode()),
           "old_sources":{n:mounts["/app/"+n]["Source"] for n in NAMES}}
    write_state(state)
    original_cmd=compose_command(chain,project)
    new_cmd=compose_command(chain+[str(OVERLAY)],project)
    try:
        # Stop before switching the receipt so no old service serves a mismatched proof.
        command(original_cmd+["stop",service])
        atomic_receipt(root,receipt,json.dumps(new,indent=2).encode())
        command(new_cmd+["up","-d","--no-deps","--force-recreate",service])
        status=check_health_capability()
        state["state"]="PATCH_APPLIED_ADMIN_API_VERIFICATION_PENDING"
        state["runtime_qualification"]=status
        STATE.write_text(json.dumps(state,indent=2))
        print(json.dumps({"state":state["state"],"health":200,
                          "source_hashes_verified":True,
                          "new_runtime_receipt_accepted":True,
                          "media_writes":0,"db_writes":0},ensure_ascii=False))
    except Exception as exc:
        print("DEPLOY_FAILED_ROLLBACK_START:",str(exc),file=sys.stderr,flush=True)
        try:
            # Restore original proof and source mounts as a pair; fail loudly if unable.
            command(new_cmd+["stop",service])
            atomic_receipt(root,receipt,original)
            command(original_cmd+["up","-d","--no-deps","--force-recreate",service])
            check_health_capability()
            state["state"]="ROLLBACK_PASS_OLD_QUALIFIED_SERVICE"
            STATE.write_text(json.dumps(state,indent=2))
            print("ROLLBACK_PASS_OLD_QUALIFIED_SERVICE",file=sys.stderr)
        except Exception as rollback_error:
            state["state"]="CRITICAL_ROLLBACK_FAILED_MANUAL_INTERVENTION"
            state["rollback_error"]=str(rollback_error)
            STATE.write_text(json.dumps(state,indent=2))
            print("CRITICAL_ROLLBACK_FAILED:",str(rollback_error),file=sys.stderr)
        raise

def preflight():
    info,mounts,chain,project,service=inspect()
    _,_,_,new,_=check_target(info,mounts,chain,project,service)
    if STATE.exists() or OVERLAY.exists() or BACKUP.exists():
        hold("upgrade_state_exists")
    print(json.dumps({"state":"NAS_QUALIFIED_SWITCH_PREFLIGHT_PASS_NOT_INSTALLED",
                      "fixture_cases":len(new["cases"]),"old_receipt_untouched":True,
                      "service":service,"new_modules":list(NAMES),
                      "production_changes":0},ensure_ascii=False))


if __name__=="__main__":
    args=argparse.ArgumentParser()
    args.add_argument("mode",choices=("preflight","apply"))
    args.add_argument("--confirm-maintenance-idle",action="store_true")
    a=args.parse_args()
    try:
        if a.mode=="preflight":preflight()
        else:
            if not a.confirm_maintenance_idle:hold("explicit_maintenance_confirmation_required")
            do_apply()
    except Exception as e:
        print(str(e),file=sys.stderr);sys.exit(1)
