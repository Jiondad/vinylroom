#!/usr/bin/env python3
"""Run real Rename Writer + NativeAlbumIndex in a NEW disposable container.

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
    # Generate a tiny genuine FLAC stream using only Python standard library.
    # Fixed-block mono 16-bit PCM, 44.1 kHz, eight constant-value frames.
    # No external encoder, production audio, or package installation needed.
    def crc(blob,bits,poly):
        reg=0; mask=(1<<bits)-1
        for byte in blob:
            reg ^= byte<<(bits-8)
            for _ in range(8):
                reg=((reg<<1)^poly)&mask if reg&(1<<(bits-1)) else (reg<<1)&mask
        return reg
    import hashlib
    block=576; frame_count=8; total=block*frame_count
    frames=[]
    for number in range(frame_count):
        # Sync, fixed blocking, block-size code 2 (576), sample-rate 9
        # (44.1 kHz), mono channel assignment, 16-bit sample-size code 4.
        header=bytes((0xff,0xf8,0x29,0x08,number))
        header+=bytes((crc(header,8,0x07),))
        # Constant subframe: zero padding/type/wasted bits, then 16-bit zero.
        frame=header+b"\x00\x00\x00"
        frame+=crc(frame,16,0x8005).to_bytes(2,"big")
        frames.append(frame)
    sizes=[len(f) for f in frames]
    packed=(44100<<44)|(0<<41)|(15<<36)|total
    streaminfo=(struct.pack(">HH",block,block)+min(sizes).to_bytes(3,"big")
        +max(sizes).to_bytes(3,"big")+packed.to_bytes(8,"big")
        +hashlib.md5(b"\x00\x00"*total).digest())
    seed=Path(tmp)/"fixture.flac"
    seed.write_bytes(b"fLaC"+b"\x80\x00\x00\x22"+streaminfo+b"".join(frames))
    # Real Mutagen metadata parsing and a tag write, not a disguised WAV file.
    probe=FLAC(seed)
    check(probe.info.sample_rate==44100 and probe.info.channels==1
        and probe.info.bits_per_sample==16 and probe.info.total_samples==total,
        "generated_flac_streaminfo_invalid")
    probe["title"]="Synthetic silence";probe.save()
    print("ISOLATED_FLAC_FIXTURE_READY",flush=True)
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
        # Diagnostic wrapper for the exact bound native scan_job. No change
        # to its implementation, lease, enqueue or Catalog behavior.
        import traceback
        original_scan_job=i.scan_job
        def traced_scan_job(*args,**kwargs):
            try:
                return original_scan_job(*args,**kwargs)
            except Exception:
                print("ISOLATED_NATIVE_SCAN_TRACEBACK_BEGIN",flush=True)
                traceback.print_exc()
                print("ISOLATED_NATIVE_SCAN_TRACEBACK_END",flush=True)
                raise
        i.scan_job=traced_scan_job
        def scan(path,recursive):
            # Capture exceptions even when native execute_job catches them
            # before the scan_job wrapper is reached. Isolated process only.
            captured=[]
            def trace_native(frame,event,arg):
                if event=="exception" and isinstance(arg[1],TypeError):
                    filename=frame.f_code.co_filename
                    if filename.startswith("/app/") and len(captured)<30:
                        captured.append({"file":filename,"line":frame.f_lineno,
                            "function":frame.f_code.co_name,"error":str(arg[1])})
                return trace_native
            previous_trace=sys.gettrace()
            try:
                sys.settrace(trace_native)
                result=i.enqueue(path,recursive=recursive,kind="manual",scan_mode="changes",synchronous=True)
            finally:
                sys.settrace(previous_trace)
                print("ISOLATED_NATIVE_TYPEERROR_EVENTS",json.dumps(captured,ensure_ascii=False),flush=True)
            print("ISOLATED_SCAN",json.dumps(result,default=str,ensure_ascii=False)[:1800],flush=True)
            if isinstance(result,dict) and result.get("state")!="completed":
                hold("native_scan_failed:"+str(result.get("message",result.get("state"))))
            return result
        def snapshot():
            with i.db() as db:
                return [dict(r) for r in db.execute("SELECT id,path,missing,hidden,data FROM albums")]
        # Seed legacy independent rows through the actual scanner and Index.put,
        # in the disposable Catalog only. Do not bypass the enqueue scope guard.
        import hashlib
        for disc in ("CD1","CD2"):
            folder=parent/disc
            result=scanner.scan(folder,"classified-music",limit=1,covers=True,ape_tag_recovery=True)
            check(len(result["albums"])==1,"legacy_fixture_scan_failed:"+disc)
            album=result["albums"][0]
            album["relative_path"]=rel+"/"+disc
            st=folder.stat()
            with i.db() as db:
                i.put(db,album,None,f"{st.st_dev}:{st.st_ino}","legacy-fixture")
        print("ISOLATED_LEGACY_CATALOG_READY",flush=True)
        rows=snapshot()
        active={r["path"]:r for r in rows if not r["missing"] and not r["hidden"]}
        check(set(active)=={rel+"/CD1",rel+"/CD2"},"legacy_child_seed_not_two_independent_albums")
        rep=active[rel+"/CD1"]["id"];old=active[rel+"/CD2"]["id"]
        check([len(json.loads(active[rel+"/"+d]["data"])["tracks"]) for d in ("CD1","CD2")]==[14,13],"legacy_track_counts")
        # Legacy fixture already contains the complete isolated library.
        # Set the normal seed-complete marker BEFORE the first native enqueue.
        # No production seed behavior is altered.
        i.setmeta("seed_complete","1")
        check(i.meta("seed_complete")=="1","isolated_seed_marker_not_set")
        print("ISOLATED_SEED_COMPLETE",flush=True)
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
        # Parent merge is fixture preparation, not a repeat qualification.
        native=NativeAlbumIndex(i)
        import tag_rename_writer as writer
        backup=Path(tmp)/"backup"
        backup.mkdir(mode=0o700)
        # Explicit opt-in only within this disposable Python process.
        os.environ[writer.RENAME_ENV]="true"
        original=rel+"/CD2/03 Track.flac"
        renamed=rel+"/CD2/03 Renamed.flac"
        def media_hashes():
            return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in root.rglob("*.flac")}
        before=media_hashes()
        check(len(before)==27,"writer_fixture_not_27")
        prepared=writer.plan(i.dbpath,root,rep,original,"03 Renamed.flac")
        print("REAL_WRITER_PLAN",json.dumps(prepared,default=str,ensure_ascii=False)[:2400],flush=True)
        check(prepared.get("state")=="READ_ONLY_RENAME_PLAN","writer_plan_failed")
        # Preserve the existing whole-job lease; NativeAlbumIndex performs
        # the real callback, not a simulated SQL update.
        with i.whole_job_lease():
            saved=writer.apply(i.dbpath,root,backup,rep,original,"03 Renamed.flac",
                               prepared["plan_id"],native,True)
        print("REAL_WRITER_APPLY",json.dumps(saved,default=str,ensure_ascii=False)[:2400],flush=True)
        check(saved.get("state")=="RENAME_WRITE_COMPLETED","writer_apply_failed")
        expected=dict(before);expected[renamed]=expected.pop(original)
        check(media_hashes()==expected,"rename_file_hash_or_scope_changed")
        check(writer._references_match(i.dbpath,rep,renamed,original),"rename_catalog_reference_failed")
        verify()
        with i.whole_job_lease():
            restored=writer.restore(i.dbpath,root,backup,saved["operation_id"],native,True)
        print("REAL_WRITER_RESTORE",json.dumps(restored,default=str,ensure_ascii=False)[:2400],flush=True)
        check(restored.get("state")=="RENAME_RESTORE_COMPLETED","writer_restore_failed")
        check(media_hashes()==before,"restore_file_hash_or_scope_changed")
        check(writer._references_match(i.dbpath,rep,original,renamed),"restore_catalog_reference_failed")
        verify()
        print(json.dumps({"state":"MULTIDISC_REAL_WRITER_NATIVE_ISOLATED_PASS",
            "fixture":"27 generated FLAC files / actual Writer and NativeAlbumIndex",
            "representative_uuid":rep,"archived_uuid":old,"tracks":27,
            "active_search":27,"archived_search":0,
            "rename_restore_file_hashes":"PASS","other_media_unchanged":"PASS",
            "writer_apply_restore_real":"PASS","production_writes":0,
            "production_deployment":"NOT_AUTHORIZED"},ensure_ascii=False,indent=2))
    finally:
        if hasattr(i,"stopping"):i.stopping.set()
'''
def main():
    image=read(["docker","inspect","--format","{{.Image}}",LIVE]).decode().strip()
    if not image.startswith("sha256:"):hold("live_image_id_unavailable")
    with tempfile.TemporaryDirectory(prefix="vinyl_native_isolated_") as temp:
        app=Path(temp)/"app";app.mkdir(mode=0o755)
        app.chmod(0o755)
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
        # Image may run as a non-root UID. Expose only the disposable source copy.
        for p in app.iterdir():
            if p.is_file() and not p.is_symlink():p.chmod(0o644)
        args=["docker","run","--rm","--network","none","--read-only",
              "--cap-drop","ALL","--security-opt","no-new-privileges",
              "--memory","768m",
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
