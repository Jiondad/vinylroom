#!/usr/bin/env python3
"""Prepare a candidate from the ACTUAL NAS HTTP source without replacing Folder Index.
No Docker command, installation, flag change, database or media access.
"""
import argparse,ast,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--current-http',required=True);p.add_argument('--expected-sha256',required=True);p.add_argument('--output',required=True);a=p.parse_args()
source=Path(a.current_http).read_bytes()
if hashlib.sha256(source).hexdigest()!=a.expected_sha256:raise SystemExit('HOLD: current HTTP SHA mismatch')
s=source.decode('utf-8');tree=ast.parse(s);functions={n.name for n in tree.body if isinstance(n,ast.FunctionDef)}
if not {'handle','plan','inspect','_identity'}.issubset(functions) or 'configure_save_context' in functions:raise SystemExit('HOLD: source contract differs or extension already present')
reference=Path(__file__).with_name('tag_cover_http.py').read_text();marker='\n_SAVE_ROUTES' # suffix starts before original handle capture
start=reference.index('\ndef configure_save_context(')
prefix="\n# TAG_EDITOR_SAVE_EXTENSION_V1 — default OFF; no automatic runtime guard configuration\n_SAVE_CONTEXT={'guard':None,'backup_root':None,'qualified':False}\n_READONLY_HANDLE=handle\n_SAVE_ROUTES=frozenset((PREFIX+'/save-capabilities',PREFIX+'/tag-plan',PREFIX+'/tag-apply',PREFIX+'/apply'))\n"
result=s+prefix+reference[start:];ast.parse(result)
out=Path(a.output)
if out.exists() or out.resolve()==Path(a.current_http).resolve():raise SystemExit('HOLD: output must be a new candidate path')
out.write_text(result);print('CANDIDATE_ONLY_WRITER_OFF',hashlib.sha256(out.read_bytes()).hexdigest())
