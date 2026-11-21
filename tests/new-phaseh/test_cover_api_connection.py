import base64,hashlib,importlib.util,io,json,sys,unittest
from pathlib import Path
from unittest.mock import Mock,patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'nas/tag-editor-cover'))
import tag_cover_http as api
from PIL import Image
# Fixture setup only. Do NOT execute Phase H's existing 13 test methods.
spec=importlib.util.spec_from_file_location('existing_fixture',Path(__file__).resolve().parents[1]/'fixtures/phaseh_existing_fixture.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)

class ConnectionTests(unittest.TestCase):
 def setUp(self):self.f=fixture.CoverTests();self.f.setUp()
 def tearDown(self):self.f.tearDown()
 def exercise(self,ext):
  ident,file,path=self.f.album(ext);before=path.read_bytes();db=self.f.db.read_bytes()
  state=api.inspect(self.f.db,self.f.music,ident,file)
  self.assertEqual(state['front_covers'],[]);self.assertFalse(state['folder_cover_included'])
  body=dict(album_id=ident,file=file,action='add',image_base64=base64.b64encode(fixture.PNG).decode(),expected_file_sha256=state['file_sha256'],expected_catalog_digest=state['catalog_digest'])
  plan=api.plan(self.f.db,self.f.music,body);self.assertEqual(plan['state'],'READ_ONLY_COVER_PLAN',plan)
  self.assertFalse(plan['http_apply_supported']);self.assertEqual(before,path.read_bytes());self.assertEqual(db,self.f.db.read_bytes())
  with path.open('ab') as stream:stream.write(b'changed')
  changed=api.plan(self.f.db,self.f.music,body);self.assertNotEqual(changed['state'],'READ_ONLY_COVER_PLAN')
 def test_flac_read_plan_adapter_no_writes_and_cas(self):self.exercise('.flac')
 def test_mp3_read_plan_adapter_no_writes_and_cas(self):self.exercise('.mp3')
 def test_front_preview_replace_remove_plan_and_tag_audio_untouched(self):
  ident,file,path=self.f.album('.flac');f=api.cover.FLAC(str(path));pic=api.cover.Picture();pic.type=3;pic.mime='image/png';pic.data=fixture.PNG;f.add_picture(pic);f.save()
  before=path.read_bytes();state=api.inspect(self.f.db,self.f.music,ident,file)
  self.assertEqual(len(state['front_covers']),1);self.assertTrue(state['preview_data_url'].startswith('data:image/jpeg;base64,'))
  for action in ['replace','remove']:
   body=dict(album_id=ident,file=file,action=action,expected_file_sha256=state['file_sha256'],expected_catalog_digest=state['catalog_digest'])
   if action=='replace':body['image_base64']=base64.b64encode(fixture.PNG).decode()
   self.assertEqual(api.plan(self.f.db,self.f.music,body)['state'],'READ_ONLY_COVER_PLAN')
  self.assertEqual(before,path.read_bytes())
 def test_absolute_traversal_and_unknown_payload_rejected(self):
  for file in ['/music/a.mp3','../a.mp3','folder/../a.mp3','a\\b.mp3']:
   with self.assertRaises(ValueError):api._relative(file)
  with self.assertRaises(ValueError):api.plan(None,None,{'album_id':'x','file':'a','approve':True})
 def test_owner_auth_and_http_apply_never_delegates_even_if_env_on(self):
  h=Mock();h.headers={};h.path=api.PREFIX+'/apply';h.member_gate.return_value=None
  with patch.object(api.cover,'cover_apply',side_effect=AssertionError('writer called')):
   api.handle(h,object(),Path('/unused'),'https://jiondad.github.io')
  h.index_admin.assert_called_once();self.assertEqual(h.reply.call_args.args[0],405)
  h=Mock();h.headers={};h.path=api.PREFIX+'/inspect';h.index_admin.side_effect=PermissionError()
  api.handle(h,None,Path('/unused'),'https://jiondad.github.io');self.assertEqual(h.reply.call_args.args[0],403)
 def test_non_square_jpeg_dimensions_use_width_height(self):
  b=io.BytesIO();Image.new('RGB',(13,7)).save(b,'JPEG');info=api._image(b.getvalue());self.assertEqual((info['width'],info['height']),(13,7))
 def test_invalid_decoded_image_and_origin_cannot_create_plan(self):
  with self.assertRaises(Exception):api._image(b'not-image')
  h=Mock();h.headers={'Origin':'https://other.example'};h.path=api.PREFIX+'/plan';h.member_gate.return_value=None
  api.handle(h,object(),Path('/unused'),'https://jiondad.github.io',True);self.assertEqual(h.reply.call_args.args[0],403)
if __name__=='__main__':unittest.main()
