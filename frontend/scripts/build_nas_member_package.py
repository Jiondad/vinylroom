#!/usr/bin/env python3
"""Create a self-contained, non-applying Synology update ZIP from tracked sources."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
root=Path(__file__).resolve().parents[1]
required={
 "nas-service/server.py":"server.py",
 "nas-service/member_access.py":"member_access.py",
 "nas-service/index_engine.py":"index_engine.py",
 "nas-service/top100.py":"top100.py",
 "nas-service/top100_cache.py":"top100_cache.py",
 "nas-service/public_browse.py":"public_browse.py",
}
out=root/"release";out.mkdir(exist_ok=True)
target=out/"VinylRoom_NAS_Member_Approval.zip"
for source in required:
    if not (root/source).is_file():raise SystemExit("Missing "+source)
readme="""Vinyl Room — Guest Browse NAS Update (NOT YET DEPLOYED)\n\nBack up existing server sources and Docker YAML before replacing Python files.\nAdd public_browse.py alongside server.py; if sources are individually bind-mounted, add its read-only mount.\nKeep MEMBERS_ONLY=true. Add PUBLIC_BROWSE=true to the existing service environment.\nRecreate the existing container. Verify /health public_browse=true.\nVerify GET /v2/public/albums and /v2/public/top100 return only public metadata.\nUnauthenticated track/ticket/file requests and every public POST must remain denied.\nSee deploy/GUEST_BROWSE.md for activation and rollback.\nDo not replace databases, music files, Supabase keys or account settings.\nOptional Top100 cache: add top100_cache.py read-only mount if needed; TOP100_CACHE_ENABLED defaults false. See deploy/PERFORMANCE.md and obtain operator approval before enabling or replacing operating files. No catalog scheduling change.\nNo secrets or original NAS data are included.\n"""
with ZipFile(target,"w",ZIP_DEFLATED) as z:
    digest=[]
    for path,renamed in required.items():
        payload=(root/path).read_bytes()
        z.writestr(renamed,payload)
        digest.append(f"{hashlib.sha256(payload).hexdigest()}  {renamed}")
    z.writestr("SHA256SUMS.txt","\n".join(digest)+"\n")
    z.writestr("READ_ME_FIRST.txt",readme)
print(target)

