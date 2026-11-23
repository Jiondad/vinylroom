#!/usr/bin/env python3
"""Narrow NAS source update for Tag Editor cover-apply busy queue.

Input: /tmp/tag_cover_http.py downloaded from the approved Vinyl Room main branch.
Only the bind-mounted /app/tag_cover_http.py source is changed. No media or DB writes.
"""
import ast, hashlib, json, os, shutil, subprocess, tempfile, time, uuid
from pathlib import Path

CONTAINER = "music-gateway-music-gateway-1"
SOURCE = Path("/tmp/tag_cover_http.py")
BACKUP_ROOT = Path("/volume1/docker/music-gateway/tag-cover-409-backups")

def run(args, timeout=90):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, timeout=timeout).stdout

def sha(data):
    return hashlib.sha256(data).hexdigest()

def mount_target():
    info = json.loads(run(["docker", "inspect", CONTAINER]))[0]
    if not info["State"]["Running"]:
        raise RuntimeError("container_not_running")
    matches = [m for m in info["Mounts"]
               if m.get("Destination") == "/app/tag_cover_http.py"]
    if len(matches) != 1 or matches[0].get("Type") != "bind":
        raise RuntimeError("tag_cover_http_bind_mount_not_unique")
    return Path(matches[0]["Source"]), info

def atomic_write(path, data):
    fd, tmp = tempfile.mkstemp(prefix=".tag-cover-409-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        os.chmod(tmp, path.stat().st_mode & 0o777)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def health():
    code = "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8787/health',timeout=5).status)"
    for _ in range(20):
        try:
            if run(["docker", "exec", CONTAINER, "python3", "-c", code], timeout=10).strip() == "200":
                return 200
        except Exception:
            time.sleep(1)
    raise RuntimeError("health_not_200")

def main():
    if not SOURCE.is_file():
        raise RuntimeError("missing_/tmp/tag_cover_http.py")
    new = SOURCE.read_bytes()
    ast.parse(new.decode("utf-8"))
    if b"SLOTS.acquire(timeout=30)" not in new:
        raise RuntimeError("downloaded_source_missing_cover_queue_patch")
    target, info = mount_target()
    old = target.read_bytes()
    old_text = old.decode("utf-8")
    if "SLOTS.acquire(timeout=30)" in old_text:
        print(json.dumps({"state":"ALREADY_PATCHED","health":200,"source_writes":0,"media_writes":0,"db_writes":0}))
        return
    expected = "if not SLOTS.acquire(blocking=False):return h.reply(409,cover.hold('tag_editor_busy'))"
    if expected not in old_text:
        raise RuntimeError("installed_source_does_not_match_expected_409_contract_HOLD")
    if old == new:
        raise RuntimeError("source_already_matches_unexpectedly")
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    backup = BACKUP_ROOT / ("tag_cover_http.py." + time.strftime("%Y%m%d-%H%M%S") + "." + uuid.uuid4().hex[:8] + ".bak")
    backup.write_bytes(old)
    backup_hash = sha(old)
    if sha(backup.read_bytes()) != backup_hash:
        raise RuntimeError("backup_hash_verification_failed")
    # Keep the backup before stopping the service. Stop must be clean before replacement.
    run(["docker", "stop", "--time", "60", CONTAINER], timeout=75)
    state = json.loads(run(["docker", "inspect", CONTAINER]))[0]["State"]
    if state.get("Running") or state.get("ExitCode") != 0 or state.get("OOMKilled"):
        raise RuntimeError("unclean_container_stop_source_not_replaced")
    if sha(target.read_bytes()) != backup_hash:
        raise RuntimeError("source_changed_after_stop_HOLD")
    try:
        atomic_write(target, new)
        run(["docker", "start", CONTAINER], timeout=45)
        status = health()
    except Exception as exc:
        # Restore the exact prior source if startup/health fails.
        try:
            current = target.read_bytes()
            if sha(current) == sha(new):
                atomic_write(target, old)
            state = json.loads(run(["docker", "inspect", CONTAINER]))[0]["State"]
            if state.get("Running"):
                run(["docker", "stop", "--time", "60", CONTAINER], timeout=75)
            run(["docker", "start", CONTAINER], timeout=45)
            restored_health = health()
        except Exception as restore_exc:
            raise RuntimeError("PATCH_FAILED_AND_RESTORE_HEALTH_UNCONFIRMED: " + str(restore_exc)) from exc
        raise RuntimeError("PATCH_FAILED_PRIOR_SOURCE_RESTORED_HEALTH_" + str(restored_health)) from exc
    print(json.dumps({
        "state":"TAG_COVER_BUSY_QUEUE_PATCH_INSTALLED",
        "health":status,
        "backup":str(backup),
        "before_sha256":backup_hash,
        "after_sha256":sha(new),
        "source_writes":1,
        "media_writes":0,
        "db_writes":0,
        "container_restarted":True
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"state":"HOLD","reason":str(exc),"media_writes":0,"db_writes":0}, ensure_ascii=False))
        raise SystemExit(2)
