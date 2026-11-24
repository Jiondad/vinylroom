#!/usr/bin/env python3
"""Prepare durable source rollback assets and inspect AI backlog. No deployment.
Run inside NAS container. Only writes a new private backup directory under /data.
Database backup is deliberately deferred to immediately before the approved cutover.
"""
import hashlib,json,os,sqlite3,time
from pathlib import Path
B=Path("/tmp/vinyl-multidisc-preinstall-final-20261124")
D=Path("/data")
TARGET={"5d7db58a-641f-42cd-84d4-15b77c396e76","3a18d47b-9263-4c72-b9db-9bdd71181e55"}
EXPECTED={
"index_scanner.py":("329d3d32b892d7bd0cd1187ecc6fd6648c856c2b2f412b85d8f073947f42d173","602b70816efe34b8ebfd26eabd98973928758d65d41edbcf93c84dae3d4b06b3"),
"tag_native_index.py":("e6e6e6127223c1b01e57aea3400180b3c80b160f0544935515052b172fd4c30e","699effa78701cd63aa775aea9a76ef264a42ace529449437bafb811d0a043373"),
"index_engine.py":("3bdf67de2bb29315fad021c58300661c903bb9c5f2a6342f1d2bfc7a6a61998f","7057f502aba53c3519f2df6ae28df6b838ef88bc43dc046d768728d2290ab2c5"),
"track_search.py":("84401b47ce847ffd74181483d77f44a4bb2903819a1d7b8758af94179d4d33de","fb5e9bc51bc3854c7ddee3b2e1d222c61a07bd078cd8d0beb02a3e23de19fc86")}
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):
    if not p.is_file() or p.is_symlink():raise ValueError("unsafe_or_missing:"+str(p))
    return p.read_bytes()
def ro(p):
    c=sqlite3.connect(p.resolve().as_uri()+"?mode=ro",uri=True,timeout=3)
    c.execute("PRAGMA query_only=ON");c.execute("BEGIN");return c
try:
    files={}
    for n,(a,b) in EXPECTED.items():
        orig=read(B/"originals"/n);cand=read(B/"candidates"/n)
        if (sha(orig),sha(cand),sha(read(Path("/app")/n)))!=(a,b,a):raise ValueError("hash_mismatch:"+n)
        files[n]=(orig,cand)
    ai=ro(D/"ai-metadata/ai-metadata-v1.sqlite3");cat=ro(D/"catalog.sqlite3")
    try:
        cursor=ai.execute("SELECT feed_id,seq FROM ai_sync_delta_cursor WHERE id=1").fetchone()
        if cursor is None:raise ValueError("no_delta_cursor")
        end=cat.execute("SELECT COALESCE(MAX(seq),0) FROM catalog_changes").fetchone()[0]
        ids={r[0] for r in cat.execute("SELECT DISTINCT album_id FROM catalog_changes WHERE seq>? AND seq<=?",(cursor[1],end))}
        cids={r[0] for r in cat.execute("SELECT id FROM albums WHERE hidden=0 AND missing=0")}
        aids={r[0] for r in ai.execute("SELECT id FROM albums WHERE active=1")}
        scope={"cursor":cursor[1],"catalog_end":end,"pending_ids":len(ids),"pending_other_ids":len(ids-TARGET),"catalog_only":len(cids-aids),"ai_only":len(aids-cids),"target_pending_ids":sorted(ids&TARGET),"scope_only_possible":end>=cursor[1] and not(ids-TARGET) and cids==aids}
    finally:ai.close();cat.close()
    os.umask(0o077)
    out=D/("multidisc-cutover-"+time.strftime("%Y%m%d-%H%M%S")+"-"+str(os.getpid()))
    out.mkdir(mode=0o700)
    for folder,idx in (("originals",0),("candidates",1)):
        (out/folder).mkdir(mode=0o700)
        for n,blobs in files.items():
            with (out/folder/n).open("xb") as f:f.write(blobs[idx]);f.flush();os.fsync(f.fileno())
            if sha(read(out/folder/n))!=EXPECTED[n][idx]:raise ValueError("copy_hash_mismatch:"+n)
    result={"state":"MULTIDISC_DURABLE_SOURCE_BACKUP_READY","path":str(out),"source_hashes_verified":True,"ai_scope":scope,"database_backup":"DEFERRED_TO_CUTOVER","production_source_writes":0,"catalog_writes":0,"ai_writes":0,"media_writes":0}
    with (out/"manifest.json").open("x") as f:json.dump(result,f,ensure_ascii=False,indent=2);f.flush();os.fsync(f.fileno())
    print(json.dumps(result,ensure_ascii=False,indent=2))
except (ValueError,OSError,sqlite3.Error) as e:
    print(json.dumps({"state":"HOLD","reason":str(e),"production_source_writes":0,"catalog_writes":0,"ai_writes":0,"media_writes":0}));raise SystemExit(1)
