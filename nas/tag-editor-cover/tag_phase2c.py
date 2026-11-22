#!/usr/bin/env python3
"""Vinyl Room Tag Editor Phase 2B: track-aware readonly metadata/conversion planner.

Phase 1 safe inventory/database path validation reused. NO media or DB writes.
"""
from __future__ import annotations

import argparse
import contextlib
from datetime import date
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import sys
import unicodedata
from urllib.parse import quote
import uuid

try:
    import mutagen
except ImportError:
    mutagen = None

DEFAULT_CATALOG = '/data/catalog.sqlite3'
DEFAULT_MUSIC_ROOT = '/music'
AUDIO_EXT = frozenset({'.flac','.mp3','.m4a','.mp4','.ogg','.oga','.opus','.wav','.aif','.aiff','.ape','.wv','.wma','.dsf','.dff','.alac','.mka'})
READABLE = frozenset({'.flac','.mp3','.m4a','.mp4','.ogg','.oga','.opus'})
FIELDS = ('artist','album_artist','album','date','genre','title','tracknumber','discnumber','featuring')
DISC_RE = re.compile(r'(?i)^(?:cd|disc|disk|디스크)\s*[-_. ]?\s*0*[1-9][0-9]{0,2}(?:\s*[-_. ]\s*.+)?$')
MAX_RECORDS = 120


def canon(obj):
    return json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(',',':'))


def digest(obj):
    return hashlib.sha256(canon(obj).encode('utf-8')).hexdigest()


def normalize(s):
    return unicodedata.normalize('NFKC',str(s or '')).strip().casefold()


def hold(reason, **kwargs):
    return {'state':'HOLD','reason':reason,'db_writes':0,'media_writes':0,**kwargs}


def db_connect(dbpath):
    p=Path(dbpath)
    if not p.is_file():
        raise ValueError('catalog_db_not_found')
    # SQLite opens the existing WAL snapshot in read-only mode, never uses a writer connection.
    uri='file:'+quote(str(p.resolve()),safe='/')+'?mode=ro'
    db=sqlite3.connect(uri,uri=True,timeout=3)
    db.row_factory=sqlite3.Row
    db.execute('PRAGMA query_only=ON')
    return db


def list_albums(dbpath, text, limit):
    if limit<1 or limit>50: return hold('limit_must_be_1_to_50')
    with contextlib.closing(db_connect(dbpath)) as db:
        clauses=['hidden=0','missing=0'];args=[]
        if text:
            clauses.append('(artist LIKE ? ESCAPE "\\" OR title LIKE ? ESCAPE "\\")')
            pattern='%'+text.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')+'%'
            args.extend([pattern,pattern])
        rows=db.execute('SELECT id,artist,title,path,year,format,data FROM albums WHERE '+' AND '.join(clauses)+' ORDER BY artist_key,year,title_key,id LIMIT ?',args+[limit]).fetchall()
    result=[]
    for row in rows:
        try:d=json.loads(row['data'])
        except (TypeError,ValueError):d={}
        result.append({'album_id':row['id'],'artist':row['artist'],'album':row['title'],'year':row['year'],'path':row['path'],'format':row['format'],'catalog_track_count':len(d.get('tracks',[])) if isinstance(d.get('tracks'),list) else None})
    return {'state':'READ_ONLY_ALBUM_LIST','count':len(result),'albums':result,'db_writes':0,'media_writes':0}


def album_record(dbpath,album_id):
    try: uuid.UUID(album_id)
    except (ValueError,TypeError):raise ValueError('invalid_album_id')
    with contextlib.closing(db_connect(dbpath)) as db:
        row=db.execute('SELECT id,artist,title,path,year,format,missing,hidden,data FROM albums WHERE id=?',(album_id,)).fetchone()
        if row is None:raise ValueError('album_id_not_found')
    if row['hidden'] or row['missing']:
        raise ValueError('album_missing_or_hidden')
    try:data=json.loads(row['data'])
    except (TypeError,ValueError):raise ValueError('invalid_catalog_album_data')
    if not isinstance(data,dict):raise ValueError('invalid_catalog_album_data')
    return row,data


def valid_album_folder(root,relative):
    if not isinstance(relative,str) or not relative or '\x00' in relative:
        raise ValueError('invalid_catalog_relative_path')
    if '\\' in relative or Path(relative).is_absolute():
        raise ValueError('non_relative_path')
    parts=Path(relative).parts
    if any(x in ('','.', '..') for x in parts):raise ValueError('path_traversal_rejected')
    root=Path(root).resolve(strict=True)
    if not root.is_dir():raise ValueError('music_root_not_directory')
    target=root
    for part in parts:
        target=target/part
        if target.is_symlink():raise ValueError('symlink_album_path')
    target=target.resolve(strict=True)
    if not target.is_relative_to(root) or not target.is_dir():
        raise ValueError('album_path_outside_music_root')
    return root,target


def _auxiliary_tree_issue(root,folder):
    """Bounded read-only check: ignore a disc subfolder ONLY if it has no audio.
    Links, inaccessible entries and unusual filesystem objects stay HOLD.
    """
    pending=[(folder,0)]
    visited=0
    while pending:
        directory,depth=pending.pop()
        if depth>8:return {'code':'nested_directory_inspection_limit','path':folder.relative_to(root).as_posix()}
        try:
            children=directory.iterdir()
            for entry in children:
                visited+=1
                if visited>2000:return {'code':'nested_directory_inspection_limit','path':folder.relative_to(root).as_posix()}
                if entry.is_symlink():return {'code':'nested_directory_symlink','path':entry.relative_to(root).as_posix()}
                if entry.is_dir():
                    pending.append((entry,depth+1))
                elif entry.is_file():
                    if entry.suffix.lower() in AUDIO_EXT:
                        return {'code':'nested_directory_contains_audio','path':entry.relative_to(root).as_posix()}
                else:return {'code':'nested_directory_special_file','path':entry.relative_to(root).as_posix()}
        except OSError:return {'code':'nested_directory_unreadable','path':directory.relative_to(root).as_posix()}
    return None


def discover_files(root,folder,allow_auxiliary_disc_dirs=False):
    files=[];issues=[]
    # Inspect album root and recognized CD/Disc subfolders only.
    try:children=sorted(folder.iterdir(),key=lambda p:p.name.casefold())
    except OSError:raise ValueError('album_folder_unreadable')
    dirs=[]
    for p in children:
        if p.is_symlink():
            issues.append({'code':'symlink_in_album_folder','path':p.relative_to(root).as_posix()})
        elif p.is_dir():
            dirs.append(p)
        elif p.is_file() and p.suffix.lower() in AUDIO_EXT:
            files.append(p)
    for d in dirs:
        if not DISC_RE.match(d.name):
            try:
                # An unknown child directory containing audio must not be silently excluded.
                contains_audio=any(x.is_file() and x.suffix.lower() in AUDIO_EXT for x in d.iterdir())
            except OSError:
                contains_audio=True
            if contains_audio:
                issues.append({'code':'unrecognized_nested_audio_folder','path':d.relative_to(root).as_posix()})
            continue
        for p in sorted(d.iterdir(),key=lambda p:p.name.casefold()):
            if p.is_symlink():
                issues.append({'code':'symlink_in_disc_folder','path':p.relative_to(root).as_posix()})
            elif p.is_file() and p.suffix.lower() in AUDIO_EXT:
                files.append(p)
            elif p.is_dir():
                if allow_auxiliary_disc_dirs:
                    issue=_auxiliary_tree_issue(root,p)
                    if issue:issues.append(issue)
                else:
                    issues.append({'code':'nested_directory_below_disc','path':p.relative_to(root).as_posix()})
    if not files:issues.append({'code':'no_audio_files_found'})
    if len(files)>MAX_RECORDS:issues.append({'code':'too_many_audio_files','count':len(files),'max':MAX_RECORDS})
    return files[:MAX_RECORDS],issues


def _as_list(value):
    if value is None:return []
    if isinstance(value,(bytes,bytearray)):
        return [value.decode('utf-8','replace')]
    if isinstance(value,(str,int,float)):
        return [str(value)]
    if isinstance(value,(list,tuple)):
        return [str(v) for v in value if isinstance(v,(str,int,float))]
    return [str(value)]


def inventory(dbpath,rootpath,album_id,allow_auxiliary_disc_dirs=False):
    row,data=album_record(dbpath,album_id)
    root,folder=valid_album_folder(rootpath,row['path'])
    paths,issues=discover_files(root,folder,allow_auxiliary_disc_dirs)
    entries=[]
    for p in paths:
        rel=p.relative_to(root).as_posix()
        if p.suffix.lower() not in READABLE:
            issues.append({'code':'unsupported_audio_format','path':rel,'extension':p.suffix.lower()})
            continue
        try:
            st=p.stat(follow_symlinks=False)
            if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
                raise ValueError('non_regular_or_hardlinked_file')
            tags=read_tags(p)
            entries.append({'file':rel,'format':p.suffix.lower(),'size':st.st_size,'mtime_ns':st.st_mtime_ns,'tags':tags})
        except (OSError,ValueError) as e:
            issues.append({'code':'file_read_failed','path':rel,'reason':str(e)})
    album={'id':row['id'],'artist':row['artist'],'title':row['title'],'year':row['year'],'path':row['path'],
           'format':row['format'],'catalog_track_count':len(data['tracks']) if isinstance(data.get('tracks'),list) else None,
           'catalog_physical_file_count':len(data['physical_files']) if isinstance(data.get('physical_files'),list) else None,
           'catalog_data_digest':hashlib.sha256(row['data'].encode('utf-8')).hexdigest()}
    return album,entries,issues


def validate_changes(raw):
    if not isinstance(raw,dict) or not raw or set(raw)-set(FIELDS):
        raise ValueError('changes_must_contain_only_supported_fields')
    out={}
    for field,value in raw.items():
        if field=='genre':
            if isinstance(value,str):value=[value]
            if not isinstance(value,list) or not value or len(value)>20:
                raise ValueError('genre_must_be_nonempty_list_or_string')
            if any(not isinstance(v,str) or not v.strip() or len(v)>200 or '\x00' in v for v in value):
                raise ValueError('invalid_genre_values')
            out[field]=[v.strip() for v in value]
        else:
            if not isinstance(value,str) or not value.strip() or len(value)>500 or '\x00' in value:
                raise ValueError('invalid_'+field)
            out[field]=[value.strip()]
        if field=='date':
            v=out[field][0]
            if not re.fullmatch(r'[0-9]{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12][0-9]|3[01]))?)?',v):
                raise ValueError('invalid_date_format')
            # Validate real calendar dates rather than accepting values such as Feb 31.
            if len(v)==4 and int(v)<1:raise ValueError('invalid_date_format')
            try:
                if len(v)==7:date.fromisoformat(v+'-01')
                elif len(v)==10:date.fromisoformat(v)
            except ValueError:raise ValueError('invalid_date_format')
    return out


def build_plan(album,entries,issues,changes):
    if issues:
        return hold('album_file_inventory_not_safe',album=album,issues=issues,inspected_files=len(entries))
    if not entries:return hold('no_supported_files',album=album)
    differing={}
    for field in changes:
        distinct={tuple(item['tags'][field]) for item in entries}
        if len(distinct)>1:
            differing[field]=[list(v) for v in sorted(distinct)]
    if differing:
        return hold('different_existing_values_between_tracks',album=album,fields=differing)
    if 'genre' in changes and len(changes['genre'])>1 and any(e['format']=='.mp3' for e in entries):
        return hold('multivalue_mp3_genre_needs_encoding_review',album=album)
    diffs=[]
    for e in entries:
        fields={field:{'before':e['tags'][field],'after':target} for field,target in changes.items() if e['tags'][field]!=target}
        diffs.append({'file':e['file'],'format':e['format'],'size':e['size'],'mtime_ns':e['mtime_ns'],'changes':fields})
    modified=sum(bool(d['changes']) for d in diffs)
    snapshot={'album_id':album['id'],'catalog_data_digest':album['catalog_data_digest'],
              'changes':changes,'files':[{'path':e['file'],'size':e['size'],'mtime_ns':e['mtime_ns'],'tags':{f:e['tags'][f] for f in changes}} for e in entries]}
    return {'state':'READ_ONLY_TAG_PLAN_READY' if modified else 'READ_ONLY_NO_CHANGE',
            'album':album,'change_fields':list(changes),'requested':changes,'files_total':len(entries),
            'files_to_change':modified,'files_no_change':len(entries)-modified,'plan_id':digest(snapshot),'diffs':diffs,
            'approval':'NOT_APPROVED','apply_supported':False,
            'db_writes':0,'media_writes':0,'external_requests':0}



# Phase 2B extension. Inventory and path safeguards above are inherited from Phase 1.
# Store joint-artist labels (e.g. "A\\B") unchanged; NEVER split or rewrite them as FEATURING.
from collections import defaultdict
from string import Formatter

TRACK_FIELDS = ('title','tracknumber','discnumber','artist','featuring','genre')
COMMON_FIELDS = ('album','date','album_artist')
ALL_TRACK_FIELDS = (*TRACK_FIELDS,*COMMON_FIELDS)
TWO_DIGIT_MAX = 99
FILENAME_PATTERNS = ('auto','track-title','disc-track-title','artist-title','track-artist-title','disc-track-artist-title')
TEMPLATE_FIELDS = frozenset(('disc','disc2','track','title','artist','featuring','album_artist'))


def _simple_list(obj,key):
    if obj.tags is None:return []
    return _as_list(obj.tags.get(key,[]))


def read_tags(path):
    """Read actual TITLE, numbered tags and exact FEATURING without fabricating values."""
    ext=path.suffix.lower()
    if ext not in READABLE:raise ValueError('unsupported_audio_format:'+ext)
    if mutagen is None:raise ValueError('mutagen_not_installed')
    try: obj=mutagen.File(str(path),easy=(ext=='.mp3'))
    except Exception as e:raise ValueError('mutagen_read_failed:'+type(e).__name__) from e
    if obj is None:raise ValueError('audio_format_unrecognized')
    if ext in ('.mp4','.m4a'):
        keys={'artist':'\xa9ART','album_artist':'aART','album':'\xa9alb','date':'\xa9day',
              'genre':'\xa9gen','title':'\xa9nam'}
        out={f:_simple_list(obj,k) for f,k in keys.items()}
        def _number(key):
            x=obj.tags.get(key,[]) if obj.tags is not None else []
            if not x:return []
            if isinstance(x[0],(tuple,list)) and x[0]:
                n=x[0][0]
                return [str(n)] if isinstance(n,int) and n>0 else []
            return []
        out['tracknumber']=_number('trkn')
        out['discnumber']=_number('disk')
        x=obj.tags.get('----:com.apple.iTunes:FEATURING',[]) if obj.tags is not None else []
        out['featuring']=[v.decode('utf-8','replace') if isinstance(v,bytes) else str(v) for v in x]
    else:
        keys={'artist':'artist','album_artist':'albumartist','album':'album','date':'date','genre':'genre',
              'title':'title','tracknumber':'tracknumber','discnumber':'discnumber'}
        out={f:_simple_list(obj,k) for f,k in keys.items()}
        out['featuring']=_simple_list(obj,'featuring') if ext!='.mp3' else []
        if ext=='.mp3':
            # EasyID3 does not register a standard FEATURING key. Read only the
            # explicit TXXX description; other contributor roles are not FEATURING.
            try:
                from mutagen.id3 import ID3
                raw=ID3(str(path))
                out['featuring']=[str(v) for frame in raw.getall('TXXX')
                                  if frame.desc.strip().casefold()=='featuring' for v in frame.text]
            except Exception as e:
                from mutagen.id3 import ID3NoHeaderError
                if not isinstance(e,ID3NoHeaderError):
                    raise ValueError('id3_featuring_read_failed:'+type(e).__name__) from e
    return {f:[v.strip() for v in out.get(f,[]) if isinstance(v,str) and v.strip()] for f in ALL_TRACK_FIELDS}


def number_component(raw):
    if not raw:return None
    value=str(raw[0]).strip()
    m=re.fullmatch(r'0*([0-9]{1,2})(?:\s*/\s*[0-9]{1,3})?',value)
    if not m:return None
    n=int(m.group(1))
    return n if 1<=n<=TWO_DIGIT_MAX else None


def track_fmt(n,original=None):
    if not isinstance(n,int) or not 1<=n<=TWO_DIGIT_MAX:raise ValueError('track_number_out_of_01_99')
    suffix=''
    if original:
        m=re.fullmatch(r'0*[0-9]{1,2}(\s*/\s*[0-9]{1,3})',str(original).strip())
        if m:suffix=m.group(1).replace(' ','')
    return f'{n:02d}'+suffix


def folder_from_path(path,depth=2):
    seg=path.split('/')
    if len(seg)<=depth:return None
    return '/'.join(seg[:depth])


def artist_folders(dbpath,text='',limit=30):
    if not 1<=limit<=100:return hold('limit_must_be_1_to_100')
    with contextlib.closing(db_connect(dbpath)) as db:
        rows=db.execute('SELECT artist,path FROM albums WHERE hidden=0 AND missing=0').fetchall()
    groups={}
    for r in rows:
        folder=folder_from_path(r['path'])
        if folder is None:continue
        if text and normalize(text) not in normalize(folder+' '+str(r['artist'])):continue
        item=groups.setdefault(folder,{'folder':folder,'album_count':0,'catalog_artist_labels':set()})
        item['album_count']+=1
        item['catalog_artist_labels'].add(r['artist'] or '')
    res=sorted(groups.values(),key=lambda v:(normalize(v['folder']),v['folder']))[:limit]
    return {'state':'READ_ONLY_ARTIST_FOLDERS','folder_depth':2,'total_matching_folders':len(groups),
            'folders':[{'folder':v['folder'],'album_count':v['album_count'],
                        'catalog_artist_labels':sorted(v['catalog_artist_labels'])[:12]} for v in res],
            'db_writes':0,'media_writes':0}


def folder_albums(dbpath,folder,limit=40):
    if not 1<=limit<=100:return hold('limit_must_be_1_to_100')
    if not folder or folder.startswith('/') or '\\' in folder or '\x00' in folder or any(x in ('','.','..') for x in folder.split('/')):
        return hold('invalid_artist_folder')
    with contextlib.closing(db_connect(dbpath)) as db:
        rows=db.execute('SELECT id,artist,title,year,path,format,data FROM albums WHERE hidden=0 AND missing=0 ORDER BY year,title,id').fetchall()
    albums=[]
    for r in rows:
        if not r['path'].startswith(folder+'/'):continue
        try:d=json.loads(r['data'])
        except (TypeError,ValueError):d={}
        albums.append({'album_id':r['id'],'artist':r['artist'],'album':r['title'],'date':r['year'],
                       'path':r['path'],'format':r['format'],'catalog_tracks':len(d.get('tracks',[])) if isinstance(d.get('tracks'),list) else None})
        if len(albums)>=limit:break
    return {'state':'READ_ONLY_ARTIST_ALBUMS','folder':folder,'count':len(albums),'albums':albums,
            'db_writes':0,'media_writes':0}


def _common(entries,field):
    patterns=defaultdict(list)
    for e in entries:
        patterns[tuple(e['tags'].get(field,[]))].append(e['file'])
    return {'uniform':len(patterns)==1,'values':[{'tags':list(k),'file_count':len(files)}
             for k,files in sorted(patterns.items(),key=lambda p:str(p[0]))],
            'missing_files':sum(not e['tags'].get(field) for e in entries)}


def _collaboration(text):
    # Display-only advisory. Never write these parts into actual file tags.
    if not isinstance(text,str) or '\\' not in text:return None
    parts=[s.strip() for s in text.split('\\')]
    return parts if len(parts)>=2 and all(parts) else None


def _track_row(e):
    tags=e['tags'];name=Path(e['file']).name
    title=tags.get('title',[])
    return {'file_name':name,'file':e['file'],'tracknumber_tag':tags.get('tracknumber',[]),
            'track_display':f"{number_component(tags['tracknumber']):02d}" if number_component(tags.get('tracknumber',[])) else None,
            'discnumber_tag':tags.get('discnumber',[]),'title_tag':title,'title_missing':not bool(title),
            'artist_tag':tags.get('artist',[]),'featuring_tag':tags.get('featuring',[]),
            'genre_tag':tags.get('genre',[]),'album_tag':tags.get('album',[]),'date_tag':tags.get('date',[]),
            'album_artist_tag':tags.get('album_artist',[]),
            'collaboration_display_members':[_collaboration(x) for x in tags.get('artist',[]) if _collaboration(x)],
            'size':e['size'],'mtime_ns':e['mtime_ns']}


def inspect_tracks(album,entries,issues):
    if issues:return hold('album_file_inventory_not_safe',album=album,issues=issues)
    album_artist=_common(entries,'album_artist')
    return {'state':'READ_ONLY_TRACKS_INSPECTED','album':album,
            'album_common':{f:_common(entries,f) for f in COMMON_FIELDS},
            'catalog_artist_collaboration_display_members':_collaboration(album.get('artist')),
            'tracks':[_track_row(e) for e in entries],
            'missing_title_count':sum(not e['tags'].get('title') for e in entries),
            'track_count':len(entries),
            'notes':['filename_and_TITLE_are_independent','featuring_is_separate_from_joint_artist',
                     'nonuniform_per_track_artist_or_genre_is_not_automatically_an_error'],
            'db_writes':0,'media_writes':0}


def _name_parts(filename):
    return Path(filename).stem,Path(filename).suffix


def filename_values(filename,pattern='auto'):
    if pattern not in FILENAME_PATTERNS:raise ValueError('invalid_filename_pattern')
    stem,_=_name_parts(filename)
    # Parse only the named format; auto intentionally does not guess who the artist is.
    specs={
      'disc-track-title':r'^(?P<disc>\d{1,2})\s*[-_]\s*(?P<track>\d{1,2})\s+[-_. ]*\s*(?P<title>.+)$',
      'track-title':r'^(?P<track>\d{1,2})\s*[-_. ]+\s*(?P<title>.+)$',
      'disc-track-artist-title':r'^(?P<disc>\d{1,2})\s*[-_]\s*(?P<track>\d{1,2})\s+[-_. ]*\s*(?P<artist>.+?)\s+[-–—]\s+(?P<title>.+)$',
      'track-artist-title':r'^(?P<track>\d{1,2})\s*[-_. ]+\s*(?P<artist>.+?)\s+[-–—]\s+(?P<title>.+)$',
      'artist-title':r'^(?P<artist>.+?)\s+[-–—]\s+(?P<title>.+)$',
    }
    modes=('disc-track-title','track-title') if pattern=='auto' else (pattern,)
    for mode in modes:
        m=re.fullmatch(specs[mode],stem)
        if not m:continue
        d=m.groupdict();out={}
        for k in ('disc','track'):
            if k in d and d[k] is not None:
                v=int(d[k])
                if not 1<=v<=99:raise ValueError(k+'_number_out_of_01_99')
                out['discnumber' if k=='disc' else 'tracknumber']=[str(v) if k=='disc' else f'{v:02d}']
        for k in ('title','artist'):
            if k in d and d[k] is not None:
                val=d[k].strip()
                if not val:raise ValueError('filename_empty_'+k)
                out[k]=[val]
        return {'pattern_used':mode,'fields':out}
    return None


def _make_snapshot(album,entries,operation,options,rows):
    return digest({'album_id':album['id'],'catalog_data_digest':album['catalog_data_digest'],
                   'operation':operation,'options':options,
                   'files':[{'file':e['file'],'size':e['size'],'mtime_ns':e['mtime_ns'],
                             'tags':e['tags']} for e in entries], 'rows':rows})


def from_filename_plan(album,entries,issues,pattern='auto',replace_existing=False):
    if issues:return hold('album_file_inventory_not_safe',album=album,issues=issues)
    rows=[];changed=0
    for e in entries:
        parsed=filename_values(Path(e['file']).name,pattern)
        if parsed is None:
            rows.append({'file':e['file'],'state':'UNPARSED','reason':'filename_does_not_match_pattern','changes':{}})
            continue
        changes={};skips={}
        for field,target in parsed['fields'].items():
            before=e['tags'].get(field,[])
            if field=='tracknumber' and before and number_component(before)==int(target[0]):
                if before!=target:skips[field]='existing_same_number_format_preserved'
                continue
            if field=='discnumber' and before and number_component(before)==int(target[0]):continue
            if before==target:continue
            if field=='artist' and any(_collaboration(v) for v in before):
                skips[field]='joint_artist_backslash_protected'
                continue
            if before and not replace_existing:
                skips[field]='existing_value_preserved'
            else:changes[field]={'before':before,'after':target}
        changed+=bool(changes)
        rows.append({'file':e['file'],'state':'PROPOSED' if changes else 'NO_CHANGE',
                     'parsed_pattern':parsed['pattern_used'],'parsed_fields':parsed['fields'],
                     'changes':changes,'skipped':skips})
    return {'state':'READ_ONLY_FILENAME_TO_TAG_PLAN','album':album,'pattern':pattern,'replace_existing':replace_existing,
            'tracks_total':len(entries),'tracks_with_proposals':changed,'rows':rows,
            'plan_id':_make_snapshot(album,entries,'filename_to_tag',{'pattern':pattern,'replace_existing':replace_existing},rows),
            'approval':'NOT_APPROVED','apply_supported':False,'db_writes':0,'media_writes':0}


def _sort_key(name):
    return [(0,int(x)) if x.isdigit() else (1,x.casefold()) for x in re.split(r'(\d+)',name)]


def _disc_from_directory(e):
    parts=Path(e['file']).parts
    for part in reversed(parts[:-1]):
        m=re.fullmatch(r'(?i)(?:cd|disc|disk|디스크)\s*[-_. ]?\s*0*(\d{1,2})',part)
        if m:
            n=int(m.group(1))
            if 1<=n<=99:return n
    return None


def track_number_plan(album,entries,issues,source='filename'):
    if issues:return hold('album_file_inventory_not_safe',album=album,issues=issues)
    if source not in ('filename','order'):return hold('invalid_number_source')
    derived=[];problems=[]
    for e in entries:
        parsed=filename_values(Path(e['file']).name,'auto')
        fd=number_component(e['tags'].get('discnumber',[])) or _disc_from_directory(e) or 1
        if parsed and parsed['fields'].get('discnumber'):
            fd=int(parsed['fields']['discnumber'][0])
        fn=int(parsed['fields']['tracknumber'][0]) if parsed and 'tracknumber' in parsed['fields'] else None
        if source=='filename' and fn is None:problems.append({'file':e['file'],'reason':'track_number_not_in_filename'})
        derived.append({'entry':e,'disc':fd,'filename_track':fn})
    if problems:return hold('cannot_safely_derive_track_number',issues=problems)
    if source=='order':
        grouped=defaultdict(list)
        for v in derived:grouped[v['disc']].append(v)
        for disc,group in grouped.items():
            group.sort(key=lambda x:_sort_key(Path(x['entry']['file']).name))
            if len(group)>TWO_DIGIT_MAX:return hold('more_than_99_tracks_in_disc',disc=disc,count=len(group))
            for i,v in enumerate(group,1):v['number']=i
    else:
        for v in derived:v['number']=v['filename_track']
    used=set();rows=[]
    for v in sorted(derived,key=lambda x:(x['disc'],x['number'],_sort_key(Path(x['entry']['file']).name))):
        key=(v['disc'],v['number'])
        if key in used:problems.append({'file':v['entry']['file'],'reason':'duplicate_track_number_on_disc','disc':v['disc'],'track':v['number']})
        used.add(key)
        tags=v['entry']['tags'];old_track=tags.get('tracknumber',[]);old_disc=tags.get('discnumber',[])
        new_track=[track_fmt(v['number'],old_track[0] if old_track else None)]
        new_disc=[str(v['disc'])]
        changes={}
        if old_track!=new_track:changes['tracknumber']={'before':old_track,'after':new_track}
        # Do not add DISCNUMBER=1 to each single-disc album unnecessarily.
        if v['disc']!=1 and old_disc!=new_disc:changes['discnumber']={'before':old_disc,'after':new_disc}
        rows.append({'file':v['entry']['file'],'disc':v['disc'],'track':f"{v['number']:02d}",
                     'changes':changes})
    if problems:return hold('track_number_conflicts',issues=problems)
    return {'state':'READ_ONLY_TRACK_NUMBER_PLAN','album':album,'source':source,'rows':rows,
            'tracks_total':len(entries),'tracks_to_change':sum(bool(x['changes']) for x in rows),
            'plan_id':_make_snapshot(album,entries,'number_tracks',{'source':source},rows),
            'approval':'NOT_APPROVED','apply_supported':False,'db_writes':0,'media_writes':0}


def filename_template(template,tags):
    if not isinstance(template,str) or not template or len(template)>240:
        raise ValueError('invalid_filename_template')
    tokens=list(Formatter().parse(template))
    for _literal,field,fmt,conversion in tokens:
        if field is not None and (field not in TEMPLATE_FIELDS or fmt or conversion):
            raise ValueError('unsupported_template_field')
    def _scalar(field):
        v=tags.get(field,[])
        if not v:return None
        return str(v[0])
    track=number_component(tags.get('tracknumber',[]))
    disc=number_component(tags.get('discnumber',[])) or 1
    values={'track':f'{track:02d}' if track else None,'disc':str(disc),'disc2':f'{disc:02d}',
            'title':_scalar('title'),'artist':_scalar('artist'),
            'featuring':', '.join(tags.get('featuring',[])) if tags.get('featuring') else None,
            'album_artist':_scalar('album_artist')}
    for _literal,field,_fmt,_conv in tokens:
        if field is not None and values[field] is None:
            raise ValueError('missing_tag_for_template:'+field)
    rendered=template.format_map(values).strip()
    if not rendered or rendered in ('.','..') or rendered[-1:] in (' ','.') or len(rendered)>220:
        raise ValueError('unsafe_rendered_filename')
    if re.search(r'[\\/\x00-\x1f<>:"|?*]',rendered):
        raise ValueError('unsafe_filename_characters')
    return rendered


def to_filename_plan(album,entries,issues,template='{disc}-{track} {title}'):
    if issues:return hold('album_file_inventory_not_safe',album=album,issues=issues)
    paths={str(Path(e['file']).parent).casefold():set() for e in entries}
    for e in entries:paths[str(Path(e['file']).parent).casefold()].add(normalize(Path(e['file']).name))
    rows=[];problems=[];proposed_by_folder=defaultdict(dict)
    for e in entries:
        old=Path(e['file']);parent=str(old.parent).casefold()
        try:target=filename_template(template,e['tags'])+old.suffix
        except ValueError as er:
            rows.append({'file':e['file'],'state':'HOLD','reason':str(er)})
            problems.append({'file':e['file'],'reason':str(er)});continue
        if target!=old.name:
            newkey=normalize(target)
            if newkey in paths[parent] and newkey!=normalize(old.name):
                problems.append({'file':e['file'],'reason':'rename_destination_already_exists','target':target})
            if newkey in proposed_by_folder[parent]:
                problems.append({'file':e['file'],'reason':'duplicate_proposed_filename','target':target,
                                 'other_file':proposed_by_folder[parent][newkey]})
            proposed_by_folder[parent][newkey]=e['file']
        rows.append({'file':e['file'],'current_file_name':old.name,'suggested_file_name':target,
                     'state':'RENAME_PROPOSED' if target!=old.name else 'NO_CHANGE'})
    if problems:return hold('unsafe_filename_conversion',album=album,issues=problems,rows=rows)
    return {'state':'READ_ONLY_TAG_TO_FILENAME_PLAN','album':album,'template':template,
            'files_to_rename':sum(r['state']=='RENAME_PROPOSED' for r in rows),
            'rows':rows,'plan_id':_make_snapshot(album,entries,'tag_to_filename',{'template':template},rows),
            'approval':'NOT_APPROVED','apply_supported':False,'db_writes':0,'media_writes':0}


FEAT_SUFFIX=re.compile(r'(?i)^(.*?)\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+(.+?)\s*[\)\]]\s*$')

def featuring_candidates(album,entries,issues):
    if issues:return hold('album_file_inventory_not_safe',album=album,issues=issues)
    rows=[]
    for e in entries:
        tag=e['tags']; title=tag.get('title',[])
        if not title:continue
        match=FEAT_SUFFIX.fullmatch(title[0])
        if match and match.group(1).strip() and match.group(2).strip():
            rows.append({'file':e['file'],'title_tag_unchanged':title,
                         'suggested_title':[match.group(1).strip()],
                         'suggested_featuring':[match.group(2).strip()],
                         'existing_featuring':tag.get('featuring',[]),
                         'review_required':True,'auto_split':False})
    return {'state':'READ_ONLY_FEATURING_CANDIDATES','album':album,'candidate_count':len(rows),
            'candidates':rows,'note':'artist_backslash_joint_album_not_converted_to_featuring',
            'db_writes':0,'media_writes':0,'apply_supported':False}


def validate_track_edits(raw):
    if not isinstance(raw,dict) or not raw or set(raw)-set(ALL_TRACK_FIELDS):
        raise ValueError('edits_must_contain_only_track_fields')
    result={}
    for key,value in raw.items():
        if key in ('genre','featuring'):
            if isinstance(value,str):value=[value]
            if not isinstance(value,list) or len(value)>20 or any(not isinstance(s,str) or not s.strip() or len(s)>250 or '\x00' in s for s in value):
                raise ValueError('invalid_'+key)
            # FEATURING can be explicitly cleared; genres must be nonempty to prevent accidental clearing.
            if key=='genre' and not value:raise ValueError('empty_genre_not_allowed')
            result[key]=[s.strip() for s in value]
        elif key in ('tracknumber','discnumber'):
            if isinstance(value,list) and len(value)==1:value=value[0]
            if not isinstance(value,(str,int)) or not str(value).isdigit():raise ValueError('invalid_number')
            n=int(value)
            if not 1<=n<=99:raise ValueError('track_or_disc_out_of_range')
            result[key]=[f'{n:02d}' if key=='tracknumber' else str(n)]
        else:
            values=value if isinstance(value,list) else [value]
            if not values or len(values)>20 or (key=='date' and len(values)!=1) or any(not isinstance(v,str) or not v.strip() or len(v)>500 or '\x00' in v for v in values):
                raise ValueError('invalid_'+key)
            result[key]=[v.strip() for v in values]
    return result


def track_edit_plan(album,entries,issues,target_file,raw_edits):
    if issues:return hold('album_file_inventory_not_safe',album=album,issues=issues)
    if not target_file or target_file.startswith('/') or '\\' in target_file:return hold('invalid_relative_track_file')
    edits=validate_track_edits(raw_edits)
    selected=[e for e in entries if e['file']==target_file]
    if len(selected)!=1:return hold('track_file_not_in_album')
    e=selected[0]
    if 'artist' in edits and any(_collaboration(v) for v in e['tags'].get('artist',[])) and edits['artist']!=e['tags']['artist']:
        return hold('joint_artist_migration_requires_separate_approval')
    changes={f:{'before':e['tags'].get(f,[]),'after':v} for f,v in edits.items() if e['tags'].get(f,[])!=v}
    return {'state':'READ_ONLY_TRACK_EDIT_PLAN','album':album,'file_name':Path(e['file']).name,
            'file':target_file,'changes':changes,
            'plan_id':_make_snapshot(album,entries,'edit_one_track',{'file':target_file,'edits':edits},[changes]),
            'approval':'NOT_APPROVED','apply_supported':False,'db_writes':0,'media_writes':0}



# Phase 2C reuses Phase 2 atomic-backup & FLAC preservation primitives.
import errno
import fcntl
import shutil
import tempfile
import time
from datetime import datetime, timezone
from mutagen.flac import FLAC

BACKUP_ROOT_DEFAULT='/data/tag-editor-backups'
WRITE_ENV='VINYL_TAG_EDITOR_WRITE_ENABLED'
MAX_WRITE_FILES=15
MAX_WRITE_BYTES=800_000_000
SAFETY_BYTES=100_000_000


def file_sha256(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for chunk in iter(lambda:f.read(4*1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()


def _synced_json(path,obj):
    target=Path(path)
    target.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.manifest-',dir=target.parent)
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as w:
            json.dump(obj,w,ensure_ascii=False,indent=2,sort_keys=True)
            w.flush();os.fsync(w.fileno())
        os.chmod(name,0o600)
        os.replace(name,target)
        _fsync_dir(target.parent)
    finally:
        if os.path.lexists(name):os.unlink(name)


def _fsync_dir(folder):
    try:
        fd=os.open(str(folder),os.O_RDONLY|os.O_DIRECTORY)
        try:os.fsync(fd)
        finally:os.close(fd)
    except OSError:
        pass  # Some network FS do not implement directory fsync.


def _file_token(path):
    st=os.stat(path,follow_symlinks=False)
    if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or Path(path).is_symlink():
        raise ValueError('nonregular_symlink_or_hardlinked')
    return {'dev':st.st_dev,'ino':st.st_ino,'size':st.st_size,'mtime_ns':st.st_mtime_ns,
            'mode':stat.S_IMODE(st.st_mode),'uid':st.st_uid,'gid':st.st_gid}


def _token_matches(original, current):
    return all(original.get(k)==current.get(k) for k in ('dev','ino','size','mtime_ns'))


def _root_guard(music_root,backup_root,allow_missing=False):
    music=Path(music_root).resolve(strict=True)
    base=Path(backup_root)
    if not base.is_absolute() or '\x00' in str(base):raise ValueError('backup_root_must_be_absolute')
    # Check existing ancestors, reject symlink segment before any write.
    current=Path(base.anchor)
    for part in base.parts[1:]:
        current=current/part
        if current.is_symlink():raise ValueError('backup_root_symlink_rejected')
    if not allow_missing and not base.is_dir():raise ValueError('backup_root_not_prepared')
    resolved=base.resolve(strict=False)
    if resolved==music or resolved.is_relative_to(music) or music.is_relative_to(resolved):
        raise ValueError('backup_root_must_be_separate_from_music')
    return base


def _stage_copy(src,destination_dir=None):
    src=Path(src)
    fd,tmp=tempfile.mkstemp(prefix='.vinyl-tag-stage-',suffix=src.suffix,dir=destination_dir or src.parent)
    try:
        with os.fdopen(fd,'wb') as out, open(src,'rb') as inp:
            shutil.copyfileobj(inp,out,length=4*1024*1024)
            out.flush();os.fsync(out.fileno())
        shutil.copystat(src,tmp,follow_symlinks=False)
        st=os.stat(src,follow_symlinks=False)
        if os.stat(tmp).st_uid!=st.st_uid or os.stat(tmp).st_gid!=st.st_gid:
            try:os.chown(tmp,st.st_uid,st.st_gid)
            except PermissionError as e:raise ValueError('cannot_preserve_file_owner') from e
        return Path(tmp)
    except BaseException:
        if os.path.exists(tmp):os.unlink(tmp)
        raise


def _flac_unchanged_signature(path):
    a=FLAC(str(path))
    # Discern audio's encoded checksum and non-target metadata including cover art.
    checksum=a.info.md5_signature
    pics=[(p.type,p.mime,p.desc,p.width,p.height,p.depth,p.colors,hashlib.sha256(p.data).hexdigest()) for p in a.pictures]
    tags={str(k).casefold():list(v) for k,v in (a.tags or {}).items()}
    return checksum,pics,tags



def flac_frames_sha256(path):
    """Hash FLAC frame bytes after metadata; verifies encoded audio is untouched."""
    h=hashlib.sha256()
    with open(path,'rb') as f:
        if f.read(4)!=b'fLaC':
            raise ValueError('non_native_flac_header')
        for _ in range(1000):
            b=f.read(4)
            if len(b)!=4:raise ValueError('corrupt_flac_metadata_header')
            size=int.from_bytes(b[1:4],'big')
            f.seek(size,os.SEEK_CUR)
            if b[0]&0x80:break
        else:
            raise ValueError('too_many_flac_metadata_blocks')
        for chunk in iter(lambda:f.read(4*1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()


def _make_stage(original,changes):
    stage=_stage_copy(original)
    try:
        before_checksum,before_pics,before_all=_flac_unchanged_signature(original)
        before_frames_sha=flac_frames_sha256(original)
        a=FLAC(str(stage))
        keymap={'artist':'artist','album_artist':'albumartist','album':'album','date':'date','genre':'genre'}
        for field,values in changes.items():a[keymap[field]]=values
        a.save()
        after_checksum,after_pics,after_all=_flac_unchanged_signature(stage)
        if after_checksum!=before_checksum or flac_frames_sha256(stage)!=before_frames_sha:
            raise ValueError('flac_audio_frames_changed')
        if after_pics!=before_pics:raise ValueError('flac_cover_art_changed')
        protected_keys=set(before_all)-{keymap[k] for k in changes}
        if any(before_all[k]!=after_all.get(k) for k in protected_keys):
            raise ValueError('untargeted_flac_tag_changed')
        for field in changes:
            if read_tags(stage)[field]!=changes[field]:
                raise ValueError('staged_tag_mismatch:'+field)
        os.chmod(stage,stat.S_IMODE(original.stat().st_mode))
        with open(stage,'rb') as f:os.fsync(f.fileno())
        return stage
    except BaseException:
        if stage.exists():stage.unlink()
        raise



def _free_space_check(paths):
    # Conservative: if paths share a device, total backup + stage bytes are charged once to it.
    space={}
    for target,minimum in paths:
        probe=Path(target)
        while not probe.exists():probe=probe.parent
        dev=probe.stat().st_dev
        if dev not in space:space[dev]={'path':probe,'need':0}
        space[dev]['need']+=minimum
    for value in space.values():
        if shutil.disk_usage(value['path']).free < value['need']+SAFETY_BYTES:
            raise ValueError('insufficient_backup_and_staging_space')


def _make_backup(file_path,backup_file,expected_sha):
    backup_file.parent.mkdir(parents=True,exist_ok=True)
    if backup_file.exists():raise ValueError('backup_collision')
    # b'xb' mode avoids silently overwriting an existing archive item.
    with open(file_path,'rb') as inp, open(backup_file,'xb') as out:
        shutil.copyfileobj(inp,out,4*1024*1024)
        out.flush();os.fsync(out.fileno())
    shutil.copystat(file_path,backup_file,follow_symlinks=False)
    os.chmod(backup_file,0o400)
    if file_sha256(backup_file)!=expected_sha:raise ValueError('backup_hash_verification_failed')


def _restore_bytes_atomic(backup,origin,expected_current_sha,expected_backup_sha,mode,uid,gid):
    if not Path(backup).is_file() or not Path(origin).is_file():raise ValueError('restore_file_missing')
    if file_sha256(origin)!=expected_current_sha:raise ValueError('restore_cas_conflict')
    if file_sha256(backup)!=expected_backup_sha:raise ValueError('backup_hash_failed_on_rollback')
    candidate=_stage_copy(backup,Path(origin).parent)
    try:
        os.chmod(candidate,mode)
        if (candidate.stat().st_uid,candidate.stat().st_gid)!=(uid,gid):
            os.chown(candidate,uid,gid)
        os.replace(candidate,origin)
        _fsync_dir(Path(origin).parent)
    finally:
        if candidate.exists():candidate.unlink()


def _verify_same_catalog(catalog,album_id,expected_digest,expected_path):
    row,_=album_record(catalog,album_id)
    if row['path']!=expected_path or hashlib.sha256(row['data'].encode('utf-8')).hexdigest()!=expected_digest:
        raise ValueError('catalog_changed_since_plan')


def _audit_save(opfile,op):
    op['updated_utc']=datetime.now(timezone.utc).isoformat()
    _synced_json(opfile,op)


# --- Phase 2C: Mp3tag-compatible pattern previews and a one-track FLAC write gate. ---
# These are intentionally detached from the operational index and AI engines.
FORMAT_FIELDS = {
    'track':'tracknumber', 'tracknumber':'tracknumber',
    'disc':'discnumber','discnumber':'discnumber',
    'albumartist':'album_artist','album_artist':'album_artist',
    'artist':'artist','album':'album','title':'title','year':'date',
    'date':'date','genre':'genre','featuring':'featuring','dummy':None,
}
FORMAT_TRACK_FIELDS=frozenset(('title','artist','tracknumber','discnumber','genre','featuring'))
FLAC_WRITE_FIELDS=FORMAT_TRACK_FIELDS
FULL_TAG_WRITE_FIELDS=frozenset(ALL_TRACK_FIELDS)
FULL_TAG_WRITE_ENV='VINYL_TAG_EDITOR_FULL_TAG_WRITE_ENABLED'  # defaults OFF pending NAS fixture qualification
TRACK_WRITE_ENV='VINYL_TAG_EDITOR_TRACK_WRITE_ENABLED'
TRACK_WRITE_MAX_BYTES=256*1024*1024


def parse_format(fmt,allow_dummy=True):
    """Accept %name% placeholders and %% escaped literal percent; no eval/expressions."""
    if not isinstance(fmt,str) or not fmt or len(fmt)>400:
        raise ValueError('invalid_format_string')
    chunks=[]; literal=[]; i=0;seen=set()
    def flush():
        if literal:
            chunks.append(('lit',''.join(literal)));literal.clear()
    while i<len(fmt):
        if fmt[i]!='%':literal.append(fmt[i]);i+=1;continue
        if i+1<len(fmt) and fmt[i+1]=='%':literal.append('%');i+=2;continue
        end=fmt.find('%',i+1)
        if end<0:raise ValueError('unclosed_format_placeholder')
        name=fmt[i+1:end].casefold()
        if name not in FORMAT_FIELDS:raise ValueError('unsupported_placeholder:'+name)
        if name=='dummy' and not allow_dummy:raise ValueError('dummy_cannot_generate_filename')
        field=FORMAT_FIELDS[name]
        if field is not None:
            if field in seen:raise ValueError('repeated_output_field:'+field)
            seen.add(field)
        flush();chunks.append(('var',name));i=end+1
    flush()
    if not any(k=='var' for k,_ in chunks):raise ValueError('pattern_has_no_variables')
    for left,right in zip(chunks,chunks[1:]):
        if left[0]=='var' and right[0]=='var':raise ValueError('adjacent_variables_ambiguous')
    return chunks


def _validate_piece(name,raw):
    value=raw.strip()
    if not value or '\x00' in value:return None
    field=FORMAT_FIELDS[name]
    if name in ('track','tracknumber','disc','discnumber'):
        if not re.fullmatch(r'[0-9]{1,2}',value):return None
        n=int(value)
        if not 1<=n<=99:return None
        return f'{n:02d}' if field=='tracknumber' else str(n)
    if name=='year':
        if not re.fullmatch('[0-9]{4}',value) or int(value)<1:return None
        return value
    if name=='date':
        if not re.fullmatch('[0-9]{4}(?:-[0-9]{2}(?:-[0-9]{2})?)?',value):return None
        return value
    if len(value)>500:return None
    return value


def extract_format(filename,fmt):
    """Return HOLD when the filename permits 2+ valid parses, rather than guessing.

    The literal separators are scanned and there are at most 2 candidate parses.
    %dummy% may occur multiple times, but is never exported into file tags.
    """
    chunks=parse_format(fmt,True)
    stem=Path(filename).stem
    solutions=[]
    def walk(i,pos,captured):
        if len(solutions)>1:return
        if i==len(chunks):
            if pos==len(stem):solutions.append(captured)
            return
        kind,val=chunks[i]
        if kind=='lit':
            if stem.startswith(val,pos):walk(i+1,pos+len(val),captured)
            return
        if i+1==len(chunks):
            remainder=stem[pos:]
            normalized=_validate_piece(val,remainder)
            if normalized is not None:walk(i+1,len(stem),captured+[(val,remainder,normalized)])
            return
        nextliteral=chunks[i+1][1]
        # parse_format explicitly forbids adjacent variables.
        start=pos+1
        while start<=len(stem):
            k=stem.find(nextliteral,start)
            if k<0:break
            piece=stem[pos:k]
            normalized=_validate_piece(val,piece)
            if normalized is not None:walk(i+1,k,captured+[(val,piece,normalized)])
            if len(solutions)>1:break
            start=k+1
    walk(0,0,[])
    if not solutions:return {'state':'UNPARSED','reason':'filename_does_not_match_format'}
    if len(solutions)>1:return {'state':'HOLD','reason':'ambiguous_filename_format'}
    extracted={};discarded=[]
    for name,original,normalized in solutions[0]:
        field=FORMAT_FIELDS[name]
        if field is None:discarded.append(original.strip())
        else:extracted[field]=[normalized]
    return {'state':'PARSED','fields':extracted,'discarded_dummy_parts':discarded}


def filename_pattern_plan(album,entries,issues,fmt,replace_existing=False):
    if issues:return hold('album_file_inventory_not_safe',issues=issues,album=album)
    try:parse_format(fmt,True)
    except ValueError as ex:return hold(str(ex))
    rows=[];counts={'proposed':0,'no_change':0,'unparsed':0,'held':0}
    for e in entries:
        r=extract_format(Path(e['file']).name,fmt)
        state=r['state'];changes={};skipped={}
        if state=='PARSED':
            for field,after in r['fields'].items():
                if field in COMMON_FIELDS:
                    skipped[field]='album_common_editor_only';continue
                before=e['tags'].get(field,[])
                if before==after:continue
                if field=='artist' and any(_collaboration(v) for v in before):
                    skipped[field]='joint_artist_backslash_protected';continue
                if before and not replace_existing:
                    skipped[field]='existing_value_preserved';continue
                if before and field=='tracknumber' and number_component(before)==int(after[0]) and before!=after:
                    skipped[field]='use_normalize_tracknumbers_for_existing_format';continue
                changes[field]={'before':before,'after':after}
            state='PROPOSED' if changes else 'NO_CHANGE'
        counts['proposed' if state=='PROPOSED' else 'no_change' if state=='NO_CHANGE' else 'held' if state=='HOLD' else 'unparsed']+=1
        rows.append({'file':e['file'],'filename':Path(e['file']).name,'state':state,
                     'parsed_fields':r.get('fields',{}),'discarded_dummy_parts':r.get('discarded_dummy_parts',[]),
                     'reason':r.get('reason'), 'changes':changes,'skipped':skipped})
    return {'state':'READ_ONLY_FORMAT_TO_TAG_PLAN','album':album,'format_string':fmt,
            'only_fill_empty':not replace_existing,'counts':counts,'rows':rows,
            'plan_id':_make_snapshot(album,entries,'phase2c_filename_format',
                                     {'format':fmt,'replace_existing':replace_existing},rows),
            'approval':'NOT_APPROVED','apply_supported':False,'db_writes':0,'media_writes':0}


def render_format(fmt,tags):
    chunks=parse_format(fmt,False)
    out=[]
    for kind,name in chunks:
        if kind=='lit':out.append(name);continue
        field=FORMAT_FIELDS[name]
        values=tags.get(field,[])
        if not values:raise ValueError('missing_tag_for_format:'+field)
        if name in ('track','tracknumber'):
            n=number_component(values)
            if n is None:raise ValueError('invalid_tracknumber_for_filename')
            out.append(f'{n:02d}')
        elif name in ('disc','discnumber'):
            n=number_component(values)
            if n is None:raise ValueError('invalid_discnumber_for_filename')
            out.append(str(n))
        elif name=='year':
            m=re.match(r'^[0-9]{4}',str(values[0]))
            if not m:raise ValueError('missing_year_for_filename')
            out.append(m.group())
        elif field in ('featuring','genre'):
            out.append(', '.join(values))
        elif len(values)>1:
            raise ValueError('multivalue_field_for_filename:'+field)
        else:out.append(str(values[0]))
    rendered=''.join(out).strip()
    if not rendered or rendered in ('.','..') or rendered[-1] in (' ','.') or len(rendered)>220:
        raise ValueError('unsafe_rendered_filename')
    if re.search(r'[\\/\x00-\x1f<>:"|?*]',rendered):
        raise ValueError('unsafe_filename_characters')
    if normalize(rendered.split('.')[0]) in {'con','prn','aux','nul','com1','com2','lpt1','lpt2'}:
        raise ValueError('reserved_filename')
    return rendered


def format_to_filename_plan(album,entries,issues,fmt):
    if issues:return hold('album_file_inventory_not_safe',issues=issues,album=album)
    try:parse_format(fmt,False)
    except ValueError as ex:return hold(str(ex))
    rows=[];problems=[];originals=set();destinations={}
    for e in entries:originals.add(normalize(e['file']))
    for e in entries:
        old=Path(e['file'])
        try:target=render_format(fmt,e['tags'])+old.suffix
        except ValueError as ex:
            problems.append({'file':e['file'],'reason':str(ex)})
            rows.append({'file':e['file'],'state':'HOLD','reason':str(ex)});continue
        newrel=(old.parent/target).as_posix()
        if normalize(newrel) in destinations and destinations[normalize(newrel)]!=e['file']:
            problems.append({'file':e['file'],'reason':'duplicate_rename_target','other_file':destinations[normalize(newrel)]})
        destinations[normalize(newrel)]=e['file']
        if newrel!=e['file'] and normalize(newrel) in originals and normalize(newrel)!=normalize(e['file']):
            problems.append({'file':e['file'],'reason':'destination_currently_exists'})
        rows.append({'file':e['file'],'current_file_name':old.name,'suggested_file_name':target,
                     'state':'RENAME_PROPOSED' if old.name!=target else 'NO_CHANGE'})
    if problems:return hold('unsafe_filename_format',album=album,issues=problems,rows=rows)
    return {'state':'READ_ONLY_FORMAT_TO_FILENAME_PLAN','album':album,'format_string':fmt,
            'files_to_rename':sum(x['state']=='RENAME_PROPOSED' for x in rows),
            'rows':rows,'plan_id':_make_snapshot(album,entries,'phase2c_filename_render',{'format':fmt},rows),
            'approval':'NOT_APPROVED','apply_supported':False,'db_writes':0,'media_writes':0}


def normalize_tracknumbers_plan(album,entries,issues):
    if issues:return hold('album_file_inventory_not_safe',issues=issues,album=album)
    rows=[];changes=0
    for e in entries:
        before=e['tags'].get('tracknumber',[])
        n=number_component(before)
        if n is None:
            rows.append({'file':e['file'],'state':'HOLD','reason':'missing_or_invalid_tracknumber','existing_tag':before});continue
        after=track_fmt(n,before[0]);modified=before!=[after]
        rows.append({'file':e['file'],'state':'PROPOSED' if modified else 'NO_CHANGE',
                     'before':before,'after':[after]})
        changes+=modified
    return {'state':'READ_ONLY_TRACKNUMBER_NORMALIZATION','album':album,'files_to_change':changes,
            'rows':rows,'plan_id':_make_snapshot(album,entries,'phase2c_normalize_tracknumber',{},rows),
            'approval':'NOT_APPROVED','apply_supported':False,'db_writes':0,'media_writes':0}


def _safe_track_choice(entries,album,target_file):
    if not target_file or target_file.startswith('/') or '\\' in target_file or '..' in Path(target_file).parts:
        raise ValueError('invalid_track_relative_path')
    selected=[e for e in entries if e['file']==target_file]
    if len(selected)!=1:raise ValueError('track_file_not_in_album')
    e=selected[0]
    if not e['file'].startswith(album['path'].rstrip('/')+'/'):
        raise ValueError('track_file_outside_album')
    return e


def track_write_plan(album,entries,issues,target_file,raw_edits):
    if issues:return hold('album_file_inventory_not_safe',issues=issues,album=album)
    try:
        e=_safe_track_choice(entries,album,target_file)
        edits=validate_track_edits(raw_edits)
        full=os.getenv(FULL_TAG_WRITE_ENV)=='true'
        allowed=FULL_TAG_WRITE_FIELDS if full and e['format'] in ('.flac','.mp3') else FLAC_WRITE_FIELDS if e['format']=='.flac' else frozenset()
        if set(edits)-allowed:raise ValueError('field_outside_qualified_writer_scope')
    except ValueError as ex:return hold(str(ex))
    if 'artist' in edits and any(_collaboration(x) for x in e['tags'].get('artist',[])) and edits['artist']!=e['tags']['artist']:
        return hold('joint_artist_migration_requires_separate_approval')
    diffs={key:{'before':e['tags'].get(key,[]),'after':value}
           for key,value in edits.items() if e['tags'].get(key,[])!=value}
    plan_id=_make_snapshot(album,entries,'phase2c_track_write',{'file':target_file,'edits':edits},[diffs])
    return {'state':'READ_ONLY_TRACK_WRITE_PLAN' if diffs else 'READ_ONLY_NO_CHANGE',
            'album':album,'file':target_file,'format':e['format'],'changes':diffs,
            'plan_id':plan_id,'approval':'NOT_APPROVED','apply_supported':False,
            'db_writes':0,'media_writes':0}


def _make_stage_track(original,changes):
    """Stage FLAC or MP3 tag changes without changing audio, embedded covers or unrelated metadata.

    MP3 and album-common fields require the separate FULL_TAG_WRITE_ENV gate, which
    remains OFF until fixture qualification and NAS runtime activation.
    """
    original=Path(original)
    full=os.getenv(FULL_TAG_WRITE_ENV)=='true'
    if original.suffix.lower()=='.mp3' and not full:
        raise ValueError('mp3_tag_writer_not_qualified')
    allowed=FULL_TAG_WRITE_FIELDS if full else FLAC_WRITE_FIELDS
    if not set(changes)<=allowed:
        raise ValueError('field_outside_qualified_writer_scope')
    stage=_stage_copy(original)
    try:
        if original.suffix.lower()=='.flac':
            before_md5,before_pics,before_tags=_flac_unchanged_signature(original)
            frame_sha=flac_frames_sha256(original)
            audio=FLAC(str(stage))
            for field,value in changes.items():
                key='albumartist' if field=='album_artist' else field
                if value:audio[key]=value
                elif field=='featuring' and key in audio:del audio[key]
                else:raise ValueError('empty_field_not_allowed:'+field)
            audio.save()
            after_md5,after_pics,after_tags=_flac_unchanged_signature(stage)
            if after_md5!=before_md5 or flac_frames_sha256(stage)!=frame_sha:
                raise ValueError('flac_audio_frames_changed')
            if after_pics!=before_pics:raise ValueError('cover_art_changed')
            changed_keys={'albumartist' if k=='album_artist' else k for k in changes}
            if any(before_tags[k]!=after_tags.get(k) for k in set(before_tags)-changed_keys):
                raise ValueError('untargeted_metadata_changed')
        elif original.suffix.lower()=='.mp3':
            from mutagen.id3 import (ID3,ID3NoHeaderError,TIT2,TPE1,TPE2,TALB,TDRC,
                                    TCON,TRCK,TPOS,TXXX)
            import tag_cover_h as _cover
            original_stream=_cover._mp3_audio_hash(original)
            original_covers=_cover._covers(original)
            def get_id3(path):
                try:return ID3(str(path))
                except ID3NoHeaderError:return ID3()
            original_id3=get_id3(original)
            tag=get_id3(stage)
            mapping={'title':('TIT2',TIT2),'artist':('TPE1',TPE1),
                     'album_artist':('TPE2',TPE2),'album':('TALB',TALB),
                     'date':('TDRC',TDRC),'genre':('TCON',TCON),
                     'tracknumber':('TRCK',TRCK),'discnumber':('TPOS',TPOS)}
            changed_codes={mapping[k][0] for k in changes if k in mapping}
            def protected_frames(obj):
                return sorted((frame.FrameID,frame.HashKey,frame.pprint()) for frame in obj.values()
                    if frame.FrameID not in changed_codes
                    and not (frame.FrameID=='TXXX' and 'featuring' in changes
                             and frame.desc.strip().casefold()=='featuring'))
            protected_before=protected_frames(original_id3)
            for field,value in changes.items():
                if field=='featuring':
                    # Preserve every other TXXX custom field, even with similar descriptions.
                    for frame in list(tag.getall('TXXX')):
                        if frame.desc.strip().casefold()=='featuring':
                            tag.delall(frame.HashKey)
                    if value:tag.add(TXXX(encoding=3,desc='FEATURING',text=value))
                elif value:
                    code,klass=mapping[field]
                    tag.setall(code,[klass(encoding=3,text=value)])
                else:raise ValueError('empty_field_not_allowed:'+field)
            # Keep ID3v1/APE trailing data and explicit multi-values; never
            # rewrite old v1 fields or collapse v2.3 values with '/' separators.
            with open(original,'rb') as f:
                f.seek(-128,2) if original.stat().st_size>=128 else f.seek(0)
                tail=f.read(128)
            v1=tail if len(tail)==128 and tail.startswith(b'TAG') else b''
            tag.save(str(stage),v1=0,v2_version=3 if original_id3.version[1]==3 else 4,v23_sep=None)
            if v1:
                with open(stage,'ab') as f:f.write(v1)
            if get_id3(stage).unknown_frames!=original_id3.unknown_frames:raise ValueError('unknown_id3_frames_changed')
            if _cover._mp3_audio_hash(stage)!=original_stream:
                raise ValueError('mp3_audio_bytes_changed')
            if _cover._covers(stage)!=original_covers:
                raise ValueError('embedded_cover_changed')
            if protected_frames(get_id3(stage))!=protected_before:
                raise ValueError('untargeted_id3_metadata_changed')
        else:
            raise ValueError('writer_format_not_supported')
        after=read_tags(stage)
        for field,value in changes.items():
            if after.get(field,[])!=value:
                raise ValueError('staged_tag_verification_failed:'+field)
        os.chmod(stage,stat.S_IMODE(original.stat().st_mode))
        with open(stage,'rb') as f:os.fsync(f.fileno())
        return stage
    except BaseException:
        if stage.exists():stage.unlink()
        raise


def track_write_preflight(catalog,music_root,backup_root,album_id,target_file,edits,expected_plan_id):
    # Same bounded non-audio disc ancillary check as the read/plan route; fail closed.
    album,entries,issues=inventory(catalog,music_root,album_id,allow_auxiliary_disc_dirs=True)
    plan=track_write_plan(album,entries,issues,target_file,edits)
    if plan['state']!='READ_ONLY_TRACK_WRITE_PLAN':return hold(plan.get('reason','no_actual_change'))
    if plan['plan_id']!=expected_plan_id:return hold('plan_id_changed_since_preview',current_plan_id=plan['plan_id'])
    try:e=_safe_track_choice(entries,album,target_file)
    except ValueError as ex:return hold(str(ex))
    if e['format']!='.flac' and not (os.getenv(FULL_TAG_WRITE_ENV)=='true' and e['format']=='.mp3'):
        return hold('track_writer_format_not_qualified')
    if e['size']>TRACK_WRITE_MAX_BYTES:return hold('track_file_over_256MB')
    if album['catalog_physical_file_count'] is not None and len(entries)!=album['catalog_physical_file_count']:
        return hold('catalog_file_count_mismatch')
    _root_guard(music_root,backup_root,allow_missing=True)
    original=Path(music_root)/target_file
    before=_file_token(original)
    sha=file_sha256(original)
    after=_file_token(original)
    if not _token_matches(before,after) or before['size']!=e['size'] or before['mtime_ns']!=e['mtime_ns']:
        return hold('file_changed_during_hashing')
    return {'state':'WRITE_PREFLIGHT_READY','album':album,'file':target_file,
            'plan_id':plan['plan_id'],'changes':{k:v['after'] for k,v in plan['changes'].items()},
            'before_sha256':sha,'file_token':before,'media_bytes':e['size'],
            'before_tags':{k:v['before'] for k,v in plan['changes'].items()},
            'db_writes':0,'media_writes':0,'approval':'NOT_APPROVED'}


def track_write_apply(catalog,music_root,backup_root,album_id,target_file,edits,expected_plan_id,
                      approve_one=False,confirm_idle=False,confirm_write=False):
    if os.environ.get(TRACK_WRITE_ENV)!='true':return hold('track_writer_feature_off')
    if not (approve_one and confirm_idle and confirm_write and expected_plan_id):
        return hold('explicit_one_track_approval_required')
    try:
        root=_root_guard(music_root,backup_root,allow_missing=True)
        root.mkdir(parents=True,exist_ok=True,mode=0o700)
        # Share the existing Phase 2 lock with album-level edits.
        fd=os.open(str(root/'.tag-editor-phase2.lock'),os.O_CREAT|os.O_RDWR,0o600)
        try:
            try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:return hold('another_tag_editor_writer_active')
            pre=track_write_preflight(catalog,music_root,backup_root,album_id,target_file,edits,expected_plan_id)
            if pre['state']!='WRITE_PREFLIGHT_READY':return pre
            _free_space_check([(root,pre['media_bytes']),(music_root,pre['media_bytes'])])
            op_id=uuid.uuid4().hex
            opdir=root/('tag-operation-'+op_id)
            opdir.mkdir(mode=0o700)
            opfile=opdir/'operation.json'
            rec={'file':target_file,'before_sha256':pre['before_sha256'],
                 'backup_relative':str((Path('originals')/target_file)),
                 'before_token':pre['file_token'],'before_tags':pre['before_tags'],
                 'after_sha256':None,'state':'planned'}
            op={'schema':1,'phase':'2C','operation_id':op_id,'state':'preparing',
                'album_id':album_id,'album_path':pre['album']['path'],
                'catalog_data_digest':pre['album']['catalog_data_digest'],
                'plan_id':expected_plan_id,'changes':pre['changes'],
                'created_utc':datetime.now(timezone.utc).isoformat(),
                'files':[rec],'db_writes':0}
            _audit_save(opfile,op)
            stage=None;swapped=False
            original=Path(music_root)/target_file
            try:
                if not _token_matches(pre['file_token'],_file_token(original)) or file_sha256(original)!=pre['before_sha256']:
                    raise ValueError('file_changed_since_preflight')
                backup=opdir/rec['backup_relative']
                _make_backup(original,backup,pre['before_sha256'])
                rec['state']='backed_up';_audit_save(opfile,op)
                stage=_make_stage_track(original,pre['changes'])
                rec['after_sha256']=file_sha256(stage)
                rec['state']='staged';op['state']='prepared';_audit_save(opfile,op)
                _verify_same_catalog(catalog,album_id,pre['album']['catalog_data_digest'],pre['album']['path'])
                if not _token_matches(pre['file_token'],_file_token(original)) or file_sha256(original)!=pre['before_sha256']:
                    raise ValueError('file_changed_before_replace')
                op['pending_file']=target_file;op['state']='applying';_audit_save(opfile,op)
                os.replace(stage,original);stage=None;swapped=True
                _fsync_dir(original.parent)
                rec['state']='replaced';op.pop('pending_file',None);_audit_save(opfile,op)
                if file_sha256(original)!=rec['after_sha256']:
                    raise ValueError('postwrite_file_sha_mismatch')
                for key,value in pre['changes'].items():
                    if read_tags(original)[key]!=value:raise ValueError('postwrite_tag_mismatch:'+key)
                rec['state']='verified';op['state']='completed';_audit_save(opfile,op)
                return {'state':'TAG_TRACK_WRITE_COMPLETED','album_id':album_id,'file':target_file,
                        'operation_id':op_id,'plan_id':expected_plan_id,'changes':pre['changes'],
                        'backup_dir':str(opdir),'audit_file':str(opfile),
                        'media_writes':1,'db_writes':0,'catalog_changed':False}
            except BaseException as ex:
                failures=[]
                if swapped:
                    try:_restore_bytes_atomic(opdir/rec['backup_relative'],original,
                         rec['after_sha256'],rec['before_sha256'],rec['before_token']['mode'],
                         rec['before_token']['uid'],rec['before_token']['gid'])
                    except BaseException as r:failures.append(str(r))
                op['state']='manual_recovery_required' if failures else 'failed_rolled_back'
                op['error']=type(ex).__name__+':'+str(ex)
                if failures:op['rollback_failed']=failures
                try:_audit_save(opfile,op)
                except BaseException:pass
                return {'state':'HOLD_MANUAL_RECOVERY' if failures else 'HOLD_ROLLED_BACK',
                        'reason':op['error'],'operation_id':op_id,'backup_dir':str(opdir),
                        'rollback_failed':failures,'db_writes':0}
            finally:
                if stage is not None and stage.exists():stage.unlink()
        finally:
            fcntl.flock(fd,fcntl.LOCK_UN);os.close(fd)
    except (ValueError,OSError,sqlite3.Error) as ex:
        return hold(type(ex).__name__+':'+str(ex))


def track_write_restore(music_root,backup_root,operation_id,approve_restore=False,confirm_idle=False):
    if os.environ.get(TRACK_WRITE_ENV)!='true':return hold('track_writer_feature_off')
    if not (approve_restore and confirm_idle):return hold('explicit_restore_approval_required')
    if not re.fullmatch(r'[a-f0-9]{32}',operation_id or ''):return hold('invalid_operation_id')
    try:
        root=_root_guard(music_root,backup_root)
        fd=os.open(str(root/'.tag-editor-phase2.lock'),os.O_CREAT|os.O_RDWR,0o600)
        try:
            try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:return hold('another_writer_active')
            opdir=root/('tag-operation-'+operation_id)
            opfile=opdir/'operation.json'
            op=json.loads(opfile.read_text(encoding='utf-8'))
            if op.get('phase')!='2C' or op.get('operation_id')!=operation_id or op.get('schema')!=1:
                return hold('operation_not_phase2c')
            if op.get('state') not in {'completed','applying','prepared','manual_recovery_required','restoring'}:
                return hold('operation_not_restorable')
            if len(op['files'])!=1:return hold('invalid_one_track_audit')
            rec=op['files'][0];rel=rec['file'];album_dir=op['album_path'].rstrip('/')+'/'
            if not rel.startswith(album_dir) or rel.startswith('/') or '\\' in rel or '..' in Path(rel).parts:
                return hold('invalid_audit_file_path')
            folder=Path(music_root).resolve(strict=True)
            original=folder/rel
            if original.is_symlink() or not original.resolve(strict=True).is_relative_to(folder):
                return hold('invalid_original_restore_path')
            backup=opdir/rec['backup_relative']
            if not backup.resolve(strict=True).is_relative_to((opdir/'originals').resolve(strict=True)):
                return hold('invalid_backup_path')
            if file_sha256(backup)!=rec['before_sha256']:return hold('backup_sha_mismatch')
            old_sha=file_sha256(original)
            if old_sha==rec['before_sha256']:
                op['state']='restored';_audit_save(opfile,op)
                return {'state':'TAG_TRACK_RESTORE_NO_CHANGE','operation_id':operation_id,'media_writes':0,'db_writes':0}
            if not rec.get('after_sha256') or old_sha!=rec['after_sha256']:
                return hold('restore_cas_conflict')
            op['state']='restoring';_audit_save(opfile,op)
            _restore_bytes_atomic(backup,original,rec['after_sha256'],rec['before_sha256'],
                                  rec['before_token']['mode'],rec['before_token']['uid'],rec['before_token']['gid'])
            if file_sha256(original)!=rec['before_sha256']:
                op['state']='restore_manual_recovery_required';_audit_save(opfile,op)
                return hold('restore_posthash_mismatch')
            op['state']='restored';_audit_save(opfile,op)
            return {'state':'TAG_TRACK_RESTORE_COMPLETED','operation_id':operation_id,
                    'file':rel,'media_writes':1,'db_writes':0}
        finally:
            fcntl.flock(fd,fcntl.LOCK_UN);os.close(fd)
    except (ValueError,OSError,TypeError,json.JSONDecodeError) as ex:return hold(type(ex).__name__+':'+str(ex))


def main(argv=None):
    p=argparse.ArgumentParser(description='Vinyl Room Tag Editor Phase2C (OFF-by-default FLAC one-track writer)')
    p.add_argument('action',choices=('check','tracks','format-from-filename','format-to-filename',
        'normalize-tracknumbers','track-write-plan','track-write-preflight','track-write-apply','track-write-restore'))
    p.add_argument('--catalog',default=DEFAULT_CATALOG)
    p.add_argument('--music-root',default=DEFAULT_MUSIC_ROOT)
    p.add_argument('--backup-root',default=BACKUP_ROOT_DEFAULT)
    p.add_argument('--album-id')
    p.add_argument('--file')
    p.add_argument('--edits-json')
    p.add_argument('--format-string',default='%dummy% - %track% - %title%')
    p.add_argument('--allow-replace-existing',action='store_true')
    p.add_argument('--expected-plan-id')
    p.add_argument('--approve-one',action='store_true')
    p.add_argument('--confirm-maintenance-idle',action='store_true')
    p.add_argument('--confirm-audio-tag-write',action='store_true')
    p.add_argument('--approve-restore',action='store_true')
    p.add_argument('--operation-id')
    args=p.parse_args(argv)
    try:
        if args.action=='check':
            out={'state':'TAG_PHASE2C_READ_ONLY_READY' if mutagen is not None and Path(args.catalog).is_file() and Path(args.music_root).is_dir() else 'HOLD',
                 'catalog_exists':Path(args.catalog).is_file(),'music_root_exists':Path(args.music_root).is_dir(),
                 'mutagen_version':getattr(mutagen,'version_string',None),
                 'writer_feature_enabled':os.environ.get(TRACK_WRITE_ENV)=='true',
                 'writer_scope':'ONE_TRACK_FLAC_ONLY','filename_rename_apply_supported':False,
                 'features':['custom_percent_format','dummy_repeatable','filename_to_tag_preview',
                            'tag_to_filename_preview','tracknumber_01_99_normalization',
                            'one_track_flac_writer','joint_artist_backslash_preserved',
                            'featuring_independent','backup_restore_and_audit'],
                 'db_writes':0,'media_writes':0}
        elif args.action=='track-write-restore':
            out=track_write_restore(args.music_root,args.backup_root,args.operation_id,
                                    args.approve_restore,args.confirm_maintenance_idle)
        else:
            if not args.album_id:raise ValueError('album_id_required')
            if args.action=='track-write-apply':
                if not args.file or not args.edits_json:raise ValueError('file_and_edits_json_required')
                out=track_write_apply(args.catalog,args.music_root,args.backup_root,args.album_id,args.file,
                                      json.loads(args.edits_json),args.expected_plan_id,
                                      args.approve_one,args.confirm_maintenance_idle,args.confirm_audio_tag_write)
            elif args.action=='track-write-preflight':
                if not args.file or not args.edits_json:raise ValueError('file_and_edits_json_required')
                out=track_write_preflight(args.catalog,args.music_root,args.backup_root,args.album_id,args.file,
                                          json.loads(args.edits_json),args.expected_plan_id)
                if out.get('state')=='WRITE_PREFLIGHT_READY':
                    out.pop('file_token',None);out.pop('before_sha256',None)
            else:
                album,entries,issues=inventory(args.catalog,args.music_root,args.album_id)
                if args.action=='tracks':out=inspect_tracks(album,entries,issues)
                elif args.action=='format-from-filename':
                    out=filename_pattern_plan(album,entries,issues,args.format_string,args.allow_replace_existing)
                elif args.action=='format-to-filename':
                    out=format_to_filename_plan(album,entries,issues,args.format_string)
                elif args.action=='normalize-tracknumbers':out=normalize_tracknumbers_plan(album,entries,issues)
                elif args.action=='track-write-plan':
                    if not args.file or not args.edits_json:raise ValueError('file_and_edits_json_required')
                    out=track_write_plan(album,entries,issues,args.file,json.loads(args.edits_json))
                else:raise ValueError('unknown_action')
    except (OSError,ValueError,sqlite3.Error,json.JSONDecodeError) as ex:out=hold(str(ex))
    print(json.dumps(out,ensure_ascii=False,indent=2))
    return 0 if not out['state'].startswith('HOLD') else 2

if __name__=='__main__':sys.exit(main())
