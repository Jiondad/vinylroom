#!/usr/bin/env python3
"""Source-only folder API release. check is readonly; install/restore require separate approval."""
import argparse,ast,base64,copy,hashlib,json,os,stat,subprocess,tempfile,time,uuid
from pathlib import Path
R=Path(__file__).resolve().parent
C='music-gateway-music-gateway-1'
BASE_NAMES=['compose.yaml','compose.confidence70-on.json','compose.fieldwise-type-on.json','compose.type-correction-auto-control.json']
EXTRA='compose.tag-editor-phase-h.json'
EXPECTED_WORKDIR=Path('/volume1/docker/music-gateway')
MODULE_TARGETS=[]
NAMES=['tag_phase2c.py','tag_cover_http.py']
def sha(b):return hashlib.sha256(b).hexdigest()


def run(a,stdin=None,cwd=None):
 return subprocess.run(a,input=stdin,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True,timeout=100,cwd=str(cwd) if cwd else None).stdout


def mapping(path,mounts):
 choices=[m for m in mounts if path==m['Destination'] or path.startswith(m['Destination'].rstrip('/')+'/')]
 if not choices:raise ValueError('no_host_bind_mount:'+path)
 m=max(choices,key=lambda x:len(x['Destination']))
 if m['Type']!='bind':raise ValueError('not_bind_mount:'+path)
 return Path(m['Source'])/path[len(m['Destination']):].lstrip('/')


def emit(data):print(json.dumps(data,ensure_ascii=False),flush=True)


def jsonsha(data):return sha(json.dumps(data,sort_keys=True,separators=(',',':')).encode())


def regular(p):
 p=Path(p)
 if p.is_symlink() or not p.is_file():raise ValueError('not_regular_source:'+str(p))
 return p.read_bytes()


def atomic(p,b):
 p=Path(p);fd,tmp=tempfile.mkstemp(prefix='.phaseh-',dir=str(p.parent))
 try:
  with os.fdopen(fd,'wb') as f:f.write(b);f.flush();os.fsync(f.fileno())
  os.chmod(tmp,stat.S_IMODE(p.stat().st_mode) if p.exists() else 0o644)
  os.replace(tmp,str(p))
 finally:
  if os.path.exists(tmp):os.unlink(tmp)


def docker_info(required=True):
 try:return json.loads(run(['docker','inspect',C]))[0]
 except subprocess.CalledProcessError:
  if required:raise ValueError('container_inspect_failed')
  return None


def compose_prefix():
 for cmd in (['docker','compose'],['docker-compose']):
  try:run(cmd+['version','--short']);return cmd
  except (OSError,subprocess.CalledProcessError):pass
 raise ValueError('compose_cli_unavailable')


def contract(i):
 labels=i['Config'].get('Labels') or {};work=Path(labels.get('com.docker.compose.project.working_dir',''))
 if not work.is_absolute() or work!=EXPECTED_WORKDIR:raise ValueError('compose_workdir_mismatch')
 files=labels.get('com.docker.compose.project.config_files','').split(',')
 base=[str(work/n) for n in BASE_NAMES]
 if files not in (base,base+[str(work/EXTRA)]):raise ValueError('compose_file_order_or_override_mismatch')
 service=labels.get('com.docker.compose.service');project=labels.get('com.docker.compose.project')
 if service!='music-gateway' or not project:raise ValueError('compose_service_or_project_mismatch')
 for f in files:regular(Path(f))
 return {'workdir':str(work),'base_files':base,'active_files':files,'project':project,'service':service,'prefix':compose_prefix()}


def runtime_sig(i):
 config={k:i['Config'].get(k) for k in ['Image','Cmd','Entrypoint','User','WorkingDir','Healthcheck','ExposedPorts','Volumes','StopSignal']}
 config['Env']=sorted(i['Config'].get('Env') or [])
 host=copy.deepcopy(i.get('HostConfig') or {})
 host['Binds']=sorted(x for x in (host.get('Binds') or []) if x.split(':')[1] not in MODULE_TARGETS)
 host['Mounts']=sorted([x for x in (host.get('Mounts') or []) if x.get('Target') not in MODULE_TARGETS],key=lambda x:x.get('Target',''))
 mounts=sorted([{k:m.get(k) for k in ['Type','Source','Destination','RW','Propagation']} for m in i.get('Mounts',[]) if m.get('Destination') not in MODULE_TARGETS],key=lambda m:m.get('Destination',''))
 return jsonsha({'image_id':i['Image'],'config':config,'host':host,'mounts':mounts,'networks':sorted((i.get('NetworkSettings') or {}).get('Networks',{}))})


def health():
 code="import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8787/health',timeout=5).status)"
 for _ in range(15):
  try:
   if run(['docker','exec',C,'python3','-c',code]).strip()=='200':return 200
  except subprocess.CalledProcessError:pass
  time.sleep(1)
 raise ValueError('health_not_200_use_source_backup_restore')


def configuration(c):
 cmd=c['prefix']+['--project-directory',c['workdir'],'--project-name',c['project']]
 for path in c['active_files']:cmd+=['-f',path]
 return cmd

def effective(c):
 try:return json.loads(run(configuration(c)+['config','--format','json'],cwd=c['workdir']))
 except Exception:raise ValueError('compose_json_config_unavailable')

def verify_bundle():
 manifest=json.loads(regular(R/'FOLDER_RELEASE.json').decode())
 for name,digest in manifest['files'].items():
  if Path(name).name!=name or sha(regular(R/name))!=digest:raise ValueError('release_file_hash_mismatch:'+name)
 return manifest

def runtime(manifest,folder,query):
 payload={k:manifest[k] for k in ['baseline','desired','protected_cover_sha256']}
 payload['candidate_phase2c']=base64.b64encode(regular(R/'tag_phase2c.py')).decode('ascii')
 code='PAYLOAD='+repr(payload)+'\nFOLDER='+repr(folder)+'\nDO_QUERY='+repr(query)+'\n'+regular(R/'folder_container_check.py').decode()
 try:return json.loads(run(['docker','exec','-i',C,'python3','-'],stdin=code))
 except subprocess.CalledProcessError as exc:
  try:reason=json.loads(exc.stdout).get('reason','runtime_check_failed')
  except (ValueError,TypeError):reason='runtime_check_failed'
  raise ValueError('runtime_HOLD:'+str(reason))

def image_guard(i):
 if json.loads(run(['docker','image','inspect',i['Config']['Image']]))[0]['Id']!=i['Image']:raise ValueError('local_image_changed_no_recreate')

def snapshot(manifest,folder,query=True):
 i=docker_info();c=contract(i)
 if not i['State']['Running']:raise ValueError('container_not_running')
 image_guard(i);config=effective(c)
 env=dict(v.split('=',1) for v in i['Config'].get('Env',[]) if '=' in v)
 for key,value in config['services'][c['service']].get('environment',{}).items():
  if env.get(key)!=value:raise ValueError('compose_environment_differs_from_running_container')
 info=runtime(manifest,folder,query)
 paths={};host_hashes={}
 for name in ['server.py']+NAMES+['tag_cover_h.py']:
  path=mapping('/app/'+name,i['Mounts']);digest=sha(regular(path))
  if digest!=info['runtime_hashes'][name]:raise ValueError('host_runtime_source_mismatch:'+name)
  paths[name]=str(path);host_hashes[name]=digest
 details={'schema':'tag-folder-release-v1','compose':c,'compose_hashes':{f:sha(regular(f)) for f in c['active_files']},'effective_sha256':jsonsha(effective(c)),
 'runtime_signature':runtime_sig(i),'image_id':i['Image'],'image_ref':i['Config']['Image'],'paths':paths,'host_hashes':host_hashes,'runtime_hashes':info['runtime_hashes'],'state':info['state'],'writer':'OFF'}
 return details,info.get('query')

def save_transaction(b,m):
 atomic(b/'transaction.json',json.dumps(m,ensure_ascii=False,sort_keys=True,indent=2).encode());os.chmod(str(b/'transaction.json'),0o600)

def same_config(d):
 c=d['compose']
 if any(sha(regular(f))!=digest for f,digest in d['compose_hashes'].items()) or jsonsha(effective(c))!=d['effective_sha256']:raise ValueError('compose_or_interpolated_environment_changed')


def stop_clean():
 run(['docker','stop','--time','60',C]);state=docker_info()['State']
 if state['Running'] or state['ExitCode']!=0 or state.get('OOMKilled'):raise ValueError('unclean_stop_sources_unchanged')

def recreate(d):
 run(configuration(d['compose'])+['up','-d','--no-deps','--no-build','--pull','never','--force-recreate',d['compose']['service']],cwd=d['compose']['workdir'])
 health()

def install(a,m):
 if not (a.approve_source_install and a.approve_service_recreate and a.confirm_maintenance_idle and a.approved_check and a.folder):raise ValueError('separate_source_and_recreate_approval_flags_required')
 d,_=snapshot(m,a.folder);saved=json.loads(regular(a.approved_check).decode())
 if d['state']!='baseline' or saved.get('state')!='READY_FOR_SEPARATE_APPROVAL' or saved.get('details')!=d or saved.get('plan_digest')!=jsonsha(d) or saved.get('folder_sha256')!=sha(a.folder.encode()):raise ValueError('approved_check_stale_or_not_baseline')
 b=R/'source-backups'/('folder-index-'+time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);b.mkdir(parents=True,mode=0o700)
 for n in NAMES:
  atomic(b/n,regular(d['paths'][n]));os.chmod(str(b/n),0o600)
 transaction={'schema':'tag-folder-backup-v1','details':d,'desired':m['desired'],'state':'BACKED_UP'};save_transaction(b,transaction);emit({'state':'SOURCE_BACKUP_READY','backup_dir':str(b)})
 again,_=snapshot(m,a.folder,False)
 if again!=d:raise ValueError('source_changed_before_stop')
 stop_clean();same_config(d)
 for name,path in d['paths'].items():
  if sha(regular(path))!=d['host_hashes'][name]:raise ValueError('source_CAS_after_stop_failed')
 for name in NAMES:atomic(Path(d['paths'][name]),regular(R/name))
 transaction['state']='RECREATING';save_transaction(b,transaction);recreate(d)
 after,_=snapshot(m,a.folder,False)
 if after['state']!='installed' or after['runtime_signature']!=d['runtime_signature'] or after['runtime_hashes']['server.py']!=d['runtime_hashes']['server.py'] or after['runtime_hashes']['index_engine.py']!=d['runtime_hashes']['index_engine.py']:raise ValueError('post_install_runtime_mismatch_restore_required')
 transaction['state']='INSTALLED_VERIFIED';save_transaction(b,transaction);emit({'state':'FOLDER_INDEX_INSTALLED_WRITE_OFF','health':200,'writer':'OFF','backup_dir':str(b),'db_writes':0,'media_writes':0,'ai_calls':0})

def restore(a,m):
 if not (a.approve_source_install and a.approve_service_recreate and a.confirm_maintenance_idle and a.backup_dir):raise ValueError('separate_restore_approval_flags_required')
 b=Path(a.backup_dir).resolve();t=json.loads(regular(b/'transaction.json').decode())
 if t.get('schema')!='tag-folder-backup-v1' or t.get('desired')!=m['desired']:raise ValueError('backup_release_mismatch')
 d=t['details'];same_config(d)
 for n in NAMES:
  if sha(regular(b/n))!=d['host_hashes'][n]:raise ValueError('backup_integrity_error')
  if sha(regular(d['paths'][n])) not in (d['host_hashes'][n],m['desired'][n]):raise ValueError('restore_source_CAS_mismatch')
 for n in ['server.py','tag_cover_h.py']:
  if sha(regular(d['paths'][n]))!=d['host_hashes'][n]:raise ValueError('protected_source_changed')
 i=docker_info(required=False)
 if i:
  now=contract(i)
  if now['active_files']!=d['compose']['active_files'] or runtime_sig(i)!=d['runtime_signature']:raise ValueError('runtime_changed_outside_release')
  image_guard(i)
 else:
  if json.loads(run(['docker','image','inspect',d['image_ref']]))[0]['Id']!=d['image_id']:raise ValueError('original_image_unavailable')
 if i and i['State']['Running']:stop_clean()
 for n in NAMES:atomic(Path(d['paths'][n]),regular(b/n))
 t['state']='RESTORING';save_transaction(b,t);recreate(d);after,_=snapshot(m,'',False)
 if after['state']!='baseline' or after['runtime_signature']!=d['runtime_signature'] or after['runtime_hashes']!=d['runtime_hashes']:raise ValueError('restored_runtime_not_original')
 t['state']='RESTORED';save_transaction(b,t);emit({'state':'FOLDER_INDEX_SOURCE_RESTORED','health':200,'writer':'OFF','db_writes':0,'media_writes':0})

def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['check','install','restore']);p.add_argument('--folder');p.add_argument('--approved-check');p.add_argument('--backup-dir');p.add_argument('--approve-source-install',action='store_true');p.add_argument('--approve-service-recreate',action='store_true');p.add_argument('--confirm-maintenance-idle',action='store_true');a=p.parse_args();m=verify_bundle()
 if a.action=='check':
  if not a.folder:raise ValueError('one_existing_relative_folder_required')
  d,q=snapshot(m,a.folder);emit({'state':'READY_FOR_SEPARATE_APPROVAL' if d['state']=='baseline' else 'FOLDER_INDEX_INSTALLED_WRITE_OFF','details':d,'plan_digest':jsonsha(d),'folder_sha256':sha(a.folder.encode()),'readonly_query':q,'db_writes':0,'media_writes':0,'source_writes':0,'restarts':0,'http_requests':0});return
 if a.action=='install':install(a,m)
 else:restore(a,m)
if __name__=='__main__':
 try:main()
 except Exception as exc:emit({'state':'HOLD','reason':'docker_or_compose_command_failed' if isinstance(exc,subprocess.SubprocessError) else str(exc),'db_writes':0,'media_writes':0});raise SystemExit(2)
