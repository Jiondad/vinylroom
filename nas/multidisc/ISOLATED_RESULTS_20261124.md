# 김종서 《名作》 — 신규 분기 격리 검증 결과 (NAS 실제 실행 출력)

## 1. scan_set 신규 분기: 5/5 PASS

- same_title_and_artist_merge: PASS
- different_title_hold: PASS
- different_artist_hold: PASS
- incomplete_disc_hold: PASS
- empty_title_hold: PASS

상태: `MULTIDISC_NEW_BRANCH_ISOLATED_PASS`.

## 2. NativeAlbumIndex.preflight 신규 분기: 5/5 PASS

- merged_cd1_disk2_parent: PASS
- single_album_no_disc: PASS
- single_cd_child_not_merged: PASS
- active_sibling_protected: PASS
- archived_sibling_allowed: PASS

상태: `MULTIDISC_NATIVE_PREFLIGHT_ISOLATED_PASS`.

**검증 범위:** 모두 사용자 제공 NAS 실행 결과. 후보 파일 대상 격리 합성 시험이며 운영 통합 성공이나 Writer E2E 검증으로 확대 해석 금지.

- 운영 Catalog 쓰기 0
- 운영 음원 쓰기 0
- 운영 소스 설치 없음
- Writer end-to-end: NOT_TESTED
- 실제 UUID 통합: NOT_AUTHORIZED

## 3. 이후 실행 게이트

현재 `tag_native_index.py` 후보와 `index_scanner.py` 후보는 통합 기능의 일부만 구현한다.
기존 `scan_job`은 CD2 레코드가 missing=1로 이동할 때 데이터 일부를 `merged_disc_records`에 보관하지만, category_albums, 검색 색인, 플레이리스트, AI DB, 그리고 Tag Editor의 CD 통합 가상 ID 처리에 대한 전체 정합성은 아직 미확인이다.

**운영 상위 폴더 수동 색인 금지.** 운영 DB 직접 UPDATE/DELETE 금지. 통합 Writer 적격성 및 기존 ID 참조보존 계획과 격리 시험 후 별도 운영 승인 필요.

기존 합격 시험과 김종서 폴더 적격성 조회는 반복하지 않는다.

## 4. 대표 UUID 화면 연결 (2026-11-24, 개발 브랜치 전용)

`frontend/dist/tag-editor-ui.js`에서 다음을 반영:
- Catalog 통합 후에는 `selectAlbum(id)`이 **대표 UUID와 부모 폴더의 실제 경로**를 담은 `/api/tracks` 응답만 수락한다.
- 파일 `entry.file`이 부모 앨범 경로 아래에 포함되고, 중복되지 않아야 정상 조회로 인정한다.
- 기존 CD 가상 통합 보기의 자식 인식에 `DISK` 및 `디스크`를 추가한다.
- 이미 구현된 물리 CD/DISC/DISK 폴더에서 DISC 번호 추출 로직 유지.
- **저장 API 포맷/동작은 변경하지 않음.** 미통합 CD 그룹은 기존 개별 UUID 사용; 통합 후 부모 앨범은 일반 `saveRenames` 경로에 대표 UUID를 전송.
- 운영 프런트엔드 게시 및 운영 Catalog 병합은 하지 않았다.

**남은 차단 조건:** `scan_set`의 부모 경로 저장 후 category/playlist/AI 참조 보존이 실제 단건 운영과 동등한 격리 Catalog에서 검증되지 않음; 종단간 Writer 통합 저장·복구 미검증. 운영 통합 승인 전까지 HOLD.

## 2026-11-24: archived CD search native sync reproducer

User's actual NAS output:
- `MULTIDISC_SEARCH_PATCH_STAGED`: `index_engine.py` source `3bdf67de...` -> candidate `7057f502...`; `track_search.py` source `84401b47...` -> candidate `fb5e9bc5...`
- `MULTIDISC_ARCHIVE_SEARCH_ISOLATED_PASS`: after archiving, representative 27; after repeated sync, representative 27; archived 0.
- `actual_scan_job_integration=NOT_TESTED`, `production_install=NOT_AUTHORIZED`, Catalog/media writes 0.

Next targeted test committed: `test_scan_job_archive_hook_isolated.py` parses the **staged index_engine.py candidate AST**, extracts its single `for row in disc_rows` archival loop, and executes that same loop with the staged `track_search.synchronize` functions in a synthetic `:memory:` DB. This is narrower than full `scan_job` and does not represent full production integration qualification.

Still HOLD: actual disc directory merge/catalog put interplay, tag Writer end-to-end, AI reference policy, category reconciliation. No operating DB, media, source, or UI publication.

## 2026-11-24 — actual archive hook targeted execution PASS

User confirmed:
- `MULTIDISC_SCAN_JOB_ARCHIVE_HOOK_ISOLATED_PASS`
- CD1 missing=0, CD2 missing=1, active search CD1=27, CD2=0, dirty queue=0
- Existing staged `scan_job` loop and `synchronize` AST used with isolated SQLite.
- Actual full `scan_job`, native callback, and media-backed Writer remain NOT TESTED.

Next development asset:
`test_writer_control_flow_isolated.py` executes existing Writer `plan/apply/restore` AST with a synthetic two-disc, 27-file parent album and a synthetic callback on isolated SQLite. It intentionally substitutes supporting base safety helpers and does NOT qualify production media access or NativeAlbumIndex. At the time of this update, this new test has not run on NAS.

No live source, production DB, media or frontend deployment authorized.
