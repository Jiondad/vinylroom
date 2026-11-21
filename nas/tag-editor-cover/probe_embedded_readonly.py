#!/usr/bin/env python3
"""Run through docker exec stdin. One existing album only; no writes or credentials."""
import json,os,sys
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
try:
 import tag_cover_http as api
 if len(sys.argv)!=3 or sys.argv[2]!='--first-supported-track':raise ValueError('album_uuid_and_explicit_track_selection_required')
 ident=sys.argv[1];catalog=Path(os.getenv('INDEX_DATA_PATH','/data'))/'catalog.sqlite3';music=Path(os.getenv('MUSIC_ROOT','/music'))
 album,entries,issues=api.cover.base.inventory(catalog,music,ident)
 if issues:raise ValueError('album_inventory_issue:'+str(issues))
 selected=next((e for e in entries if e['format'] in ('.flac','.mp3')),None)
 if selected is None:raise ValueError('no_supported_audio_file')
 result=api.inspect(catalog,music,ident,selected['file'])
 if result.get('state')!='EMBEDDED_COVER_INSPECTED':raise ValueError(result.get('reason','inspection_held'))
 preview=result.pop('preview_data_url',None);result['preview_available']=bool(preview)
 try:
  urlopen('http://127.0.0.1:8787'+api.PREFIX+'/inspect',timeout=5)
  raise ValueError('unauthenticated_cover_route_was_not_denied')
 except HTTPError as err:
  denial=json.loads(err.read())
  if err.code!=403 or denial.get('reason')!='administrator_required':raise ValueError('cover_route_or_admin_gate_not_verified')
 result.update(probe_state='PHASE_H_READONLY_PREPARED',unauthenticated_http_status=403,authenticated_http='NOT_TESTED',network_scope='container_loopback_gate_check_only',db_writes=0,media_writes=0)
 print(json.dumps(result,ensure_ascii=False))
except Exception as exc:
 print(json.dumps({'state':'HOLD','reason':str(exc),'db_writes':0,'media_writes':0},ensure_ascii=False));raise SystemExit(2)
