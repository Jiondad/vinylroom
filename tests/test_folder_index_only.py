import hashlib,json,sqlite3,sys,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'nas/tag-editor-cover'));sys.path.insert(1,str(ROOT/'baseline'))
import tag_phase2c as base
import tag_cover_http as http
class FolderIndexTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'catalog.sqlite3';self.folder='POP & ROCK/Chet Baker'
  with sqlite3.connect(self.path) as db:
   db.executescript('CREATE TABLE albums(id TEXT PRIMARY KEY,artist TEXT,title TEXT,year TEXT,path TEXT,hidden INTEGER,missing INTEGER,data TEXT); CREATE INDEX album_path ON albums(path); CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT); INSERT INTO meta VALUES("revision","r1");')
   for n in range(20):self.row(db,n,self.folder+'/Album '+str(n).zfill(2))
   self.row(db,30,self.folder+' Jr/Other');self.row(db,31,self.folder+'/Hidden',hidden=1);self.row(db,32,self.folder+'/Missing',missing=1)
  self.before=hashlib.sha256(self.path.read_bytes()).hexdigest()
 def tearDown(self):
  self.assertEqual(hashlib.sha256(self.path.read_bytes()).hexdigest(),self.before);self.tmp.cleanup()
 def row(self,db,n,path,hidden=0,missing=0):
  db.execute('INSERT INTO albums VALUES(?,?,?,?,?,?,?,?)',('00000000-0000-4000-8000-'+str(n).zfill(12),'A','Album '+str(n),'1999',path,hidden,missing,'THIS PAYLOAD MUST NEVER BE SELECTED'))
 def test_twenty_summaries_are_one_indexed_select_without_payload_or_media(self):
  statements=[];original=base.db_connect
  def connect(path):
   db=original(path);db.set_trace_callback(statements.append);return db
  with patch.object(base,'db_connect',connect):r=base.folder_albums_page(self.path,self.folder)
  self.assertEqual(len(r['items']),20);self.assertFalse(r['has_more']);self.assertIsNone(r['next_cursor']);self.assertEqual(set(r['items'][0]),{'id','artist','title','date','relative_path'})
  selects=[s for s in statements if s.startswith('SELECT ') and 'FROM albums' in s];self.assertEqual(len(selects),1);self.assertNotIn('data',selects[0].lower())
  with base.db_connect(self.path) as db:plan=[x[3] for x in db.execute('EXPLAIN QUERY PLAN '+base.FOLDER_SELECT,base.folder_list_window(self.folder,20,None)[1])]
  self.assertTrue(any('album_path' in p for p in plan));self.assertFalse(any('SCAN albums' in p for p in plan));self.plan=plan
 def test_boundary_and_pagination_exact_folder_and_duplicate_paths(self):
  with sqlite3.connect(self.path) as db:self.row(db,33,self.folder);self.row(db,34,self.folder+'/Album 01')
  self.before=hashlib.sha256(self.path.read_bytes()).hexdigest();items=[];cursor=None
  while True:
   r=base.folder_albums_page(self.path,self.folder,7,cursor);items.extend(r['items'])
   if not r['has_more']:break
   cursor=r['next_cursor']
  self.assertEqual(len(items),22);self.assertEqual(len({a['id'] for a in items}),22);self.assertTrue(all(a['relative_path']==self.folder or a['relative_path'].startswith(self.folder+'/') for a in items))
  with self.assertRaises(ValueError):base.folder_albums_page(self.path,'POP & ROCK/Other',7,cursor)
  with sqlite3.connect(self.path) as db:db.execute("UPDATE meta SET value='r2' WHERE key='revision'")
  self.before=hashlib.sha256(self.path.read_bytes()).hexdigest()
  with self.assertRaisesRegex(ValueError,'catalog_changed'):base.folder_albums_page(self.path,self.folder,7,cursor)
 def test_invalid_paths_and_missing_index_hold_without_schema_changes(self):
  for path in ['/music/A','A/../B','A//B','A\\B','A/','A/./B','A/test.flac','A\x00B']:
   with self.assertRaises(ValueError):base.folder_albums_page(self.path,path)
  with sqlite3.connect(self.path) as db:db.execute('DROP INDEX album_path')
  self.before=hashlib.sha256(self.path.read_bytes()).hexdigest()
  with self.assertRaisesRegex(ValueError,'album_path_index'):base.folder_albums_page(self.path,self.folder)
 def test_new_endpoint_reuses_admin_origin_and_get_only_contract(self):
  class Handler:
   path='/v2/admin/tag-cover/folder-albums?path=POP+%26+ROCK%2FChet+Baker';headers={'Origin':'https://frontend.test'}
   def index_admin(self):
    if self.denied:raise PermissionError()
   def member_gate(self):return True
   def reply(self,code,data):return code,data
   denied=False
  h=Handler();idx=SimpleNamespace(dbpath=self.path);code,r=http.handle(h,idx,None,'https://frontend.test');self.assertEqual(code,200);self.assertEqual(len(r['items']),20)
  h.denied=True;self.assertEqual(http.handle(h,idx,None,'https://frontend.test')[0],403)
  h.denied=False;h.headers={'Origin':'https://other.test'};self.assertEqual(http.handle(h,idx,None,'https://frontend.test')[0],403)
  h.headers={'Origin':'https://frontend.test'};self.assertEqual(http.handle(h,idx,None,'https://frontend.test',True)[0],405)
if __name__=='__main__':unittest.main()
