#!/usr/bin/env python3
"""Stage-only candidate: use an embedded FRONT cover when a Catalog thumbnail is absent.
Run inside Vinyl Room container. Only writes to /tmp/vinyl-cover-embedded-stage.
Does not import server, read DB/music, mutate runtime, or deploy.
"""
from pathlib import Path
import ast, difflib, hashlib, json

SOURCE=Path('/app/server.py')
STAGE=Path('/tmp/vinyl-cover-embedded-stage')
old="""            if route=='/v2/cover':
                with INDEX.db() as db:row=db.execute('SELECT thumbnail FROM albums WHERE id=? AND hidden=0',(params.get('id',''),)).fetchone()
                if not row or not row[0]:return self.reply(404,{'message':'커버 없음'})
                import base64
                match=re.fullmatch(r'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)',row[0])
                if not match:return self.reply(404,{'message':'커버 없음'})
                body=base64.b64decode(match[2]);etag='"'+hashlib.sha256(body).hexdigest()+'"'
"""
new="""            if route=='/v2/cover':
                ident=params.get('id','')
                if not UUID.fullmatch(ident):raise ValueError('잘못된 앨범 번호입니다.')
                with INDEX.db() as db:
                    row=db.execute('SELECT thumbnail,path,missing FROM albums WHERE id=? AND hidden=0',(ident,)).fetchone()
                if not row:return self.reply(404,{'message':'커버 없음'})
                if row[0]:
                    import base64
                    match=re.fullmatch(r'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)',row[0])
                    if not match:return self.reply(404,{'message':'커버 없음'})
                    body=base64.b64decode(match[2]);mime='image/'+match[1]
                else:
                    if row[2]:return self.reply(404,{'message':'커버 없음'})
                    from album_embedded_fallback import first_front_cover
                    found=first_front_cover(ROOT,row[1])
                    if not found:return self.reply(404,{'message':'커버 없음'})
                    body,mime=found
                etag='"'+hashlib.sha256(body).hexdigest()+'"'
"""
original="self.send_header('Content-Type','image/'+match[1]);self.send_header('Content-Length',str(len(body) if status==200 else 0));self.end_headers()"
replacement="self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body) if status==200 else 0));self.end_headers()"

helper='''"""Read-only, bounded embedded album FRONT cover fallback for catalog thumbnail misses."""
from pathlib import Path

MAX_FOLDER_ITEMS=500
MAX_TRACK_TRIES=8
MAX_COVER_BYTES=8*1024*1024
DISC_NAMES=('cd','disc','disk')

def _safe_children(folder):
    try:
        if folder.is_symlink() or not folder.is_dir():
            return []
        children=[]
        with folder.iterdir() as entries:
            for item in entries:
                children.append(item)
                if len(children)>MAX_FOLDER_ITEMS:
                    return []
        return sorted(children,key=lambda x:x.name.casefold())
    except (OSError,ValueError):
        return []

def first_front_cover(music_root, relative_path):
    """Return (image bytes, MIME) or None. No folder writes, DB changes or indexing."""
    try:
        root=Path(music_root).resolve(strict=True)
        relative=Path(relative_path)
        if relative.is_absolute() or not relative.parts or '..' in relative.parts or '\\\\' in str(relative):
            return None
        folder=root
        for part in relative.parts:
            folder=folder/part
            if folder.is_symlink():return None
        folder=folder.resolve(strict=True)
        if not folder.is_relative_to(root) or not folder.is_dir():return None
        children=_safe_children(folder)
        audio_ext={'.flac','.mp3'}
        candidates=[p for p in children if p.suffix.casefold() in audio_ext]
        discs=[p for p in children if p.is_dir() and not p.is_symlink() and
               p.name.casefold().startswith(DISC_NAMES)]
        for disc in discs[:8]:
            candidates.extend(p for p in _safe_children(disc) if p.suffix.casefold() in audio_ext)
        from mutagen import File as MutagenFile
        tried=0
        for p in candidates:
            if tried>=MAX_TRACK_TRIES:break
            if p.is_symlink() or not p.is_file():continue
            tried+=1
            try:
                audio=MutagenFile(str(p),easy=False)
                if audio is None:continue
                if p.suffix.casefold()=='.mp3':
                    pictures=audio.tags.getall('APIC') if audio.tags else []
                else:
                    pictures=getattr(audio,'pictures',[])
                for pic in pictures:
                    if getattr(pic,'type',None)!=3:continue
                    blob=pic.data
                    if not blob or len(blob)>MAX_COVER_BYTES:continue
                    if blob.startswith(b'\\xff\\xd8\\xff'):return blob,'image/jpeg'
                    if blob.startswith(b'\\x89PNG\\r\\n\\x1a\\n'):return blob,'image/png'
            except (OSError,ValueError,TypeError,AttributeError):
                continue
        return None
    except (OSError,ValueError,TypeError):
        return None
'''
s=SOURCE.read_text(encoding='utf-8')
if s.count(old)!=1 or s.count(original)!=1:
    raise SystemExit('HOLD: source pattern mismatch; no staging performed')
candidate=s.replace(old,new,1).replace(original,replacement,1)
ast.parse(candidate,filename='server.py')
ast.parse(helper,filename='album_embedded_fallback.py')
STAGE.mkdir(parents=True,exist_ok=True)
(STAGE/'server.py').write_text(candidate,encoding='utf-8')
(STAGE/'album_embedded_fallback.py').write_text(helper,encoding='utf-8')
print(json.dumps({'state':'COVER_FALLBACK_CANDIDATE_STAGED_NOT_DEPLOYED','stage_dir':str(STAGE),'server_original_sha256':hashlib.sha256(s.encode()).hexdigest(),'server_candidate_sha256':hashlib.sha256(candidate.encode()).hexdigest(),'changed_files':['server.py','album_embedded_fallback.py'],'syntax':'PASS','media_writes':0,'db_writes':0,'server_runtime_modified':False},ensure_ascii=False))
print('=== SERVER DIFF ===')
print(''.join(difflib.unified_diff(s.splitlines(True),candidate.splitlines(True),fromfile='server.py',tofile='stage/server.py')))
