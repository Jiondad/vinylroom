import ast,importlib.util,unittest
from pathlib import Path
p=Path(__file__).resolve().parents[2]/'nas/tag-editor-cover/nas_phaseh_release.py'
spec=importlib.util.spec_from_file_location('release',p);release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
SOURCE=b'''class Handler:
    def index_admin(self): pass
    def member_gate(self): pass
    def reply(self): pass
    def index_api(self,post=False):
        return 'unchanged'
'''
class ReleaseTests(unittest.TestCase):
 def test_hook_is_only_on_new_prefix_existing_route_preserved(self):
  out=release.patch_source(SOURCE).decode();ast.parse(out)
  self.assertEqual(out.count(release.MARK),1);self.assertIn("return 'unchanged'",out)
  self.assertLess(out.index("startswith('/v2/admin/tag-cover')"),out.index("from tag_cover_http"))
 def test_no_repeat_or_changed_contract_install(self):
  out=release.patch_source(SOURCE)
  with self.assertRaises(ValueError):release.patch_source(out)
  with self.assertRaises(ValueError):release.patch_source(SOURCE.replace(b'post=False',b'other=False'))
 def test_no_unbound_source_destination(self):
  with self.assertRaises(ValueError):release.mapping('/app/tag_cover_http.py',[])
  self.assertEqual(str(release.mapping('/app/server.py',[{'Destination':'/app','Source':'/nas/app','Type':'bind'}])),'/nas/app/server.py')
if __name__=='__main__':unittest.main()
