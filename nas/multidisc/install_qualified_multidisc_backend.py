#!/usr/bin/env python3
"""Install four qualified multidisc candidates and migrate the existing receipt.
Host maintenance operation. No explicit index job, AI sync, media write or frontend publish.
Cold backups immediately before source replacement; source/receipt rollback on failure.
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
def run(*args,timeout=100):return subprocess.check_output(args,text=True,stderr=subprocess.PIPE,timeout=timeout)
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
    a.add_argument("--install",action="store_true")
    a.add_argument("--confirm-maintenance-idle",action="store_true")
    args=a.parse_args()
    require(args.install and args.confirm_maintenance_idle,"explicit_install_and_idle_confirmation_required")
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
    expected_receipt_names={"server.py","index_engine.py","catalog_lease.py","tag_cover_http.py","tag_phase2c.py","tag_cover_h.py","tag_rename_writer.py","tag_native_index.py"}
    require(proof.get("schema")=="fullsave-native-qualification-v1" and set(proof["hashes"])==expected_receipt_names,"receipt_schema_changed")
    require(proof["hashes"]["tag_cover_http.py"]=="ee1b251e65ea48a8f3e5d336bc88a5c760c3256ec9a8bac572bec9772700342b","adapter_source_changed")
    require(receipt.stat().st_uid==1026 and receipt.stat().st_gid==100 and receipt.stat().st_mode&0o777==0o600,"receipt_owner_mode_changed")
    # Resolve host receipt directory into the actual container bind mount.
    possible=[]
    for m in info["Mounts"]:
        if m.get("Type")!="bind":continue
        host=Path(m["Source"])
        if receipt.parent==host or host.is_dir() and receipt.parent.is_relative_to(host):
            possible.append((len(str(host)),str(Path(m["Destination"])/receipt.parent.relative_to(host))))
    require(bool(possible),"receipt_directory_mount_missing")
    backup_root=max(possible)[1]
    def receipt_loads():
        code="import sys,tag_cover_http as h; print('RECEIPT_OK' if h._fullsave_receipt(sys.argv[1]) else 'RECEIPT_REJECTED')"
        return run("docker","exec","-e","PYTHONDONTWRITEBYTECODE=1",C,"python3","-c",code,backup_root).strip().endswith("RECEIPT_OK")
    require(receipt_loads(),"old_runtime_receipt_not_accepted")
    old_receipt=receipt.read_bytes()
    migrated=dict(proof);migrated["hashes"]=dict(proof["hashes"])
    for n in ("index_engine.py","tag_native_index.py"):migrated["hashes"][n]=FILES[n][2]
    # Preserve historical case receipts without claiming they were rerun.
    migrated["qualification_basis"]={"inherited_cases":proof.get("cases",[]),"inherited_receipt_sha256":hashlib.sha256(old_receipt).hexdigest(),"additional_qualification":"MULTIDISC_SAVE_ADAPTER_ISOLATED_PASS","native_writer_receipt":"MULTIDISC_REAL_WRITER_NATIVE_ISOLATED_PASS","adapter_runner_commit":"5013bf7b40e156c55c700d10142b65151d11d1fd","adapter_operations":["a87c8f7a9ed54b34a9873b7da4240194","1e365c511c0647a49802479a13960409"],"candidate_hashes":{n:v[2] for n,v in FILES.items()},"http_authentication_retested":False,"legacy_tag_cover_cases_rerun":False}
    new_receipt=(json.dumps(migrated,ensure_ascii=False,indent=2)+"\n").encode()
    dbs=[DATA/"catalog.sqlite3",DATA/"ai-metadata/ai-metadata-v1.sqlite3"]
    require(all(p.is_file() and not p.is_symlink() for p in dbs),"database_missing")
    require(shutil.disk_usage(DATA).free>sum(p.stat().st_size for p in dbs)*2+256*1024*1024,"insufficient_space")
    os.umask(0o077)
    out=B/("cold-backup-"+time.strftime("%Y%m%d-%H%M%S"))
    out.mkdir(mode=0o700)
    changed=[];receipt_changed=False;records=[]
    try:
        stop()
        for n,(p,old,new) in FILES.items():
            require(sha(ROOT/p)==old,"source_changed_after_stop:"+n)
        require(receipt.read_bytes()==old_receipt,"receipt_changed_after_stop")
        # Backup at the actual cutover, not the earlier snapshot followed by restart.
        for p in dbs:
            dst=out/p.name
            with sqlite3.connect(p.as_uri()+"?mode=ro",uri=True) as src,sqlite3.connect(dst) as dest:
                src.backup(dest)
                require(dest.execute("PRAGMA quick_check").fetchall()==[("ok",)],"backup_integrity:"+p.name)
            with dst.open("rb") as f:os.fsync(f.fileno())
            records.append({"source":str(p),"backup":str(dst),"sha256":sha(dst),"bytes":dst.stat().st_size})
        shutil.copy2(receipt,out/"fullsave-native-qualified.json")
        with (out/"manifest.json").open("x") as f:
            json.dump({"databases":records,"receipt_sha256":sha(out/"fullsave-native-qualified.json"),"source_bundle":str(B),"restore_requires_service_stopped_and_no_later_writes":True,"qualification_basis":migrated["qualification_basis"]},f,indent=2)
            f.flush();os.fsync(f.fileno())
        for n,(p,old,new) in FILES.items():
            target=ROOT/p
            changed.append(n)
            put(target,(B/"candidates"/n).read_bytes())
            require(sha(target)==new,"install_hash_mismatch:"+n)
        receipt_changed=True
        put(receipt,new_receipt)
        require(receipt.read_bytes()==new_receipt,"receipt_write_failed")
        run("docker","start",C)
        health()
        for n,(_,_,new) in FILES.items():
            got=run("docker","exec",C,"python3","-c","import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())","/app/"+n).strip()
            require(got==new,"runtime_hash_mismatch:"+n)
        require(receipt_loads(),"new_runtime_receipt_not_accepted")
    except Exception as e:
        try:
            if changed or receipt_changed:
                if inspect()["State"]["Running"]:stop()
                for n in reversed(changed):
                    p,old,new=FILES[n]
                    put(ROOT/p,(B/"originals"/n).read_bytes())
                    require(sha(ROOT/p)==old,"rollback_hash_failed:"+n)
                if receipt_changed:
                    put(receipt,old_receipt)
                    require(receipt.read_bytes()==old_receipt,"receipt_rollback_failed")
            if not inspect()["State"]["Running"]:run("docker","start",C)
            health()
            require(receipt_loads(),"rollback_receipt_not_accepted")
        except Exception as rollback:
            raise RuntimeError("CUTOVER_FAILED_ROLLBACK_UNCONFIRMED:"+str(e)+" / "+str(rollback)) from e
        raise RuntimeError("CUTOVER_HELD_OLD_SOURCE_RESTORED:"+str(e)) from e
    result={"state":"MULTIDISC_BACKEND_INSTALLED","path":str(out),"health":200,"source_hashes_verified":True,"runtime_receipt_accepted":True,"inherited_legacy_cases":True,"source_writes":4,"receipt_writes":1,"media_writes":0,"explicit_db_writes":0,"single_album_scan":"NOT_EXECUTED","ai_sync":"NOT_EXECUTED","frontend":"NOT_PUBLISHED"}
    (out/"install-result.json").write_text(json.dumps(result,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=="__main__":
    try:main()
    except Exception as e:
        print(json.dumps({"state":"HOLD","reason":str(e)}));raise SystemExit(1)
