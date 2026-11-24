# Category reference scope / Kim Jong-seo 名作 / 2026-11-24

## Actual NAS read-only findings
- personal_playlists: all 3 rows, CD1/CD2 UUID occurrences 0, SCOPED_COMPLETE
- trusted_autofill_audit: all 514 rows, CD1/CD2 UUID occurrences 0, SCOPED_COMPLETE
- category_references: 2000 rows, no occurrences in scanned subset; HOLD_PARTIAL (not exhaustive)
- album_assets / track_search_dirty_v1: indexed exact-ID query reported 0 rows each
- Past verified: category_albums key for CD2 = `8f9cf87f180a184400bec19ba21bb58655c324ba349b7ff1a0973e78ecc4d01c`; CD1 = `e8ef8de27051a9ac3681412d06845bd962425ac9612011fa04e80bd4b37ddc2a`; track_search_v1 13+14; catalog_changes 13+14.

## Action
Created `check_category_reference_keys_readonly.py`: introspects indexes, uses those two **known keys only** if an indexed key-like field exists; otherwise HOLD with schema/index metadata. It never scans the entire category_references payload and never mutates the Catalog.

## Interpretation
These findings resolve the personal-playlist and trusted-audit uncertainty **for those two UUID strings in that Catalog DB** only. They do not establish AI DB or arbitrary track-path-linked references. Category references may be metadata keyed indirectly; do not assume a 0 string-match count means evidence may be deleted or reassigned. The final category mapping and existing SQLite native index must be accounted for before merge.

## Status
Only development branch modified. No NAS install, media, Catalog or AI DB writes. No re-run of 10/10 passed isolated checks.
