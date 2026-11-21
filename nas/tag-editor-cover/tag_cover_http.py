"""Phase H authenticated embedded-cover inspection/plans; HTTP apply is always disabled.
Uses existing Phase H/2C policy. No media/DB writes, no durable image uploads.
"""
import base64
import binascii
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile
import threading
from urllib.parse import parse_qs, urlsplit
import tag_cover_h as cover
from PIL import Image

PREFIX='/v2/admin/tag-cover'
VERSION='tag-cover-read-plan-v1'
SLOTS=threading.BoundedSemaphore(1)
MAX_JSON=14*1024*1024+4096

def _relative(value):
    if not isinstance(value,str) or not value or len(value)>2000 or '\\' in value or '\x00' in value:
        raise ValueError('invalid_relative_file')
    p=Path(value)
    if p.is_absolute() or any(x in ('..','.') for x in p.parts) or ':' in value:
        raise ValueError('absolute_or_unsafe_file_rejected')
    return value

def _identity(album_id,file):
    if not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',album_id or ''):
        raise ValueError('invalid_album_id')
    return album_id,_relative(file)

def _image(blob):
    info=cover._image_info(blob)
    with Image.open(io.BytesIO(blob)) as im:
        if im.format not in ('JPEG','PNG'):raise ValueError('image_must_be_jpeg_or_png')
        if im.width>cover.MAX_EDGE or im.height>cover.MAX_EDGE or im.width*im.height>cover.MAX_PIXELS:
            raise ValueError('cover_dimensions_exceed_limit')
        im.verify()
    return info

def _preview(blob):
    # Render decoded JPEG/PNG pixels, never forward untrusted SVG/HTML or a folder cover.
    _image(blob)
    with Image.open(io.BytesIO(blob)) as im:
        im.thumbnail((320,320));im=im.convert('RGB');out=io.BytesIO();im.save(out,'JPEG',quality=82)
    return 'data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode('ascii')

def inspect(catalog,music_root,album_id,file):
    _identity(album_id,file)
    album,entries,issues=cover.base.inventory(catalog,music_root,album_id)
    if issues:return cover.hold('album_inventory_issue',issues=issues)
    entry=cover.base._safe_track_choice(entries,album,file)
    if entry['format'] not in ('.flac','.mp3'):return cover.hold('cover_format_not_supported')
    if entry['size']>cover.MAX_AUDIO_BYTES:return cover.hold('audio_file_over_256MB')
    path=Path(music_root)/file;before=cover.base._file_token(path)
    sha=cover.base.file_sha256(path);pictures=cover._covers(path)
    result={'state':'EMBEDDED_COVER_INSPECTED','album_id':album_id,'file':file,
            'file_sha256':sha,'file_token':before,'catalog_digest':album['catalog_data_digest'],
            'front_covers':[p for p in pictures if p['type']==cover.FRONT],
            'other_cover_count':sum(p['type']!=cover.FRONT for p in pictures),
            'source':'actual_audio_embedded_front','folder_cover_included':False,
            'write_enabled':False,'media_writes':0,'db_writes':0,'version':VERSION}
    if path.suffix.lower()=='.flac':raw=[p.data for p in cover.FLAC(str(path)).pictures if p.type==cover.FRONT]
    else:raw=[p.data for p in cover._mp3_tags(path).getall('APIC') if p.type==cover.FRONT]
    if raw:
        if hashlib.sha256(raw[0]).hexdigest()!=result['front_covers'][0]['sha256']:
            return cover.hold('cover_changed_during_inspection')
        try:result['preview_data_url']=_preview(raw[0])
        except (ValueError,OSError):result['preview_hold']='embedded_picture_preview_not_supported'
    if not cover.base._token_matches(before,cover.base._file_token(path)) or cover.base.file_sha256(path)!=sha:
        return cover.hold('file_changed_during_inspection')
    return result

def plan(catalog,music_root,body):
    if not isinstance(body,dict) or set(body)-{'album_id','file','action','image_base64','expected_file_sha256','expected_catalog_digest'}:
        raise ValueError('unsupported_plan_fields')
    ident,file=_identity(body.get('album_id'),body.get('file'))
    action=body.get('action')
    if action not in cover.ACTIONS:raise ValueError('invalid_cover_action')
    if not re.fullmatch('[a-f0-9]{64}',body.get('expected_file_sha256','')) or not re.fullmatch('[a-f0-9]{64}',body.get('expected_catalog_digest','')):
        raise ValueError('inspect_current_file_first')
    blob=None
    if action!='remove':
        encoded=body.get('image_base64')
        if not isinstance(encoded,str) or len(encoded)>14*1024*1024:raise ValueError('cover_size_limit_10MB')
        try:blob=base64.b64decode(encoded,validate=True)
        except (ValueError,binascii.Error):raise ValueError('invalid_image_base64')
        _image(blob)
    elif body.get('image_base64'):raise ValueError('remove_must_not_include_image')
    # TemporaryDirectory creates mode 0700; image file 0600, removed even after failure.
    # No uploaded image remains as an unbound reusable apply asset.
    with tempfile.TemporaryDirectory(prefix='vinyl-cover-plan-') as td:
        image=None
        if blob is not None:
            image=Path(td)/'image';image.write_bytes(blob);image.chmod(0o600)
        result=cover.cover_plan(catalog,music_root,ident,file,action,image)
    if result.get('state')=='READ_ONLY_COVER_PLAN':
        if result['before_sha256']!=body['expected_file_sha256']:return cover.hold('file_changed_since_inspection')
        if result['catalog_digest']!=body['expected_catalog_digest']:return cover.hold('catalog_changed_since_inspection')
    result.update(write_enabled=False,http_apply_supported=False,version=VERSION)
    return result

def handle(h,index,music_root,origin,post=False):
    """Called only by a narrowly inserted existing Handler.index_api branch."""
    h._public_read=False
    try:
        h.index_admin() # Existing server-side verified OWNER/email gate; never accept client isAdmin.
        if h.member_gate() is False:return
        if h.headers.get('Origin') not in (None,origin) or (post and h.headers.get('Origin')!=origin):
            return h.reply(403,{'state':'HOLD','reason':'origin_not_allowed'})
        route=urlsplit(h.path).path
        if route==PREFIX+'/apply' or route==PREFIX+'/restore':
            return h.reply(405,{'state':'HOLD','reason':'cover_http_write_disabled','write_enabled':False})
        if index is None:return h.reply(503,{'state':'HOLD','reason':'catalog_unavailable'})
        if not SLOTS.acquire(blocking=False):return h.reply(409,{'state':'HOLD','reason':'cover_preview_busy'})
        try:
            if not post and route==PREFIX+'/inspect':
                q=parse_qs(urlsplit(h.path).query)
                if any(len(v)!=1 for v in q.values()) or set(q)-{'album_id','file'}:raise ValueError('invalid_inspect_query')
                result=inspect(index.dbpath,music_root,q.get('album_id',[''])[0],q.get('file',[''])[0])
            elif post and route==PREFIX+'/plan':
                length=int(h.headers.get('Content-Length','0'))
                if h.headers.get_content_type()!='application/json' or not 0<length<=MAX_JSON:raise ValueError('invalid_plan_request_size_or_type')
                result=plan(index.dbpath,music_root,json.loads(h.rfile.read(length)))
            else:return h.reply(404,{'state':'HOLD','reason':'cover_route_not_supported'})
            return h.reply(200,result)
        finally:SLOTS.release()
    except PermissionError:return h.reply(403,{'state':'HOLD','reason':'administrator_required'})
    except (ValueError,TypeError,KeyError,OSError,cover.base.sqlite3.Error):
        # Do not disclose arbitrary local exception paths or credentials.
        return h.reply(400,{'state':'HOLD','reason':'cover_input_or_file_verification_failed'})
