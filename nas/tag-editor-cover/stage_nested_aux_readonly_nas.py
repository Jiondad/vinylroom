#!/usr/bin/env python3
"""Stage the verified nested-aux READ-ONLY fix without touching operational files.

Reads the two active Docker bind sources and the existing immutable receipt.
Writes a NEW, distinct staging directory. Existing qualified source SHA checks happen before any stage is created.\nDoes not change Compose, receipts,
backup, original candidates, catalog, music or the running container.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

CONTAINER = "music-gateway-music-gateway-1"
MODULES = ("tag_phase2c.py", "tag_cover_http.py")
EXPECTED_DIR = Path("/volume1/docker/music-gateway/tag-editor-fullsave-native-20261122/candidate")


def command(*args):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def replace_once(source, old, new, label):
    if source.count(old) != 1:
        raise ValueError("HOLD: source anchor mismatch at " + label)
    return source.replace(old, new, 1)


HELPER = '''def _auxiliary_tree_issue(root,folder):
    """Bounded read-only check: ignore a disc subfolder ONLY if it has no audio.
    Links, inaccessible entries and unusual filesystem objects stay HOLD.
    """
    pending=[(folder,0)]
    visited=0
    while pending:
        directory,depth=pending.pop()
        if depth>8:return {'code':'nested_directory_inspection_limit','path':folder.relative_to(root).as_posix()}
        try:
            children=directory.iterdir()
            for entry in children:
                visited+=1
                if visited>2000:return {'code':'nested_directory_inspection_limit','path':folder.relative_to(root).as_posix()}
                if entry.is_symlink():return {'code':'nested_directory_symlink','path':entry.relative_to(root).as_posix()}
                if entry.is_dir():
                    pending.append((entry,depth+1))
                elif entry.is_file():
                    if entry.suffix.lower() in AUDIO_EXT:
                        return {'code':'nested_directory_contains_audio','path':entry.relative_to(root).as_posix()}
                else:return {'code':'nested_directory_special_file','path':entry.relative_to(root).as_posix()}
        except OSError:return {'code':'nested_directory_unreadable','path':directory.relative_to(root).as_posix()}
    return None


'''


def patch_tags(source):
    source = replace_once(source,
        "def discover_files(root,folder):\n    files=[];issues=[]",
        HELPER + "def discover_files(root,folder,allow_auxiliary_disc_dirs=False):\n    files=[];issues=[]",
        "discover_files")
    source = replace_once(source,
        "            elif p.is_dir():\n                issues.append({'code':'nested_directory_below_disc','path':p.relative_to(root).as_posix()})",
        "            elif p.is_dir():\n                if allow_auxiliary_disc_dirs:\n                    issue=_auxiliary_tree_issue(root,p)\n                    if issue:issues.append(issue)\n                else:\n                    issues.append({'code':'nested_directory_below_disc','path':p.relative_to(root).as_posix()})",
        "disc children")
    source = replace_once(source,
        "def inventory(dbpath,rootpath,album_id):\n    row,data=album_record(dbpath,album_id)\n    root,folder=valid_album_folder(rootpath,row['path'])\n    paths,issues=discover_files(root,folder)",
        "def inventory(dbpath,rootpath,album_id,allow_auxiliary_disc_dirs=False):\n    row,data=album_record(dbpath,album_id)\n    root,folder=valid_album_folder(rootpath,row['path'])\n    paths,issues=discover_files(root,folder,allow_auxiliary_disc_dirs)",
        "inventory")
    return source


def patch_http(source):
    return replace_once(source,
        "def read_album_tags(catalog,music_root,album_id):\n    album,entries,issues=cover.base.inventory(catalog,music_root,album_id)",
        "def read_album_tags(catalog,music_root,album_id):\n    # Only tag viewing ignores fully inspected non-audio ancillary disc folders.\n    # Writer inventory remains strict by default.\n    album,entries,issues=cover.base.inventory(catalog,music_root,album_id,allow_auxiliary_disc_dirs=True)",
        "read_album_tags")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", required=True)
    args = parser.parse_args()
    stage = Path(args.stage).absolute()
    if os.geteuid() != 0:
        raise ValueError("HOLD: root_required")
    if stage.exists():
        raise ValueError("HOLD: staging_directory_already_exists")
    d = json.loads(command("docker", "inspect", CONTAINER))[0]
    if not d["State"]["Running"]:
        raise ValueError("HOLD: container_not_running")
    mounts = {m["Destination"]:m for m in d["Mounts"]}
    source_paths = {}
    for name in MODULES:
        m = mounts.get("/app/" + name)
        if not m or m.get("Type") != "bind" or m.get("RW"):
            raise ValueError("HOLD: active_readonly_mount_changed:" + name)
        p = Path(m["Source"])
        if p != EXPECTED_DIR / name or not p.is_file():
            raise ValueError("HOLD: unexpected_active_source:" + name)
        source_paths[name] = p
    receipt_code = (
        "import json,pathlib;"
        "p=pathlib.Path('/tag-editor-backups/fullsave-native-qualified.json');"
        "r=json.loads(p.read_text());"
        "print(json.dumps({'state':r.get('state'),'hashes':{k:r.get('hashes',{}).get(k) for k in ('tag_phase2c.py','tag_cover_http.py')}}))"
    )
    receipt = json.loads(command("docker", "exec", CONTAINER, "python3", "-c", receipt_code))
    if receipt["state"] != "PASS":
        raise ValueError("HOLD: qualification_receipt_not_pass")
    original, updated = {}, {}
    for name in MODULES:
        data = source_paths[name].read_bytes()
        if digest(data) != receipt["hashes"].get(name):
            raise ValueError("HOLD: current_source_not_qualified:" + name)
        original[name] = data
        current = data.decode("utf-8")
        edited = patch_tags(current) if name == "tag_phase2c.py" else patch_http(current)
        compile(edited, name, "exec")
        updated[name] = edited.encode("utf-8")
    if not str(stage).startswith("/volume1/docker/music-gateway/"):
        raise ValueError("HOLD: staging_path_outside_music_gateway")
    stage.mkdir(mode=0o700, parents=False)
    for name in MODULES:
        file = stage / name
        with file.open("xb") as f:
            f.write(updated[name])
            f.flush()
            os.fsync(f.fileno())
        file.chmod(0o600)
    manifest = {
        "state":"NESTED_AUX_STAGE_ONLY_NOT_INSTALLED",
        "original_sha256":{name:digest(original[name]) for name in MODULES},
        "candidate_sha256":{name:digest(updated[name]) for name in MODULES},
        "candidate_files":list(MODULES),
        "production_changes":0,
        "note":"No Compose, receipt, music, DB, or active source changes. Requalification required before any switch."
    }
    mf = stage / "manifest.json"
    mf.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    mf.chmod(0o600)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print("HOLD:",str(exc),file=sys.stderr)
        sys.exit(1)
