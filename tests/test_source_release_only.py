import ast,io,json,sys,tempfile,unittest
from pathlib import Path
from contextlib import ExitStack,redirect_stdout
from types import SimpleNamespace
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'nas/tag-editor-cover'))
import nas_folder_release as r
class SourceReleaseTests(unittest.TestCase):
 def fixture(self,root,stack):
  package=root/'package';package.mkdir();work=root/'work';work.mkdir();files={}
  for n in ['server.py','tag_phase2c.py','tag_cover_http.py','tag_cover_h.py','index_engine.py']:
   files[n]=work/n;files[n].write_bytes(('# baseline '+n).encode())
  for n in r.NAMES:(package/n).write_bytes(('# candidate '+n).encode())
  compose=work/'compose.yaml';compose.write_text('unchanged');c={'prefix':['docker','compose'],'workdir':str(work),'base_files':[str(compose)],'active_files':[str(compose)],'project':'music-gateway','service':'music-gateway'}
  manifest={'baseline':{n:r.sha(files[n].read_bytes()) for n in r.NAMES},'desired':{n:r.sha((package/n).read_bytes()) for n in r.NAMES}}
  calls=[];running=[True]
  def info(required=True):return {'State':{'Running':running[0]},'Image':'old','Config':{'Image':'old:fixed','Env':['AI_ENABLED=true']},'HostConfig':{},'Mounts':[{'Type':'bind','Source':str(p),'Destination':'/app/'+n,'RW':False} for n,p in files.items()],'NetworkSettings':{'Networks':{'same':{}}}}
  def runtime(m,folder,query):
   h={n:r.sha(p.read_bytes()) for n,p in files.items()};state='baseline' if all(h[n]==m['baseline'][n] for n in r.NAMES) else 'installed'
   return {'runtime_hashes':h,'state':state}
  def stop():calls.append('stop');running[0]=False
  def recreate(d):calls.append(('recreate',d['compose']['active_files']));running[0]=True
  for name,val in [('R',package),('contract',lambda i:c),('effective',lambda c:{'services':{'music-gateway':{'environment':{'AI_ENABLED':'true'}}}}),('docker_info',info),('image_guard',lambda i:None),('runtime',runtime),('stop_clean',stop),('recreate',recreate)]:stack.enter_context(patch.object(r,name,val))
  return package,work,files,manifest,calls
 def test_two_sources_install_restore_without_compose_or_protected_source_changes(self):
  with tempfile.TemporaryDirectory() as td,ExitStack() as stack,redirect_stdout(io.StringIO()):
   package,work,files,m,calls=self.fixture(Path(td),stack);before={p.name:p.read_bytes() for p in work.iterdir()};d,_=r.snapshot(m,'Genre/Artist');plan=package/'check.json';plan.write_text(json.dumps({'state':'READY_FOR_SEPARATE_APPROVAL','details':d,'plan_digest':r.jsonsha(d),'folder_sha256':r.sha(b'Genre/Artist')}))
   a=SimpleNamespace(approve_source_install=True,approve_service_recreate=True,confirm_maintenance_idle=True,approved_check=str(plan),folder='Genre/Artist');r.install(a,m)
   self.assertEqual(files['server.py'].read_bytes(),before['server.py']);self.assertEqual((work/'compose.yaml').read_bytes(),before['compose.yaml'])
   backup=next((package/'source-backups').iterdir());r.restore(SimpleNamespace(approve_source_install=True,approve_service_recreate=True,confirm_maintenance_idle=True,backup_dir=str(backup)),m)
   self.assertEqual({p.name:p.read_bytes() for p in work.iterdir()},before);self.assertEqual(len(calls),4)
 def test_missing_approval_and_stale_plan_stop_before_any_source_replacement(self):
  with tempfile.TemporaryDirectory() as td,ExitStack() as stack:
   package,work,files,m,calls=self.fixture(Path(td),stack)
   with self.assertRaises(ValueError):r.install(SimpleNamespace(approve_source_install=False),m)
   plan=package/'bad.json';plan.write_text('{}')
   with self.assertRaisesRegex(ValueError,'stale'):r.install(SimpleNamespace(approve_source_install=True,approve_service_recreate=True,confirm_maintenance_idle=True,approved_check=str(plan),folder='Genre/Artist'),m)
   self.assertFalse(calls)
 def test_host_python36_compatibility_and_recreation_uses_active_files(self):
  text=Path(r.__file__).read_text();ast.parse(text,feature_version=(3,6))
  for v in ['capture_output=True','text=True','.is_relative_to(','.unlink(missing_ok=']:self.assertNotIn(v,text)
  c={'prefix':['docker','compose'],'workdir':'/tmp','project':'p','active_files':['one','two','three','four','five']};cmd=r.configuration(c);self.assertEqual(cmd.count('-f'),5);self.assertEqual(cmd[-1],'five')
if __name__=='__main__':unittest.main()
