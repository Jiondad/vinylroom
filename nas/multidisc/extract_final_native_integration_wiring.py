#!/usr/bin/env python3
"""Extract only the NAS native integration contract needed for isolated harness.

Read staged candidates and current NAS *source* (no imports, no production DB,
no media reads and no source writes). Bounded, line-numbered output. This is
not a request to repeat previously qualified component tests.
"""
import ast
import hashlib
import json
from pathlib import Path

BUNDLE=Path("/tmp/vinyl-multidisc-preinstall-final-20261124")
APP=Path("/app")
EXPECTED={
"index_scanner.py":"602b70816efe34b8ebfd26eabd98973928758d65d41edbcf93c84dae3d4b06b3",
"index_engine.py":"7057f502aba53c3519f2df6ae28df6b838ef88bc43dc046d768728d2290ab2c5",
"tag_native_index.py":"699effa78701cd63aa775aea9a76ef264a42ace529449437bafb811d0a043373"}
TARGETS=[
("index_scanner.py","scan_set",["def scan_set","combined","relative_path","physical_files"]),
("index_engine.py","put",["def put","db.execute","synchronize"]),
("index_engine.py","scan_job",["def scan_job","if discs:","self.put(db,data","UPDATE albums SET missing=1","return job"]),
("tag_native_index.py","preflight",["def preflight","allow_auxiliary","inventory"]),
("tag_native_index.py","__call__",["def __call__","enqueue","execute_job"])
]
def stop(msg):
    print(json.dumps({"state":"HOLD","reason":msg,"catalog_writes":0,"media_writes":0},ensure_ascii=False))
    raise SystemExit(1)
def locate(tree,name):
    choices=[n for n in ast.walk(tree)
        if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name==name]
    if len(choices)!=1:stop("function_ambiguous:"+name)
    return choices[0]

trees={}
lines={}
for name,sha in EXPECTED.items():
    p=BUNDLE/"candidates"/name
    if not p.is_file() or p.is_symlink():stop("bundle_candidate_missing:"+name)
    raw=p.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=sha:stop("candidate_hash_changed:"+name)
    code=raw.decode("utf-8")
    trees[name]=ast.parse(code)
    lines[name]=code.splitlines()

# Print integration dependency hints and bounded excerpts; never dump secrets,
# dotenv values or external service configuration.
print("STATE: MULTIDISC_INTEGRATION_WIRING_READ_ONLY")
for filename,name,markers in TARGETS:
    node=locate(trees[filename],name)
    src=lines[filename]
    references=sorted({n.id for n in ast.walk(node)
        if isinstance(n,ast.Name) and isinstance(n.ctx,ast.Load)})
    called=sorted({n.func.attr for n in ast.walk(node)
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute)
        and isinstance(n.func.value,ast.Name) and n.func.value.id=="self"})
    ranges=[]
    if name in ("scan_set","put","preflight","__call__"):
        if node.end_lineno-node.lineno<=75:ranges=[(node.lineno,node.end_lineno)]
        else:ranges=[(node.lineno,min(node.lineno+23,node.end_lineno))]
    else:
        for i in range(node.lineno-1,node.end_lineno):
            if any(term in src[i] for term in markers):
                ranges.append((max(node.lineno,i-5),min(node.end_lineno,i+7)))
    line_nums=set()
    for lo,hi in ranges:
        line_nums.update(range(lo,hi+1))
    if len(line_nums)>115:line_nums=set(sorted(line_nums)[:115])
    print(f"\n=== {filename}:{name} {node.lineno}-{node.end_lineno} ===")
    print("LOAD_NAMES",json.dumps(references[:75],ensure_ascii=False))
    print("SELF_CALLS",json.dumps(called[:35],ensure_ascii=False))
    last=0
    for num in sorted(line_nums):
        if num>last+1:print("...")
        print(f"{num:04d} {src[num-1][:200]}")
        last=num
print("\nREAD_ONLY_COMPLETE\nCATALOG_WRITES=0\nMEDIA_WRITES=0")
