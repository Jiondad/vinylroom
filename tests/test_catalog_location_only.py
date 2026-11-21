import ast,unittest
from pathlib import Path
path=Path(__file__).resolve().parents[1]/'nas/tag-editor-cover/folder_container_check.py'
tree=ast.parse(path.read_text());node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='catalog_location');ns={'ast':ast,'Path':Path};exec(compile(ast.Module(body=[node],type_ignores=[]),str(path),'exec'),ns)
class CatalogLocationTest(unittest.TestCase):
 def test_actual_runtime_location_must_be_proved_before_using_catalog(self):
  server=ast.parse("INDEX=Index(ROOT,os.environ.get('INDEX_DATA_PATH','/data'),reader,scanner)")
  index=ast.parse("class Index:\n def __init__(self,root,data_path):\n  self.dir=Path(data_path).resolve()\n  self.dbpath=self.dir/'catalog.sqlite3'\n")
  f=ns['catalog_location'];self.assertEqual(f(server,index,{b'INDEX_DATA_PATH':b'/chosen'}),Path('/chosen/catalog.sqlite3'))
  with self.assertRaisesRegex(ValueError,'location_contract'):f(ast.parse("INDEX=Index(ROOT,'/unknown')"),index,{})
  with self.assertRaisesRegex(ValueError,'filename_contract'):f(server,ast.parse('class Index: pass'),{})
if __name__=='__main__':unittest.main()
