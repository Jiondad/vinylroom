#!/usr/bin/env python3
"""Stage ancillary-safe save-path upgrade from current qualified NAS sources.

Only a fresh NEW staging directory is written; no service/receipt/media/catalog
writes. Anchors, active read-only mounts and current qualification hashes all
must match. Do not run against an already-staged source or overlay.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

CONTAINER="music-gateway-music-gateway-1"
NAMES=("tag_phase2c.py","tag_cover_http.py","tag_cover_h.py","tag_rename_writer.py")
BASE=Path("/volume1/docker/music-gateway")


def cmd(argv):
    p=subprocess.run(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if p.returncode:raise RuntimeError("HOLD: subprocess_failure:"+p.stderr[-900:])
    return p.stdout

def digest(blob):
    return hashlib.sha256(blob).hexdigest()

def replace_exact(source,old,new,description,expected=1):
    actual=source.count(old)
    if actual!=expected:raise RuntimeError("HOLD: source_anchor_changed:"+description+":"+str(actual))
    return source.replace(old,new)

def modify(name,source):
    if name=="tag_phase2c.py":
        return replace_exact(source,
            "def track_write_preflight(catalog,music_root,backup_root,album_id,target_file,edits,expected_plan_id):\n    album,entries,issues=inventory(catalog,music_root,album_id)",
            "def track_write_preflight(catalog,music_root,backup_root,album_id,target_file,edits,expected_plan_id):\n    # Same bounded non-audio disc ancillary check as the read/plan route; fail closed.\n    album,entries,issues=inventory(catalog,music_root,album_id,allow_auxiliary_disc_dirs=True)",
            "track_write_preflight")
    if name=="tag_cover_http.py":
        return replace_exact(source,
            "    album,entries,issues=cover.base.inventory(catalog,music_root,album_id)",
            "    album,entries,issues=cover.base.inventory(catalog,music_root,album_id,allow_auxiliary_disc_dirs=True)",
            "cover_inspect_and_tag_plan",2)
    if name=="tag_cover_h.py":
        return replace_exact(source,
            "        album,entries,issues=base.inventory(catalog,music_root,album_id)",
            "        album,entries,issues=base.inventory(catalog,music_root,album_id,allow_auxiliary_disc_dirs=True)",
            "cover_plan")
    if name=="tag_rename_writer.py":
        return replace_exact(source,
            "        album,entries,issues=base.inventory(catalog,music_root,album_id)",
            "        album,entries,issues=base.inventory(catalog,music_root,album_id,allow_auxiliary_disc_dirs=True)",
            "rename_plan")
    raise RuntimeError("HOLD: unknown_module")

def main():
    a=argparse.ArgumentParser()
    a.add_argument("--stage",required=True)
    opts=a.parse_args()
    if os.geteuid()!=0:raise RuntimeError("HOLD: root_required")
    stage=Path(opts.stage).absolute()
    if stage.parent!=BASE:raise RuntimeError("HOLD: stage_parent_unexpected")
    if stage.exists():raise RuntimeError("HOLD: stage_already_exists")
    info=json.loads(cmd(["docker","inspect",CONTAINER]))[0]
    if not info["State"]["Running"] or info["Config"]["User"]!="1026:100":
        raise RuntimeError("HOLD: running_container_contract_changed")
    mounts={m["Destination"]:m for m in info["Mounts"]}
    proof_code=("import json,pathlib;"
        "r=json.loads(pathlib.Path('/tag-editor-backups/fullsave-native-qualified.json').read_text());"
        "print(json.dumps({'schema':r.get('schema'),'state':r.get('state'),'hashes':r.get('hashes',{})}))")
    proof=json.loads(cmd(["docker","exec",CONTAINER,"python3","-c",proof_code]))
    if proof.get("schema")!="fullsave-native-qualification-v1" or proof.get("state")!="PASS":
        raise RuntimeError("HOLD: prior_qualification_unavailable")
    original={};updated={}
    for name in NAMES:
        mount=mounts.get("/app/"+name)
        if not mount or mount["Type"]!="bind" or mount["RW"]:
            raise RuntimeError("HOLD: qualified_bind_changed:"+name)
        path=Path(mount["Source"])
        old=path.read_bytes()
        if digest(old)!=proof["hashes"].get(name):
            raise RuntimeError("HOLD: prior_qualification_sha_mismatch:"+name)
        edited=modify(name,old.decode("utf-8"))
        compile(edited,name,"exec")
        original[name]=digest(old);updated[name]=edited.encode("utf-8")
    stage.mkdir(mode=0o755)
    for name in NAMES:
        dest=stage/name
        with dest.open("xb") as f:
            f.write(updated[name]);f.flush();os.fsync(f.fileno())
        dest.chmod(0o644)
    manifest={
        "state":"AUX_SAFE_SAVE_STAGE_ONLY_NOT_INSTALLED",
        "source_sha256":original,
        "candidate_sha256":{n:digest(updated[n]) for n in NAMES},
        "module_names":list(NAMES),
        "production_changes":0,
        "notes":"New staged files only. Requires isolated NAS SHA requalification and coordinated receipt/bind upgrade."
    }
    f=stage/"manifest.json"
    f.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    f.chmod(0o600)
    print(json.dumps(manifest,ensure_ascii=False,indent=2))

if __name__=="__main__":
    try:main()
    except (OSError,ValueError,KeyError,RuntimeError) as e:
        print(str(e),file=sys.stderr)
        sys.exit(1)
