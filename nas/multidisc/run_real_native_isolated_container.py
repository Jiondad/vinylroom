#!/usr/bin/env python3
"""Run native index integration in a NEW network-disabled disposable container.

Run on NAS HOST (not docker exec). Never mounts production /data or /music.
Copies only top-level Python source files and four pinned candidate modules.
Uses the same image as the running service, with a clean environment, read-only
root filesystem and disposable /tmp. No production backup/restore or install.
"""
import hashlib,json,os,subprocess,tempfile
from pathlib import Path

LIVE="music-gateway-music-gateway-1"
BUNDLE="/tmp/vinyl-multidisc-preinstall-final-20261124/candidates"
HASHES={
"index_scanner.py":"602b70816efe34b8ebfd26eabd98973928758d65d41edbcf93c84dae3d4b06b3",
"tag_native_index.py":"699effa78701cd63aa775aea9a76ef264a42ace529449437bafb811d0a043373",
"index_engine.py":"7057f502aba53c3519f2df6ae28df6b838ef88bc43dc046d768728d2290ab2c5",
"track_search.py":"fb5e9bc51bc3854c7ddee3b2e1d222c61a07bd078cd8d0beb02a3e23de19fc86"}
def run(args,**kw):return subprocess.run(args,check=True,**kw)
def read(args):return run(args,stdout=subprocess.PIPE).stdout
def hold(reason):
    print(json.dumps({"state":"HOLD","reason":reason,"production_writes":0},ensure_ascii=False))
    raise SystemExit(1)

HARNESS=r'''
import inspect,json,os,sqlite3,subprocess,shutil,tempfile,sys,wave,struct
from pathlib import Path
from mutagen.flac import FLAC

REP_TITLE="Multidisc isolated album"
ARTIST="Vinyl Room isolated fixture"
def hold(reason):
    print(json.dumps({"state":"HOLD","reason":reason,"production_writes":0},ensure_ascii=False))
    raise SystemExit(1)
def check(ok,reason):
    if not ok:hold(reason)
with tempfile.TemporaryDirectory(prefix="native_integration_") as tmp:
    root=Path(tmp)/"music"
    data=Path(tmp)/"data"
    parent=root/"KPOP"/ARTIST/REP_TITLE
    root.mkdir();data.mkdir()
    encoder=shutil.which("ffmpeg") or shutil.which("flac")
    if not encoder:hold("isolated_flac_encoder_unavailable")
    wav=Path(tmp)/"fixture.wav"
    with wave.open(str(wav),"wb") as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100)
        w.writeframes(b"\x00\x00"*4410)
    seed=Path(tmp)/"fixture.flac"
    if Path(encoder).name=="ffmpeg":
        subprocess.run([encoder,"-nostdin","-loglevel","error","-i",str(wav),str(seed)],check=True)
    else:
        subprocess.run([encoder,"--silent","-o",str(seed),str(wav)],check=True)
    for disc,count in ((1,14),(2,13)):
        folder=parent/("CD"+str(disc));folder.mkdir(parents=True)
        for n in range(1,count+1):
            p=folder/f"{n:02d} Track.flac";shutil.copyfile(seed,p)
            a=FLAC(p);a["album"]=REP_TITLE;a["artist"]=ARTIST
            a["albumartist"]=ARTIST;a["title"]=f"Disc {disc} Track {n:02d}"
            a["tracknumber"]=str(n);a["discnumber"]=str(disc);a["date"]="2007";a.save()
    import index_scanner as scanner
    from index_engine import Index
    from tag_native_index import NativeAlbumIndex
    # Constructor interface verified against actual extracted NAS source.
    # Network access is disabled by Docker; no production mounts exist.
    i=Index(root,data,lambda *a,**k:None,scanner,track_search=True)
    try:
        check(Path(i.dbpath).resolve().is_relative_to(data.resolve()),"unexpected_index_db_path")
        check(Path(i.root).resolve()==root.resolve(),"unexpected_index_root")
        rel=parent.relative_to(root).as_posix()
        def scan(path,recursive):
            result=i.enqueue(path,recursive=recursive,kind="manual",scan_mode="changes",synchronous=True)
            print("ISOLATED_SCAN",json.dumps(result,default=str,ensure_ascii=False)[:1800])
            return result
        def snapshot():
            with i.db() as db:
                return [dict(r) for r in db.execute("SELECT id,path,missing,hidden,data FROM albums")]
        # Create the two independent legacy Catalog records using the real Index.
        for disc in ("CD1","CD2"):scan(rel+"/"+disc,False)
        rows=snapshot()
        active={r["path"]:r for r in rows if not r["missing"] and not r["hidden"]}
        check(set(active)=={rel+"/CD1",rel+"/CD2"},"legacy_child_seed_not_two_independent_albums")
        rep=active[rel+"/CD1"]["id"];old=active[rel+"/CD2"]["id"]
        check([len(json.loads(active[rel+"/"+d]["data"])["tracks"]) for d in ("CD1","CD2")]==[14,13],"legacy_track_counts")
        scan(rel,True)
        def verify():
            rows={r["id"]:r for r in snapshot()}
            check(set(rows)=={rep,old},"unexpected_album_ids")
            check(rows[rep]["path"]==rel and not rows[rep]["missing"] and rows[old]["missing"]==1,"uuid_archive_transition")
            tracks=json.loads(rows[rep]["data"])["tracks"]
            check(len(tracks)==27,"merged_track_count")
            check(sum(t.get("disc")==1 for t in tracks)==14 and sum(t.get("disc")==2 for t in tracks)==13,"disc_split")
            with i.db() as db:
                counts=dict(db.execute("SELECT album_id,count(*) FROM track_search_v1 GROUP BY album_id"))
            check(counts=={rep:27},"search_not_27_0")
        verify()
        # Actual Native adapter, actual parent inventory, actual native enqueue.
        native=NativeAlbumIndex(i)
        check(i.meta("seed_complete")=="1","isolated_seed_not_complete")
        native.preflight(rep,rel)
        native(rep,rel)
        verify()
        print(json.dumps({"state":"MULTIDISC_REAL_NATIVE_INDEX_ISOLATED_PASS",
            "fixture":"27 generated FLAC files / two discs / real candidate modules",
            "representative_uuid":rep,"archived_uuid":old,"tracks":27,
            "active_search":27,"archived_search":0,"native_preflight_and_callback":"PASS",
            "writer_apply_restore_real":"NOT_TESTED","production_writes":0,
            "production_deployment":"NOT_AUTHORIZED"},ensure_ascii=False,indent=2))
    finally:
        if hasattr(i,"stopping"):i.stopping.set()
'''
def main():
    image=read(["docker","inspect","--format","{{.Image}}",LIVE]).decode().strip()
    if not image.startswith("sha256:"):hold("live_image_id_unavailable")
    with tempfile.TemporaryDirectory(prefix="vinyl_native_isolated_") as temp:
        app=Path(temp)/"app";app.mkdir(mode=0o700)
        listing=read(["docker","exec",LIVE,"python3","-c",
            "import json,pathlib; print(json.dumps([p.name for p in pathlib.Path('/app').glob('*.py') if p.is_file() and not p.is_symlink()]))"])
        names=json.loads(listing)
        if len(names)>250 or not names:hold("unexpected_source_count")
        for name in names:
            if Path(name).name!=name or not name.endswith(".py"):hold("unsafe_source_name")
            blob=read(["docker","exec",LIVE,"cat","/app/"+name])
            if len(blob)>4*1024*1024:hold("oversize_source:"+name)
            (app/name).write_bytes(blob)
        for name,expected in HASHES.items():
            blob=read(["docker","exec",LIVE,"cat",BUNDLE+"/"+name])
            if hashlib.sha256(blob).hexdigest()!=expected:hold("candidate_hash_changed:"+name)
            (app/name).write_bytes(blob)
        (app/"_multidisc_native_fixture.py").write_text(HARNESS,encoding="utf-8")
        args=["docker","run","--rm","--network","none","--read-only",
              "--cap-drop","ALL","--security-opt","no-new-privileges",
              "--memory","768m","--pids-limit","128",
              "--tmpfs","/tmp:rw,nosuid,nodev,size=256m",
              "--mount","type=bind,source="+str(app)+",target=/app,readonly",
              "--workdir","/app","-e","PYTHONDONTWRITEBYTECODE=1",
              "-e","INDEX_AUTOMATIC_ENABLED=false",
              "--entrypoint","python3",image,"/app/_multidisc_native_fixture.py"]
        # Run only the isolated image; no --volumes-from, no production bind mounts,
        # no inherited service environment or secrets from the live container.
        proc=subprocess.run(args)
        if proc.returncode:hold("isolated_native_run_failed:"+str(proc.returncode))
if __name__=="__main__":main()
