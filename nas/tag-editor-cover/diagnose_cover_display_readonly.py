#!/usr/bin/env python3
"""Vinyl Room: read-only album-cover serving path diagnostic.
Run INSIDE existing container: python3 - < this_file.py
No imports of server/index modules; no network, DB or media reads; no writes.
"""
import ast, json, re
from pathlib import Path

FILES=('/app/server.py','/app/index_engine.py')
TERMS=re.compile(r"cover.original|cover-original|/v2/cover|cover_path|cover_source|cover_url|cover_image|_cover\b|def cover|\.pictures|\bAPIC\b",re.I)
def source(path):
    p=Path(path)
    if not p.is_file() or p.is_symlink(): return {'state':'HOLD','reason':'source_missing_or_symlink'}
    s=p.read_text(encoding='utf-8')
    lines=s.splitlines()
    try: tree=ast.parse(s)
    except SyntaxError as e: return {'state':'HOLD','reason':'syntax_error','line':e.lineno}
    targets=[]
    for node in ast.walk(tree):
        if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and ('cover' in node.name.lower() or 'art' in node.name.lower()):
            targets.append({'name':node.name,'line':node.lineno,'end_line':node.end_lineno})
    hits=[]
    for n,line in enumerate(lines,1):
        if not TERMS.search(line):continue
        # Never dump sensitive config, tokens, headers, or request credentials.
        if re.search(r"token|secret|password|api_key|authorization|publishable_key",line,re.I):continue
        first=max(1,n-2);last=min(len(lines),n+3)
        snippet=[{'line':i,'code':lines[i-1][:240]} for i in range(first,last+1) if not re.search(r"token|secret|password|api_key|authorization|publishable_key",lines[i-1],re.I)]
        hits.append({'match_line':n,'context':snippet})
        if len(hits)>=24:break
    return {'state':'READ_ONLY','lines':len(lines),'functions':targets[:25],'cover_references':hits}
print(json.dumps({'state':'COVER_DISPLAY_SOURCE_DIAGNOSTIC','media_writes':0,'db_writes':0,'files':{p:source(p) for p in FILES}},ensure_ascii=False,indent=2))
