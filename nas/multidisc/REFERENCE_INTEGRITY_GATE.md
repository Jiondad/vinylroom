# Multidisc Catalog UUID — reference integrity acceptance gate

**Candidate:** 김종서 《名作》, CD1 `5d7db58a-641f-42cd-84d4-15b77c396e76` (representative) + CD2 `3a18d47b-9263-4c72-b9db-9bdd71181e55` (historical only).

## Existing evidence (do not re-run)
- 14 + 13 = 27 tracks. Same artist/title. Parent album row absent. Catalog parent and disk folders qualified.
- `category_albums` 1 row each / different key; `track_search_v1` 14 + 13 rows; `catalog_changes` 14 + 13 rows.
- Synthetic `scan_set` 5/5 PASS and `NativeAlbumIndex.preflight` 5/5 PASS.
- Writer `plan`, `apply`, `restore`, `_catalog_files`, `_references_match` read; Writer E2E remains untested.

## Preservation contract

| Reference surface | Expected behavior | Prohibited shortcut |
| --- | --- | --- |
| `albums` | CD1 ID remains active, relocated to parent; old CD2 row retained inactive | Generating new UUID / deleting historical CD2 |
| `track_search_v1` | 27 searchable tracks resolve to active representative ID after native sync | Leaving active search hits linked only to archived CD2 |
| `category_albums` | Preserve both original category keys for audit and resolve final active category through existing classification logic | Blindly swapping CD2 `album_id` or moving its category key |
| `catalog_changes` | Preserve 27 historical changes and their original IDs | Updating historical references to CD1 |
| playlists/favorites/queue/bookmarks | Existing album references must remain usable or be migrated through verified existing policies | Assuming all refs are in `album_id` columns |
| AI metadata/synchronization | Do not mutate AI data; any existing CD2 cross-DB reference must be accounted for before pilot | Assuming Catalog-only scope proves AI integrity |
| Tag Editor | Parent UUID retrieves 27 files; per-file physical disc path preserved, rename/restore through existing Writer | Sending a synthetic `disc-group:...` ID to Writer |

## Read-only additional-reference audit

`inspect_additional_references_readonly.py` introspects Catalog schema and checks **only previously unverified indexed ID reference columns**. The three prior verified tables are reported from the existing receipt without repeated counting. Nonindexed columns and possible JSON payload references are flagged as unresolved, **not declared clean**. Does not inspect separate AI DB by default.

## Migration hold criteria

Actual NAS integration is **HOLD** until all are met:
1. Read-only additional-reference topology understood; indirect and AI references handled.
2. Category and track-search final state represented by a small isolated Catalog fixture using actual schema, no direct operational SQL.
3. Archive/representative transitions and Tag Editor 27-file path identity verified using existing index paths and narrowly scoped isolated testing.
4. Backup/rollback contract for the exact parent and CD1/CD2 rows and any dependent references, plus explicit approval.
5. No re-execution of unrelated previous success tests or whole-library indexing.

**Current disposition:** `READ_ONLY_DEVELOPMENT_ONLY`. Existing operational binaries and data untouched.
