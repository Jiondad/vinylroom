#!/usr/bin/env python3
"""Stage ONLY a fail-closed CD-folder Rename API guard for the known NAS binding.

Does not mutate /app, NAS live source, Catalog, media, or qualification receipt.
Use a separate reviewed deployment step after inspecting this staged candidate.
"""
import ast
import hashlib
import json
from pathlib import Path

SOURCE = Path('/volume1/docker/music-gateway/tag-editor-leasebusy-409-stage-20261123/tag_cover_http.py')
OUT = Path('/volume1/docker/music-gateway/tag-editor-cd-rename-guard-stage-20261123')
EXPECTED = '87e75c2a852e9f452032c9949d6313fbe3afa81c13f93ca383e04b7a133281dd'
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
raw=SOURCE.read_bytes()
actual=hashlib.sha256(raw).hexdigest()
if actual!=EXPECTED:
    raise SystemExit('HOLD: unexpected live source SHA256 '+actual)
source=raw.decode('utf-8')
if source.count(ANCHOR)!=1:
    raise SystemExit('HOLD: rename-plan anchor missing or ambiguous')
candidate=source.replace(ANCHOR,GUARD+ANCHOR,1)
ast.parse(candidate,filename='tag_cover_http.py')
OUT.mkdir(parents=True,exist_ok=True)
target=OUT/'tag_cover_http.py.candidate'
if target.exists():
    raise SystemExit('HOLD: candidate already exists; refusing overwrite')
target.write_text(candidate,encoding='utf-8')
result={'state':'CD_RENAME_GUARD_STAGED','source_sha256':actual,'candidate_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'candidate':str(target),'media_writes':0,'db_writes':0,'live_source_writes':0,'receipt_writes':0}
print(json.dumps(result,ensure_ascii=False))
