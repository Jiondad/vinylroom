#!/usr/bin/env python3
"""Deploy qualified CD Rename native+HTTP candidate to pinned Docker bind mounts.

Never modifies media or catalog. Verifies the full 8-source receipt, preserves
inode for file bind mounts, retains rollback backups, and restores on failure.
The 13 previously passed tests are reused; the new isolated CD test was PASS.
"""
import hashlib,json,os,stat,subprocess,time,datetime
from pathlib import Path

ROOT=Path('/volume1/docker/music-gateway')
STAGE=ROOT/'tag-editor-cd-rename-guard-stage-20261123'
RECEIPT=ROOT/'tag-editor-backups/fullsave-native-qualified.json'
NATIVE=ROOT/'tag-editor-fullsave-native-20261122/candidate/tag_native_index.py'
HTTP=ROOT/'tag-editor-leasebusy-409-stage-20261123/tag_cover_http.py'
NATIVE_CAND=STAGE/'tag_native_index.py.fixed-candidate'
HTTP_CAND=STAGE/'tag_cover_http.py.cd-release-candidate'
MANIFEST=STAGE/'cd-rename-release-staged.json'
C='music-gateway-music-gateway-1'
OLD_NATIVE='ef1f6903e31359c07de6dbf56bd7ad615d21ec3b6b2325c98c143c22cd65c684'
OLD_HTTP='d07d29f02395b128fa9f65b92923451d3ebfbf510bf26105f61c0506588146cd'
NEW_NATIVE='e6e6e6127223c1b01e57aea3400180b3c80b160f0544935515052b172fd4c30e'
NEW_HTTP='ee1b251e65ea48a8f3e5d336bc88a5c760c3256ec9a8bac572bec9772700342b'
OLD_RECEIPT='d2749fc72bd4e037c54f34f5019f12afa89261dc6a73127e89dadbfc2e604e1f'
SOURCES={
 'server.py':'tag-editor-leasebusy-409-stage-20261123/server.py',
 'index_engine.py':'tag-editor-fullsave-native-20261122/candidate/index_engine.py',
 'catalog_lease.py':'ai-sync-core-stage1/catalog_lease.py',
 'tag_cover_http.py':'tag-editor-leasebusy-409-stage-20261123/tag_cover_http.py',
 'tag_phase2c.py':'tag-editor-aux-safe-save-stage-20261122/tag_phase2c.py',
 'tag_cover_h.py':'tag-editor-aux-safe-save-stage-20261122/tag_cover_h.py',
 'tag_rename_writer.py':'tag-editor-aux-safe-save-stage-20261122/tag_rename_writer.py',
 'tag_native_index.py':'tag-editor-fullsave-native-20261122/candidate/tag_native_index.py',
}
def sha(data):return hashlib.sha256(data).hexdigest()
def hold(msg):raise SystemExit('HOLD: '+msg)
def cmd(*args,check=True):
    cp=subprocess.run(list(args),capture_output=True,text=True)
    if check and cp.returncode:raise RuntimeError(' '.join(args)+' -> '+cp.stderr.strip())
    return cp
def existing_write(path, data):
    # NEVER os.replace(): Docker file bind mounts follow the existing inode.
    with path.open('r+b') as f:
        f.seek(0);f.write(data);f.truncate();f.flush();os.fsync(f.fileno())
def secure_file(path,uid,mode):
    info=path.stat()
    return path.is_file() and not path.is_symlink() and info.st_uid==uid and stat.S_IMODE(info.st_mode)==mode

if not STAGE.is_dir() or STAGE.is_symlink():hold('stage directory missing or symlink')
for p in (RECEIPT,NATIVE,HTTP,NATIVE_CAND,HTTP_CAND,MANIFEST):
    if not p.is_file() or p.is_symlink():hold('source missing or symlink '+str(p))
if not secure_file(RECEIPT,1026,0o600):hold('receipt owner/mode changed')
if RECEIPT.parent.is_symlink() or RECEIPT.parent.stat().st_uid!=1026 or stat.S_IMODE(RECEIPT.parent.stat().st_mode)!=0o700:hold('receipt directory changed')
manifest=json.loads(MANIFEST.read_text())
if manifest.get('state')!='STAGED_NOT_DEPLOYED' or manifest.get('isolated_qualification')!='CD_NATIVE_ISOLATED_RENAME_PASS':hold('staged qualification missing')
old_native=NATIVE.read_bytes();old_http=HTTP.read_bytes();old_receipt=RECEIPT.read_bytes()
candidate_native=NATIVE_CAND.read_bytes();candidate_http=HTTP_CAND.read_bytes()
for label,content,expected in (
    ('live native',old_native,OLD_NATIVE),('live HTTP',old_http,OLD_HTTP),
    ('receipt',old_receipt,OLD_RECEIPT),('candidate native',candidate_native,NEW_NATIVE),
    ('candidate HTTP',candidate_http,NEW_HTTP)):
    if sha(content)!=expected:hold(label+' hash mismatch')
if manifest.get('native_sha256')!=NEW_NATIVE or manifest.get('http_sha256')!=NEW_HTTP:
    hold('staging manifest hash mismatch')
proof=json.loads(old_receipt)
if proof.get('schema')!='fullsave-native-qualification-v1' or proof.get('state')!='PASS' or set(proof.get('hashes',{}))!=set(SOURCES):
    hold('receipt schema/state/source list mismatch')
for name,rel in SOURCES.items():
    p=ROOT/rel
    if not p.is_file() or p.is_symlink() or sha(p.read_bytes())!=proof['hashes'][name]:
        hold('installed source differs from receipt: '+name)
if proof['hashes']['tag_native_index.py']!=OLD_NATIVE or proof['hashes']['tag_cover_http.py']!=OLD_HTTP:
    hold('existing receipt candidate not expected')
inspect=json.loads(cmd('docker','inspect',C).stdout)[0]
if inspect['State']['Running'] is not True:hold('container not running')
mounts={m['Destination']:m['Source'] for m in inspect['Mounts'] if m.get('Type')=='bind'}
if mounts.get('/app/tag_native_index.py')!=str(NATIVE) or mounts.get('/app/tag_cover_http.py')!=str(HTTP):
    hold('Docker bind mount differs: refuse overwriting sources')
if os.geteuid()!=0:hold('deployment requires NAS root')
# The receipt records actual isolated PASS evidence; retain previous qualification
# without inventing newly executed tests.
updated=dict(proof)
updated['hashes']=dict(proof['hashes'])
updated['hashes'].update({'tag_native_index.py':NEW_NATIVE,'tag_cover_http.py':NEW_HTTP})
updated['cd_native_scoped_patch']={
 'state':'PASS','evidence':'CD_NATIVE_ISOLATED_RENAME_PASS',
 'cases':['CD1_apply_restore','CD2_apply_restore','independent_disc_uuids','sibling_catalog_unchanged'],
 'source_hashes':{'tag_native_index.py':NEW_NATIVE,'tag_cover_http.py':NEW_HTTP},
 'prior_qualification_reused':True,'operating_media_writes':0,'operating_catalog_writes':0
}
new_receipt=(json.dumps(updated,ensure_ascii=False,indent=2)+'\n').encode()
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
audit=STAGE/('rollback-cd-release-'+stamp)
if audit.exists():hold('backup folder exists')
audit.mkdir(mode=0o700)
for name,data in (
    ('tag_native_index.py.before',old_native),
    ('tag_cover_http.py.before',old_http),
    ('fullsave-native-qualified.json.before',old_receipt)):
    fd=os.open(str(audit/name),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
stopped=False
try:
    cmd('docker','stop','-t','30',C)
    stopped=True
    if json.loads(cmd('docker','inspect',C).stdout)[0]['State']['Running']:
        raise RuntimeError('container did not stop')
    existing_write(NATIVE,candidate_native)
    existing_write(HTTP,candidate_http)
    existing_write(RECEIPT,new_receipt)
    for name,rel in SOURCES.items():
        if sha((ROOT/rel).read_bytes())!=updated['hashes'][name]:
            raise RuntimeError('installed hash verification failed: '+name)
    if not secure_file(RECEIPT,1026,0o600):raise RuntimeError('receipt permission changed')
    cmd('docker','start',C)
    stopped=False
    for attempt in range(15):
        status=json.loads(cmd('docker','inspect',C).stdout)[0]['State']
        if status['Running']:break
        time.sleep(1)
    else:raise RuntimeError('container failed to become running')
    # Verify the exact container-visible bytes; do not claim live web health without it.
    verify=cmd('docker','exec',C,'python3','-c',
        'import hashlib,json,pathlib; '
        'names=["tag_native_index.py","tag_cover_http.py"]; '
        'p=json.loads(pathlib.Path("/tag-editor-backups/fullsave-native-qualified.json").read_text()); '
        'assert all(hashlib.sha256((pathlib.Path("/app")/n).read_bytes()).hexdigest()==p["hashes"][n] for n in names); '
        'print("CD_RELEASE_CONTAINER_HASH_PASS")')
    if 'CD_RELEASE_CONTAINER_HASH_PASS' not in verify.stdout:
        raise RuntimeError('container runtime hash verification failed')
except BaseException as exc:
    rollback_error=None
    try:
        if not stopped:
            cmd('docker','stop','-t','30',C)
            stopped=True
        existing_write(NATIVE,old_native)
        existing_write(HTTP,old_http)
        existing_write(RECEIPT,old_receipt)
        cmd('docker','start',C)
        stopped=False
    except BaseException as rollback_exc:
        rollback_error=repr(rollback_exc)
    print(json.dumps({'state':'HOLD_ROLLED_BACK' if rollback_error is None else 'HOLD_MANUAL_RECOVERY',
        'reason':repr(exc),'rollback_error':rollback_error,'rollback_dir':str(audit),
        'operating_media_writes':0,'operating_catalog_writes':0},ensure_ascii=False))
    raise SystemExit(2)

print(json.dumps({
  'state':'CD_RENAME_BACKEND_DEPLOYED_FRONTEND_PENDING',
  'container_running':True,'runtime_source_hashes_verified':True,
  'native_sha256':NEW_NATIVE,'http_sha256':NEW_HTTP,
  'receipt_sha256':sha(RECEIPT.read_bytes()),
  'rollback_dir':str(audit),
  'operating_media_writes':0,'operating_catalog_writes':0,
  'external_health':'NOT_CHECKED',
  'frontend_publish':'PENDING'
},ensure_ascii=False,indent=2))
