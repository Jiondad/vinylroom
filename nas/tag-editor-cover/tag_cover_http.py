"""Phase H authenticated inspection/plans plus default-OFF qualified save adapter.
Uses existing Phase H/2C Writer policy. Saves require server-owned maintenance lease, NAS qualification and existing feature flags; no DB writes.
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

# TAG_EDITOR_SAVE_EXTENSION_V1 -- no engine or DB; server integration defaults OFF.
_SAVE_CONTEXT = {'guard': None, 'backup_root': None, 'qualified': False}
_READONLY_HANDLE = handle
_SAVE_ROUTES = frozenset((PREFIX+'/save-capabilities', PREFIX+'/tag-plan', PREFIX+'/tag-apply', PREFIX+'/apply'))

def configure_save_context(runtime_guard, backup_root, qualification_passed=False):
    """Server-owned context only. Guard must HOLD the existing index/AI maintenance lease.
    Qualification is set by deployment code after NAS fixture apply/restore succeeds;
    neither this function nor environment flags are exposed through HTTP.
    """
    if not callable(runtime_guard):raise ValueError('runtime_lease_guard_required')
    _SAVE_CONTEXT.update(guard=runtime_guard, backup_root=backup_root, qualified=qualification_passed if isinstance(qualification_passed,dict) else qualification_passed is True)

def save_capabilities():
    import os
    qualified=_SAVE_CONTEXT['qualified'];ready=bool(callable(_SAVE_CONTEXT['guard']) and _SAVE_CONTEXT['backup_root']);tag_ok=qualified is True or (isinstance(qualified,dict) and qualified.get('tags') is True);cover_ok=qualified is True or (isinstance(qualified,dict) and qualified.get('cover') is True)
    return {'state':'TAG_EDITOR_SAVE_CAPABILITIES','version':'tag-editor-save-v1',
        'tags':ready and tag_ok and os.getenv(cover.base.TRACK_WRITE_ENV)=='true',
        'cover':ready and cover_ok and os.getenv(cover.COVER_ENV)=='true', 'rename':False, 'mp3_tags':False,
        'tag_formats':['flac'],'tag_fields':sorted(cover.base.FLAC_WRITE_FIELDS),
        'reason':None if ready and tag_ok and cover_ok else 'nas_qualification_and_runtime_lease_not_connected'}

def _writer_edits(raw):
    if not isinstance(raw,dict):raise ValueError('invalid_edits')
    result={}
    for key,value in raw.items():
        if key not in ('genre','featuring') and isinstance(value,list):
            if len(value)!=1:raise ValueError('writer_requires_single_value')
            value=value[0]
        result[key]=value
    return result

def tag_plan(catalog,music_root,body):
    if not isinstance(body,dict) or set(body)-{'album_id','file','edits','before_tags','expected_plan_id','confirm_write'}:
        raise ValueError('unsupported_tag_fields')
    album_id,file=_identity(body.get('album_id'),body.get('file'))
    album,entries,issues=cover.base.inventory(catalog,music_root,album_id)
    entry=cover.base._safe_track_choice(entries,album,file)
    if entry['format']!='.flac':return cover.hold('phase2c_write_flac_only')
    raw=_writer_edits(body.get('edits'));edits=cover.base.validate_track_edits(raw)
    before=body.get('before_tags')
    if not isinstance(before,dict) or set(before)!=set(edits):return cover.hold('original_field_snapshot_required')
    if any(entry['tags'].get(k,[])!=before[k] for k in edits):return cover.hold('tags_changed_since_browser_read')
    return cover.base.track_write_plan(album,entries,issues,file,raw)

def save_request(catalog,music_root,route,body):
    """Single-file adapter, called under verified admin auth AND existing runtime lease."""
    caps=save_capabilities();kind='tags' if route.endswith('/tag-apply') else 'cover'
    if route.endswith('/tag-plan'):return tag_plan(catalog,music_root,body)
    if not isinstance(body,dict) or body.get('confirm_write') is not True:return cover.hold('explicit_save_confirmation_required')
    if not caps[kind]:return cover.hold('save_feature_not_qualified_or_off')
    expected=body.get('expected_plan_id')
    if not isinstance(expected,str) or not re.fullmatch('[a-f0-9]{64}',expected):return cover.hold('expected_plan_id_required')
    with _SAVE_CONTEXT['guard']():
        if kind=='tags':
            result=tag_plan(catalog,music_root,body)
            if result.get('state')!='READ_ONLY_TRACK_WRITE_PLAN' or result.get('plan_id')!=expected:return cover.hold('plan_changed_since_confirmation')
            result=cover.base.track_write_apply(catalog,music_root,_SAVE_CONTEXT['backup_root'],body['album_id'],body['file'],_writer_edits(body['edits']),expected,True,True,True)
        else:
            plan_body={k:v for k,v in body.items() if k not in ('expected_plan_id','confirm_write')}
            result=plan(catalog,music_root,plan_body)
            if result.get('state')!='READ_ONLY_COVER_PLAN' or result.get('plan_id')!=expected:return cover.hold('plan_changed_since_confirmation')
            with tempfile.TemporaryDirectory(prefix='vinyl-cover-apply-') as td:
                image=None
                if body['action']!='remove':
                    blob=base64.b64decode(body['image_base64'],validate=True);_image(blob)
                    image=Path(td)/'image';image.write_bytes(blob);image.chmod(0o600)
                result=cover.cover_apply(catalog,music_root,_SAVE_CONTEXT['backup_root'],body['album_id'],body['file'],body['action'],image,expected,True,True,True)
        # Existing Writer verifies audio/tags/backup and records operation.json; reread result.
        if result.get('state') in ('TAG_TRACK_WRITE_COMPLETED','COVER_WRITE_COMPLETED'):
            result['verification']=inspect(catalog,music_root,body['album_id'],body['file'])
            if result['verification'].get('state')!='EMBEDDED_COVER_INSPECTED':result['state']='HOLD_POSTWRITE_INSPECTION'
            elif kind=='tags':result['saved_tags']=cover.base.read_tags(Path(music_root)/body['file'])
        return result

def handle(h,index,music_root,origin,post=False):
    route=urlsplit(h.path).path
    if route not in _SAVE_ROUTES:return _READONLY_HANDLE(h,index,music_root,origin,post)
    h._public_read=False
    try:
        h.index_admin()
        if h.member_gate() is False:return
        if h.headers.get('Origin') not in (None,origin) or (post and h.headers.get('Origin')!=origin):return h.reply(403,cover.hold('origin_not_allowed'))
        if route.endswith('/save-capabilities') and not post:return h.reply(200,save_capabilities())
        if not post:return h.reply(405,cover.hold('post_required'))
        if index is None:return h.reply(503,cover.hold('catalog_unavailable'))
        length=int(h.headers.get('Content-Length','0'))
        if h.headers.get_content_type()!='application/json' or not 0<length<=MAX_JSON:raise ValueError('invalid_save_request')
        # Album-cover writes wait briefly for an in-flight Tag Editor inspect/plan/save
        # instead of failing immediately with HTTP 409. File CAS and the existing
        # runtime maintenance lease remain the authoritative write guards.
        acquired = SLOTS.acquire(timeout=30) if route == PREFIX+'/apply' else SLOTS.acquire(blocking=False)
        if not acquired:return h.reply(409,cover.hold('tag_editor_busy'))
        try:return h.reply(200,save_request(index.dbpath,music_root,route,json.loads(h.rfile.read(length))))
        finally:SLOTS.release()
    except PermissionError:return h.reply(403,cover.hold('administrator_required_or_runtime_not_idle'))
    except (ValueError,TypeError,KeyError,OSError,cover.base.sqlite3.Error):return h.reply(400,cover.hold('save_validation_or_file_conflict'))
