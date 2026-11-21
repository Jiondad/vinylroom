#!/usr/bin/env python3
"""NAS host source-only installer. Does not connect to Catalog/AI or edit music."""
import argparse,ast,base64,hashlib,json,os,subprocess,tempfile,time,uuid
from pathlib import Path
R=Path(__file__).resolve().parent;C='music-gateway-music-gateway-1'
NAMES=['tag_phase2c.py','tag_cover_h.py','tag_cover_http.py']
MARK='# VINYL_TAG_COVER_READ_PLAN_V1'
HOOK="""        # VINYL_TAG_COVER_READ_PLAN_V1
        if urlsplit(self.path).path.startswith('/v2/admin/tag-cover'):
            from tag_cover_http import handle as tag_cover_handle
            return tag_cover_handle(self, INDEX, ROOT, ORIGIN, post)
"""
def sha(b):return hashlib.sha256(b).hexdigest()
def run(a):return subprocess.run(a,check=True,capture_output=True,text=True,timeout=100).stdout
def patch_source(raw):
 s=raw.decode();tree=ast.parse(s);classes=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Handler']
 if len(classes)!=1:raise ValueError('Handler_contract_mismatch')
 methods={n.name:n for n in classes[0].body if isinstance(n,ast.FunctionDef)}
 if not {'index_api','index_admin','member_gate','reply'}<=methods.keys():raise ValueError('admin_gate_contract_missing')
 m=methods['index_api'];lines=s.splitlines(True)
 if [a.arg for a in m.args.args]!=['self','post'] or lines[m.lineno-1].strip()!='def index_api(self,post=False):':raise ValueError('index_api_contract_mismatch')
 if MARK in s:raise ValueError('already_installed_no_repeat_install')
 lines.insert(m.lineno,HOOK);out=''.join(lines).encode();ast.parse(out);return out

def mapping(path,mounts):
 choices=[m for m in mounts if path==m['Destination'] or path.startswith(m['Destination'].rstrip('/')+'/')]
 if not choices:raise ValueError('no_host_bind_mount:'+path)
 m=max(choices,key=lambda x:len(x['Destination']))
 if m['Type']!='bind':raise ValueError('not_bind_mount:'+path)
 return Path(m['Source'])/path[len(m['Destination']):].lstrip('/')

def inspect():
 i=json.loads(run(['docker','inspect',C]))[0]
 if not i['State']['Running']:raise ValueError('container_not_running')
 code="""import json,base64
from pathlib import Path
import mutagen,PIL
e=dict(x.split(b'=',1) for x in Path('/proc/1/environ').read_bytes().split(b'\\0') if b'=' in x)
print(json.dumps({'body':base64.b64encode(Path('/app/server.py').read_bytes()).decode(),'cover_write':e.get(b'VINYL_TAG_EDITOR_COVER_WRITE_ENABLED',b'unset').decode()}))"""
 d=json.loads(run(['docker','exec',C,'python3','-c',code]));raw=base64.b64decode(d.pop('body'))
 if d['cover_write'].lower() not in ('unset','false','0','off',''):raise ValueError('cover_writer_not_off')
 targets={n:mapping('/app/'+n,i['Mounts']) for n in ['server.py']+NAMES}
 if targets['server.py'].read_bytes()!=raw:raise ValueError('host_runtime_source_mismatch')
 for n in NAMES:
  if not targets[n].parent.is_dir():raise ValueError('module_parent_missing')
  if targets[n].exists() and targets[n].read_bytes()!=(R/n).read_bytes():raise ValueError('unmanaged_module_collision:'+n)
 d.update(server_sha256=sha(raw),hook_installed=MARK in raw.decode(),targets={n:str(p) for n,p in targets.items()})
 return d,raw,targets

def atomic(p,b):
 fd,tmp=tempfile.mkstemp(prefix='.phaseh-',dir=p.parent)
 try:
  with os.fdopen(fd,'wb') as f:f.write(b);f.flush();os.fsync(f.fileno())
  os.chmod(tmp,p.stat().st_mode&0o777 if p.exists() else 0o644);os.replace(tmp,p)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)

def stop():
 run(['docker','stop','--time','60',C]);s=json.loads(run(['docker','inspect',C]))[0]['State']
 if s['Running'] or s['ExitCode']!=0 or s.get('OOMKilled'):raise ValueError('unclean_stop_HOLD_sources_unchanged')
def start():
 run(['docker','start',C]);code="import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8787/health',timeout=5).status)"
 for _ in range(15):
  try:
   if run(['docker','exec',C,'python3','-c',code]).strip()=='200':return 200
  except subprocess.SubprocessError:pass
  time.sleep(1)
 raise ValueError('health_not_200_source_restore_required')

def main():
 p=argparse.ArgumentParser();p.add_argument('command',choices=['check','install','restore']);p.add_argument('--expected-server-sha256');p.add_argument('--approved-check');p.add_argument('--approve-source-install',action='store_true');p.add_argument('--confirm-maintenance-idle',action='store_true');p.add_argument('--backup-dir');a=p.parse_args()
 for line in (R/'SHA256SUMS.txt').read_text().splitlines():
  h,n=line.split(None,1);f=R/n.strip().lstrip('*')
  if not f.resolve().is_relative_to(R) or sha(f.read_bytes())!=h:raise ValueError('bundle_hash_mismatch')
 if a.command=='restore':
  if not(a.approve_source_install and a.confirm_maintenance_idle and a.backup_dir):raise ValueError('explicit_restore_flags_required')
  b=Path(a.backup_dir).resolve();m=json.loads((b/'backup.json').read_text());i=json.loads(run(['docker','inspect',C]))[0]
  for r in m:
   path=mapping('/app/'+r['name'],i['Mounts'])
   actual=sha(path.read_bytes()) if path.exists() else None
   if str(path)!=r['path'] or actual not in (r['before'],r['after']):raise ValueError('restore_source_CAS_mismatch')
   if r['before'] and sha((b/r['name']).read_bytes())!=r['before']:raise ValueError('backup_hash_mismatch')
  if i['State']['Running']:stop()
  for r in m:
   path=Path(r['path'])
   if r['before']:atomic(path,(b/r['name']).read_bytes())
   else:path.unlink(missing_ok=True)
  print(json.dumps({'state':'SOURCE_RESTORED','health':start(),'media_writes':0,'db_writes':0}));return
 d,raw,targets=inspect()
 if a.approved_check:
  saved=json.loads(Path(a.approved_check).read_text());a.expected_server_sha256=saved['details']['server_sha256']
  if saved.get('state')!='SOURCE_READY_FOR_APPROVAL' or saved['details']['targets']!=d['targets']:raise ValueError('approved_check_contract_changed')
 if a.command=='check':
  if not d['hook_installed']:patch_source(raw)
  print(json.dumps({'state':'PHASE_H_INSTALLED_WRITE_OFF' if d['hook_installed'] else 'SOURCE_READY_FOR_APPROVAL','details':d,'source_writes':0,'media_writes':0,'db_writes':0}));return
 if not(a.approve_source_install and a.confirm_maintenance_idle and a.expected_server_sha256==d['server_sha256']):raise ValueError('source_approval_or_expected_sha_required')
 items={'server.py':patch_source(raw),**{n:(R/n).read_bytes() for n in NAMES}}
 b=R/'source-backups'/('phaseh-'+time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);b.mkdir(parents=True,mode=0o700);records=[]
 for n,new in items.items():
  path=targets[n];old=path.read_bytes() if path.exists() else None
  if old is not None:atomic(b/n,old)
  records.append({'name':n,'path':str(path),'before':sha(old) if old is not None else None,'after':sha(new)})
 (b/'backup.json').write_text(json.dumps(records,indent=2));print(json.dumps({'state':'SOURCE_BACKUP_READY','backup_dir':str(b),'source_writes':0}));again,_,_=inspect()
 if again['server_sha256']!=d['server_sha256']:raise ValueError('source_changed_before_stop')
 stop()
 for r in records:
  path=Path(r['path'])
  if (sha(path.read_bytes()) if path.exists() else None)!=r['before']:raise ValueError('source_changed_after_stop_do_not_start')
 for n,new in items.items():atomic(targets[n],new)
 health=start();after,_,_=inspect();print(json.dumps({'state':'PHASE_H_INSTALLED_WRITE_OFF','health':health,'backup_dir':str(b),'details':after,'media_writes':0,'db_writes':0}))
if __name__=='__main__':
 try:main()
 except Exception as e:print(json.dumps({'state':'HOLD','reason':str(e),'media_writes':0,'db_writes':0}));raise SystemExit(2)
