"""Vinyl Room Tag Editor: fail-closed single-file rename transaction (candidate).

A rename is NEVER allowed without a server-owned Catalog reindex callback installed
and explicitly qualified. The callback must synchronously update the Catalog under
the existing whole-job lease; this module has no direct Catalog-write shortcuts.
"""
import ctypes
import errno
import fcntl
import os
from pathlib import Path
import re
import stat
import uuid
from datetime import datetime, timezone
import tag_phase2c as base

RENAME_ENV='VINYL_TAG_EDITOR_RENAME_WRITE_ENABLED'  # separate default OFF gate
MAX_AUDIO_BYTES=256*1024*1024


def _no_replace(src,dst):
    """Linux renameat2(RENAME_NOREPLACE) prevents overwriting another media file."""
    libc=ctypes.CDLL(None,use_errno=True)
    fn=getattr(libc,'renameat2',None)
    if fn is None:raise OSError(errno.ENOSYS,'atomic no-replace rename unavailable')
    fn.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint)
    fn.restype=ctypes.c_int
    if fn(-100,os.fsencode(src),-100,os.fsencode(dst),1)!=0:
        err=ctypes.get_errno()
        raise OSError(err,os.strerror(err))
    base._fsync_dir(Path(src).parent)


def _target(filename,source):
    if not isinstance(filename,str) or not filename or len(filename)>220:
        raise ValueError('invalid_target_filename')
    if filename in ('.','..') or filename.endswith(('.', ' ')):
        raise ValueError('unsafe_target_filename')
    if filename!=Path(filename).name or '/' in filename or '\\' in filename:
        raise ValueError('target_must_be_basename')
    if any(ord(ch)<32 or ch in '<>:"|?*' for ch in filename) or '\x00' in filename:
        raise ValueError('unsafe_target_filename')
    if filename.split('.')[0].casefold().strip() in {
            'con','prn','aux','nul','com1','com2','lpt1','lpt2'}:
        raise ValueError('reserved_target_filename')
    if Path(filename).suffix.lower()!=Path(source).suffix.lower():
        raise ValueError('audio_extension_must_be_preserved')
    return filename


def _catalog_file_names(catalog,album_id):
    row,data=base.album_record(catalog,album_id)
    files=data.get('physical_files',[])
    if not isinstance(files,list):return None
    names=set()
    for entry in files:
        if not isinstance(entry,dict):return None
        value=next((entry[k] for k in ('path','filename','name') if isinstance(entry.get(k),str)),None)
        if value is None:return None
        names.add(Path(value).name.casefold())
    return names


def plan(catalog,music_root,album_id,file,new_name):
    try:
        album,entries,issues=base.inventory(catalog,music_root,album_id)
        if issues:return base.hold('album_inventory_issue',issues=issues)
        e=base._safe_track_choice(entries,album,file)
        if e['format'] not in ('.mp3','.flac'):return base.hold('rename_format_not_supported')
        if e['size']>MAX_AUDIO_BYTES:return base.hold('audio_file_over_256MB')
        new_name=_target(new_name,file)
        old=Path(music_root)/file
        new_relative=(Path(file).parent/new_name).as_posix()
        target=Path(music_root)/new_relative
        if new_relative==file:return base.hold('rename_no_change')
        if any(base.normalize(Path(x['file']).name)==base.normalize(new_name)
               and x['file']!=file and Path(x['file']).parent==Path(file).parent
               for x in entries):
            return base.hold('destination_collides_with_album_track')
        if target.exists() or target.is_symlink():
            return base.hold('destination_already_exists')
        if not target.parent.samefile(old.parent):
            return base.hold('rename_must_remain_in_original_folder')
        before_token=base._file_token(old)
        before_sha=base.file_sha256(old)
        if not base._token_matches(before_token,base._file_token(old)):
            return base.hold('source_changed_during_planning')
        catalog_names=_catalog_file_names(catalog,album_id)
        if catalog_names is None or Path(file).name.casefold() not in catalog_names:
            return base.hold('catalog_filename_inventory_not_verifiable')
        snap={'album_id':album_id,'album_digest':album['catalog_data_digest'],
              'source':file,'target':new_relative,'file_sha':before_sha,
              'token':before_token}
        return {'state':'READ_ONLY_RENAME_PLAN','album_id':album_id,'file':file,
                'new_file':new_relative,'new_name':new_name,'plan_id':base.digest(snap),
                'expected_catalog_digest':album['catalog_data_digest'],
                'expected_file_sha256':before_sha,'file_token':before_token,
                'album_path':album['path'],'media_writes':0,'db_writes':0}
    except (ValueError,OSError,base.sqlite3.Error) as ex:
        return base.hold(type(ex).__name__+':'+str(ex))


def apply(catalog,music_root,backup_root,album_id,file,new_name,expected_plan_id,
          reindex_album=None,confirm_write=False):
    """Caller MUST hold server-owned whole-job Catalog lease throughout this call.

    reindex_album(album_id, album_path) must perform a synchronous existing-index
    refresh, not a new SQL writer. If unavailable, HOLD before any filesystem write.
    """
    if os.getenv(RENAME_ENV)!='true' or not callable(reindex_album):
        return base.hold('rename_writer_or_catalog_reindex_off')
    if not confirm_write or not re.fullmatch(r'[a-f0-9]{64}',expected_plan_id or ''):
        return base.hold('explicit_rename_confirmation_required')
    try:
        backup=base._root_guard(music_root,backup_root,allow_missing=True)
        backup.mkdir(parents=True,exist_ok=True,mode=0o700)
        fd=os.open(str(backup/'.tag-editor-phase2.lock'),os.O_CREAT|os.O_RDWR,0o600)
        try:
            try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:return base.hold('another_tag_editor_writer_active')
            prepared=plan(catalog,music_root,album_id,file,new_name)
            if prepared.get('state')!='READ_ONLY_RENAME_PLAN':return prepared
            if prepared['plan_id']!=expected_plan_id:
                return base.hold('rename_plan_changed_since_confirmation')
            source=Path(music_root)/file
            target=Path(music_root)/prepared['new_file']
            expected_sha=prepared['expected_file_sha256']
            token=prepared['file_token']
            base._free_space_check([(backup,token['size'])])
            opid=uuid.uuid4().hex
            opdir=backup/('rename-operation-'+opid)
            opdir.mkdir(mode=0o700)
            opfile=opdir/'operation.json'
            backup_file=opdir/'originals'/file
            op={'schema':1,'phase':'TAG_RENAME_V1','operation_id':opid,
                'album_id':album_id,'source':file,'target':prepared['new_file'],
                'plan_id':expected_plan_id,'original_sha256':expected_sha,
                'original_catalog_digest':prepared['expected_catalog_digest'],
                'created_utc':datetime.now(timezone.utc).isoformat(),
                'state':'preparing','backup_relative':str(backup_file.relative_to(opdir))}
            base._audit_save(opfile,op)
            renamed=False
            try:
                base._make_backup(source,backup_file,expected_sha)
                base._verify_same_catalog(catalog,album_id,
                            prepared['expected_catalog_digest'],prepared['album_path'])
                if not base._token_matches(token,base._file_token(source)) or base.file_sha256(source)!=expected_sha:
                    raise ValueError('file_changed_before_rename')
                op['state']='moving';base._audit_save(opfile,op)
                _no_replace(source,target)
                renamed=True
                op['state']='reindexing';base._audit_save(opfile,op)
                if base.file_sha256(target)!=expected_sha:
                    raise ValueError('renamed_file_sha_mismatch')
                reindex_album(album_id,prepared['album_path'])
                observed=_catalog_file_names(catalog,album_id)
                if observed is None or new_name.casefold() not in observed or Path(file).name.casefold() in observed:
                    raise ValueError('catalog_reindex_did_not_reflect_rename')
                if base.file_sha256(target)!=expected_sha:
                    raise ValueError('renamed_file_changed_after_reindex')
                op['state']='completed';base._audit_save(opfile,op)
                return {'state':'RENAME_WRITE_COMPLETED','album_id':album_id,
                        'file':file,'new_file':prepared['new_file'],
                        'operation_id':opid,'audit_file':str(opfile),
                        'media_writes':1,'catalog_changed':True}
            except BaseException as ex:
                failures=[]
                if renamed:
                    try:
                        if not source.exists() and base.file_sha256(target)==expected_sha:
                            _no_replace(target,source)
                        else:raise ValueError('rename_rollback_cas_conflict')
                    except BaseException as rollback_error:
                        failures.append(type(rollback_error).__name__+':'+str(rollback_error))
                    if not failures:
                        try:reindex_album(album_id,prepared['album_path'])
                        except BaseException as rollback_error:
                            failures.append('catalog_rollback_failed:'+str(rollback_error))
                op['state']='manual_recovery_required' if failures else 'failed_rolled_back'
                op['reason']=type(ex).__name__+':'+str(ex)
                if failures:op['rollback_failed']=failures
                base._audit_save(opfile,op)
                return {'state':'HOLD_MANUAL_RECOVERY' if failures else 'HOLD_ROLLED_BACK',
                        'reason':op['reason'],'operation_id':opid,
                        'rollback_failed':failures,'audit_file':str(opfile)}
        finally:
            fcntl.flock(fd,fcntl.LOCK_UN);os.close(fd)
    except (ValueError,OSError,base.sqlite3.Error) as ex:
        return base.hold(type(ex).__name__+':'+str(ex))
