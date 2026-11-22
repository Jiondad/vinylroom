#!/usr/bin/env python3
"""Vinyl Room Tag Editor Phase H: embedded FRONT cover plan/atomic writer.

Standalone NAS-local backend primitive. Production HTTP routes and web authentication
are deliberately NOT installed. Defaults to read-only; apply requires four gates.
Supports one selected FLAC or MP3 at a time; no directory covers, renames, DB writes.
Reuses the unchanged Phase 2C catalog, backup, file CAS, audit and locking primitives.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import zlib
import sys
import uuid
from datetime import datetime, timezone

import tag_phase2c as base
from mutagen.flac import FLAC, Picture
from mutagen.id3 import ID3, ID3NoHeaderError, APIC

COVER_ENV='VINYL_TAG_EDITOR_COVER_WRITE_ENABLED'
COVER_MAX_BYTES=10*1024*1024
MAX_EDGE=4096
MAX_PIXELS=16_000_000
MAX_AUDIO_BYTES=256*1024*1024
ACTIONS=('add','replace','remove')
FRONT=3


def hold(reason, **kw):return base.hold(reason,**kw)


def _jpeg_size(data):
    if not data.startswith(b'\xff\xd8'):raise ValueError('invalid_jpeg_signature')
    pos=2
    while pos < len(data):
        if data[pos]!=255:raise ValueError('invalid_jpeg_marker')
        while pos<len(data) and data[pos]==255:pos+=1
        if pos>=len(data):break
        marker=data[pos];pos+=1
        if marker in (0xd9,0xda):break
        if marker in (0x01,*range(0xd0,0xd8)):continue
        if pos+2>len(data):break
        length=int.from_bytes(data[pos:pos+2],'big')
        if length<2 or pos+length>len(data):raise ValueError('bad_jpeg_segment')
        if marker in (0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf):
            if length<7:raise ValueError('invalid_jpeg_sof')
            return int.from_bytes(data[pos+5:pos+7],'big'),int.from_bytes(data[pos+3:pos+5],'big')
        pos+=length
    raise ValueError('jpeg_dimensions_not_found')


def _image_info(blob):
    if not isinstance(blob,bytes) or not 0<len(blob)<=COVER_MAX_BYTES:
        raise ValueError('cover_size_limit_10MB')
    if blob.startswith(b'\x89PNG\r\n\x1a\n'):
        if len(blob)<33 or blob[12:16]!=b'IHDR':raise ValueError('invalid_png_ihdr')
        width=int.from_bytes(blob[16:20],'big');height=int.from_bytes(blob[20:24],'big')
        # PNG must contain complete, correctly CRC-protected IHDR/IDAT/IEND chunks.
        pos=8;seen_idat=False;seen_iend=False;first=True
        while pos<len(blob):
            if pos+12>len(blob):raise ValueError('truncated_png_chunk')
            n=int.from_bytes(blob[pos:pos+4],'big')
            end=pos+12+n
            if end>len(blob):raise ValueError('truncated_png_chunk')
            typ=blob[pos+4:pos+8]
            expected=int.from_bytes(blob[pos+8+n:end],'big')
            if zlib.crc32(blob[pos+4:pos+8+n])!=expected:
                raise ValueError('png_crc_mismatch')
            if first and (typ!=b'IHDR' or n!=13):raise ValueError('invalid_png_ihdr')
            first=False
            if typ==b'IDAT':seen_idat=True
            if typ==b'IEND':
                if n or end!=len(blob):raise ValueError('invalid_png_iend')
                seen_iend=True;break
            pos=end
        if not seen_idat or not seen_iend:raise ValueError('png_missing_image_data')
        mime='image/png'
    elif blob.startswith(b'\xff\xd8'):
        if not blob.endswith(b'\xff\xd9'):raise ValueError('jpeg_missing_eoi')
        width,height=_jpeg_size(blob);mime='image/jpeg'
    else:raise ValueError('image_must_be_jpeg_or_png')
    if width<1 or height<1 or width>MAX_EDGE or height>MAX_EDGE or width*height>MAX_PIXELS:
        raise ValueError('cover_dimensions_exceed_limit')
    return {'mime':mime,'width':width,'height':height,'bytes':len(blob),
            'sha256':hashlib.sha256(blob).hexdigest()}


def image_file(path):
    if path is None:raise ValueError('cover_image_required')
    p=Path(path)
    st=p.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or st.st_size>COVER_MAX_BYTES or st.st_size==0:
        raise ValueError('image_file_invalid')
    with p.open('rb') as f:blob=f.read(COVER_MAX_BYTES+1)
    info=_image_info(blob)
    return blob,info


def _cover_record(mime,kind,desc,data,width=0,height=0):
    return {'type':kind,'mime':mime,'desc':desc,'width':width,'height':height,
            'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}


def _mp3_tags(path):
    try:return ID3(path)
    except ID3NoHeaderError:return ID3()


def _covers(path):
    ext=Path(path).suffix.lower()
    if ext=='.flac':
        return [_cover_record(p.mime,p.type,p.desc,p.data,p.width,p.height) for p in FLAC(str(path)).pictures]
    if ext=='.mp3':
        return [_cover_record(p.mime,p.type,p.desc,p.data) for p in _mp3_tags(path).getall('APIC')]
    raise ValueError('cover_write_format_flac_mp3_only')


def _tag_state(path):
    ext=Path(path).suffix.lower()
    if ext=='.flac':return {str(k).casefold():list(v) for k,v in (FLAC(str(path)).tags or {}).items()}
    if ext=='.mp3':
        # Preserve the non-APIC frames; compare semantic payloads, not frame ordering.
        return sorted((frame.FrameID,frame.HashKey,frame.pprint())
                      for frame in _mp3_tags(path).values() if frame.FrameID!='APIC')
    raise ValueError('invalid_track_format')


def _mp3_audio_hash(path):
    # ID3v2 tag location is strictly the beginning. Compare *all* trailing bytes,
    # including optional ID3v1/APE content, without re-encoding audio.
    h=hashlib.sha256()
    with open(path,'rb') as f:
        head=f.read(10)
        if head[:3]==b'ID3':
            if len(head)!=10 or head[3] not in (2,3,4) or any(b&128 for b in head[6:10]):
                raise ValueError('nonstandard_id3_header')
            length=((head[6]&127)<<21)|((head[7]&127)<<14)|((head[8]&127)<<7)|(head[9]&127)
            offset=10+length+(10 if head[5]&0x10 and head[3]==4 else 0)
            if offset>=Path(path).stat().st_size:raise ValueError('mp3_without_audio_after_id3')
            f.seek(offset)
        else:f.seek(0)
        for part in iter(lambda:f.read(4*1024*1024),b''):h.update(part)
    return h.hexdigest()


def _stream_signature(path):
    return base.flac_frames_sha256(path) if Path(path).suffix.lower()=='.flac' else _mp3_audio_hash(path)


def _cover_change(original,action,blob,info):
    stage=base._stage_copy(original)
    try:
        original_covers=_covers(original);original_tags=_tag_state(original)
        stream=_stream_signature(original)
        ext=Path(original).suffix.lower()
        if ext=='.flac':
            audio=FLAC(str(stage))
            saved=[p for p in audio.pictures if p.type!=FRONT]
            audio.clear_pictures()
            for pic in saved:audio.add_picture(pic)
            if action!='remove':
                new=Picture();new.type=FRONT;new.mime=info['mime'];new.desc='';new.data=blob
                new.width=info['width'];new.height=info['height'];new.depth=24;new.colors=0
                audio.add_picture(new)
            audio.save()
        else:
            tags=_mp3_tags(str(stage));other=[p for p in tags.getall('APIC') if p.type!=FRONT]
            tags.delall('APIC')
            for pic in other:tags.add(pic)
            if action!='remove':tags.add(APIC(encoding=3,mime=info['mime'],type=FRONT,desc='',data=blob))
            tags.save(str(stage),v2_version=3 if tags.version[1]==3 else 4)
        if _stream_signature(stage)!=stream:raise ValueError('audio_stream_changed')
        if _tag_state(stage)!=original_tags:raise ValueError('non_cover_metadata_changed')
        after=_covers(stage)
        old_others=sorted((p['type'],p['mime'],p['desc'],p['sha256']) for p in original_covers if p['type']!=FRONT)
        new_others=sorted((p['type'],p['mime'],p['desc'],p['sha256']) for p in after if p['type']!=FRONT)
        if old_others!=new_others:raise ValueError('other_covers_changed')
        fronts=[p for p in after if p['type']==FRONT]
        if action=='remove':
            if fronts:raise ValueError('front_cover_removal_failed')
        elif len(fronts)!=1 or fronts[0]['sha256']!=info['sha256']:
            raise ValueError('new_cover_verification_failed')
        base.os.chmod(stage,stat.S_IMODE(original.stat().st_mode))
        with open(stage,'rb') as f:base.os.fsync(f.fileno())
        return stage
    except BaseException:
        if stage.exists():stage.unlink()
        raise


def cover_plan(catalog,music_root,album_id,file,action,image_path=None):
    if action not in ACTIONS:return hold('invalid_cover_action')
    try:
        blob,info=image_file(image_path) if action!='remove' else (None,None)
        if action=='remove' and image_path:return hold('remove_must_not_include_image')
        album,entries,issues=base.inventory(catalog,music_root,album_id,allow_auxiliary_disc_dirs=True)
        if issues:return hold('album_inventory_issue',issues=issues)
        e=base._safe_track_choice(entries,album,file)
        if e['format'] not in ('.flac','.mp3'):return hold('cover_format_not_supported')
        if e['size']>MAX_AUDIO_BYTES:return hold('audio_file_over_256MB')
        if album['catalog_physical_file_count'] is not None and len(entries)!=album['catalog_physical_file_count']:
            return hold('catalog_file_count_mismatch')
        music=Path(music_root).resolve(strict=True);original=music/file
        tok=base._file_token(original)
        original_sha=base.file_sha256(original)
        if not base._token_matches(tok,base._file_token(original)):
            return hold('file_changed_during_preview')
        pics=_covers(original);front=[p for p in pics if p['type']==FRONT]
        if action=='add' and front:return hold('front_cover_already_present_use_replace')
        if action in ('replace','remove') and not front:return hold('no_front_cover_to_change')
        base_plan={'album_id':album_id,'catalog_digest':album['catalog_data_digest'],
                   'file':file,'file_sha256':original_sha,'action':action,
                   'image_sha256':info['sha256'] if info else None,
                   'prior_covers':pics}
        planid=base.digest(base_plan)
        return {'state':'READ_ONLY_COVER_PLAN','album_id':album_id,'file':file,'format':e['format'],
                'action':action,'plan_id':planid,'current_front':front,'other_cover_count':len(pics)-len(front),
                'new_cover':info,'before_sha256':original_sha,'file_token':tok,
                'catalog_digest':album['catalog_data_digest'],'album_path':album['path'],
                'media_writes':0,'db_writes':0,'approval':'NOT_APPROVED',
                'apply_supported':False}
    except (ValueError,OSError,base.sqlite3.Error) as e:return hold(type(e).__name__+':'+str(e))


def cover_apply(catalog,music_root,backup_root,album_id,file,action,image_path,expected_plan_id,
                approve_one=False,confirm_idle=False,confirm_write=False):
    if os.getenv(COVER_ENV)!='true':return hold('cover_writer_feature_off')
    if not (approve_one and confirm_idle and confirm_write and expected_plan_id):
        return hold('explicit_approval_required')
    try:
        backup_root=base._root_guard(music_root,backup_root,allow_missing=True)
        backup_root.mkdir(parents=True,exist_ok=True,mode=0o700)
        fd=os.open(str(backup_root/'.tag-editor-phase2.lock'),os.O_CREAT|os.O_RDWR,0o600)
        try:
            try:base.fcntl.flock(fd,base.fcntl.LOCK_EX|base.fcntl.LOCK_NB)
            except BlockingIOError:return hold('another_tag_editor_writer_active')
            plan=cover_plan(catalog,music_root,album_id,file,action,image_path)
            if plan['state']!='READ_ONLY_COVER_PLAN':return plan
            if plan['plan_id']!=expected_plan_id:return hold('plan_id_changed_since_preview')
            music=Path(music_root).resolve(strict=True);original=music/file
            image,info=image_file(image_path) if action!='remove' else (None,None)
            if info and info['sha256']!=plan['new_cover']['sha256']:
                return hold('image_changed_since_preview')
            before_sha=plan['before_sha256'];tok=plan['file_token']
            base._free_space_check([(backup_root,tok['size']),(music,tok['size'])])
            opid=uuid.uuid4().hex
            opdir=backup_root/('cover-operation-'+opid);opdir.mkdir(mode=0o700)
            opfile=opdir/'operation.json'
            rec={'file':file,'before_sha256':before_sha,'before_token':tok,
                 'backup_relative':str(Path('originals')/file),'after_sha256':None,'state':'planned'}
            op={'schema':1,'phase':'H_COVER','operation_id':opid,'album_id':album_id,
                'catalog_data_digest':plan['catalog_digest'],'album_path':plan['album_path'],
                'plan_id':expected_plan_id,'action':action,'created_utc':datetime.now(timezone.utc).isoformat(),
                'state':'preparing','files':[rec],'db_writes':0}
            base._audit_save(opfile,op)
            stage=None;swapped=False
            try:
                if not base._token_matches(tok,base._file_token(original)) or base.file_sha256(original)!=before_sha:
                    raise ValueError('file_changed_since_preview')
                backup=opdir/rec['backup_relative']
                base._make_backup(original,backup,before_sha)
                rec['state']='backed_up';base._audit_save(opfile,op)
                stage=_cover_change(original,action,image,info)
                rec['after_sha256']=base.file_sha256(stage)
                rec['state']='staged';op['state']='prepared';base._audit_save(opfile,op)
                base._verify_same_catalog(catalog,album_id,plan['catalog_digest'],plan['album_path'])
                if not base._token_matches(tok,base._file_token(original)) or base.file_sha256(original)!=before_sha:
                    raise ValueError('file_changed_before_replace')
                op['pending_file']=file;op['state']='applying';base._audit_save(opfile,op)
                os.replace(stage,original);stage=None;swapped=True
                base._fsync_dir(original.parent)
                rec['state']='replaced';op.pop('pending_file',None);base._audit_save(opfile,op)
                if base.file_sha256(original)!=rec['after_sha256']:
                    raise ValueError('postwrite_sha_mismatch')
                covers=_covers(original);front=[p for p in covers if p['type']==FRONT]
                if action=='remove' and front:raise ValueError('postwrite_front_cover_present')
                if action!='remove' and (len(front)!=1 or front[0]['sha256']!=info['sha256']):
                    raise ValueError('postwrite_front_cover_mismatch')
                rec['state']='verified';op['state']='completed';base._audit_save(opfile,op)
                return {'state':'COVER_WRITE_COMPLETED','operation_id':opid,'album_id':album_id,
                        'file':file,'action':action,'backup_dir':str(opdir),'media_writes':1,'db_writes':0,
                        'catalog_changed':False}
            except BaseException as exc:
                failures=[]
                if swapped:
                    try:base._restore_bytes_atomic(opdir/rec['backup_relative'],original,
                         rec['after_sha256'],before_sha,tok['mode'],tok['uid'],tok['gid'])
                    except BaseException as rollback_exc:failures.append(str(rollback_exc))
                op['state']='manual_recovery_required' if failures else 'failed_rolled_back'
                op['error']=type(exc).__name__+':'+str(exc)
                if failures:op['rollback_failed']=failures
                try:base._audit_save(opfile,op)
                except BaseException:pass
                return {'state':'HOLD_MANUAL_RECOVERY' if failures else 'HOLD_ROLLED_BACK',
                        'reason':op['error'],'operation_id':opid,'rollback_failed':failures,
                        'media_writes':int(swapped),'db_writes':0}
            finally:
                if stage is not None and stage.exists():stage.unlink()
        finally:
            base.fcntl.flock(fd,base.fcntl.LOCK_UN);os.close(fd)
    except (ValueError,OSError,base.sqlite3.Error) as e:return hold(type(e).__name__+':'+str(e))


def cover_restore(music_root,backup_root,operation_id,approve_restore=False,confirm_idle=False):
    if os.getenv(COVER_ENV)!='true':return hold('cover_writer_feature_off')
    if not (approve_restore and confirm_idle):return hold('explicit_restore_approval_required')
    if not re.fullmatch(r'[0-9a-f]{32}',operation_id or ''):return hold('invalid_operation_id')
    try:
        root=base._root_guard(music_root,backup_root)
        fd=os.open(str(root/'.tag-editor-phase2.lock'),os.O_CREAT|os.O_RDWR,0o600)
        try:
            try:base.fcntl.flock(fd,base.fcntl.LOCK_EX|base.fcntl.LOCK_NB)
            except BlockingIOError:return hold('another_writer_active')
            opdir=root/('cover-operation-'+operation_id)
            op=json.loads((opdir/'operation.json').read_text(encoding='utf-8'))
            if op.get('schema')!=1 or op.get('phase')!='H_COVER' or op.get('operation_id')!=operation_id:
                return hold('invalid_cover_operation')
            if op.get('state') not in ('completed','applying','prepared','manual_recovery_required','restoring'):
                return hold('operation_not_restorable')
            if len(op['files'])!=1:return hold('invalid_file_count')
            rec=op['files'][0];relative=rec['file']
            album_dir=op['album_path'].rstrip('/')+'/'
            if not relative.startswith(album_dir) or relative.startswith('/') or '\\' in relative or '..' in Path(relative).parts:
                return hold('invalid_restore_path')
            music=Path(music_root).resolve(strict=True);original=music/relative
            if original.is_symlink() or not original.resolve(strict=True).is_relative_to(music):
                return hold('invalid_original_file_path')
            backup=opdir/rec['backup_relative']
            if not backup.resolve(strict=True).is_relative_to((opdir/'originals').resolve(strict=True)):
                return hold('invalid_backup_path')
            if base.file_sha256(backup)!=rec['before_sha256']:return hold('backup_hash_mismatch')
            current=base.file_sha256(original)
            if current==rec['before_sha256']:
                op['state']='restored';base._audit_save(opdir/'operation.json',op)
                return {'state':'COVER_RESTORE_NO_CHANGE','media_writes':0,'db_writes':0}
            if current!=rec['after_sha256']:return hold('restore_cas_conflict')
            op['state']='restoring';base._audit_save(opdir/'operation.json',op)
            base._restore_bytes_atomic(backup,original,rec['after_sha256'],rec['before_sha256'],
                                       rec['before_token']['mode'],rec['before_token']['uid'],rec['before_token']['gid'])
            if base.file_sha256(original)!=rec['before_sha256']:return hold('restore_posthash_mismatch')
            op['state']='restored';base._audit_save(opdir/'operation.json',op)
            return {'state':'COVER_RESTORE_COMPLETED','operation_id':operation_id,'media_writes':1,'db_writes':0}
        finally:
            base.fcntl.flock(fd,base.fcntl.LOCK_UN);os.close(fd)
    except (OSError,ValueError,KeyError,TypeError,json.JSONDecodeError) as e:
        return hold(type(e).__name__+':'+str(e))


def main(argv=None):
    parser=argparse.ArgumentParser(description='Vinyl Room embedded cover: read-only by default')
    parser.add_argument('command',choices=('check','plan','apply','restore'))
    parser.add_argument('--catalog',default=base.DEFAULT_CATALOG)
    parser.add_argument('--music-root',default=base.DEFAULT_MUSIC_ROOT)
    parser.add_argument('--backup-root',default=base.BACKUP_ROOT_DEFAULT)
    parser.add_argument('--album-id')
    parser.add_argument('--file')
    parser.add_argument('--action',choices=ACTIONS)
    parser.add_argument('--image-file')
    parser.add_argument('--expected-plan-id')
    parser.add_argument('--operation-id')
    parser.add_argument('--approve-one',action='store_true')
    parser.add_argument('--confirm-idle',action='store_true')
    parser.add_argument('--confirm-write',action='store_true')
    parser.add_argument('--approve-restore',action='store_true')
    args=parser.parse_args(argv)
    if args.command=='check':
        out={'state':'COVER_PHASE_H_READ_ONLY_READY','write_feature_enabled':os.getenv(COVER_ENV)=='true',
             'formats':('.flac','.mp3'),'actions':ACTIONS,'batch_write_supported':False,
             'folder_cover_write_supported':False,'db_writes':0,'media_writes':0}
    elif args.command=='restore':out=cover_restore(args.music_root,args.backup_root,args.operation_id,
                                               args.approve_restore,args.confirm_idle)
    elif args.command=='plan':out=cover_plan(args.catalog,args.music_root,args.album_id,args.file,
                                            args.action,args.image_file)
    else:out=cover_apply(args.catalog,args.music_root,args.backup_root,args.album_id,args.file,
                         args.action,args.image_file,args.expected_plan_id,
                         args.approve_one,args.confirm_idle,args.confirm_write)
    print(json.dumps(out,ensure_ascii=False,sort_keys=True,indent=2,default=str))
    return 0 if out['state'] not in ('HOLD','HOLD_MANUAL_RECOVERY','HOLD_ROLLED_BACK') else 2

if __name__=='__main__':sys.exit(main())
