#!/usr/bin/env python3
"""One-shot *isolated* CD1/CD2 rename trial. Never writes operational media or Catalog."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT=Path('/volume1/docker/music-gateway')
STAGE=ROOT/'tag-editor-cd-rename-guard-stage-20261123'
C='music-gateway-music-gateway-1'
NATIVE=STAGE/'tag_native_index.py.fixed-candidate'
HTTP=STAGE/'tag_cover_http.py.cd-native.candidate'
EXPECTED_NATIVE='e6e6e6127223c1b01e57aea3400180b3c80b160f0544935515052b172fd4c30e'
EXPECTED_HTTP='87e75c2a852e9f452032c9949d6313fbe3afa81c13f93ca383e04b7a133281dd'
OLD_NATIVE='ef1f6903e31359c07de6dbf56bd7ad615d21ec3b6b2325c98c143c22cd65c684'
OLD_HTTP='d07d29f02395b128fa9f65b92923451d3ebfbf510bf26105f61c0506588146cd'
LIVE_NATIVE=ROOT/'tag-editor-fullsave-native-20261122/candidate/tag_native_index.py'
LIVE_HTTP=ROOT/'tag-editor-leasebusy-409-stage-20261123/tag_cover_http.py'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def hold(msg):raise SystemExit('HOLD: '+msg)
for path,expected in ((NATIVE,EXPECTED_NATIVE),(HTTP,EXPECTED_HTTP),(LIVE_NATIVE,OLD_NATIVE),(LIVE_HTTP,OLD_HTTP)):
    if not path.is_file() or path.is_symlink() or sha(path)!=expected:hold('source SHA mismatch '+str(path))

# Test-only candidate module in the container's /tmp. This is NOT an /app mount.
remote='/tmp/vr_cd_native_isolated_candidate_20261124.py'
cp=subprocess.run(['docker','cp',str(NATIVE),C+':'+remote],capture_output=True,text=True)
if cp.returncode:hold('docker cp: '+cp.stderr.strip())

TEST=r'''
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
import time
import uuid

import index_engine
import index_scanner
import tag_rename_writer as writer

path=Path('/tmp/vr_cd_native_isolated_candidate_20261124.py')
spec=importlib.util.spec_from_file_location('vr_cd_native_fixture',path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

SOURCE=Path('/music/KPOP/김종서 (Kim Jong Sheo)/김종서 - 2007.04.18 名作(명작) - 20th Anniversary Greatest Hits [FLAC-16bit-44.1kHz]')
NAMES={'CD1':'01. I Love You.flac','CD2':'11. Free Style 2.flac'}

def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
    return h.hexdigest()

def make_job(path):
    return {'id':str(uuid.uuid4()),'path':path,'recursive':True,'scan_mode':'changes',
            'kind':'manual','state':'queued','processed':0,'added':0,'updated':0,
            'unchanged':0,'missing':0,'errors':[],'message':'fixture','created_at':time.time()}

def fail(message):raise RuntimeError(message)

with tempfile.TemporaryDirectory(prefix='vr_cd_rename_isolated_') as td:
    base=Path(td)
    music=base/'music'
    data=base/'db'
    backup=base/'backup'
    hashes={}
    for disc,name in NAMES.items():
        original=SOURCE/disc/name
        if not original.is_file() or original.is_symlink():fail('source missing '+disc)
        dst=music/'KPOP'/'FixtureArtist'/'FixtureAlbum'/disc/name
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(original,dst)
        hashes[disc]=digest(dst)
        if digest(original)!=hashes[disc]:fail('copy checksum '+disc)
    backup.mkdir(mode=0o700)
    i=index_engine.Index(music,data,lambda *args,**kwargs:[],index_scanner,track_search=False)
    i.setmeta('seed_complete','1')
    album_ids={}
    paths={}
    for disc in NAMES:
        path='KPOP/FixtureArtist/FixtureAlbum/'+disc
        job=make_job(path)
        i.execute_job(job)
        if job.get('state')!='completed' or job.get('errors'):fail('initial scan '+disc+': '+str(job))
        with i.db() as db:
            rows=db.execute('SELECT id FROM albums WHERE path=? AND missing=0 AND hidden=0',(path,)).fetchall()
        if len(rows)!=1:fail('initial catalog identity '+disc)
        album_ids[disc]=rows[0]['id']
        paths[disc]=path
    if album_ids['CD1']==album_ids['CD2']:fail('disc UUID collision')
    cb=mod.NativeAlbumIndex(i)
    os.environ[writer.RENAME_ENV]='true'
    completed=[]
    for disc,name in NAMES.items():
        old=paths[disc]+'/'+name
        new_name='trial-renamed-'+name
        before=music/old
        target=before.with_name(new_name)
        other='CD2' if disc=='CD1' else 'CD1'
        with i.db() as db:
            other_before=db.execute('SELECT id,path,missing,hidden,data FROM albums WHERE id=?',(album_ids[other],)).fetchone()
            other_before=tuple(other_before)
        planned=writer.plan(i.dbpath,music,album_ids[disc],old,new_name)
        if planned.get('state')!='READ_ONLY_RENAME_PLAN':fail('rename plan '+disc+': '+str(planned))
        with i.whole_job_lease(blocking=True):
            applied=writer.apply(i.dbpath,music,backup,album_ids[disc],old,new_name,
                                 planned['plan_id'],cb,True)
        if applied.get('state')!='RENAME_WRITE_COMPLETED':fail('apply '+disc+': '+str(applied))
        if before.exists() or not target.is_file() or digest(target)!=hashes[disc]:
            fail('renamed file not preserved '+disc)
        with i.db() as db:
            row=db.execute('SELECT id,path,missing,hidden FROM albums WHERE id=?',(album_ids[disc],)).fetchone()
            other_after=db.execute('SELECT id,path,missing,hidden,data FROM albums WHERE id=?',(album_ids[other],)).fetchone()
        if row is None or row['path']!=paths[disc] or row['missing'] or row['hidden']:
            fail('UUID changed '+disc)
        if tuple(other_after)!=other_before:fail('sibling Catalog changed '+disc)
        with i.whole_job_lease(blocking=True):
            restored=writer.restore(i.dbpath,music,backup,applied['operation_id'],cb,True)
        if restored.get('state')!='RENAME_RESTORE_COMPLETED':
            fail('restore '+disc+': '+str(restored))
        if not before.is_file() or target.exists() or digest(before)!=hashes[disc]:
            fail('restore file mismatch '+disc)
        with i.db() as db:
            row=db.execute('SELECT id,path,missing,hidden FROM albums WHERE id=?',(album_ids[disc],)).fetchone()
            other_after=db.execute('SELECT id,path,missing,hidden,data FROM albums WHERE id=?',(album_ids[other],)).fetchone()
        if row is None or row['path']!=paths[disc] or row['missing'] or row['hidden']:
            fail('restore UUID changed '+disc)
        if tuple(other_after)!=other_before:fail('restore sibling Catalog changed '+disc)
        completed.append(disc)
    print(json.dumps({'state':'CD_NATIVE_ISOLATED_RENAME_PASS','discs':completed,
                      'distinct_uuids':True,'restore':True,'sibling_catalog_unchanged':True,
                      'operating_media_writes':0,'operating_catalog_writes':0,
                      'fixture_removed_on_exit':True},ensure_ascii=False))
'''
try:
    result=subprocess.run(['docker','exec','-i',C,'python3','-'],input=TEST,
                          text=True,capture_output=True,timeout=240)
    if result.stdout:print(result.stdout.strip())
    if result.returncode:
        print('HOLD: isolated trial failed',file=sys.stderr)
        print(result.stderr[-4500:],file=sys.stderr)
        raise SystemExit(2)
finally:
    subprocess.run(['docker','exec',C,'rm','-f',remote],capture_output=True)
