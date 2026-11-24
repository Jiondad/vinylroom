#!/usr/bin/env python3
"""Synthetic end-to-end Rename Writer flow, using real plan/apply/restore AST.

Executes original Writer's plan/apply/restore and _catalog_files/_references_match
in a strict TemporaryDirectory with 27 synthetic file bytes and an in-memory
Catalog. Replaces ONLY base inventory, media fingerprint, backup primitives,
writer _target/_no_replace, and native index callback with isolated shims.

Important: This tests the Writer control flow/UUID persistence/restore path, NOT
production NativeAlbumIndex, audio/tag parsing, real file durability or NAS install.
No operational media or DB opened or written.
"""
import ast
import contextlib
import datetime
import fcntl
import hashlib
import json
import os
import re
import shutil
import sqlite3
import tempfile
import uuid
from pathlib import Path
from types import SimpleNamespace

WRITER=Path("/app/tag_rename_writer.py")
REP="5d7db58a-641f-42cd-84d4-15b77c396e76"
ROOT_PATH=("KPOP/김종서 (Kim Jong Sheo)/김종서 - 2007.04.18 名作(명작) - "
           "20th Anniversary Greatest Hits [FLAC-16bit-44.1kHz]")
EXPECTED_FILES=27

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,
        "operating_catalog_writes":0,"operating_media_writes":0},ensure_ascii=False))

if not WRITER.is_file() or WRITER.is_symlink():
    hold("writer_source_not_found")

source=WRITER.read_text(encoding="utf-8")
tree=ast.parse(source)
names={"plan","apply","restore","_catalog_files","_references_match"}
selected=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
if {n.name for n in selected}!=names:
    hold("writer_functions_missing_or_nested")
unit=ast.Module(body=selected,type_ignores=[])
ast.fix_missing_locations(unit)

with tempfile.TemporaryDirectory(prefix="vinyl_writer_27_synthetic_") as temp:
    temp=Path(temp)
    music=temp/"music"
    backup=temp/"backup"
    music.mkdir()
    backup.mkdir(mode=0o700)
    files=[]
    for disc,count in (("CD1",14),("CD2",13)):
        for number in range(1,count+1):
            relative=ROOT_PATH+"/"+disc+"/"+f"{number:02} Test.flac"
            target=music/relative
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(("synthetic-"+disc+"-"+str(number)).encode("ascii"))
            files.append({"path":relative,"filename":target.name,"subfolder":disc})
    if len(files)!=EXPECTED_FILES:hold("synthetic_track_fixture_count_wrong")

    db=sqlite3.connect(":memory:")
    db.row_factory=sqlite3.Row
    db.execute("CREATE TABLE albums(id TEXT PRIMARY KEY,path TEXT,data TEXT,missing INTEGER,hidden INTEGER)")
    db.execute("INSERT INTO albums VALUES(?,?,?,?,?)",
               (REP,ROOT_PATH,json.dumps({"physical_files":files}),0,0))
    def album_record(catalog,album_id):
        row=catalog.execute("SELECT * FROM albums WHERE id=?",(album_id,)).fetchone()
        if not row:raise ValueError("album_missing")
        return row,json.loads(row["data"])

    def sha(path):
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()

    def file_token(path):
        stat=Path(path).stat()
        return {"size":stat.st_size,"mtime_ns":stat.st_mtime_ns}
    def inventory(catalog,music_root,album_id,allow_auxiliary_disc_dirs=False):
        row,obj=album_record(catalog,album_id)
        entries=[]
        for r in obj["physical_files"]:
            p=Path(music_root)/r["path"]
            if not p.is_file():return None,[],[{"error":"missing_file"}]
            entries.append({"file":r["path"],"format":".flac","size":p.stat().st_size})
        return {"id":album_id,"path":row["path"],
                "catalog_data_digest":hashlib.sha256(row["data"].encode()).hexdigest()},entries,[]
    def verify_catalog(catalog,album_id,digest,path):
        album,_,issues=inventory(catalog,music,album_id)
        if issues or album["path"]!=path or album["catalog_data_digest"]!=digest:
            raise ValueError("catalog_changed")
    def root_guard(music_root,backup_root,allow_missing=False):
        root=Path(backup_root).resolve()
        if root!=backup.resolve() or root.is_relative_to(Path(music_root).resolve()):
            raise ValueError("backup_scope_unsafe")
        return root
    def audit_save(path,obj):
        Path(path).write_text(json.dumps(obj),encoding="utf-8")
    def make_backup(source,dest,expected):
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,dest)
        if sha(dest)!=expected:raise ValueError("backup_sha")
    def no_replace(source,dest):
        if Path(dest).exists():raise ValueError("target_exists")
        os.rename(source,dest)
    def target_name(new_name,old_relative):
        if (not isinstance(new_name,str) or "/" in new_name or "\\" in new_name
            or new_name in ("",".","..") or not new_name.endswith(".flac")):
            raise ValueError("invalid_new_name")
        return new_name
    def hold_value(reason,**kw):
        return {"state":"HOLD","reason":reason,**kw}

    base=SimpleNamespace(
        sqlite3=sqlite3,album_record=album_record,inventory=inventory,
        hold=hold_value,_safe_track_choice=lambda entries,album,file:
            next(e for e in entries if e["file"]==file),
        normalize=lambda s:str(s).casefold(),_file_token=file_token,
        file_sha256=sha,_token_matches=lambda a,b:a==b,
        digest=lambda x:hashlib.sha256(json.dumps(x,sort_keys=True,ensure_ascii=False).encode()).hexdigest(),
        _root_guard=root_guard,_free_space_check=lambda *args:None,
        _audit_save=audit_save,_make_backup=make_backup,
        _verify_same_catalog=verify_catalog,_fsync_dir=lambda path:None)
    const_name="VINYL_SYNTHETIC_WRITER_TEST_ENABLED"
    env_old=os.environ.get(const_name)
    os.environ[const_name]="true"
    ns={"base":base,"Path":Path,"MAX_AUDIO_BYTES":256*1024*1024,
        "RENAME_ENV":const_name,"re":re,"os":os,"fcntl":fcntl,
        "uuid":uuid,"json":json,
        "datetime":datetime.datetime,"timezone":datetime.timezone,
        "_target":target_name,"_no_replace":no_replace}
    try:
        exec(compile(unit,str(WRITER),"exec"),ns)
        plan=ns["plan"];apply=ns["apply"];restore=ns["restore"]
        references_match=ns["_references_match"]
        class NativeReindex:
            calls=0
            def preflight(self,album_id,path):
                if album_id!=REP or path!=ROOT_PATH:raise ValueError("identity_changed")
                album,entries,issues=inventory(db,music,album_id,True)
                if issues or len(entries)!=27:raise ValueError("inventory_not_27")
            def __call__(self,album_id,path):
                self.calls+=1
                if album_id!=REP or path!=ROOT_PATH:raise ValueError("reindex_identity_changed")
                row,obj=album_record(db,REP)
                modified=0
                for r in obj["physical_files"]:
                    file=music/r["path"]
                    if file.exists():continue
                    name=file.name
                    if name.endswith(" Test.flac"):
                        alternate=file.with_name(name.replace(" Test.flac"," Renamed.flac"))
                    elif name.endswith(" Renamed.flac"):
                        alternate=file.with_name(name.replace(" Renamed.flac"," Test.flac"))
                    else:
                        raise ValueError("unrecognized_test_filename")
                    if not alternate.is_file():
                        raise ValueError("reindex_unmatched_file")
                    r["path"]=alternate.relative_to(music).as_posix()
                    r["filename"]=alternate.name
                    modified+=1
                if modified!=1:raise ValueError("reindex_unexpected_change:"+str(modified))
                db.execute("UPDATE albums SET data=? WHERE id=?",(json.dumps(obj),REP))
                return {"state":"completed"}

        # Use the final filename within CD2 only; no real FLAC or Catalog touched.
        reindex=NativeReindex()
        old=ROOT_PATH+"/CD2/03 Test.flac"
        new_name="03 Renamed.flac"
        prepared=plan(db,music,REP,old,new_name)
        if prepared.get("state")!="READ_ONLY_RENAME_PLAN":
            hold("writer_plan_failed:"+str(prepared))
        saved=apply(db,music,backup,REP,old,new_name,prepared["plan_id"],reindex,True)
        if saved.get("state")!="RENAME_WRITE_COMPLETED":
            hold("writer_apply_failed:"+str(saved))
        new=ROOT_PATH+"/CD2/"+new_name
        if not references_match(db,REP,new,old) or not (music/new).is_file():
            hold("writer_post_apply_reference_missing")
        done=restore(db,music,backup,saved["operation_id"],reindex,True)
        if done.get("state")!="RENAME_RESTORE_COMPLETED":
            hold("writer_restore_failed:"+str(done))
        if not references_match(db,REP,old,new) or not (music/old).is_file() or (music/new).exists():
            hold("writer_post_restore_reference_missing")
        if reindex.calls!=2 or len(ns["_catalog_files"](db,REP))!=27:
            hold("reindex_calls_or_track_count_wrong")
        print(json.dumps({"state":"MULTIDISC_WRITER_CONTROL_FLOW_ISOLATED_PASS",
            "existing_writer_functions":["plan","apply","restore"],
            "representative_uuid":REP,"physical_disc":"CD2",
            "album_tracks":27,"rename_reindex_calls":reindex.calls,
            "post_restore_filename_verified":True,
            "native_reindex_callback":"SYNTHETIC_ONLY",
            "base_safety_helpers":"SYNTHETIC_SHIMS",
            "actual_scan_job_and_native_index":"NOT_TESTED",
            "operating_catalog_writes":0,"operating_media_writes":0,
            "production_install":"NOT_AUTHORIZED"},ensure_ascii=False,indent=2))
    finally:
        if env_old is None:os.environ.pop(const_name,None)
        else:os.environ[const_name]=env_old
        db.close()
