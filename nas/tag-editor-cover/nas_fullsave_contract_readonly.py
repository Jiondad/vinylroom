#!/usr/bin/env python3
"""Export only the running container's Tag Editor/native index code contracts.
No imports of server/AI/index modules, SQL, restart, file mutation or media access.
Redirect stdout on NAS to NAS_FULLSAVE_CONTRACT.json and return that file/output.
"""
import json,subprocess
CONTAINER='music-gateway-music-gateway-1'
CHILD=r'''
import ast,hashlib,json,os
from pathlib import Path
names=('server.py','tag_cover_http.py','tag_phase2c.py','tag_cover_h.py','tag_rename_writer.py','index_engine.py','catalog_lease.py')
result={}
methods={'enqueue','execute_job','scan_job','put','db','whole_job_lease','folder','detail','configure_save_context','configure_rename_context'}
for name in names:
 p=Path('/app')/name
 if not p.is_file():result[name]={'missing':True};continue
 raw=p.read_bytes();text=raw.decode('utf-8');tree=ast.parse(text);lines=text.splitlines(keepends=True)
 exports={}
 wanted=set(methods)
 if name=='server.py':
  # Follow only server-owned maintenance guard names passed into the save context.
  for n in ast.walk(tree):
   if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr in ('configure_save_context','configure_rename_context'):
    for arg in n.args[:1]:
     if isinstance(arg,ast.Name):wanted.add(arg.id)
    for kw in n.keywords:
     if kw.arg in ('runtime_guard','reindex_album') and isinstance(kw.value,ast.Name):wanted.add(kw.value.id)
    exports['save_context_call_at_'+str(n.lineno)]=ast.unparse(n)
  # Identify actual INDEX constructor references without instantiating the server.
  for n in tree.body:
   if isinstance(n,(ast.Assign,ast.AnnAssign)):
    targets=n.targets if isinstance(n,ast.Assign) else [n.target]
    if any(isinstance(t,ast.Name) and t.id=='INDEX' for t in targets):exports['INDEX_assignment']=ast.unparse(n)
 for n in ast.walk(tree):
  if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in wanted:
   begin=min([n.lineno]+[x.lineno for x in n.decorator_list])-1
   exports[n.name+'@'+str(n.lineno)]=''.join(lines[begin:n.end_lineno])
 if name=='catalog_lease.py':exports={'lease_source':text}
 result[name]={'sha256':hashlib.sha256(raw).hexdigest(),'folder_api_present':'folder-albums' in text,'code':exports}
flags={k:os.environ.get(k,'unset') for k in ('VINYL_TAG_EDITOR_TRACK_WRITE_ENABLED','VINYL_TAG_EDITOR_COVER_WRITE_ENABLED','VINYL_TAG_EDITOR_FULL_TAG_WRITE_ENABLED','VINYL_TAG_EDITOR_RENAME_WRITE_ENABLED')}
print(json.dumps({'state':'NAS_FULLSAVE_CONTRACT_READONLY','sources':result,'flags':flags,'source_imports':0,'sql_connections':0,'media_access':0,'changes':0},ensure_ascii=False))
'''
def main():
 c=json.loads(subprocess.check_output(['docker','inspect',CONTAINER],text=True))[0]
 raw=subprocess.check_output(['docker','exec','-i',CONTAINER,'python3','-'],input=CHILD,text=True)
 out=json.loads(raw)
 wanted={'/app/server.py','/app/index_engine.py','/app/catalog_lease.py','/app/tag_cover_http.py','/app/tag_phase2c.py','/app/tag_cover_h.py','/app/tag_rename_writer.py','/music','/data','/tag-editor-backups'}
 out['mounts']=[{k:m.get(k) for k in ('Type','Source','Destination','RW')} for m in c.get('Mounts',[]) if m.get('Destination') in wanted]
 labels=c.get('Config',{}).get('Labels',{})
 out['compose']={k:labels.get(k) for k in ('com.docker.compose.project.working_dir','com.docker.compose.project.config_files','com.docker.compose.service')}
 out['container']={'name':CONTAINER,'running':c.get('State',{}).get('Running'),'user':c.get('Config',{}).get('User'),'read_only_root':c.get('HostConfig',{}).get('ReadonlyRootfs')}
 print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
