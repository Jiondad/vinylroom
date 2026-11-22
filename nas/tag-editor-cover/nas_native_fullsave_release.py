#!/usr/bin/env python3
"""Pinned NAS candidate release. No production media write or SQL; never starts AI.
prepare/check: read production, write only NEW stage. install/enable/rollback: explicit
operator command; preserve original Compose chain and all unrelated settings.
"""
import argparse,base64,hashlib,json,os,subprocess,sys,time,urllib.request
from pathlib import Path
CONTAINER='music-gateway-music-gateway-1'
FULL='VINYL_TAG_EDITOR_FULL_TAG_WRITE_ENABLED';RENAME='VINYL_TAG_EDITOR_RENAME_WRITE_ENABLED'
EXPECTED={'server.py':'31cdc3ef488d12d4a4d4e5938f69a0a270b260755d018d4a680a5c8b5c266375','index_engine.py':'66abf0f75eb256e16334631466ba70eac8faa33e196c2e4b671e4c992cb0c81d','tag_cover_http.py':'bf69b6e6b9d2291dcb30e2e8c7e154c3391aeb9d437669be80b7d8ef019b2298','tag_phase2c.py':'0a98c4c73c6973a212d164d7de11da6384e3865aa4df39338a4e3b0064a6d4a5','tag_cover_h.py':'13062756878a789fa3c27e65716a81330953e5f252ddc5234b2bd9d81b06a736','catalog_lease.py':'c14e7cee6838c38350cc6ebd5ec9f8203d1353ab1d6f98f59a15d2f7a2218ba2'}
FILES=('server.py','index_engine.py','tag_cover_http.py','tag_phase2c.py','tag_rename_writer.py','tag_native_index.py')
def hold(reason):raise RuntimeError(reason)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def command(args,stdin=None):
    r=subprocess.run(args,input=stdin,stdout=subprocess.PIPE,stderr=subprocess.PIPE,encoding='utf-8')
    if r.returncode:hold('command_failed:'+args[0]+':'+r.stderr[-1200:])
    return r.stdout

def inspect():
    d=json.loads(command(['docker','inspect',CONTAINER]))[0]
    if not d['State']['Running'] or d['Config']['User']!='1026:100' or not d['HostConfig']['ReadonlyRootfs']:hold('container_contract_changed')
    mounts={m['Destination']:m for m in d['Mounts']}
    for dest in ('/music','/data','/tag-editor-backups'):
        if dest not in mounts or not mounts[dest]['RW']:hold('expected_rw_bind_missing:'+dest)
    labels=d['Config']['Labels'];chain=labels['com.docker.compose.project.config_files'].split(',')
    if len(chain)!=8 and not chain[-1].endswith('/compose.fullsave-native.json'):hold('compose_chain_changed')
    return d,mounts,chain

def base_command(m):
    cmd=['docker','compose','-p',m['project']]
    for p in m['compose']:cmd+=['-f',p]
    return cmd

def overlay(m,stage,on):
    return {'services':{m['service']:{'environment':{FULL:str(on).lower(),RENAME:str(on).lower()},'volumes':[{'type':'bind','source':str(stage/'candidate'/n),'target':'/app/'+n,'read_only':True} for n in FILES]}}}

def validate_config(m,stage):
    cmd=base_command(m)
    a=json.loads(command(cmd+['config','--format','json']))
    b=json.loads(command(cmd+['-f',str(stage/'compose.fullsave-native.json'),'config','--format','json']))
    svc=m['service'];av=a['services'][svc];bv=b['services'][svc]
    ae=dict(av.get('environment',{}));be=dict(bv.get('environment',{}))
    for flag in (FULL,RENAME):ae.pop(flag,None);be.pop(flag,None)
    if ae!=be:hold('unrelated_environment_changed')
    for key in set(av)|set(bv):
        if key not in ('environment','volumes') and av.get(key)!=bv.get(key):hold('unrelated_service_setting_changed:'+key)
    va={v['target']:v for v in av.get('volumes',[])};vb={v['target']:v for v in bv.get('volumes',[])}
    allowed={'/app/'+n for n in FILES}
    if any(va.get(k)!=vb.get(k) for k in set(va)|set(vb) if k not in allowed):hold('unrelated_mount_changed')
    for n in FILES:
        v=vb['/app/'+n]
        if v['source']!=str(stage/'candidate'/n) or not v.get('read_only'):hold('candidate_mount_changed:'+n)
    for name in set(a['services'])|set(b['services']):
        if name!=svc and a['services'].get(name)!=b['services'].get(name):hold('other_service_changed')

def prepare(stage):
    if os.geteuid()!=0:hold('root_required_for_owner_preservation')
    d,mounts,chain=inspect()
    if len(chain)!=8:hold('already_staged_review_existing_release')
    source={}
    for n,digest in EXPECTED.items():
        v=mounts.get('/app/'+n)
        if not v or v['Type']!='bind' or v['RW'] or sha(v['Source'])!=digest:hold('baseline_bind_or_sha_mismatch:'+n)
        source[n]=v['Source']
    reference=Path(__file__).resolve().parent
    # Prepare on service Python (3.12); host Synology Python need not support ast.unparse.
    payload={'tool':(reference/'prepare_native_fullsave.py').read_text(),'current':{n:base64.b64encode(Path(p).read_bytes()).decode() for n,p in source.items()},'reference':{n:base64.b64encode((reference/n).read_bytes()).decode() for n in ('tag_cover_http.py','tag_phase2c.py','tag_rename_writer.py','tag_native_index.py')}}
    code="import sys,json,base64,tempfile,pathlib; p=json.load(sys.stdin); t=pathlib.Path(tempfile.mkdtemp(prefix='fullsave-prepare-')); a=t/'current'; b=t/'ref'; a.mkdir(); b.mkdir(); [(a/n).write_bytes(base64.b64decode(v)) for n,v in p['current'].items()]; [(b/n).write_bytes(base64.b64decode(v)) for n,v in p['reference'].items()]; ns={}; exec(compile(p['tool'],'prepare_native_fullsave.py','exec'),ns); ns['prepare'](a,b,t/'out'); print(json.dumps({f.name:base64.b64encode(f.read_bytes()).decode() for f in (t/'out').iterdir()})); import shutil; shutil.rmtree(t)"
    generated=json.loads(command(['docker','exec','-i',CONTAINER,'python3','-c',code],json.dumps(payload)))
    if stage.exists():hold('new_stage_required')
    stage.mkdir(mode=0o700,parents=True);(stage/'baseline').mkdir(mode=0o700);(stage/'candidate').mkdir(mode=0o755)
    for n,p in source.items():(stage/'baseline'/n).write_bytes(Path(p).read_bytes())
    for n,v in generated.items():
        if Path(n).name!=n:hold('invalid_generated_filename')
        (stage/'candidate'/n).write_bytes(base64.b64decode(v));(stage/'candidate'/n).chmod(0o644)
    # Container uid needs traverse candidate/fixture; baseline remains private.
    stage.chmod(0o711)
    labels=d['Config']['Labels'];m={'schema':1,'project':labels['com.docker.compose.project'],'service':labels['com.docker.compose.service'],'compose':chain,'compose_sha':{p:sha(p) for p in chain},'baseline':source,'baseline_sha':EXPECTED,'candidate_sha':{n:sha(stage/'candidate'/n) for n in FILES},'image':d['Image'],'backup':mounts['/tag-editor-backups']['Source'],'app_mounts':{k:v['Source'] for k,v in mounts.items() if k.startswith('/app/') and v['Type']=='bind'},'state':'PREPARED_NOT_INSTALLED'}
    (stage/'manifest.json').write_text(json.dumps(m,indent=2));(stage/'manifest.json').chmod(0o600)
    (stage/'compose.fullsave-native.json').write_text(json.dumps(overlay(m,stage,False),indent=2))
    validate_config(m,stage)
    return {'state':m['state'],'stage':str(stage),'candidate_sha':m['candidate_sha'],'production_changes':0}

def load(stage):
    m=json.loads((stage/'manifest.json').read_text())
    for p,digest in m['compose_sha'].items():
        if sha(p)!=digest:hold('original_compose_changed:'+p)
    for n,p in m['baseline'].items():
        if sha(p)!=m['baseline_sha'][n]:hold('original_source_changed:'+n)
    for n,digest in m['candidate_sha'].items():
        if sha(stage/'candidate'/n)!=digest:hold('candidate_changed:'+n)
    validate_config(m,stage);return m

def health():
    for attempt in range(30):
        try:
            if urllib.request.urlopen('http://127.0.0.1:8787/health',timeout=2).status==200:return True
        except Exception:pass
        time.sleep(1)
    return False

def recreate(m,stage,use_overlay):
    cmd=base_command(m)
    if use_overlay:cmd+=['-f',str(stage/'compose.fullsave-native.json')]
    command(cmd+['up','-d','--no-deps','--force-recreate',m['service']])
    if not health():hold('health_not_200')

def idle_check(m):
    # Existing lock is opened read-only; do not create it or import the app.
    code="""import os,sqlite3,json,fcntl,pathlib
p=pathlib.Path(os.environ.get('INDEX_DATA_PATH','/data')).resolve()
assert p==pathlib.Path('/data') or pathlib.Path('/data') in p.parents,'catalog_data_path_changed'
lock=p/'catalog-whole-job.lock'
fd=os.open(str(lock),os.O_RDONLY|os.O_NOFOLLOW)
try:
 fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 db=sqlite3.connect('file:'+str(p/'catalog.sqlite3')+'?mode=ro',uri=True)
 try:
  assert not any(json.loads(r[0]).get('state') in ('queued','running') for r in db.execute('SELECT data FROM jobs ORDER BY rowid DESC LIMIT 500')),'native_index_job_pending'
 finally:db.close()
 db=sqlite3.connect('file:'+str(p/'catalog.sqlite3')+'?mode=ro',uri=True)
 try:
  pending=[json.loads(r[0]).get('state') for r in db.execute('SELECT data FROM jobs ORDER BY rowid DESC LIMIT 500')]
  assert not any(s in ('queued','running') for s in pending),'native_index_job_pending'
 finally:db.close()
finally:os.close(fd)
print('MAINTENANCE_IDLE_OBSERVED')"""
    command(['docker','exec',CONTAINER,'python3','-c',code])

def install(m,stage,idle):
    if not idle:hold('explicit_maintenance_idle_required')
    d,mounts,chain=inspect()
    if chain!=m['compose'] or d['Image']!=m['image']:hold('running_compose_or_image_changed')
    idle_check(m)
    try:recreate(m,stage,True)
    except Exception:
        recreate(m,stage,False);raise
    return {'state':'INSTALLED_NEW_FLAGS_OFF','health':200,'full_tags':False,'rename':False,'production_media_writes':0}

def qualify(m,stage):
    d,mounts,chain=inspect()
    if chain!=m['compose']+[str(stage/'compose.fullsave-native.json')] or d['Image']!=m['image']:hold('candidate_not_running_or_image_changed')
    for n,digest in m['candidate_sha'].items():
        if sha(mounts['/app/'+n]['Source'])!=digest:hold('running_candidate_mismatch:'+n)
    q=stage/'qualification';q.mkdir(mode=0o700);os.chown(str(q),1026,100)
    reference=Path(__file__).resolve().parent
    cmd=['docker','run','--rm','--network','none','--read-only','--user','1026:100','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/tmp:rw,noexec,nosuid,size=128m','--entrypoint','python3']
    app=dict(m['app_mounts']);app.update({'/app/'+n:str(stage/'candidate'/n) for n in FILES})
    for dest,src in app.items():cmd+=['--mount','type=bind,src='+src+',dst='+dest+',readonly']
    for src,dest,ro in ((reference/'fixture-audio','/fixture-source',True),(reference/'qualify_native_fullsave.py','/qualification.py',True),(q,'/qualification-data',False)):
        cmd+=['--mount','type=bind,src='+str(src)+',dst='+dest+(',readonly' if ro else '')]
    for flag in (FULL,RENAME,'VINYL_TAG_EDITOR_TRACK_WRITE_ENABLED','VINYL_TAG_EDITOR_COVER_WRITE_ENABLED'):cmd+=['-e',flag+'=true']
    # No /music, /data, production secrets, volumes-from or application startup.
    command(cmd+[m['image'],'/qualification.py'])
    proof=json.loads((q/'qualification.json').read_text())
    if proof.get('state')!='PASS' or len(proof.get('native_job_ids',[]))!=2:hold('fixture_qualification_failed')
    return {'state':'NAS_ISOLATED_QUALIFICATION_PASS','cases':proof['cases'],'native_job_ids':proof['native_job_ids'],'production_writes':0,'http_requests':0}

def enable(m,stage,idle):
    if not idle:hold('explicit_maintenance_idle_required')
    d,mounts,chain=inspect()
    if chain!=m['compose']+[str(stage/'compose.fullsave-native.json')] or d['Image']!=m['image']:hold('candidate_not_running_or_image_changed')
    idle_check(m)
    proof=json.loads((stage/'qualification/qualification.json').read_text())
    expected=dict(m['candidate_sha']);expected.update({n:EXPECTED[n] for n in ('catalog_lease.py','tag_cover_h.py')})
    if proof.get('state')!='PASS' or proof.get('hashes')!=expected or len(proof.get('native_job_ids',[]))!=2:hold('qualification_source_mismatch')
    root=Path(m['backup'])
    if root.is_symlink() or root.stat().st_uid!=1026 or root.stat().st_mode & 0o777!=0o700:hold('backup_owner_or_mode_requires_review')
    target=root/'fullsave-native-qualified.json'
    if target.exists() or target.is_symlink():hold('existing_qualification_must_be_preserved')
    with target.open('x') as f:json.dump(proof,f,indent=2);f.flush();os.fsync(f.fileno())
    os.chown(str(target),1026,100);target.chmod(0o600)
    path=stage/'compose.fullsave-native.json';off=path.read_bytes();path.write_text(json.dumps(overlay(m,stage,True),indent=2))
    try:validate_config(m,stage);recreate(m,stage,True)
    except Exception:
        path.write_bytes(off);recreate(m,stage,True);raise
    return {'state':'FLAGS_APPLIED_ADMIN_API_VERIFICATION_PENDING','health':200,'full_tags_flag':True,'rename_flag':True,'production_media_writes':0,'note':'Not operational PASS until authenticated capability/plan/apply/reread succeeds.'}

def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=('prepare','check','install','qualify','enable','rollback'));p.add_argument('--stage',required=True);p.add_argument('--confirm-maintenance-idle',action='store_true');a=p.parse_args();stage=Path(a.stage).resolve()
    try:
        if a.mode=='prepare':result=prepare(stage)
        else:
            m=load(stage)
            if a.mode=='check':result={'state':'CANDIDATE_INTEGRITY_PASS','production_changes':0}
            elif a.mode=='install':result=install(m,stage,a.confirm_maintenance_idle)
            elif a.mode=='qualify':result=qualify(m,stage)
            elif a.mode=='enable':result=enable(m,stage,a.confirm_maintenance_idle)
            else:
                if not a.confirm_maintenance_idle:hold('explicit_maintenance_idle_required')
                d,_,chain=inspect()
                if chain!=m['compose']+[str(stage/'compose.fullsave-native.json')]:hold('running_compose_changed')
                recreate(m,stage,False);result={'state':'ORIGINAL_COMPOSE_RESTORED','health':200,'data_restored':False,'note':'Source/config rollback only; audit and backups retained.'}
        print(json.dumps(result,ensure_ascii=False))
    except Exception as e:print(json.dumps({'state':'HOLD','reason':str(e)},ensure_ascii=False));sys.exit(1)
if __name__=='__main__':main()
