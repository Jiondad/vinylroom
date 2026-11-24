#!/usr/bin/env python3
"""Stage minimal multidisc patches against actual NAS source. NEVER install.

Source read only (/app). Output candidate files and manifest in a NEW /tmp dir.
No Catalog, media, service, or DB access. Abort if the known implementation differs.
"""
import ast
import hashlib
import json
import os
from pathlib import Path

SRC = Path("/app")
OUT = Path("/tmp/vinyl-multidisc-candidate-20261124")

def hold(reason):
    raise SystemExit(json.dumps({"state": "HOLD", "reason": reason, "live_writes": 0,
                                 "db_writes": 0, "media_writes": 0}, ensure_ascii=False))

def replace_one(source, old, new, name):
    if source.count(old) != 1:
        hold(name + "_source_anchor_mismatch")
    return source.replace(old, new, 1)

def sha(content):
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

def stage():
    if OUT.exists():
        hold("staging_output_already_exists")
    source = {}
    for name in ("index_scanner.py", "tag_native_index.py"):
        path = SRC/name
        if not path.is_file() or path.is_symlink():
            hold("required_source_unavailable:" + name)
        raw = path.read_text(encoding="utf-8")
        ast.parse(raw, filename=str(path))
        source[name] = raw

    scanner_old = """    if not parts:return {'albums':[], 'errors':errors}
    combined = dict(parts[0]);hint = folder_hints(folder.name)"""
    scanner_new = """    if not parts:return {'albums':[], 'errors':errors}
    # Never merge numbered siblings whose actual scanned album identity differs.
    # Explicit errors hold the parent's existing Catalog rows in scan_job().
    if len(parts)!=len(discs):
        errors.append({'path':str(folder),'error':'incomplete_disc_set'})
        return {'albums':[], 'errors':errors}
    identities={(str(a.get('title') or '').strip().casefold(),
                 str(a.get('artist') or '').strip().casefold()) for a in parts}
    if len(identities)!=1 or any(not title or not artist for title,artist in identities):
        errors.append({'path':str(folder),'error':'disc_album_identity_mismatch'})
        return {'albums':[], 'errors':errors}
    combined = dict(parts[0]);hint = folder_hints(folder.name)"""
    source_new = {}
    source_new["index_scanner.py"] = replace_one(
        source["index_scanner.py"], scanner_old, scanner_new, "scan_set"
    )

    native_old = """        album, entries, issues = base.inventory(
            i.dbpath, i.root, album_id
        )
        if issues:"""
    native_new = """        # A merged album may contain numbered CD/DISC/DISK folders and
        # harmless artwork/booklet directories below each disc. Only broaden
        # this inventory option when >=2 valid direct disc children exist.
        disc_children = [
            p for p in folder.iterdir()
            if p.is_dir() and not p.is_symlink()
            and getattr(i.scanner, 'disc_number', lambda _: None)(p.name)
        ]
        allow_disc_aux = len(disc_children) >= 2
        album, entries, issues = base.inventory(
            i.dbpath, i.root, album_id,
            allow_auxiliary_disc_dirs=allow_disc_aux
        )
        if issues:"""
    source_new["tag_native_index.py"] = replace_one(
        source["tag_native_index.py"], native_old, native_new, "native_preflight"
    )
    for name, code in source_new.items():
        ast.parse(code, filename=name)
    # File installation is deliberately unavailable in this script.
    OUT.mkdir(mode=0o700)
    files = {}
    for name, code in source_new.items():
        p = OUT/(name+".candidate")
        with p.open("x",encoding="utf-8") as f:
            f.write(code)
        files[name] = {"source_sha256": sha(source[name]), "candidate_sha256":sha(code),
                       "candidate":str(p)}
    result = {"state":"MULTIDISC_PATCH_CANDIDATES_STAGED",
              "files":files,"live_source_writes":0,"catalog_writes":0,"media_writes":0,
              "production_install":"NOT_AUTHORIZED",
              "isolated_regression":"NOT_RUN",
              "backend_restart":"NOT_PERFORMED"}
    (OUT/"manifest.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=="__main__":
    stage()
