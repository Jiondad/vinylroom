#!/usr/bin/env python3
"""Exact-baseline candidate preparation. No install, Docker, DB or media access."""
import ast,hashlib,json
from pathlib import Path

INDEX_SHA='66abf0f75eb256e16334631466ba70eac8faa33e196c2e4b671e4c992cb0c81d'
SERVER_SHA='31cdc3ef488d12d4a4d4e5938f69a0a270b260755d018d4a680a5c8b5c266375'
HTTP_SHA='bf69b6e6b9d2291dcb30e2e8c7e154c3391aeb9d437669be80b7d8ef019b2298'
TAG_SHA='0a98c4c73c6973a212d164d7de11da6384e3865aa4df39338a4e3b0064a6d4a5'
COVER_SHA='13062756878a789fa3c27e65716a81330953e5f252ddc5234b2bd9d81b06a736'

def sha(data):return hashlib.sha256(data).hexdigest()
def patch_index(raw):
    if sha(raw)!=INDEX_SHA:raise ValueError('installed_index_sha_changed')
    text=raw.decode();tree=ast.parse(text)
    method=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='enqueue')
    lines=text.splitlines(keepends=True);source=''.join(lines[method.lineno-1:method.end_lineno])
    old="def enqueue(self,path='',recursive=True,kind='manual',scan_mode='changes'):"
    if source.count(old)!=1 or source.count('self.progress(job);self.jobs.put_nowait(job)')!=1:raise ValueError('native_enqueue_contract_changed')
    source=source.replace(old,"def enqueue(self,path='',recursive=True,kind='manual',scan_mode='changes',synchronous=False):\n        if type(synchronous) is not bool or (synchronous and (not path or kind!='manual')):raise ValueError('synchronous_album_scope_required')")
    source=source.replace('self.progress(job);self.jobs.put_nowait(job)',"self.progress(job)\n            if not synchronous:self.jobs.put_nowait(job)")
    source=source.replace('        return job\n','        if synchronous:self.execute_job(job)\n        return job\n')
    # Single-function replacement. The @index_job decorator and every other byte stay.
    result=''.join(lines[:method.lineno-1])+source+''.join(lines[method.end_lineno:]);ast.parse(result)
    return result.encode()

def patch_server(raw):
    if sha(raw)!=SERVER_SHA:raise ValueError('installed_server_sha_changed')
    count=[0]
    def transform(text,depth=0):
        if depth>3:raise ValueError('nested_server_source_limit')
        tree=ast.parse(text);lines=text.splitlines(keepends=True);offset=[0]
        for line in lines:offset.append(offset[-1]+len(line))
        def pos(line,column):return offset[line-1]+len(lines[line-1].encode('utf-8')[:column].decode('utf-8'))
        aliases={'configure_save_context'}
        for imported in ast.walk(tree):
            if isinstance(imported,ast.ImportFrom) and imported.module=='tag_cover_http':
                aliases.update(n.asname or n.name for n in imported.names if n.name=='configure_save_context')
        replacements=[]
        for n in ast.walk(tree):
            if isinstance(n,ast.Call):
                name=n.func.id if isinstance(n.func,ast.Name) else n.func.attr if isinstance(n.func,ast.Attribute) else ''
                if name in aliases:
                    if any(k.arg=='index' for k in n.keywords):raise ValueError('server_already_fullsave_wired')
                    # Add an explicit server-owned INDEX reference; keep original guard and qualification arguments.
                    n.keywords.append(ast.keyword(arg='index',value=ast.Name(id='INDEX',ctx=ast.Load())))
                    a=pos(n.lineno,n.col_offset);b=pos(n.end_lineno,n.end_col_offset)
                    replacements.append((a,b,ast.unparse(n)));count[0]+=1
                elif name=='exec' and n.args and isinstance(n.args[0],ast.Constant) and isinstance(n.args[0].value,str) and 'configure_save_context' in n.args[0].value:
                    c=n.args[0];a=pos(c.lineno,c.col_offset);b=pos(c.end_lineno,c.end_col_offset)
                    replacements.append((a,b,repr(transform(c.value,depth+1))))
        for a,b,value in sorted(replacements,reverse=True):text=text[:a]+value+text[b:]
        ast.parse(text);return text
    result=transform(raw.decode())
    if count[0]!=1:raise ValueError('exactly_one_server_save_context_call_required:'+str(count[0]))
    return result.encode()

def patch_tags(raw,reference):
    if sha(raw)!=TAG_SHA:raise ValueError('installed_tag_sha_changed')
    old=raw.decode();new=reference.decode();oldtree=ast.parse(old);newtree=ast.parse(new)
    olddefs={n.name:n for n in oldtree.body if isinstance(n,ast.FunctionDef)}
    newdefs={n.name:n for n in newtree.body if isinstance(n,ast.FunctionDef)}
    lines=old.splitlines(keepends=True);newlines=new.splitlines(keepends=True)
    changes=[]
    for name in ('validate_track_edits','track_write_plan','_make_stage_track','track_write_preflight'):
        a,b=olddefs[name],newdefs[name]
        if ast.dump(a.args,include_attributes=False)!=ast.dump(b.args,include_attributes=False):raise ValueError('tag_function_signature_changed:'+name)
        changes.append((a.lineno-1,a.end_lineno,''.join(newlines[b.lineno-1:b.end_lineno])))
    for a,b,text in sorted(changes,reverse=True):lines[a:b]=[text]
    text=''.join(lines)
    node=next(n for n in ast.parse(text).body if isinstance(n,ast.FunctionDef) and n.name=='track_write_plan')
    parts=text.splitlines(keepends=True)
    parts.insert(node.lineno-1,"FULL_TAG_WRITE_FIELDS=frozenset(ALL_TRACK_FIELDS)\nFULL_TAG_WRITE_ENV='VINYL_TAG_EDITOR_FULL_TAG_WRITE_ENABLED'\n\n")
    text=''.join(parts);ast.parse(text);return text.encode()


def patch_http(raw,reference):
    if sha(raw)!=HTTP_SHA:raise ValueError('installed_http_sha_changed')
    old=raw.decode();new=reference.decode();marker='# TAG_EDITOR_SAVE_EXTENSION_V1'
    if old.count(marker)!=1 or new.count(marker)!=1:raise ValueError('http_extension_boundary_changed')
    # Never drop unknown NAS Folder Index additions hidden after the save boundary.
    allowed={'_SAVE_CONTEXT','_READONLY_HANDLE','_SAVE_ROUTES','configure_save_context','save_capabilities','_writer_edits','tag_plan','save_request','handle'}
    for node in ast.parse(old[old.index(marker):]).body:
        if isinstance(node,ast.FunctionDef):names={node.name}
        elif isinstance(node,ast.Assign) and all(isinstance(t,ast.Name) for t in node.targets):names={t.id for t in node.targets}
        else:raise ValueError('unrecognized_installed_http_extension_node')
        if not names<=allowed:raise ValueError('unrecognized_installed_http_extension:'+','.join(names))
    result=old[:old.index(marker)]+new[new.index(marker):]
    ast.parse(result);return result.encode()

def prepare(current,reference,out):
    current,reference,out=map(Path,(current,reference,out));out.mkdir(mode=0o700,parents=True,exist_ok=False)
    expected={'server.py':SERVER_SHA,'index_engine.py':INDEX_SHA,'tag_cover_http.py':HTTP_SHA,'tag_phase2c.py':TAG_SHA,'tag_cover_h.py':COVER_SHA}
    for name,digest in expected.items():
        if sha((current/name).read_bytes())!=digest:raise ValueError('baseline_sha_mismatch:'+name)
    (out/'server.py').write_bytes(patch_server((current/'server.py').read_bytes()))
    (out/'index_engine.py').write_bytes(patch_index((current/'index_engine.py').read_bytes()))
    (out/'tag_cover_http.py').write_bytes(patch_http((current/'tag_cover_http.py').read_bytes(),(reference/'tag_cover_http.py').read_bytes()))
    (out/'tag_phase2c.py').write_bytes(patch_tags((current/'tag_phase2c.py').read_bytes(),(reference/'tag_phase2c.py').read_bytes()))
    for name in ('tag_rename_writer.py','tag_native_index.py'):(out/name).write_bytes((reference/name).read_bytes())
    manifest={p.name:sha(p.read_bytes()) for p in out.glob('*.py')}
    (out/'SOURCE_SHA256.json').write_text(json.dumps(manifest,indent=2)+'\n');return manifest
