#!/usr/bin/env python3
"""Stage the narrowly scoped archived-disc track search fix, never install.

The original source SHAs were observed on the actual NAS. Fail closed if they
changed. Write NEW files under /tmp only; do not touch /app, DB or media.
"""
import ast
import hashlib
import json
from pathlib import Path

ROOT=Path("/app")
OUT=Path("/tmp/vinyl-multidisc-search-stage-20261124")
EXPECTED={
 "index_engine.py":"3bdf67de2bb29315fad021c58300661c903bb9c5f2a6342f1d2bfc7a6a61998f",
 "track_search.py":"84401b47ce847ffd74181483d77f44a4bb2903819a1d7b8758af94179d4d33de"
}

def hold(reason):
    raise SystemExit(json.dumps({"state":"HOLD","reason":reason,"live_source_writes":0,
                                 "catalog_writes":0,"media_writes":0},ensure_ascii=False))

def replace_once(src,old,new,scope):
    if src.count(old)!=1:hold("source_anchor_mismatch:"+scope)
    return src.replace(old,new,1)

if OUT.exists():hold("stage_already_exists")
raw={}
for name,expected in EXPECTED.items():
    p=ROOT/name
    if not p.is_file() or p.is_symlink():hold("missing_source:"+name)
    content=p.read_bytes()
    if hashlib.sha256(content).hexdigest()!=expected:hold("source_sha_mismatch:"+name)
    raw[name]=content.decode("utf-8")
    ast.parse(raw[name],filename=name)

track=replace_once(raw["track_search.py"],
    "row=db.execute('SELECT data FROM albums WHERE id=?',(key,)).fetchone()",
    "row=db.execute('SELECT data,missing,hidden FROM albums WHERE id=?',(key,)).fetchone()",
    "track_select")
track=replace_once(track,
    "        if row:\n            tracks=json.loads(row[0]).get('tracks') or []",
    "        # Archived or hidden albums cannot own active track-search rows.\n"
    "        if row and not row[1] and not row[2]:\n"
    "            tracks=json.loads(row[0]).get('tracks') or []",
    "track_missing_guard")

index=replace_once(raw["index_engine.py"],
    """                        for row in disc_rows:
                            if row['id']!=saved_id:db.execute('UPDATE albums SET missing=1 WHERE id=?',(row['id'],))
                        if replaced_id:""",
    """                        for row in disc_rows:
                            if row['id']!=saved_id:
                                db.execute('UPDATE albums SET missing=1 WHERE id=?',(row['id'],))
                                # Target ONLY archived siblings and the existing native
                                # synchronizer. Retain album, category and audit history.
                                if self.track_search_enabled:
                                    from track_search import synchronize
                                    db.execute('INSERT OR IGNORE INTO track_search_dirty_v1 VALUES(?)',(row['id'],))
                                    synchronize(db,norm,row['id'])
                        if replaced_id:""",
    "scan_job_archive")
candidate={"index_engine.py":index,"track_search.py":track}
for name,content in candidate.items():ast.parse(content,filename=name)
OUT.mkdir(mode=0o700)
files={}
for name,content in candidate.items():
    dest=OUT/(name+".candidate")
    dest.write_text(content,encoding="utf-8")
    files[name]={"source_sha256":EXPECTED[name],
                 "candidate_sha256":hashlib.sha256(content.encode("utf-8")).hexdigest(),
                 "path":str(dest)}
result={"state":"MULTIDISC_SEARCH_PATCH_STAGED","files":files,
        "isolated_integration":"NOT_TESTED","production_install":"NOT_AUTHORIZED",
        "live_source_writes":0,"catalog_writes":0,"media_writes":0}
(OUT/"manifest.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(result,ensure_ascii=False,indent=2))
