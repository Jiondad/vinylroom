#!/usr/bin/env python3
"""Install only the previously staged CD Rename API HOLD with pinned hashes.

Runs on Synology host. No catalog, media or index writes. Docker restart is a
separate, explicitly visible operator step. Existing file bind mount is
written in place (do NOT os.replace its inode).
"""
import ast
import hashlib
import json
import os
import stat
from pathlib import Path

ROOT = Path('/volume1/docker/music-gateway')
LIVE = ROOT/'tag-editor-leasebusy-409-stage-20261123/tag_cover_http.py'
STAGED = ROOT/'tag-editor-cd-rename-guard-stage-20261123/tag_cover_http.py.candidate'
AUDIT = ROOT/'tag-editor-cd-rename-guard-stage-20261123/rollback'
RECEIPT_ROOT = ROOT/'tag-editor-backups'
RECEIPT = RECEIPT_ROOT/'fullsave-native-qualified.json'
OLD = '87e75c2a852e9f452032c9949d6313fbe3afa81c13f93ca383e04b7a133281dd'
NEW = 'd07d29f02395b128fa9f65b92923451d3ebfbf510bf26105f61c0506588146cd'
ANCHOR = "    if route.endswith('/rename-plan'):return writer.plan(catalog,music_root,body['album_id'],body['file'],body.get('new_name'))"
GUARD = """    # CD1/CD2 are independent Catalog UUIDs; the installed native enqueue forbids
    # disc-folder indexing, and parent scan_set may merge/archive their UUIDs.
    # Reject both plan and apply before any Rename Writer media or Catalog writes.
    if not route.endswith('/rename-restore'):
        import sqlite3
        with sqlite3.connect(Path(catalog).resolve().as_uri()+'?mode=ro', uri=True) as ro:
            ro.execute('PRAGMA query_only=ON')
            album_paths=ro.execute('SELECT path FROM albums WHERE id=?',(body['album_id'],)).fetchall()
        if len(album_paths)!=1 or not isinstance(album_paths[0][0],str):
            return cover.hold('rename_album_identity_unavailable')
        if re.fullmatch(r'(?:cd|disc|disk)[\\s._-]*0*[1-9][0-9]*',Path(album_paths[0][0]).name,re.I):
            return cover.hold('cd_disc_rename_native_reindex_unqualified')
"""

def hold(msg): raise SystemExit('HOLD: '+msg)
def sha(b):return hashlib.sha256(b).hexdigest()
def owner_mode(path, mode):
    info=path.stat()
    return not path.is_symlink() and info.st_uid==os.geteuid() and stat.S_IMODE(info.st_mode)==mode

if not LIVE.is_file() or not STAGED.is_file() or not RECEIPT.is_file():
    hold('one or more files missing')
if not owner_mode(RECEIPT_ROOT,0o700) or not owner_mode(RECEIPT,0o600):
    hold('receipt owner/mode mismatch')
if LIVE.is_symlink() or STAGED.is_symlink() or AUDIT.exists():
    hold('live/staged symlink or pre-existing rollback directory')

live = LIVE.read_bytes()
candidate = STAGED.read_bytes()
old_receipt=RECEIPT.read_bytes()
if sha(live)!=OLD or sha(candidate)!=NEW:
    hold('source or candidate SHA256 mismatch')
source=live.decode('utf-8')
if source.count(ANCHOR)!=1:
    hold('source anchor mismatch')
derived=source.replace(ANCHOR,GUARD+ANCHOR,1).encode('utf-8')
if candidate!=derived:
    hold('candidate contains unexpected changes')
ast.parse(candidate.decode('utf-8'))

proof=json.loads(old_receipt)
names={'server.py','index_engine.py','catalog_lease.py','tag_cover_http.py',
       'tag_phase2c.py','tag_cover_h.py','tag_rename_writer.py','tag_native_index.py'}
if proof.get('schema')!='fullsave-native-qualification-v1' or proof.get('state')!='PASS':
    hold('qualification schema/state')
if set(proof.get('hashes',{}))!=names or proof['hashes']['tag_cover_http.py']!=OLD:
    hold('receipt source list or old hash mismatch')
# Verify every existing receipt hash against the currently installed sources.
for name in sorted(names):
    installed=ROOT/'tag-editor-leasebusy-409-stage-20261123'/name if name in ('server.py','tag_cover_http.py') else None
    if installed is None:
        # The live files are provided by separate Docker bind mounts. Use the
        # exact container mount mapping previously verified for this installation.
        paths={
            'index_engine.py':'tag-editor-fullsave-native-20261122/candidate/index_engine.py',
            'tag_native_index.py':'tag-editor-fullsave-native-20261122/candidate/tag_native_index.py',
            'tag_rename_writer.py':'tag-editor-aux-safe-save-stage-20261122/tag_rename_writer.py',
            'tag_phase2c.py':'tag-editor-aux-safe-save-stage-20261122/tag_phase2c.py',
            'tag_cover_h.py':'tag-editor-aux-safe-save-stage-20261122/tag_cover_h.py',
            'catalog_lease.py':'ai-sync-core-stage1/catalog_lease.py',
        }
        installed=ROOT/paths[name]
    if not installed.is_file() or installed.is_symlink() or sha(installed.read_bytes())!=proof['hashes'][name]:
        hold('receipt mismatch for '+name)

updated=dict(proof)
updated['hashes']=dict(proof['hashes'])
updated['hashes']['tag_cover_http.py']=NEW
new_receipt=(json.dumps(updated,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
# Back up both originals before touching either installed file.
AUDIT.mkdir(mode=0o700)
for path,data in [(AUDIT/'tag_cover_http.py.before',live),(AUDIT/'fullsave-native-qualified.json.before',old_receipt)]:
    fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,'wb') as f:
        f.write(data);f.flush();os.fsync(f.fileno())

def write_existing(path,blob):
    # Preserve inode for Docker's single-file bind mount and preserve mode.
    with path.open('r+b') as f:
        f.seek(0);f.write(blob);f.truncate();f.flush();os.fsync(f.fileno())

try:
    write_existing(LIVE,candidate)
    if sha(LIVE.read_bytes())!=NEW:raise RuntimeError('installed source hash mismatch')
    write_existing(RECEIPT,new_receipt)
    if json.loads(RECEIPT.read_bytes())['hashes']['tag_cover_http.py']!=NEW:
        raise RuntimeError('receipt update mismatch')
except Exception:
    write_existing(LIVE,live)
    write_existing(RECEIPT,old_receipt)
    raise

print(json.dumps({
    'state':'CD_RENAME_GUARD_INSTALLED_RESTART_PENDING',
    'live_sha256':sha(LIVE.read_bytes()),
    'receipt_tag_cover_http_sha256':NEW,
    'rollback_dir':str(AUDIT),
    'media_writes':0,'db_writes':0
},ensure_ascii=False))
