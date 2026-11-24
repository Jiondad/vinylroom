# 김종서 《名作》 — NAS Writer 함수 연결점 (읽기 전용 출력)

사용자가 NAS 운영 컨테이너에서 확인한 함수 목록:

- `tag_rename_writer.py`: `plan(catalog,music_root,album_id,file,new_name)` at 82, `apply(catalog,music_root,backup_root,album_id,file,new_name,expected_plan_id,reindex_album,confirm_write)` at 123, `restore(catalog,music_root,backup_root,operation_id,reindex_album,confirm_write)` at 216.
- `tag_cover_http.py`: `plan(catalog,music_root,body)` at 77, `tag_plan(...)` at 201, `configure_rename_context(reindex_album,qualification_passed)` at 218, `rename_capable()` at 224, `rename_request(catalog,music_root,route,body)` at 232, `_safe_apply_error_log(route,exc)` at 293.

**Decision:** Existing `reindex_album` is injected into Writer. Do not replace it with a new engine, directly call the parent scan, or rewrite UUIDs blindly. Need the function bodies of the Writer's plan/apply/restore, rename_request, and the production callback wiring to determine whether parent-path inventory is already supported.

**Confirmed blocker:** Before merge `NativeAlbumIndex.preflight` enforces one active album in a path scope. After merge the representative UUID may be at the parent folder, but `apply/restore` must still be qualified against the parent and nested file paths. This is a code review gate, not a proven write failure.

**Status:** development source review only. No backend install, no operational merge or Catalog/media writes.
