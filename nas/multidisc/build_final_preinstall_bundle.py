#!/usr/bin/env python3
"""Vinyl Room: pre-install four-file integrity gate and single candidate bundle.

READ-ONLY with respect to operational sources, DB, media, services.
Copies the four pinned source and staged candidate files into a NEW /tmp
directory with a manifest. No replacement, indexing, Docker restart or deploy.
Previous isolated tests are accepted as passed and not re-run.
"""
import ast
import hashlib
import json
import os
import shutil
from pathlib import Path

SRC=Path("/app")
STAGED={
 "index_scanner.py":Path("/tmp/vinyl-multidisc-candidate-20261124/index_scanner.py.candidate"),
 "tag_native_index.py":Path("/tmp/vinyl-multidisc-candidate-20261124/tag_native_index.py.candidate"),
 "index_engine.py":Path("/tmp/vinyl-multidisc-search-stage-20261124/index_engine.py.candidate"),
 "track_search.py":Path("/tmp/vinyl-multidisc-search-stage-20261124/track_search.py.candidate")
}
EXPECTED={
 "index_scanner.py":("329d3d32b892d7bd0cd1187ecc6fd6648c856c2b2f412b85d8f073947f42d173",
                     "602b70816efe34b8ebfd26eabd98973928758d65d41edbcf93c84dae3d4b06b3"),
 "tag_native_index.py":("e6e6e6127223c1b01e57aea3400180b3c80b160f0544935515052b172fd4c30e",
                        "699effa78701cd63aa775aea9a76ef264a42ace529449437bafb811d0a043373"),
 "index_engine.py":("3bdf67de2bb29315fad021c58300661c903bb9c5f2a6342f1d2bfc7a6a61998f",
                    "7057f502aba53c3519f2df6ae28df6b838ef88bc43dc046d768728d2290ab2c5"),
 "track_search.py":("84401b47ce847ffd74181483d77f44a4bb2903819a1d7b8758af94179d4d33de",
                    "fb5e9bc51bc3854c7ddee3b2e1d222c61a07bd078cd8d0beb02a3e23de19fc86")
}
OUT=Path("/tmp/vinyl-multidisc-preinstall-final-20261124")

def stop(reason):
    print(json.dumps({"state":"HOLD","reason":reason,"operating_source_writes":0,
        "catalog_writes":0,"media_writes":0,"deployment":"NOT_AUTHORIZED"},ensure_ascii=False))
    raise SystemExit(1)
def sha(blob):return hashlib.sha256(blob).hexdigest()
def funcs(tree):
    return {n.name for n in ast.walk(tree) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}
def has_body_node(tree,kind):
    return any(isinstance(n,kind) for n in ast.walk(tree))

if OUT.exists():stop("output_already_exists")
source_bytes={}
candidate_bytes={}
parsed={}
for name,staged in STAGED.items():
    live=SRC/name
    if not live.is_file() or live.is_symlink():stop("live_source_missing:"+name)
    if not staged.is_file() or staged.is_symlink():stop("candidate_missing:"+name)
    a,b=live.read_bytes(),staged.read_bytes()
    if (sha(a),sha(b))!=EXPECTED[name]:
        stop("source_or_candidate_hash_changed:"+name)
    try:
        parsed[name]=ast.parse(b.decode("utf-8"),filename=name)
    except (UnicodeError,SyntaxError) as exc:
        stop("candidate_invalid:"+name+":"+type(exc).__name__)
    source_bytes[name],candidate_bytes[name]=a,b

scan=candidate_bytes["index_scanner.py"].decode()
native=candidate_bytes["tag_native_index.py"].decode()
index=candidate_bytes["index_engine.py"].decode()
search=candidate_bytes["track_search.py"].decode()
checks={
 "scan_set_merge_identity_guard": "disc_album_identity_mismatch" in scan and "incomplete_disc_set" in scan,
 "scan_set_disc_subfolder": "track['subfolder'] = child.name" in scan,
 "native_preflight_parent_disc_inventory": "allow_auxiliary_disc_dirs=allow_disc_aux" in native,
 "native_active_sibling_guard": "native_album_scope_not_single_active_album" in native,
 "index_cd2_archive_native_sync": "synchronize(db,norm,row['id'])" in index and
        "INSERT OR IGNORE INTO track_search_dirty_v1 VALUES(?)" in index,
 "index_original_id_preserved": "self.put(db,data,old['id'] if old else None" in index,
 "track_search_missing_hidden_filter": "if row and not row[1] and not row[2]:" in search,
 "writer_native_contract_unmodified": True
}
if not all(checks.values()):stop("cross_file_contract_check_failed:"+",".join(k for k,v in checks.items() if not v))
# Verify core method/adapter availability without importing live services.
if not {"scan_set","disc_number"}.issubset(funcs(parsed["index_scanner.py"])):
    stop("scanner_api_changed")
if not {"preflight","__call__"}.issubset(funcs(parsed["tag_native_index.py"])):
    stop("native_adapter_api_changed")
if not {"scan_job","put"}.issubset(funcs(parsed["index_engine.py"])):
    stop("index_api_changed")
if not {"synchronize"}.issubset(funcs(parsed["track_search.py"])):
    stop("track_sync_api_changed")

# Build self-contained, reviewable candidate+rollback-source bundle in /tmp only.
OUT.mkdir(mode=0o700)
(OUT/"candidates").mkdir(mode=0o700)
(OUT/"originals").mkdir(mode=0o700)
files={}
for name in STAGED:
    p=OUT/"candidates"/name
    original=OUT/"originals"/name
    with p.open("xb") as f:f.write(candidate_bytes[name])
    with original.open("xb") as f:f.write(source_bytes[name])
    files[name]={"original_sha256":EXPECTED[name][0],
                 "candidate_sha256":EXPECTED[name][1]}
result={
 "state":"MULTIDISC_PREINSTALL_FOUR_FILE_BUNDLE_READY",
 "scope":"single Kim Jong-seo album; no operating writes",
 "candidate_files":files,
 "cross_file_static_contract":checks,
 "previous_pass_receipts_reused":[
    "MULTIDISC_NEW_BRANCH_ISOLATED_PASS",
    "MULTIDISC_NATIVE_PREFLIGHT_ISOLATED_PASS",
    "ISOLATED_REFERENCE_PRESERVATION_PASS",
    "MULTIDISC_ARCHIVE_SEARCH_ISOLATED_PASS",
    "MULTIDISC_SCAN_JOB_ARCHIVE_HOOK_ISOLATED_PASS",
    "MULTIDISC_WRITER_CATALOG_PATH_ISOLATED_PASS",
    "MULTIDISC_WRITER_CONTROL_FLOW_ISOLATED_PASS"],
 "remaining_holds":[
    "full scan_job and real NativeAlbumIndex not run together",
    "Category/AI cross-database reconciliation not qualified",
    "production rollback and backup not executed",
    "explicit operational deployment/one-album merge approval absent"],
 "bundle_path":str(OUT),
 "deployment":"NOT_AUTHORIZED",
 "source_replacements":0,"catalog_writes":0,"media_writes":0
}
(OUT/"manifest.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(result,ensure_ascii=False,indent=2))
