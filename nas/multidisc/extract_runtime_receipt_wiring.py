#!/usr/bin/env python3
"""Read only, extract actual receipt consumers and the existing sync startup wiring.
No imports of server, no network, no DB changes or service restart.
"""
import ast,json
from pathlib import Path
out={}
for name in ("server.py","tag_cover_http.py","ai_metadata/auto_sync.py","ai_metadata/sync.py"):
 p=Path("/app")/name
 src=p.read_text();tree=ast.parse(src)
 matches=[]
 for n in ast.walk(tree):
  if not isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):continue
  body=ast.get_source_segment(src,n) or ""
  if name=="server.py":
   relevant=any(s in body for s in ("fullsave-native-qualified","fullsave-native-qualification","configure_rename_context","configure_save_context"))
  elif name=="tag_cover_http.py":
   relevant=n.name in ("save_capabilities","configure_rename_context","configure_save_context","save_request")
  elif name.endswith("auto_sync.py"):
   relevant=n.name in ("start_observer","configured","enabled")
  else:
   relevant=n.name=="__init__" and "index_guard" in body
  if relevant and len(body)<25000:matches.append({"name":n.name,"source":body})
 out[name]=matches
print(json.dumps({"state":"MULTIDISC_RECEIPT_RUNTIME_WIRING","functions":out,"writes":0},ensure_ascii=False,indent=2))
