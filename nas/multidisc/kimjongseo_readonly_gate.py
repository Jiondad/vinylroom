#!/usr/bin/env python3
"""Read-only gate for ONE existing multidisc album before UUID consolidation.

Run inside the music-gateway container. No HTTP, reindex, media or DB writes.
This script never performs or authorizes the migration.
"""
import json
import re
import sqlite3
from pathlib import Path

DB = Path("/data/catalog.sqlite3")
MUSIC = Path("/music")
PARENT = ("KPOP/김종서 (Kim Jong Sheo)/"
          "김종서 - 2007.04.18 名作(명작) - 20th Anniversary Greatest Hits [FLAC-16bit-44.1kHz]")
CD1 = "5d7db58a-641f-42cd-84d4-15b77c396e76"
CD2 = "3a18d47b-9263-4c72-b9db-9bdd71181e55"
DISC = re.compile(r"^(?:cd|disc|disk|디스크)\s*[-_. ]*(\d+)(?:\s*[-_:]\s*.+)?$", re.I)

def fail(code):
    raise SystemExit(json.dumps({"state":"HOLD","reason":code,"db_writes":0,"media_writes":0},
                                ensure_ascii=False))

def disc_number(name):
    m = DISC.fullmatch(name)
    return int(m.group(1)) if m and int(m.group(1)) > 0 else None

if not DB.is_file() or not MUSIC.is_dir():
    fail("mount_not_found")
base = MUSIC / PARENT
if not base.is_dir() or base.is_symlink() or not base.resolve().is_relative_to(MUSIC.resolve()):
    fail("album_parent_unavailable")

db = sqlite3.connect(DB.resolve().as_uri() + "?mode=ro", uri=True)
db.row_factory = sqlite3.Row
db.execute("PRAGMA query_only=ON")
try:
    rows = db.execute(
        "SELECT id,path,title,artist,missing,hidden,data FROM albums "
        "WHERE id IN (?,?) OR path=? OR path LIKE ?",
        (CD1,CD2,PARENT,PARENT+"/%")
    ).fetchall()
    expected = {CD1,CD2}
    active = [r for r in rows if not r["missing"] and not r["hidden"]]
    if {r["id"] for r in active} != expected or len(active) != 2:
        fail("unexpected_active_albums_or_existing_parent")
    if any(r["path"] == PARENT for r in rows):
        fail("parent_catalog_record_already_present")
    if len({r["title"] for r in active}) != 1 or len({r["artist"] for r in active}) != 1:
        fail("album_title_or_artist_mismatch")

    albums = []
    for r in active:
        child = Path(r["path"]).name
        if Path(r["path"]).parent.as_posix() != PARENT or disc_number(child) is None:
            fail("unexpected_album_path")
        path = base / child
        if not path.is_dir() or path.is_symlink():
            fail("disc_folder_unavailable")
        obj = json.loads(r["data"])
        tracks = obj.get("tracks", [])
        if not isinstance(tracks,list) or not tracks:
            fail("tracks_unavailable")
        albums.append({"id":r["id"],"folder":child,"disc":disc_number(child),
                       "title":r["title"],"artist":r["artist"],"tracks":len(tracks)})
    if len({r["disc"] for r in albums}) != len(albums):
        fail("duplicate_disc_number")
    if {r["disc"] for r in albums} != {1,2}:
        fail("unexpected_disc_numbers")

    sibling_disc_folders = []
    for p in base.iterdir():
        if p.is_dir() and not p.is_symlink() and disc_number(p.name) is not None:
            sibling_disc_folders.append(p.name)
    if set(sibling_disc_folders) != {a["folder"] for a in albums}:
        fail("unindexed_or_unexpected_disc_sibling")

    refs = {}
    for table in ("category_albums","track_search_v1","catalog_changes"):
        refs[table] = {
            r["id"]: db.execute(
                f"SELECT COUNT(*) FROM {table} WHERE album_id=?", (r["id"],)
            ).fetchone()[0] for r in active
        }

    print(json.dumps({
        "state":"READ_ONLY_MULTIDISC_GUARD_PASS",
        "parent_path":PARENT,
        "proposed_representative_uuid":CD1,
        "archived_disc_uuid":CD2,
        "albums":sorted(albums,key=lambda a:a["disc"]),
        "total_tracks":sum(a["tracks"] for a in albums),
        "existing_uuid_references":refs,
        "tag_editor_native_index_integration":"NOT_IMPLEMENTED",
        "migration_execution":"NOT_AUTHORIZED",
        "db_writes":0,"media_writes":0
    },ensure_ascii=False,indent=2))
finally:
    db.close()
