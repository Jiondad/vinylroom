#!/usr/bin/env python3
"""Host-side final installation wiring receipt. No source, DB or media writes."""
import json,subprocess,hashlib
from pathlib import Path
C="music-gateway-music-gateway-1"
def run(*a):return subprocess.check_output(a,text=True,timeout=30)
info=json.loads(run("docker","inspect",C))[0]
mounts=info["Mounts"]
names=["index_scanner.py","index_engine.py","tag_native_index.py","track_search.py","tag_cover_http.py"]
def resolve(dest):
    matches=[m for m in mounts if dest==m["Destination"] or dest.startswith(m["Destination"].rstrip("/")+"/")]
    if not matches:return {"destination":dest,"state":"IMAGE_OR_CONTAINER_LAYER"}
    m=max(matches,key=lambda m:len(m["Destination"]))
    host=Path(m["Source"])/dest[len(m["Destination"]):].lstrip("/")
    return {"destination":dest,"host":str(host),"type":m["Type"],"rw":m["RW"],"file":host.is_file(),"symlink":host.is_symlink(),"sha256":hashlib.sha256(host.read_bytes()).hexdigest() if host.is_file() else None}
data=resolve("/data")
paths=[resolve("/app/"+n) for n in names]
receipt=Path("/volume1/docker/music-gateway/tag-editor-backups/fullsave-native-qualified.json")
proof=json.loads(receipt.read_text()) if receipt.is_file() else {}
inner="""import sqlite3,json
from pathlib import Path
def ro(p):return sqlite3.connect(Path(p).as_uri()+'?mode=ro',uri=True)
a=ro('/data/ai-metadata/ai-metadata-v1.sqlite3')
c=ro('/data/catalog.sqlite3')
seq=a.execute('SELECT seq FROM ai_sync_delta_cursor WHERE id=1').fetchone()[0]
ids=[r[0] for r in c.execute('SELECT DISTINCT album_id FROM catalog_changes WHERE seq>?',(seq,))]
targets={'5d7db58a-641f-42cd-84d4-15b77c396e76','3a18d47b-9263-4c72-b9db-9bdd71181e55'}
other=[]
for i in ids:
 if i not in targets:
  other.append({'id':i,'catalog':c.execute('SELECT artist,title,hidden,missing FROM albums WHERE id=?',(i,)).fetchone(),'ai':a.execute('SELECT state,active FROM albums WHERE id=?',(i,)).fetchone()})
print(json.dumps({'cursor':seq,'other_pending':other,'pending_count':len(ids)},ensure_ascii=False))
"""
print(json.dumps({"state":"MULTIDISC_HOST_INSTALL_WIRING","mounts":paths,"data_mount":data,"receipt":{"path":str(receipt),"schema":proof.get("schema"),"state":proof.get("state"),"hashes":proof.get("hashes")},"ai_scope":json.loads(run("docker","exec",C,"python3","-c",inner)),"writes":0},ensure_ascii=False,indent=2))
