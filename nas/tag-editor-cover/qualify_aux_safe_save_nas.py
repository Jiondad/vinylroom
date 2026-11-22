#!/usr/bin/env python3
"""Qualify new two-file read-only Tag Editor patch in an isolated fixture Docker.

No production music, catalog, backup, or receipt mounts. No production service
restart. Existing qualification proof is READ ONLY and never overwritten.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

CONTAINER = "music-gateway-music-gateway-1"
BASE = Path("/volume1/docker/music-gateway")
STAGE = BASE / "tag-editor-aux-safe-save-stage-20261122"
REFERENCE = BASE / "VinylRoom_TagEditor_Native_FullSave_20261122"
CANDIDATE_NAMES = ("tag_phase2c.py","tag_cover_http.py","tag_cover_h.py","tag_rename_writer.py")
RECEIPT = "/tag-editor-backups/fullsave-native-qualified.json"
EIGHT = ("server.py","index_engine.py","catalog_lease.py","tag_cover_http.py",
         "tag_phase2c.py","tag_cover_h.py","tag_rename_writer.py","tag_native_index.py")
FLAGS = ("VINYL_TAG_EDITOR_FULL_TAG_WRITE_ENABLED",
         "VINYL_TAG_EDITOR_RENAME_WRITE_ENABLED",
         "VINYL_TAG_EDITOR_TRACK_WRITE_ENABLED",
         "VINYL_TAG_EDITOR_COVER_WRITE_ENABLED")


def run(args, input=None):
    p = subprocess.run(args, input=input, text=True, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE, check=False)
    if p.returncode:
        raise RuntimeError("HOLD command_failed " + args[0] + ": " + p.stderr[-1400:])
    return p.stdout


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def mount(src, dest, readonly=True):
    if not Path(src).exists():
        raise RuntimeError("HOLD mount_source_missing: " + dest)
    return ["--mount","type=bind,src="+str(src)+",dst="+dest+(",readonly" if readonly else "")]


def main():
    if os.geteuid()!=0:
        raise RuntimeError("HOLD root_required")
    manifest=json.loads((STAGE/"manifest.json").read_text())
    if manifest.get("state")!="AUX_SAFE_SAVE_STAGE_ONLY_NOT_INSTALLED" or manifest.get("production_changes")!=0 or set(manifest.get("module_names",[]))!=set(CANDIDATE_NAMES):
        raise RuntimeError("HOLD stage_manifest_state")
    for name in CANDIDATE_NAMES:
        expected=manifest["candidate_sha256"][name]
        if sha(STAGE/name)!=expected:
            raise RuntimeError("HOLD candidate_sha_mismatch: "+name)
        if not os.access(STAGE/name,os.R_OK) or STAGE.joinpath(name).stat().st_mode & 0o777 != 0o644:
            raise RuntimeError("HOLD candidate_permissions: "+name)

    info=json.loads(run(["docker","inspect",CONTAINER]))[0]
    if not info["State"]["Running"] or info["Config"]["User"]!="1026:100":
        raise RuntimeError("HOLD container_contract_changed")
    mounts={m["Destination"]:m for m in info["Mounts"]}
    old={}
    for name, expected in manifest["source_sha256"].items():
        m=mounts.get("/app/"+name)
        if not m or m.get("Type")!="bind" or m.get("RW") or sha(m["Source"])!=expected:
            raise RuntimeError("HOLD qualified_original_changed: "+name)
        old[name]=expected

    proof_script=(
        "import json,pathlib;"
        "p=pathlib.Path('"+RECEIPT+"');"
        "r=json.loads(p.read_text());"
        "print(json.dumps({'state':r.get('state'),'hashes':r.get('hashes',{})}))"
    )
    old_proof=json.loads(run(["docker","exec",CONTAINER,"python3","-c",proof_script]))
    if old_proof.get("state")!="PASS" or set(old_proof.get("hashes",{}))!=set(EIGHT):
        raise RuntimeError("HOLD operating_qualification_invalid")

    app_mounts={}
    for dest,m in mounts.items():
        if dest.startswith("/app/") and m.get("Type")=="bind":
            app_mounts[dest]=m["Source"]
    for name in EIGHT:
        dest="/app/"+name
        if dest not in app_mounts:
            raise RuntimeError("HOLD missing_qualified_module: "+name)
        if sha(app_mounts[dest])!=old_proof["hashes"][name]:
            raise RuntimeError("HOLD operating_qualified_module_mismatch: "+name)

    for name in CANDIDATE_NAMES:
        app_mounts["/app/"+name]=str(STAGE/name)
    expected_new={name:sha(app_mounts["/app/"+name]) for name in EIGHT}

    for fname in ("qualify_native_fullsave.py","fixture-audio/test.flac","fixture-audio/test.mp3"):
        if not (REFERENCE/fname).is_file():
            raise RuntimeError("HOLD missing_fixture: "+fname)

    q=STAGE/"qualification"
    if q.exists():
        raise RuntimeError("HOLD qualification_directory_already_exists")
    q.mkdir(mode=0o700)
    os.chown(q,1026,100)

    cmd=["docker","run","--rm","--network","none","--read-only",
         "--user","1026:100","--cap-drop","ALL","--security-opt","no-new-privileges",
         "--tmpfs","/tmp:rw,noexec,nosuid,size=128m","--entrypoint","python3"]
    for dest,src in sorted(app_mounts.items()):
        cmd+=mount(src,dest)
    cmd+=mount(REFERENCE/"fixture-audio","/fixture-source")
    cmd+=mount(REFERENCE/"qualify_native_fullsave.py","/qualification.py")
    cmd+=mount(q,"/qualification-data",False)
    for name in FLAGS:
        cmd+=["-e",name+"=true"]
    cmd += [info["Image"],"/qualification.py"]
    print("START: ISOLATED_FULL_SAVE_REQUALIFICATION",flush=True)
    print(run(cmd).strip(),flush=True)

    result=json.loads((q/"qualification.json").read_text())
    if result.get("state")!="PASS" or result.get("hashes")!=expected_new or len(result.get("native_job_ids",[]))!=2:
        raise RuntimeError("HOLD fixture_qualification_proof_mismatch")
    if result.get("operating_media_writes")!=0 or result.get("operating_db_writes")!=0:
        raise RuntimeError("HOLD unexpected_production_writes")
    # Verify current production qualifications remained unchanged.
    after=json.loads(run(["docker","exec",CONTAINER,"python3","-c",proof_script]))
    if after!=old_proof:
        raise RuntimeError("HOLD live_receipt_changed")
    for name,digest in old.items():
        if sha(mounts["/app/"+name]["Source"])!=digest:
            raise RuntimeError("HOLD live_module_changed")
    print(json.dumps({
        "state":"ISOLATED_REQUALIFICATION_PASS_NOT_INSTALLED",
        "cases":len(result["cases"]),
        "native_jobs":len(result["native_job_ids"]),
        "new_proof_file":str(q/"qualification.json"),
        "original_receipt_unchanged":True,
        "production_changes":0
    },ensure_ascii=False))


if __name__=="__main__":
    try:
        main()
    except (OSError,ValueError,KeyError,RuntimeError) as exc:
        print("HOLD:",str(exc),file=sys.stderr)
        sys.exit(1)
