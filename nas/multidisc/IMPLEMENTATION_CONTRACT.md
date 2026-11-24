# Vinyl Room — 멀티 CD 대표 UUID 통합 / 김종서 《名作》 단건 개발 계약

## 실제 확인 결과
- 부모 폴더: `KPOP/김종서 (Kim Jong Sheo)/김종서 - 2007.04.18 名作(명작) - 20th Anniversary Greatest Hits [FLAC-16bit-44.1kHz]`
- CD1: `5d7db58a-641f-42cd-84d4-15b77c396e76` (14곡)
- CD2: `3a18d47b-9263-4c72-b9db-9bdd71181e55` (13곡)
- 부모 Catalog 행은 없음. 두 앨범 활성. 두 앨범명이 같고 아티스트도 동일.
- `category_albums` 각 1건(서로 다른 key), `track_search_v1` 총 27건, `catalog_changes` 총 27건.

## 운영 불변식
1. 대표 UUID는 **CD1 기존 UUID**. 신규 UUID 생성 금지.
2. 기존 CD2 UUID는 과거 참조·감사를 위해 보존. `catalog_changes` 이력 재작성 금지.
3. 부모 직속 `CD1/CD2`, `DISK1/DISK2`, `DISC1/DISC2` 등 유효한 번호 폴더만 대상. 번호 중복, 빈 트랙, 태그 앨범명 불일치, 다른 아티스트, 다른 부모 폴더면 HOLD. 단순 전역 앨범명 일치로 병합 금지.
4. 태그 파일/폴더명/커버 원본은 수정하지 않음. 기존 색인의 `scan_set` 결과로 디스크별 `disc`, `subfolder`를 유지.
5. 보호된 수동 편집 필드, 카테고리, 즐겨찾기, 플레이리스트, AI 연결은 기존 의미대로 보존 또는 UUID 별칭을 통해 읽기 호환. 충돌시 즉시 HOLD.
6. Tag Editor의 현행 `NativeAlbumIndex.preflight`는 독립 CD UUID를 요구하고, 부모에 활성 자식이 있으면 거절함. **이를 우회하지 말 것**. 통합 앨범 전용 Writer/재색인 계약을 먼저 별도로 적격화.
7. Rename 도중/직후 재색인 시 각 디스크 경로가 원본 소속과 일치하는지 확인하고, 통합 대표 UUID의 27곡 목록을 재조회해 결과 확인. 두 디스크 UUID를 무조건 같은 ID로 바꿔 Writer에 넘기는 방식 금지.
8. 기존 성공 시험 재실행 금지. 해당 변경 분기만 격리 검증. 전체 자동색인/Confidence70/Gemini/AI 변환/전역 DB UPDATE 금지.

## 실행 단계
1. `kimjongseo_readonly_gate.py`로 **실제 폴더 존재·번호·Catalog 활동행**을 단 한 번 확인. 이는 이미 통과한 Catalog 정보 중복 검사가 아니라, 상위 폴더 색인을 해도 범위 외 자식이 없는지 점검하기 위한 전용 게이트.
2. NAS 설치본의 **통합 앨범 전용 Native Writer 설계/후보**와 `scan_set`의 디스크별 앨범명 일치 보장을 개발; 기존 일반 앨범 및 단일 CD 저장 경로는 유지.
3. 별도 격리 Catalog/가짜 음원으로 통합-리네임-재색인-복구 단건 검증; 실제 27곡 재검증 반복 금지.
4. 실제 김종서 단건 적용은 별도 승인 및 **백업·원복 준비** 이후 진행. 주 운영과 AI 정합화 안정성 확인 없이 운영 수정 금지.
5. 사용자 화면 Album/Artist Home/Tag Editor가 동일 대표 UUID와 디스크 구분을 보여주는지 확인.

## 현재 상태
**READ_ONLY_DEVELOPMENT_ONLY** — 통합/색인/운영 DB/음원 쓰기 코드 미설치. 아직 운영 적용 불가.

## 운영 함수 원문 검토 후 실제 개발 추가 (2026-11-24)
- `tag_phase2c.inventory(...allow_auxiliary_disc_dirs=False)`는 옵션 `True`일 때 앨범 루트와 CD/DISC/DISK 하위 폴더의 오디오 파일을 읽는다. `tag_rename_writer.plan`은 **이미** `allow_auxiliary_disc_dirs=True`를 사용한다.
- `_catalog_files`는 `physical_files` 안의 상대경로가 부모 앨범 path 아래인지 확인하고, `_references_match`는 그 목록에서 실제 변경 전후 파일명을 비교한다.
- `NativeAlbumIndex.preflight`는 `base.inventory(i.dbpath,i.root,album_id)` 호출에 보조 디스크 옵션을 전달하지 않는 차이가 있다.
- `index_scanner.scan_set`에는 서로 다른 디스크의 앨범명·아티스트가 일치하는지 검증하는 명시적 조건이 없다.

따라서 신규 **NAS 실행을 하지 않는 후보 생성기** `stage_minimal_multidisc_patch_nas.py`를 추가:
1. 운영 `/app/index_scanner.py`와 `/app/tag_native_index.py`의 정확한 기존 코드 블록을 1회씩 확인하고, 변경 후보를 `/tmp/vinyl-multidisc-candidate-20261124`에만 생성.
2. `scan_set`은 부분 디스크 읽기 및 디스크 간 앨범명/아티스트 불일치일 때 원래 앨범을 유지하도록 HOLD 결과 반환.
3. `NativeAlbumIndex.preflight`는 **직접 하위의 번호가 붙은 디스크 폴더가 2개 이상일 때만** 기존 inventory 보조 디스크 옵션 적용.
4. 생성한 후보를 `ast.parse`로 검증하고 원본/후보 SHA256을 manifest에 기록.
5. 이 단계는 실제 Rename Writer·API·Catalog·음원을 변경하지 않으며, 격리 테스트를 통과한 것도 아니다.

**중요:** 이 후보는 완성된 통합 배포 패치가 아니다. Category/AI/플레이리스트 참조 관계 보존, 대표 UUID 전환 후 Tag Editor 선택 모델, 격리 통합/복원 검증을 완료해야 실제 NAS 설치 및 김종서 단건 운영 통합이 가능하다.
