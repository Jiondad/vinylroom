"""Only NEW native-index/preparation/qualification gates. No media or network."""
import ast,contextlib,hashlib,json,queue,sqlite3,sys,tempfile,threading,unittest,uuid,time
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'nas/tag-editor-cover'))
import prepare_native_fullsave as prepare
import tag_native_index as native
import tag_cover_http as http
import nas_native_fullsave_release as release
class NativeContracts(unittest.TestCase):
 def test_native_enqueue_synchronous_keeps_queue_empty_default_queues(self):
  raw=(ROOT/'tests/fixtures/native-fullsave/enqueue.py.txt').read_bytes()
  with patch.object(prepare,'INDEX_SHA',prepare.sha(raw)):result=prepare.patch_index(raw)
  before=ast.parse(raw);after=ast.parse(result)
  self.assertEqual(len(after.body[0].body),1)
  calls=[]
  def index_job(fn):
   def run(self,*args,**kwargs):
    with self.whole_job_lease():return fn(self,*args,**kwargs)
   return run
  ns={'index_job':index_job,'json':json,'uuid':uuid,'time':time};exec(compile(result,'fixture','exec'),ns)
  with tempfile.TemporaryDirectory() as temp:
   i=ns['Index']();i.root=Path(temp);(i.root/'Album').mkdir();i.folder=lambda p:i.root/p;i.scanner=object();i.jobs=queue.Queue(20);i.lock=threading.RLock();i.depth=0
   @contextlib.contextmanager
   def lease():
    i.depth+=1
    try:yield
    finally:i.depth-=1
   i.whole_job_lease=lease
   db=sqlite3.connect(':memory:');db.execute('CREATE TABLE jobs(id TEXT,data TEXT)')
   @contextlib.contextmanager
   def connection():yield db
   i.db=connection;i.progress=lambda job:None
   def execute(job):
    self.assertGreater(i.depth,0);self.assertTrue(i.jobs.empty());calls.append(threading.get_ident());job['state']='completed'
   i.execute_job=execute
   job=i.enqueue('Album',synchronous=True);self.assertEqual(job['state'],'completed');self.assertEqual(calls,[threading.get_ident()]);self.assertTrue(i.jobs.empty())
   job=i.enqueue('Album');self.assertEqual(job['state'],'queued');self.assertEqual(i.jobs.qsize(),1);self.assertEqual(len(calls),1)
   with self.assertRaises(ValueError):i.enqueue('',synchronous=True)
   with self.assertRaises(ValueError):i.enqueue('Album',synchronous=1)
 def test_server_patch_direct_alias_and_embedded_exec_preserves_guard(self):
  samples=['configure_save_context(guard, backup, qualified)\n','from tag_cover_http import configure_save_context as cfg\ncfg(guard, backup, qualification_passed=qualified)\n','http.configure_save_context(guard, backup, qualified)\n',"exec('http.configure_save_context(guard, backup, qualified)')\n"]
  for s in samples:
   with self.subTest(s=s),patch.object(prepare,'SERVER_SHA',prepare.sha(s.encode())):
    result=prepare.patch_server(s.encode()).decode();self.assertIn('index=INDEX',result);self.assertIn('guard',result);self.assertIn('qualified',result)
 def test_server_patch_fails_zero_multiple_or_hash_change(self):
  for s in ('pass\n','configure_save_context(a,b)\nconfigure_save_context(c,d)\n','configure_save_context(a,b,index=INDEX)\n'):
   with patch.object(prepare,'SERVER_SHA',prepare.sha(s.encode())),self.assertRaises(ValueError):prepare.patch_server(s.encode())
  with self.assertRaises(ValueError):prepare.patch_server(b'pass\n')
 def test_tag_merge_changes_only_four_functions_and_two_constants(self):
  ref=(ROOT/'nas/tag-editor-cover/tag_phase2c.py').read_bytes()
  # Synthetic old source has a sentinel and old implementations; never operating evidence.
  names=('validate_track_edits','track_write_plan','_make_stage_track','track_write_preflight')
  t=ast.parse(ref);lines=ref.decode().splitlines(True);pieces=[]
  for n in t.body:
   if isinstance(n,ast.FunctionDef) and n.name in names:
    signature=''.join(lines[n.lineno-1:n.lineno]);pieces.append(signature+'    return "legacy"\n\n')
  raw=('UNRELATED_SENTINEL = "preserved"\n'+''.join(pieces)).encode()
  with patch.object(prepare,'TAG_SHA',prepare.sha(raw)):result=prepare.patch_tags(raw,ref)
  out=ast.parse(result);self.assertEqual(out.body[0].value.value,'preserved')
  defs={n.name:ast.dump(n,include_attributes=False) for n in out.body if isinstance(n,ast.FunctionDef)}
  for n in t.body:
   if isinstance(n,ast.FunctionDef) and n.name in names:self.assertEqual(defs[n.name],ast.dump(n,include_attributes=False))
 def test_adapter_rejects_missing_sync_and_busy_before_inventory(self):
  class Missing:
   def enqueue(self,path):pass
  with self.assertRaises(ValueError):native.NativeAlbumIndex(Missing())
  class Busy:
   def enqueue(self,path,synchronous=False):pass
  i=Busy();i.stopping=threading.Event();i.active=True;i.jobs=queue.Queue()
  with patch.object(native.base,'inventory',side_effect=AssertionError('must not access media')):
   with self.assertRaisesRegex(PermissionError,'busy'):native.NativeAlbumIndex(i).preflight('id','Album')
 def test_receipt_absent_or_bad_preserves_existing_qualification(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);p.chmod(0o700)
   self.assertIsNone(http._fullsave_receipt(p));f=p/'fullsave-native-qualified.json';f.write_text('{}');f.chmod(0o600)
   self.assertIsNone(http._fullsave_receipt(p))
   with patch.object(http,'configure_rename_context') as rename:
    http.configure_save_context(contextlib.nullcontext,str(p),{'tags':True,'cover':True},index=object())
    self.assertEqual(http._SAVE_CONTEXT['qualified'],{'tags':True,'cover':True});rename.assert_not_called()
 def test_compose_only_two_flags_six_ro_files(self):
  value=release.overlay({'service':'music-gateway'},Path('/stage'),False)['services']['music-gateway']
  self.assertEqual(value['environment'],{release.FULL:'false',release.RENAME:'false'})
  self.assertEqual(len(value['volumes']),6);self.assertTrue(all(v['read_only'] for v in value['volumes']))
  self.assertNotIn('/music',[v['target'] for v in value['volumes']])
 def test_new_fixture_container_has_no_production_storage_or_network(self):
  source=(ROOT/'nas/tag-editor-cover/nas_native_fullsave_release.py').read_text()
  tree=ast.parse(source);fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='qualify');segment=ast.get_source_segment(source,fn)
  self.assertIn("'--network','none'",segment);self.assertNotIn('volumes-from',segment.replace('# No /music, /data, production secrets, volumes-from or application startup.',''))
  self.assertNotIn('Index.start',segment)
class ReleaseContracts(unittest.TestCase):
 def test_compose_preserves_unrelated_environment_and_mounts(self):
  with tempfile.TemporaryDirectory() as temp:
   stage=Path(temp);m={'project':'music-gateway','service':'music-gateway','compose':['base.yaml']}
   base={'services':{'music-gateway':{'image':'same','environment':{'AI_WORKER_ENABLED':'false','SECRET':'unchanged'},'volumes':[{'type':'bind','source':'/old','target':'/music','read_only':False}]},'other':{'image':'preserved'}}}
   import copy
   candidate=copy.deepcopy(base);candidate['services']['music-gateway']['environment'].update({release.FULL:'false',release.RENAME:'false'});candidate['services']['music-gateway']['volumes']+=release.overlay(m,stage,False)['services']['music-gateway']['volumes']
   with patch.object(release,'command',side_effect=[json.dumps(base),json.dumps(candidate)]):release.validate_config(m,stage)
   candidate['services']['music-gateway']['environment']['AI_WORKER_ENABLED']='true'
   with patch.object(release,'command',side_effect=[json.dumps(base),json.dumps(candidate)]),self.assertRaisesRegex(RuntimeError,'unrelated_environment_changed'):release.validate_config(m,stage)
 def test_http_merge_preserves_folder_prefix_rejects_unknown_suffix(self):
  raw=b"# Folder Index sentinel\nFOLDER_INDEX_VERSION=1\n# TAG_EDITOR_SAVE_EXTENSION_V1\n_SAVE_CONTEXT={}\ndef handle(h,index,music_root,origin,post=False):return None\n"
  ref=(ROOT/'nas/tag-editor-cover/tag_cover_http.py').read_bytes()
  with patch.object(prepare,'HTTP_SHA',prepare.sha(raw)):
   result=prepare.patch_http(raw,ref);self.assertTrue(result.startswith(b'# Folder Index sentinel\nFOLDER_INDEX_VERSION=1\n'));self.assertIn(b'def configure_rename_context',result)
  unknown=raw+b'NAS_EXTRA_GUARD=True\n'
  with patch.object(prepare,'HTTP_SHA',prepare.sha(unknown)),self.assertRaisesRegex(ValueError,'unrecognized_installed_http_extension'):prepare.patch_http(unknown,ref)
 def test_fullsave_receipt_requires_exact_current_sources_and_private_mode(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);backup=root/'backups';backup.mkdir(mode=0o700);app=root/'app';app.mkdir()
   names=('server.py','index_engine.py','catalog_lease.py','tag_cover_http.py','tag_phase2c.py','tag_cover_h.py','tag_rename_writer.py','tag_native_index.py')
   for n in names:(app/n).write_text('fixture '+n)
   proof={'schema':'fullsave-native-qualification-v1','state':'PASS','hashes':{n:hashlib.sha256((app/n).read_bytes()).hexdigest() for n in names}}
   p=backup/'fullsave-native-qualified.json';p.write_text(json.dumps(proof));p.chmod(0o600)
   with patch.object(http,'__file__',str(app/'tag_cover_http.py')):
    self.assertEqual(http._fullsave_receipt(backup),proof)
    (app/'index_engine.py').write_text('changed');self.assertIsNone(http._fullsave_receipt(backup))
    (app/'index_engine.py').write_text('fixture index_engine.py');p.chmod(0o644);self.assertIsNone(http._fullsave_receipt(backup))
 def test_idle_probe_reads_existing_lock_and_readonly_catalog(self):
  m={'project':'x'}
  with patch.object(release,'command',return_value='') as cmd:release.idle_check(m)
  code=cmd.call_args[0][0][-1]
  self.assertIn('os.O_RDONLY|os.O_NOFOLLOW',code);self.assertIn('mode=ro',code);self.assertNotIn('O_CREAT',code)
if __name__=='__main__':unittest.main()
