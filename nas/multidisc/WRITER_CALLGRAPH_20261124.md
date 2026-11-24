# 김종서 《名作》 — NAS Writer 함수 연결점 (읽기 전용 출력)

사용자가 NAS 운영 컨테이너에서 확인한 함수 목록:

- `tag_rename_writer.py`: `plan(catalog,music_root,album_id,file,new_name)` at 82, `apply(catalog,music_root,backup_root,album_id,file,new_name,expected_plan_id,reindex_album,confirm_write)` at 123, `restore(catalog,music_root,backup_root,operation_id,reindex_album,confirm_write)` at 216.
- `tag_cover_http.py`: `plan(catalog,music_root,body)` at 77, `tag_plan(...)` at 201, `configure_rename_context(reindex_album,qualification_passed)` at 218, `rename_capable()` at 224, `rename_request(catalog,music_root,route,body)` at 232, `_safe_apply_error_log(route,exc)` at 293.

**Decision:** Existing `reindex_album` is injected into Writer. Do not replace it with a new engine, directly call the parent scan, or rewrite UUIDs blindly. Need the function bodies of the Writer's plan/apply/restore, rename_request, and the production callback wiring to determine whether parent-path inventory is already supported.

**Confirmed blocker:** Before merge `NativeAlbumIndex.preflight` enforces one active album in a path scope. After merge the representative UUID may be at the parent folder, but `apply/restore` must still be qualified against the parent and nested file paths. This is a code review gate, not a proven write failure.

**Status:** development source review only. No backend install, no operational merge or Catalog/media writes.

## 2026-11-24 실제 Writer 함수 본문 검토 결과

운영 컨테이너에서 추출한 함수 원문 확인(요약):
- `tag_rename_writer.plan`은 `base.inventory(..., allow_auxiliary_disc_dirs=True)`로 앨범의 전체 파일 인벤토리를 받고, `_safe_track_choice`, 원래 폴더 유지, 파일명 충돌, 기존 Catalog 파일 포함 여부, 앨범 digest, 파일 SHA/token을 검증한다.
- `apply`는 기존 전체-job Catalog lease 및 Writer lock을 전제로, `plan`을 **다시 검증**하고 `reindex_album.preflight(album_id,album_path)`를 파일 변경 전에 호출한다. rename 후 `reindex_album(album_id,album_path)`, `_references_match`, SHA 검증까지 한 다음 완료한다.
- `restore`는 기존 operation의 CAS, 백업 SHA/경로를 검사하고 역방향 `plan → apply`를 재사용한다. 새 복구 엔진 불필요.
- `tag_cover_http.rename_request`는 서버 소유 `guard()`로 apply/restore를 감싼다. HTTP에서 새 UUID 무차별 치환 금지.

### 변경 목표 범위 — 재사용 우선
1. **단건 통합 전에:** `scan_set()`이 CD1/CD2의 앨범명/앨범 아티스트 불일치 시 HOLD하도록 구현. 현재 `scan_set`은 첫 디스크 앨범을 바탕으로 만들되 제목은 상위 폴더의 `folder_hints` 결과로 덮을 수 있다. 디스크별 원본 메타와 통합된 앨범명에 대한 보존 기준 확정 필요.
2. **Catalog 단건 통합 시:** 기존 `scan_job`이 부모 path에 CD1 UUID를 옮기고 CD2 행을 `missing=1` 처리하는 표준 코드를 재사용. 기존 `catalog_changes` 감사 이력은 건드리지 않는다. category_albums 두 키는 차이 존재하며 DB 직접 치환하지 않는다.
3. **통합 후 Writer:** 변경은 `tag_rename_writer`보다 `NativeAlbumIndex` 경로에 집중. 대표 UUID의 `album_path`가 **부모**이고 유일 활성 행이라면 기존 `preflight` 조건의 범위와 일치할 여지가 있다. `reindex_album`은 기존 `enqueue(parent,recursive=True,scan_mode='changes',synchronous=True)` 경로를 재사용하고, `_references_match`는 통합 Catalog 트랙 경로를 확인할 수 있어야 한다. 단, `base.inventory`, `_catalog_files`, `_references_match`의 실제 부모 앨범 허용 여부는 아직 확인되지 않음.
4. **프런트엔드:** 현재 `disc-group:parent` 가상 선택과 두 CD UUID별 Write job은 통합 후에도 남아 있을 수 있다. 실제 parent 통합 UUID를 가진 앨범을 우선 열고, CD별 실제 파일 경로/트랙 번호만 유지하는 단일 대표 앨범 선택으로 전환해야 한다. 기존 CD1/CD2 독립 저장 경로는 미통합 앨범에 그대로 적용.
5. **롤백:** 사전 Catalog DB 백업, 기존 CD1/CD2 ID 매핑 보존, 원본 미디어 쓰기 없음. 임의 Catalog 직접 UPDATE/DELETE 금지. 이미 있는 `manual_recovery_required` 감사 파일 건드리지 않음.
6. **검증:** 이미 통과한 실제 운영 Rename/Restore 시험은 반복하지 않는다. 통합 앨범 분기만 격리 테스트(대표 UUID, 부모 인벤토리 27곡, CD1/2 개별 경로, rename→reindex→restore 시뮬레이션). 통합 라이브러리 전체 색인 금지.

### 확인 필요와 미확인 사실
- `base.inventory`의 부모 상대경로 지원, `_catalog_files`와 `_references_match`의 통합 트랙 경로 지원.
- `scan_set` 디스크별 **같은 실제 앨범 태그** 확인 로직의 신규 설치 후보.
- 실제 Catalog에서 단건 통합할 때의 category_albums/AI DB 및 플레이리스트 연결 정책.

**현재 작업 상태:** source review complete; writer rewrite not necessary based on available bodies; integrated Writer qualification remains pending. No NAS source install, no DB/audio changes.
