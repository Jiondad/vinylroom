#!/usr/bin/env python3
"""Read-only NAS evidence intake. Does not install, restart, change flags or open databases."""
import json,subprocess
CONTAINER='music-gateway-music-gateway-1'
def main():
 r=subprocess.run(['docker','inspect',CONTAINER],check=True,text=True,stdout=subprocess.PIPE);c=json.loads(r.stdout)[0]
 source=r'''import hashlib,json,os,ast
from pathlib import Path
files={}
for name in ('server.py','tag_phase2c.py','tag_cover_h.py','tag_cover_http.py'):
 p=Path('/app')/name
 if p.is_file():
  text=p.read_text();tree=ast.parse(text);files[name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'relevant_functions':[n.name for n in ast.walk(tree) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and any(s in n.name for s in ('lease','idle','lock','index_api','save_context','job'))],'folder_api_present':'folder-albums' in text,'save_extension_present':'configure_save_context' in text}
 else:files[name]={'missing':True}
flags={k:os.getenv(k,'unset') for k in ('VINYL_TAG_EDITOR_TRACK_WRITE_ENABLED','VINYL_TAG_EDITOR_COVER_WRITE_ENABLED')}
print(json.dumps({'files':files,'writer_flags':flags,'source_writes':0,'media_writes':0,'db_connections':0,'restarts':0}))'''
 p=subprocess.run(['docker','exec','-i',CONTAINER,'python3','-'],input=source,check=True,text=True,stdout=subprocess.PIPE)
 out=json.loads(p.stdout);out['mounts']=[{k:m.get(k) for k in ('Type','Source','Destination','RW')} for m in c['Mounts'] if m.get('Destination') in ('/music','/data','/app/server.py','/app/tag_cover_http.py','/app/tag_cover_h.py','/app/tag_phase2c.py')]
 out['state']='NAS_SAVE_PREFLIGHT_READ_ONLY';out['operating_install_performed']=False;out['required_before_on']=['installed runtime maintenance lease wiring','NAS dedicated fixture apply/restore verification','writable media mount and separate backup root','exact installed source hash match preserving Folder Index']
 print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
