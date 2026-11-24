#!/usr/bin/env python3
"""Inspect the existing NAS native Catalog update hooks needed by one CD merge.

Read source text only: never import operational modules, query/write a DB,
scan media, invoke the indexer, or alter a running service.
"""
import ast
import hashlib
import json
from pathlib import Path

ROOT=Path("/app")
NAMES=("index_engine.py","track_search.py","index_scanner.py")
KEYWORDS=(
    "track_search", "queue_category(", "apply_category(",
    "merged_disc_records", "disc_rows", "missing=1", "missing = 1",
    "synchronize(", "category_albums", "catalog_changes",
    "def scan_job(", "def put("
)

def excerpt(lines, keys, context=4, cap=110):
    found=[]
    for n,line in enumerate(lines):
        if any(x in line for x in keys):
            found.extend(range(max(0,n-context),min(len(lines),n+context+1)))
    found=sorted(set(found))[:cap]
    last=-2
    for n in found:
        if n>last+1:print("    ...")
        print(f"{n+1:04}: {lines[n][:240]}")
        last=n
    if len(found)>=cap:print("    [OUTPUT CAPPED]")

def review(name):
    f=ROOT/name
    print("\n========",name,"========")
    if not f.is_file() or f.is_symlink():
        print("NOT_FOUND")
        return
    raw=f.read_bytes()
    code=raw.decode("utf-8")
    tree=ast.parse(code,filename=str(f))
    print("SHA256:",hashlib.sha256(raw).hexdigest())
    print("IMPORTS:")
    for n in tree.body:
        if isinstance(n,ast.Import):
            imports=[a.name for a in n.names]
        elif isinstance(n,ast.ImportFrom):
            imports=[(n.module or "")+"."+a.name for a in n.names]
        else:continue
        if any(x in str(imports).lower() for x in ("track","category","catalog","index")):
            print(imports)
    print("SELECTED_SOURCE:")
    excerpt(code.splitlines(),KEYWORDS)
    print("TOP_LEVEL_FUNCTIONS:",[
        n.name for n in tree.body
        if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))
        and any(k in n.name for k in ("category","track","sync"))][:35])

for filename in NAMES:review(filename)
print("\nREAD_ONLY_COMPLETE")
