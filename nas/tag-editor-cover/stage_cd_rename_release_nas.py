#!/usr/bin/env python3
"""Stage two-source CD Rename release candidates. No writes to operational paths."""
import ast
import hashlib
import json
from pathlib import Path

BASE=Path('/volume1/docker/music-gateway')
STAGE=BASE/'tag-editor-cd-rename-guard-stage-20261123'
NATIVE=STAGE/'tag_native_index.py.fixed-candidate'
HTTP=STAGE/'tag_cover_http.py.cd-native.candidate'
LIVE_NATIVE=BASE/'tag-editor-fullsave-native-20261122/candidate/tag_native_index.py'
LIVE_HTTP=BASE/'tag-editor-leasebusy-409-stage-20261123/tag_cover_http.py'
OUT_HTTP=STAGE/'tag_cover_http.py.cd-release-candidate'
MANIFEST=STAGE/'cd-rename-release-staged.json'
CHECKS=[
    (NATIVE,'e6e6e6127223c1b01e57aea3400180b3c80b160f0544935515052b172fd4c30e'),
    (HTTP,'87e75c2a852e9f452032c9949d6313fbe3afa81c13f93ca383e04b7a133281dd'),
    (LIVE_NATIVE,'ef1f6903e31359c07de6dbf56bd7ad615d21ec3b6b2325c98c143c22cd65c684'),
    (LIVE_HTTP,'d07d29f02395b128fa9f65b92923451d3ebfbf510bf26105f61c0506588146cd'),
]
def sha(data):return hashlib.sha256(data).hexdigest()
def fail(reason):raise SystemExit('HOLD: '+reason)
for path,expected in CHECKS:
    if not path.is_file() or path.is_symlink() or sha(path.read_bytes())!=expected:
        fail('pinned source differs: '+str(path))
native=NATIVE.read_text(encoding='utf-8')
http=HTTP.read_text(encoding='utf-8')
for source in (native,http):ast.parse(source)
if 'cd_disc_rename_native_reindex_unqualified' in http:
    fail('CD backend guard unexpectedly present in candidate')
http_ast=ast.parse(http)
functions={n.name for n in http_ast.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}
required={'save_capabilities','rename_capable','configure_save_context'}
if not required.issubset(functions):fail('HTTP candidate missing API wiring: '+str(required-functions))
if http.count('def save_capabilities(')!=1:fail('save capabilities function not unique')
# Capability is fail-closed: old backend, failed qualification, or disabled Rename -> false.
# Existing native receipt gate is enforced by rename_capable().
# Adding this field changes no other save-capabilities keys.
addon="""

# Explicit qualified capability for frontend integrated CD1/CD2 Rename.
# Backend Rename remains protected by the existing owner lease,
# NAS qualification receipt, and explicit write gate.
_CD_NATIVE_ORIGINAL_SAVE_CAPABILITIES = save_capabilities

def save_capabilities():
    result = _CD_NATIVE_ORIGINAL_SAVE_CAPABILITIES()
    if not isinstance(result, dict):
        raise RuntimeError('cd_native_save_capabilities_shape_changed')
    result = dict(result)
    result['cd_rename'] = (result.get('rename') is True and rename_capable())
    return result
"""
candidate=http.rstrip()+addon
ast.parse(candidate)
record={
    'schema':'cd-rename-release-stage-v1',
    'state':'STAGED_NOT_DEPLOYED',
    'isolated_qualification':'CD_NATIVE_ISOLATED_RENAME_PASS',
    'isolated_tests':['CD1_apply_restore','CD2_apply_restore','independent_disc_uuids','sibling_catalog_unchanged'],
    'native_candidate':str(NATIVE),
    'native_sha256':sha(native.encode()),
    'http_candidate':str(OUT_HTTP),
    'http_sha256':sha(candidate.encode()),
    'previous_live_hashes':{'tag_native_index.py':CHECKS[2][1],'tag_cover_http.py':CHECKS[3][1]},
    'receipt_update':'REQUIRED_BEFORE_DEPLOY',
    'operating_service_changes':0,
    'operating_catalog_writes':0,
    'operating_media_writes':0,
    'frontend_publish':'NOT_YET',
}
if OUT_HTTP.exists() and OUT_HTTP.read_text(encoding='utf-8')!=candidate:
    fail('existing staged HTTP candidate content differs')
if MANIFEST.exists() and json.loads(MANIFEST.read_text(encoding='utf-8'))!=record:
    fail('existing stage manifest differs')
if not OUT_HTTP.exists():OUT_HTTP.write_text(candidate,encoding='utf-8')
if not MANIFEST.exists():MANIFEST.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,ensure_ascii=False,indent=2))
