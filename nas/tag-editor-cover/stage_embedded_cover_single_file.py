#!/usr/bin/env python3
"""Prepare a SINGLE-FILE, non-deployed server.py patch from previously staged files.
Run inside the current Vinyl Room container. Writes only to /tmp.
"""
from pathlib import Path
import ast,hashlib,json,difflib

STAGE=Path('/tmp/vinyl-cover-embedded-stage')
CURRENT=Path('/app/server.py')
SERVER=STAGE/'server.py'
HELPER=STAGE/'album_embedded_fallback.py'
original=CURRENT.read_text(encoding='utf-8')
candidate=SERVER.read_text(encoding='utf-8')
helper=HELPER.read_text(encoding='utf-8')
# Confirm the staged file has the expected original baseline, excluding this narrow change.
before='''            if route=='/v2/cover':
                with INDEX.db() as db:row=db.execute('SELECT thumbnail FROM albums WHERE id=? AND hidden=0',(params.get('id',''),)).fetchone()
                if not row or not row[0]:return self.reply(404,{'message':'커버 없음'})
                import base64
                match=re.fullmatch(r'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)',row[0])
                if not match:return self.reply(404,{'message':'커버 없음'})
                body=base64.b64decode(match[2]);etag='"'+hashlib.sha256(body).hexdigest()+'"'
'''
if original.count(before)!=1 or candidate.count('from album_embedded_fallback import first_front_cover')!=1:
    raise SystemExit('HOLD: baseline changed or staged patch does not match')
# Avoid any dependency on a second module that would be lost on container recreate.
candidate=candidate.replace('from album_embedded_fallback import first_front_cover','',1)
candidate=candidate.replace('found=first_front_cover(ROOT,row[1])','found=_vr_embedded_front_cover(ROOT,row[1])',1)
for a,b in (
    ('MAX_FOLDER_ITEMS','_VR_EC_MAX_FOLDER_ITEMS'),
    ('MAX_TRACK_TRIES','_VR_EC_MAX_TRACK_TRIES'),
    ('MAX_COVER_BYTES','_VR_EC_MAX_COVER_BYTES'),
    ('DISC_NAMES','_VR_EC_DISC_NAMES'),
    ('_safe_children','_vr_embedded_safe_children'),
    ('first_front_cover','_vr_embedded_front_cover'),
):
    helper=helper.replace(a,b)
# Insert only before the first top-level function/class so imports are already loaded.
tree=ast.parse(candidate)
nodes=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef))]
if not nodes:raise SystemExit('HOLD: no anchor for helper')
anchor=nodes[0].lineno-1
lines=candidate.splitlines(keepends=True)
lines.insert(anchor,'\n# Album cover fallback: read-only, bounded; used only when thumbnail is absent.\n'+helper+'\n')
candidate=''.join(lines)
ast.parse(candidate,filename='server.py')
if candidate.count('def _vr_embedded_front_cover(')!=1 or candidate.count('found=_vr_embedded_front_cover(ROOT,row[1])')!=1:
    raise SystemExit('HOLD: helper wiring invalid')
output=STAGE/'server_single_file.py'
output.write_text(candidate,encoding='utf-8')
print(json.dumps({'state':'COVER_SINGLE_FILE_STAGE_PASS_NOT_DEPLOYED',
 'original_sha256':hashlib.sha256(original.encode()).hexdigest(),
 'candidate_sha256':hashlib.sha256(candidate.encode()).hexdigest(),
 'stage_path':str(output),'syntax':'PASS',
 'production_server_modified':False,'db_writes':0,'media_writes':0},ensure_ascii=False))
