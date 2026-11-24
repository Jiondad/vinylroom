# Vinyl Room — 멀티 CD UUID 통합 운영 설치 전 최종 검증 판정

**기준일:** 2026-11-24  
**대상:** 김종서 《20th Anniversary Greatest Hits 名作》 단 1장  
**판정:** `HOLD — FULL_NATIVE_INTEGRATION_AND_ROLLBACK_NOT_QUALIFIED`  
**운영 설치/DB 쓰기/음원 쓰기:** 모두 미실행

## 고정된 단건 구성
- CD1 대표 UUID `5d7db58a-641f-42cd-84d4-15b77c396e76`, 14곡
- CD2 역사 UUID `3a18d47b-9263-4c72-b9db-9bdd71181e55`, 13곡
- 총 2CD · 27곡. 통합 뒤 활성 앨범 1건 목표
- Category 원본 키: CD1 `e8ef8de27051a9ac3681412d06845bd962425ac9612011fa04e80bd4b37ddc2a`, CD2 `8f9cf87f180a184400bec19ba21bb58655c324ba349b7ff1a0973e78ecc4d01c`

## 이미 합격한 결과: 재시험 금지
1. 단건 실제 폴더·Catalog 읽기 적격성 `READ_ONLY_MULTIDISC_GUARD_PASS`
2. 신규 `scan_set` 분기 5/5 `MULTIDISC_NEW_BRANCH_ISOLATED_PASS`
3. 신규 NativeAlbumIndex preflight 분기 5/5 `MULTIDISC_NATIVE_PREFLIGHT_ISOLATED_PASS`
4. 대표/이전 UUID·카테고리·감사 이력 메모리 보존 `ISOLATED_REFERENCE_PRESERVATION_PASS`
5. 구 검색 동기화 CD2 13건 잔존 재현 `MULTIDISC_ARCHIVED_SEARCH_EDGE_REPRODUCED`
6. 검색 차단 후보 27/0, 반복 sync 후에도 27/0 `MULTIDISC_ARCHIVE_SEARCH_ISOLATED_PASS`
7. 실제 `scan_job`의 CD2 비활성화 loop AST와 후보 sync 결합 `MULTIDISC_SCAN_JOB_ARCHIVE_HOOK_ISOLATED_PASS`
8. Writer Catalog 27곡 경로 및 CD2 Rename 경로 `MULTIDISC_WRITER_CATALOG_PATH_ISOLATED_PASS`
9. Writer `plan/apply/restore` 합성 제어 흐름 `MULTIDISC_WRITER_CONTROL_FLOW_ISOLATED_PASS` (Native callback과 파일 보조 기능은 synthetic)

## 최종 설치 전 네 파일의 범위
- `index_scanner.py`: 형제 디스크 수/앨범명/아티스트 일치 가드
- `tag_native_index.py`: 대표 부모 폴더 인벤토리에서 번호 디스크 보조 폴더 허용
- `index_engine.py`: 기존 CD2 비활성화 지점에서 이전 UUID 검색 동기화
- `track_search.py`: missing/hidden 앨범은 검색 행을 다시 생성하지 않음

해당 후보와 원본 소스의 고정 해시를 이용한 **설치 불가능한 패키지 준비 도구**:
`nas/multidisc/build_final_preinstall_bundle.py`

- 실제 운영 `/app` **읽기만 수행**
- 이미 만든 `/tmp` 후보 네 파일의 SHA256을 검증
- `/tmp/vinyl-multidisc-preinstall-final-20261124`에 후보/원본 복사본/manifest 생성
- 개발 변경 코드 간 최소 정적 연결 계약 확인
- 운영 소스/운영 DB/음원/서비스에 쓰기 없음
- 기존 성공 시험 재실행하지 않음

## 미충족 필수 조건 (현재 HOLD)
1. **전체 Index.scan_job + Index.put + NativeAlbumIndex**를 동등한 격리 환경에서 실제 연결한 시험은 아직 미실행. 개별 AST 통과를 전체 동작 PASS로 간주하면 안 됨.
2. 실제 FLAC 원본을 사용하지 않는 격리 트랙 파일로 Writer의 기존 안전 보조 기능과 재색인 콜백이 함께 동작하는지 미검증. Writer E2E 합성시험은 이를 대체하지 못함.
3. Category는 근거 키 2개 존재를 확인했으나 통합된 대표 앨범의 최종 분류 경로와 AI 별도 DB 참조 보존을 입증하지 못함.
4. 실제 단건 적용에 필요한 **Catalog/AI DB 동시점 백업, 복구 시점 및 소스 롤백 프로토콜** 미실행.
5. Tag Editor 후보 화면은 개발 브랜치에만 존재하며 대표 UUID 조회 및 저장의 실제 NAS 통합 화면 검증 미실행.
6. 사용자 **운영 DB 쓰기 명시 승인** 없음.

## 안전 원칙
- 기존 일반 앨범·독립 CD Rename·색인 동작 보호
- 운영 전체 색인 금지, Gemini/Confidence70 전역 제어 금지
- `catalog_changes` 및 `category_references` 과거 데이터 직접 UPDATE/DELETE 금지
- 실제 적용은 김종서 단건만, 대표 CD1 UUID 유지, 이전 CD2 UUID 기록 유지
- 오류 발생 시 사전 설치 금지(HOLD), 원본 음원 수정 금지

## 결론
현재 근거로는 **개별 신규 변경 지점에 대한 높은 수준의 격리 확증**이 있지만, 운영 설치 전 **최종 전체 통합 검증 PASS는 아직 부여할 수 없다**. 최종 검증 패키지는 읽기 전용으로 준비하되, 운영 게시 및 Catalog 통합은 하지 않는다.

## 2026-11-24 NAS 실제 패키지 생성 결과

**`MULTIDISC_PREINSTALL_FOUR_FILE_BUNDLE_READY` — 사용자 전달 실제 NAS 출력 확인**

- `index_scanner.py`: original `329d3d32b892d7bd0cd1187ecc6fd6648c856c2b2f412b85d8f073947f42d173`, candidate `602b70816efe34b8ebfd26eabd98973928758d65d41edbcf93c84dae3d4b06b3`
- `tag_native_index.py`: original `e6e6e6127223c1b01e57aea3400180b3c80b160f0544935515052b172fd4c30e`, candidate `699effa78701cd63aa775aea9a76ef264a42ace529449437bafb811d0a043373`
- `index_engine.py`: original `3bdf67de2bb29315fad021c58300661c903bb9c5f2a6342f1d2bfc7a6a61998f`, candidate `7057f502aba53c3519f2df6ae28df6b838ef88bc43dc046d768728d2290ab2c5`
- `track_search.py`: original `84401b47ce847ffd74181483d77f44a4bb2903819a1d7b8758af94179d4d33de`, candidate `fb5e9bc51bc3854c7ddee3b2e1d222c61a07bd078cd8d0beb02a3e23de19fc86`
- `cross_file_static_contract`: **8/8 true**
- Bundle: `/tmp/vinyl-multidisc-preinstall-final-20261124`
- `deployment=NOT_AUTHORIZED`, `source_replacements=0`, `catalog_writes=0`, `media_writes=0`

**판정 업데이트:** 4파일 패키지 준비 및 정적 호환성 PASS. 전체 Native 색인 실행, AI 연결, 최종 Category 결과, 원복 절차에 대한 검증은 별도로 남음. 원래 HOLD 판정은 유지.

**중요:** `/tmp`의 소스 복사본은 지속 백업이 아니다. 컨테이너 재기동 및 삭제 시 사라질 수 있으므로 운영 설치·원복을 허용하는 백업으로 사용하면 안 된다.

## 다음 실행 단계 — 실제 Native 연결 구현 전 계약 추출

4파일 패키지 준비 PASS 결과와 static 8/8 PASS는 확정되었으며 재검증하지 않는다.

새 읽기 전용 추출기:
`nas/multidisc/extract_final_native_integration_wiring.py`

목적: **실제 NAS에서 준비된 후보 소스**의 `scan_set`, `Index.put`, `Index.scan_job`, `NativeAlbumIndex.preflight/__call__`에 필요한 외부 의존성과 실제 호출 지점을 선택적으로 추출하여, **전체 연결의 격리 실행 도구**를 정확히 구성한다. 코드를 임의 추정하거나 기존에 합격한 단위시험을 반복하지 않는다.

읽는 대상은 고정 해시가 확인된 `/tmp/vinyl-multidisc-preinstall-final-20261124/candidates`의 후보 파일뿐이다. 운영 DB, 음악 파일, 서비스 또는 운영 소스를 수정하지 않는다. 추출기 자체의 실행 결과가 곧 Native E2E PASS를 의미하지는 않는다.

운영 설치는 여전히 HOLD. 별도 승인 전 운영 Catalog 병합/소스 교체/음원 쓰기 금지.
