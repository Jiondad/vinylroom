import base64,contextlib,hashlib,io,json,os,sqlite3,subprocess,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'nas/tag-editor-cover'))
import tag_cover_http as http
from PIL import Image
class SaveConnection(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.music=self.root/'music';self.folder=self.music/'TEST/Album';self.folder.mkdir(parents=True);self.backup=self.root/'backup';self.catalog=self.root/'catalog.sqlite3';self.id='11111111-1111-4111-8111-111111111111'
  for ext in ['flac','mp3']:subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=0.15','-metadata','title=Before',str(self.folder/('01.'+ext))],check=True)
  with sqlite3.connect(str(self.catalog)) as db:
   db.execute('CREATE TABLE albums (id TEXT,artist TEXT,title TEXT,path TEXT,year TEXT,format TEXT,missing INTEGER,hidden INTEGER,data TEXT)');db.execute('INSERT INTO albums VALUES(?,?,?,?,?,?,?,?,?)',(self.id,'Test','Album','TEST/Album','2026','FLAC',0,0,json.dumps({'physical_files':[{},{}]})))
  self.catalog_sha=http.cover.base.file_sha256(self.catalog);self.flags={k:os.environ.get(k) for k in [http.cover.COVER_ENV,http.cover.base.TRACK_WRITE_ENV]}
  for k in self.flags:os.environ[k]='true'
  self.leases=0
  @contextlib.contextmanager
  def guard():self.leases+=1;yield
  http.configure_save_context(guard,str(self.backup),True)
 def tearDown(self):
  http._SAVE_CONTEXT.update(guard=None,backup_root=None,qualified=False)
  for k,v in self.flags.items():
   if v is None:os.environ.pop(k,None)
   else:os.environ[k]=v
  self.temp.cleanup()
 def test_missing_runtime_context_is_off(self):
  http._SAVE_CONTEXT['qualified']=False;self.assertFalse(http.save_capabilities()['tags']);r=http.save_request(self.catalog,self.music,http.PREFIX+'/tag-apply',{});self.assertEqual(r['state'],'HOLD');self.assertEqual(self.leases,0)
 def test_tag_apply_and_existing_restore(self):
  file='TEST/Album/01.flac';old=http.cover.base.file_sha256(self.music/file);tags=http.cover.base.read_tags(self.music/file);body={'album_id':self.id,'file':file,'edits':{'title':['After'],'tracknumber':['03']},'before_tags':{k:tags[k] for k in ['title','tracknumber']}}
  p=http.tag_plan(self.catalog,self.music,body);self.assertEqual(p['state'],'READ_ONLY_TRACK_WRITE_PLAN');body.update(expected_plan_id=p['plan_id'],confirm_write=True);r=http.save_request(self.catalog,self.music,http.PREFIX+'/tag-apply',body);self.assertEqual(r['state'],'TAG_TRACK_WRITE_COMPLETED',r);self.assertEqual(http.cover.base.read_tags(self.music/file)['title'],['After']);self.assertEqual(r['verification']['state'],'EMBEDDED_COVER_INSPECTED')
  again=http.save_request(self.catalog,self.music,http.PREFIX+'/tag-apply',body);self.assertEqual(again['state'],'HOLD')
  restored=http.cover.base.track_write_restore(self.music,self.backup,r['operation_id'],True,True);self.assertEqual(restored['state'],'TAG_TRACK_RESTORE_COMPLETED',restored);self.assertEqual(http.cover.base.file_sha256(self.music/file),old);self.assertEqual(http.cover.base.file_sha256(self.catalog),self.catalog_sha)
 def test_cover_apply_and_restore_formats(self):
  image=io.BytesIO();Image.new('RGB',(12,12),'blue').save(image,'PNG');blob=base64.b64encode(image.getvalue()).decode()
  for ext in ['flac','mp3']:
   file='TEST/Album/01.'+ext;old=http.cover.base.file_sha256(self.music/file);ins=http.inspect(self.catalog,self.music,self.id,file);body={'album_id':self.id,'file':file,'action':'add','image_base64':blob,'expected_file_sha256':ins['file_sha256'],'expected_catalog_digest':ins['catalog_digest']};p=http.plan(self.catalog,self.music,body);self.assertEqual(p['state'],'READ_ONLY_COVER_PLAN');body.update(expected_plan_id=p['plan_id'],confirm_write=True);r=http.save_request(self.catalog,self.music,http.PREFIX+'/apply',body);self.assertEqual(r['state'],'COVER_WRITE_COMPLETED',r);self.assertEqual(len(r['verification']['front_covers']),1)
   restored=http.cover.cover_restore(self.music,self.backup,r['operation_id'],True,True);self.assertEqual(restored['state'],'COVER_RESTORE_COMPLETED');self.assertEqual(http.cover.base.file_sha256(self.music/file),old)
  self.assertEqual(http.cover.base.file_sha256(self.catalog),self.catalog_sha)
 def test_changed_source_and_unselected_file_protected(self):
  file='TEST/Album/01.flac';untouched=http.cover.base.file_sha256(self.folder/'01.mp3');r=http.tag_plan(self.catalog,self.music,{'album_id':self.id,'file':file,'edits':{'title':['After']},'before_tags':{'title':['Wrong']}});self.assertEqual(r['reason'],'tags_changed_since_browser_read');self.assertEqual(http.cover.base.file_sha256(self.folder/'01.mp3'),untouched)
 def test_qualification_is_per_writer(self):
  http._SAVE_CONTEXT['qualified']={'tags':True,'cover':False};c=http.save_capabilities();self.assertTrue(c['tags']);self.assertFalse(c['cover']);self.assertFalse(c['rename'])
 def test_http_authentication_rejects_before_writer(self):
  class H:
   path=http.PREFIX+'/tag-apply';headers={'Origin':'https://jiondad.github.io'}
   def index_admin(self):raise PermissionError()
   def reply(self,status,body):self.result=(status,body);return self.result
  h=H();http.handle(h,None,self.music,'https://jiondad.github.io',True);self.assertEqual(h.result[0],403);self.assertEqual(self.leases,0)
if __name__=='__main__':unittest.main()
