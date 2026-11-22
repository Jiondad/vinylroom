"""Only new rename HTTP/restore/path contracts; native-index fixture is synthetic."""
import contextlib,json,os,sqlite3,subprocess,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'nas/tag-editor-cover'))
import tag_cover_http as http
import tag_rename_writer as rename
class RenameWiring(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.music=self.root/'music';self.backup=self.root/'backup';self.db=self.root/'catalog';self.uid='11111111-1111-4111-8111-111111111111';self.album='TEST/Album';self.file=self.album+'/CD1/01.flac'
  for disc in ('CD1','CD2'):
   folder=self.music/self.album/disc;folder.mkdir(parents=True)
   subprocess.run([os.environ.get('TAG_EDITOR_FIXTURE_FFMPEG','ffmpeg'),'-v','error','-f','lavfi','-i','sine=frequency=440:duration=0.1','-metadata','title=Original',str(folder/'01.flac')],check=True)
  with sqlite3.connect(self.db) as db:
   db.execute('CREATE TABLE albums(id TEXT,artist TEXT,title TEXT,path TEXT,year TEXT,format TEXT,missing INTEGER,hidden INTEGER,data TEXT)');db.execute('INSERT INTO albums VALUES(?,?,?,?,?,?,?,?,?)',(self.uid,'Test','Album',self.album,'2026','FLAC',0,0,'{}'))
  self.held=False;self.calls=[];self.oldflag=os.getenv(rename.RENAME_ENV);os.environ[rename.RENAME_ENV]='true'
  @contextlib.contextmanager
  def guard():
   assert not self.held;self.held=True
   try:yield
   finally:self.held=False
  http.configure_save_context(guard,str(self.backup),{'tags':True,'cover':True});self.reindex_raw()
  http.configure_rename_context(self.reindex,True)
 def reindex_raw(self):
  # Simulates a native index only for fixture Catalog; NOT a production adapter.
  files=[{'path':p.relative_to(self.music).as_posix()} for p in sorted((self.music/self.album).glob('CD*/*.flac'))]
  with sqlite3.connect(self.db) as db:db.execute('UPDATE albums SET data=? WHERE id=?',(json.dumps({'physical_files':files}),self.uid))
 def reindex(self,uid,path):
  assert self.held and uid==self.uid and path==self.album
  self.calls.append((uid,path));self.reindex_raw()
 def tearDown(self):
  http._SAVE_CONTEXT.clear();http._SAVE_CONTEXT.update(guard=None,backup_root=None,qualified=False)
  if self.oldflag is None:os.environ.pop(rename.RENAME_ENV,None)
  else:os.environ[rename.RENAME_ENV]=self.oldflag
  self.temp.cleanup()
 def body(self):
  b={'album_id':self.uid,'file':self.file,'new_name':'1 - 01. Death Penalty.flac'}
  p=http.save_request(self.db,self.music,http.PREFIX+'/rename-plan',b);self.assertEqual(p['state'],'READ_ONLY_RENAME_PLAN',p);return {**b,'expected_plan_id':p['plan_id'],'confirm_write':True}
 def test_http_rename_and_restore_same_lease_with_multidisc_names(self):
  before=http.cover.base.file_sha256(self.music/self.file);other=http.cover.base.file_sha256(self.music/self.album/'CD2/01.flac')
  r=http.save_request(self.db,self.music,http.PREFIX+'/rename-apply',self.body());self.assertEqual(r['state'],'RENAME_WRITE_COMPLETED',r);self.assertEqual(r['saved_tags']['title'],['Original']);self.assertIn(r['new_file'],rename._catalog_files(self.db,self.uid));self.assertFalse((self.music/self.file).exists())
  restored=http.save_request(self.db,self.music,http.PREFIX+'/rename-restore',{'operation_id':r['operation_id'],'confirm_write':True});self.assertEqual(restored['state'],'RENAME_RESTORE_COMPLETED',restored);self.assertEqual(http.cover.base.file_sha256(self.music/self.file),before);self.assertEqual(http.cover.base.file_sha256(self.music/self.album/'CD2/01.flac'),other);self.assertEqual(len(self.calls),2)
 def test_hash_cas_stops_before_move(self):
  body=self.body();p=self.music/self.file
  with p.open('ab') as f:f.write(b'changed')
  r=http.save_request(self.db,self.music,http.PREFIX+'/rename-apply',body);self.assertEqual(r['state'],'HOLD',r);self.assertTrue(p.exists());self.assertEqual(self.calls,[])
 def test_native_failure_restores_and_verifies_catalog(self):
  def callback(uid,path):
   assert self.held;self.reindex_raw();self.calls.append('called')
   if len(self.calls)==1:raise RuntimeError('native indexing failed')
  http.configure_rename_context(callback,True)
  r=http.save_request(self.db,self.music,http.PREFIX+'/rename-apply',self.body());self.assertEqual(r['state'],'HOLD_ROLLED_BACK',r);self.assertTrue((self.music/self.file).exists());self.assertIn(self.file,rename._catalog_files(self.db,self.uid))
 def test_rollback_without_catalog_restoration_is_manual_hold(self):
  def callback(uid,path):
   assert self.held;self.calls.append('called')
   if len(self.calls)==1:self.reindex_raw();raise RuntimeError('partial index')
  http.configure_rename_context(callback,True)
  r=http.save_request(self.db,self.music,http.PREFIX+'/rename-apply',self.body());self.assertEqual(r['state'],'HOLD_MANUAL_RECOVERY',r)
 def test_unicode_case_collision_and_unsafe_names(self):
  folder=(self.music/self.file).parent;(folder/'É NOTES.FLAC').write_bytes((self.music/self.file).read_bytes())
  r=rename.plan(self.db,self.music,self.uid,self.file,'E\u0301 notes.flac');self.assertEqual(r['reason'],'destination_collides_with_album_track',r)
  for name in ('../new.flac','COM9.flac','a.mp3','😀'*100+'.flac'):
   r=rename.plan(self.db,self.music,self.uid,self.file,name);self.assertEqual(r['state'],'HOLD',r)
 def test_missing_native_qualification_blocks_before_write(self):
  http._SAVE_CONTEXT.pop('reindex_album');self.assertFalse(http.save_capabilities()['rename'])
  r=http.save_request(self.db,self.music,http.PREFIX+'/rename-apply',self.body());self.assertEqual(r['reason'],'native_reindex_and_nas_qualification_required');self.assertFalse(self.backup.exists())
 def test_new_read_endpoint_returns_actual_file_tags(self):
  r=http.read_album_tags(self.db,self.music,self.uid);self.assertEqual(r['state'],'ACTUAL_ALBUM_TAGS');self.assertEqual(len(r['entries']),2);self.assertEqual(r['entries'][0]['tags']['title'],['Original']);self.assertFalse(self.backup.exists())
class NewTagValueContracts(unittest.TestCase):
 setUp=RenameWiring.setUp
 tearDown=RenameWiring.tearDown
 reindex_raw=RenameWiring.reindex_raw
 reindex=RenameWiring.reindex
 # Use only these newly defined methods when running locally; inherited rename
 # cases are already recorded and are not invoked a second time.
 def test_new_mp3_v23_multivalues_v1_and_protected_metadata(self):
  from mutagen.id3 import ID3,USLT,TXXX,APIC
  from PIL import Image
  import io
  target=self.music/self.album/'CD1/new.mp3'
  subprocess.run([os.environ.get('TAG_EDITOR_FIXTURE_FFMPEG','ffmpeg'),'-v','error','-f','lavfi','-i','sine=frequency=440:duration=0.1',str(target)],check=True)
  tag=ID3(target);tag.add(USLT(encoding=3,lang='eng',desc='original',text='Preserve lyrics'));tag.add(TXXX(encoding=3,desc='CUSTOM',text=['Keep custom']));image=io.BytesIO();Image.new('RGB',(4,4),'blue').save(image,'PNG');tag.add(APIC(encoding=3,mime='image/png',type=3,desc='front',data=image.getvalue()));tag.save(target,v2_version=3,v23_sep=None)
  with target.open('ab') as f:f.write(b'TAG'+b'X'*125)
  # Exact same existing fixture schema; Catalog count reflects the new test file.
  files=[{'path':p.relative_to(self.music).as_posix()} for p in (self.music/self.album).glob('CD*/*') if p.suffix.lower() in ('.flac','.mp3')]
  with sqlite3.connect(self.db) as db:db.execute('UPDATE albums SET data=? WHERE id=?',(json.dumps({'physical_files':files}),self.uid))
  self.roundtrip_values(target)
 def test_new_flac_multivalues_and_nine_fields(self):
  from mutagen.flac import FLAC
  target=self.music/self.file;audio=FLAC(target);audio['lyrics']=['Preserve lyrics'];audio['custom']=['Keep custom'];audio.save();self.roundtrip_values(target)
 def roundtrip_values(self,target):
  oldflag=os.getenv(http.cover.base.FULL_TAG_WRITE_ENV);oldtrack=os.getenv(http.cover.base.TRACK_WRITE_ENV);os.environ[http.cover.base.FULL_TAG_WRITE_ENV]='true';os.environ[http.cover.base.TRACK_WRITE_ENV]='true';http._SAVE_CONTEXT['qualified']['full_tags']=True
  try:
   oldsha=http.cover.base.file_sha256(target);file=target.relative_to(self.music).as_posix();old=http.cover.base.read_tags(target)
   edits={'title':['New Title'],'artist':['Artist A','Artist B'],'album':['New Album'],'album_artist':['A','B'],'date':['2026-11-22'],'genre':['Rock','Pop'],'featuring':['Guest A','Guest B'],'tracknumber':['03'],'discnumber':['2']}
   body={'album_id':self.uid,'file':file,'edits':edits,'before_tags':{k:old[k] for k in edits}};p=http.tag_plan(self.db,self.music,body);self.assertEqual(p['state'],'READ_ONLY_TRACK_WRITE_PLAN',p)
   r=http.save_request(self.db,self.music,http.PREFIX+'/tag-apply',{**body,'expected_plan_id':p['plan_id'],'confirm_write':True});self.assertEqual(r['state'],'TAG_TRACK_WRITE_COMPLETED',r);self.assertEqual(r['saved_tags'],edits)
   result=http.cover.base.track_write_restore(self.music,self.backup,r['operation_id'],True,True);self.assertEqual(result['state'],'TAG_TRACK_RESTORE_COMPLETED',result);self.assertEqual(http.cover.base.file_sha256(target),oldsha)
  finally:
   for flag,value in ((http.cover.base.FULL_TAG_WRITE_ENV,oldflag),(http.cover.base.TRACK_WRITE_ENV,oldtrack)):
    if value is None:os.environ.pop(flag,None)
    else:os.environ[flag]=value
if __name__=='__main__':unittest.main()
