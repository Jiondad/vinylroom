#!/usr/bin/env python3
"""Host cutover: cold DB backups + four pinned source replacements.
No scan, direct AI writes, receipt promotion or frontend publication.
Existing receipt remains unchanged; changed hashes may disable FullSave until
the separately qualified receipt migration is installed.
"""
import argparse,hashlib,json,os,sqlite3,subprocess,time,shutil
from pathlib import Path
C="music-gateway-music-gateway-1"
ROOT=Path("/volume1/docker/music-gateway")
DATA=ROOT/"index-data"
B=DATA/"multidisc-cutover-20261124-082050-4071"
FILES={
"index_scanner.py":("artwork-deploy-prep/index_scanner.py","329d3d32b892d7bd0cd1187ecc6fd6648c856c2b2f412b85d8f073947f42d173","602b70816efe34b8ebfd26eabd98973928758d65d41edbcf93c84dae3d4b06b3"),
"index_engine.py":("tag-editor-fullsave-native-20261122/candidate/index_engine.py","3bdf67de2bb29315fad021c58300661c903bb9c5f2a6342f1d2bfc7a6a61998f","7057f502aba53c3519f2df6ae28df6b838ef88bc43dc046d768728d2290ab2c5"),
"tag_native_index.py":("tag-editor-fullsave-native-20261122/candidate/tag_native_index.py","e6e6e6127223c1b01e57aea3400180b3c80b160f0544935515052b172fd4c30e","699effa78701cd63aa775aea9a76ef264a42ace529449437bafb811d0a043373"),
"track_search.py":("artwork-deploy-prep/track_search.py","84401b47ce847ffd74181483d77f44a4bb2903819a1d7b8758af94179d4d33de","fb5e9bc51bc3854c7ddee3b2e1d222c61a07bd078cd8d0beb02a3e23de19fc86")}
def run(*args,timeout=100):return subprocess.check_output(args,text=True,timeout=timeout)
def inspect():return json.loads(run("docker","inspect",C))[0]
def sha(p):
    h=hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()
def require(ok,msg):
    if not ok:raise RuntimeError(msg)
def put(p,b):
    with p.open("r+b") as f:f.seek(0);f.write(b);f.truncate();f.flush();os.fsync(f.fileno())
def health():
    for _ in range(30):
        try:
            if run("docker","exec",C,"python3","-c","import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8787/health',timeout=3).status)",timeout=8).strip()=="200":return 200
        except Exception:pass
        time.sleep(1)
    raise RuntimeError("health_failed")
def stop():
    run("docker","stop","--time","60",C)
    s=inspect()["State"]
    require(not s["Running"] and not s.get("OOMKilled") and s["ExitCode"]==0,"unclean_stop")
def main():
    a=argparse.ArgumentParser()
    a.add_argument("--backup-only",action="store_true")
    args=a.parse_args()
    require(args.backup_only,"backup_only_required_pending_receipt_migration")
    info=inspect();require(info["State"]["Running"],"service_not_running")
    mounts={m["Destination"]:m for m in info["Mounts"]}
    require(mounts["/data"]["Source"]==str(DATA),"data_mount_changed")
    for n,(p,old,new) in FILES.items():
        target=ROOT/p
        require(mounts["/app/"+n]["Source"]==str(target),"mount_changed:"+n)
        require(not target.is_symlink() and sha(target)==old and sha(B/"originals"/n)==old and sha(B/"candidates"/n)==new,"source_hash_changed:"+n)
    receipt=ROOT/"tag-editor-backups/fullsave-native-qualified.json"
    require(receipt.is_file() and not receipt.is_symlink(),"receipt_missing")
    proof=json.loads(receipt.read_text())
    require(proof.get("state")=="PASS","old_receipt_not_pass")
    for n,h in proof["hashes"].items():
        m=mounts.get("/app/"+n)
        require(m and sha(Path(m["Source"]))==h,"receipt_hash_changed:"+n)
    dbs=[DATA/"catalog.sqlite3",DATA/"ai-metadata/ai-metadata-v1.sqlite3"]
    require(all(p.is_file() and not p.is_symlink() for p in dbs),"database_missing")
    require(shutil.disk_usage(DATA).free>sum(p.stat().st_size for p in dbs)*2+256*1024*1024,"insufficient_space")
    os.umask(0o077)
    out=B/("cold-backup-"+time.strftime("%Y%m%d-%H%M%S"))
    out.mkdir(mode=0o700)
    stopped=False
    try:
        stop();stopped=True
        records=[]
        for p in dbs:
            dst=out/p.name
            with sqlite3.connect(p.as_uri()+"?mode=ro",uri=True) as src,sqlite3.connect(dst) as dest:
                src.backup(dest)
                require(dest.execute("PRAGMA quick_check").fetchall()==[("ok",)],"backup_integrity:"+p.name)
            records.append({"source":str(p),"backup":str(dst),"sha256":sha(dst),"bytes":dst.stat().st_size})
        shutil.copy2(receipt,out/"fullsave-native-qualified.json")
        (out/"manifest.json").write_text(json.dumps({"databases":records,"receipt_sha256":sha(out/"fullsave-native-qualified.json"),"source_bundle":str(B),"restore_requires_service_stopped_and_no_later_writes":True},indent=2))
    finally:
        if not inspect()["State"]["Running"]:run("docker","start",C)
        health()
    print(json.dumps({"state":"MULTIDISC_COLD_BACKUP_READY","path":str(out),"databases":records,"health":200,"source_writes":0,"media_writes":0,"explicit_db_writes":0,"note":"Backup snapshot only; refresh at actual cutover if any later writes."},indent=2))
if __name__=="__main__":
    try:main()
    except Exception as e:
        print(json.dumps({"state":"HOLD","reason":str(e)}));raise SystemExit(1)
