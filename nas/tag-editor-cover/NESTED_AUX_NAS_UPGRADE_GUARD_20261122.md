# Vinyl Room Tag Editor — nested ancillary folders: NAS upgrade guard

## Why a direct two-file overwrite is unsafe
The current operational NAS supports MP3/FLAC full-tag and rename. `tag_cover_http._fullsave_receipt` validates SHA256 of eight runtime files, including `tag_phase2c.py` and `tag_cover_http.py`, against `/tag-editor-backups/fullsave-native-qualified.json`. Both are bind-mounted from the existing `tag-editor-fullsave-native-20261122/candidate/` directory. **Directly overwriting either file invalidates the qualification and can disable full-tag/rename on restart.** Never change the receipt to match untested files.

## Proven GitHub source
The read-only ancillary folder exception was merged into this development branch at `d6a182211a44bdd1af2e55650a2c5b4dde1f8c52` and scoped test run 45020377316 passed seven tests.

- Read endpoint alone opts into bounded non-audio disc-folder inspection
- Save/rename/cover plan and apply retain strict legacy inventory
- Nested audio, symlink, unreadable or excessive trees remain HOLD

## Next safe NAS operation (read only)
This prints *only* module SHA compatibility with existing signed-off qualification, not any tokens or content of the proof:

```bash
docker exec music-gateway-music-gateway-1 python3 - <<'PY'
import hashlib,json,os,pathlib,stat
p=pathlib.Path('/tag-editor-backups/fullsave-native-qualified.json')
if not p.is_file():
 print('HOLD: receipt_missing')
else:
 proof=json.loads(p.read_text())
 print('RECEIPT_SCHEMA:',proof.get('schema'),'STATE:',proof.get('state'))
 print('RECEIPT_MODE:',oct(stat.S_IMODE(p.stat().st_mode)))
 for name in ('tag_phase2c.py','tag_cover_http.py'):
  src=pathlib.Path('/app')/name
  print(name,'MATCH:',hashlib.sha256(src.read_bytes()).hexdigest()==proof.get('hashes',{}).get(name))
PY
```

If using `docker exec ... python3 -`, supply `-i` to pass the here-document:
`docker exec -i music-gateway-music-gateway-1 python3 - <<'PY'`.

## Upgrade design (not performed)
1. Preserve existing 6-file candidate, `manifest.json`, 8-source receipt, Compose chain, music, catalog and backups unchanged.
2. Prepare a **NEW distinct staging directory** based on verified current candidate modules; apply only the two read-only changes. Save SHA256 of all eight runtime sources in a *new* qualification manifest. Do not replace existing files in place.
3. Run the already-developed ancillary-folder **change-specific** tests on new candidate, then any **new SHA-required NAS isolated qualification**, reusing unrelated previously passed tests; do not duplicate the broad suite.
4. Before switching, atomically stage the new qualification proof in an owner-only, mode 0600 location; compare file digests and the original source receipt. The existing production receipt must **never be rewritten in place or replaced without a verified atomic switch + rollback design**.
5. At maintenance idle, switch only the two new bind mounts via a separate Compose overlay and run Health + new capability (cover, tags, mp3_tags, rename) checks. If any fail, rollback bind mounts **and qualification proof** as one coordinated operation; verify Health and flags, preserving logs.
6. Re-query Lee Moon Sae *Memories* using authenticated GET; remain HOLD if subfolders contain audio or are inaccessible. Do not perform writes to production audio.

**Status: CODE_VERIFIED, NAS_SWITCH_NOT_PERFORMED.** Existing live capabilities must take priority over a rushed read-only hotfix. Do not run older `nas_native_fullsave_release.py enable` against an already qualified installation: it refuses existing receipts and is not a patch upgrader.
