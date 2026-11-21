# Executed in the current container through stdin by nas_folder_release.py.
# Does not import server.py, start an Index engine, or open any media file.
import ast,base64,hashlib,json,os,time,types
from pathlib import Path

def catalog_location(server_tree,index_tree,env):
 expected=ast.dump(ast.parse("os.environ.get('INDEX_DATA_PATH','/data')",mode='eval').body,include_attributes=False)
 constructors=[n.value for n in ast.walk(server_tree) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='INDEX' for t in n.targets) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='Index']
 if len(constructors)!=1 or len(constructors[0].args)<2 or ast.dump(constructors[0].args[1],include_attributes=False)!=expected:raise ValueError('runtime_catalog_location_contract_unconfirmed')
 expected_db=ast.dump(ast.parse("self.dbpath=self.dir/'catalog.sqlite3'").body[0],include_attributes=False)
 expected_dir=ast.dump(ast.parse("self.dir=Path(data_path).resolve()").body[0],include_attributes=False)
 constructors=[m for n in index_tree.body if isinstance(n,ast.ClassDef) and n.name=='Index' for m in n.body if isinstance(m,ast.FunctionDef) and m.name=='__init__']
 statements=[ast.dump(n,include_attributes=False) for n in ast.walk(constructors[0]) if isinstance(n,ast.Assign)] if len(constructors)==1 else []
 if expected_db not in statements or expected_dir not in statements:raise ValueError('runtime_catalog_filename_contract_unconfirmed')
 root=Path(env.get(b'INDEX_DATA_PATH',b'/data').decode())
 if not root.is_absolute():raise ValueError('runtime_catalog_directory_not_absolute')
 return root/'catalog.sqlite3'

def container_check(payload,folder,query):
 def digest(raw):return hashlib.sha256(raw).hexdigest()
 names=['server.py','index_engine.py','tag_phase2c.py','tag_cover_http.py','tag_cover_h.py']
 raw={}
 for n in names:
  path=Path('/app',n)
  if not path.is_file():raise ValueError('runtime_source_missing:'+n)
  raw[n]=path.read_bytes()
 hashes={n:digest(b) for n,b in raw.items()}
 if hashes['tag_cover_h.py']!=payload['protected_cover_sha256']:raise ValueError('protected_cover_source_baseline_mismatch')
 states=[]
 for n in ['tag_phase2c.py','tag_cover_http.py']:
  if hashes[n]==payload['baseline'][n]:states.append('baseline')
  elif hashes[n]==payload['desired'][n]:states.append('installed')
  else:raise ValueError('operating_module_baseline_mismatch:'+n)
 if len(set(states))!=1:raise ValueError('mixed_source_state')
 tree=ast.parse(raw['server.py']);handlers=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Handler']
 if len(handlers)!=1:raise ValueError('existing_handler_not_found')
 methods={n.name:n for n in handlers[0].body if isinstance(n,ast.FunctionDef)}
 if not {'index_api','index_admin','member_gate','reply'}<=set(methods):raise ValueError('existing_admin_gate_contract_missing')
 expected=ast.parse("if urlsplit(self.path).path.startswith('/v2/admin/tag-cover'):\n from tag_cover_http import handle as tag_cover_handle\n return tag_cover_handle(self, INDEX, ROOT, ORIGIN, post)").body[0]
 body=methods['index_api'].body
 if not body or ast.dump(body[0],include_attributes=False)!=ast.dump(expected,include_attributes=False):raise ValueError('installed_phase_h_router_hook_mismatch')
 env=dict(x.split(b'=',1) for x in Path('/proc/1/environ').read_bytes().split(b'\0') if b'=' in x)
 writer=env.get(b'VINYL_TAG_EDITOR_COVER_WRITE_ENABLED',b'unset').decode()
 if writer.lower() not in ('unset','','false','off','0'):raise ValueError('cover_writer_not_off')
 result={'runtime_hashes':hashes,'state':states[0],'writer':'OFF','router_hook':'EXACT_PHASE_H_EXISTING','source_writes':0,'db_writes':0,'media_reads':0,'media_writes':0,'http_requests':0}
 if query:
  try:import PIL,mutagen
  except ImportError as exc:raise ValueError('existing_phase_h_dependency_missing:'+str(exc.name))
  # Compile the verified package candidate in memory; no module source installation.
  candidate=base64.b64decode(payload['candidate_phase2c'])
  if digest(candidate)!=payload['desired']['tag_phase2c.py']:raise ValueError('candidate_payload_hash_mismatch')
  module=types.ModuleType('phase2c_folder_candidate');module.__file__='<verified-candidate-in-memory>'
  exec(compile(candidate,'<verified-folder-candidate>','exec'),module.__dict__)
  dbpath=catalog_location(tree,ast.parse(raw['index_engine.py']),env);f,args,_=module.folder_list_window(folder,20,None)
  with module.contextlib.closing(module.db_connect(dbpath)) as db:
   module.folder_list_contract(db)
   schema=[tuple(row) for row in db.execute('PRAGMA table_info(albums)')]
   plan=[row[3] for row in db.execute('EXPLAIN QUERY PLAN '+module.FOLDER_SELECT,args)]
  if any('SCAN albums' in p for p in plan):raise ValueError('folder_query_would_scan_catalog')
  started=time.perf_counter();page=module.folder_albums_page(dbpath,folder,20)
  result['schema_sha256']=digest(json.dumps(schema,sort_keys=True).encode())
  result['query']={'summary_count':len(page['items']),'has_more':page['has_more'],'field_names':['id','title','artist','date','relative_path'],'path_values_omitted':True,'select_limit':21,'query_plan':plan,'catalog_query_ms':round((time.perf_counter()-started)*1000,3),'not_browser_http_timing':True}
 return result

try:
 print(json.dumps(container_check(PAYLOAD,FOLDER,DO_QUERY),ensure_ascii=False))
except Exception as exc:
 print(json.dumps({'state':'HOLD','reason':str(exc) if isinstance(exc,ValueError) else type(exc).__name__,'db_writes':0,'media_writes':0,'http_requests':0}));raise SystemExit(2)
