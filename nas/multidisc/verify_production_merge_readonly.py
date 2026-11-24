#!/usr/bin/env python3
"""Read-only post-cutover receipt; no index, sync, or media changes."""
import sqlite3,json
from pathlib import Path
REP="5d7db58a-641f-42cd-84d4-15b77c396e76"
OLD="3a18d47b-9263-4c72-b9db-9bdd71181e55"
PARENT="KPOP/김종서 (Kim Jong Sheo)/김종서 - 2007.04.18 名作(명작) - 20th Anniversary Greatest Hits [FLAC-16bit-44.1kHz]"
def ro(p):
    c=sqlite3.connect(Path(p).as_uri()+"?mode=ro",uri=True,timeout=3)
    c.row_factory=sqlite3.Row;c.execute("PRAGMA query_only=ON");c.execute("BEGIN");return c
with ro("/data/catalog.sqlite3") as c, ro("/data/ai-metadata/ai-metadata-v1.sqlite3") as a:
    rows={}
    for r in c.execute("SELECT id,path,missing,hidden,data FROM albums WHERE id IN (?,?)",(REP,OLD)):
        d=json.loads(r["data"]);tracks=d.get("tracks",[])
        rows[r["id"]]={"path":r["path"],"missing":r["missing"],"hidden":r["hidden"],"tracks":len(tracks),"disc_counts":{str(n):sum(str(t.get("disc"))==str(n) for t in tracks) for n in (1,2)},"category":d.get("category"),"genre":d.get("genre")}
    search={i:c.execute("SELECT count(*) FROM track_search_v1 WHERE album_id=?",(i,)).fetchone()[0] for i in (REP,OLD)}
    keys=[dict(r) for r in c.execute("SELECT * FROM category_albums WHERE album_id IN (?,?)",(REP,OLD))]
    ai=[dict(r) for r in a.execute("SELECT id,active,state,protected,changed_fields FROM albums WHERE id IN (?,?)",(REP,OLD))]
    cursor=a.execute("SELECT seq FROM ai_sync_delta_cursor WHERE id=1").fetchone()
    end=c.execute("SELECT max(seq) FROM catalog_changes").fetchone()[0]
    pending=[] if cursor is None else [r[0] for r in c.execute("SELECT DISTINCT album_id FROM catalog_changes WHERE seq>? AND seq<=?",(cursor[0],end))]
    p=rows.get(REP,{});o=rows.get(OLD,{})
    ok=p.get("path")==PARENT and p.get("missing")==0 and p.get("hidden")==0 and p.get("tracks")==27 and p.get("disc_counts")=={"1":14,"2":13} and o.get("missing")==1 and search=={REP:27,OLD:0}
    print(json.dumps({"state":"MULTIDISC_PRODUCTION_CATALOG_PASS" if ok else "HOLD","catalog":rows,"search_counts":search,"category_links":keys,"ai":ai,"ai_cursor":cursor[0] if cursor else None,"catalog_end":end,"pending_ids":pending,"writes":0},ensure_ascii=False,indent=2,default=str))
