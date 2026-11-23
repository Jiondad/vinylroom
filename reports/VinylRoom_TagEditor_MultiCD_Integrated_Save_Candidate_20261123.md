# Vinyl Room — Tag Editor Multi-CD 통합 저장 개발 후보

- 기준일: 2026-11-23
- 브랜치: `feature/tag-editor-multicd-unified-draft-20261123`
- 상태: **CANDIDATE_ONLY / NOT_MERGED / NAS_REAL_TEST_PENDING**
- 대상 화면 사례: 김종서 — 20th Anniversary Greatest Hits (CD1·CD2)
- 기존 단일 앨범 저장/복구, Catalog/AI, NAS 원본 보호

## 사용자 요구
CD1/CD2와 같이 한 앨범 폴더 아래 디스크 하위 폴더가 있으면 Mp3tag처럼 한 화면에서 여러 디스크의 트랙을 동시에 선택·태그 편집·저장할 수 있어야 한다. 기존 개별 Catalog 앨범 UUID와 파일 경로는 유지한다.

## 구현
1. 좌측 트리의 상위 앨범 폴더에 `CD 통합` 버튼을 추가 (CD/DISC 숫자 하위 폴더, 직계 2~8개 한정).
2. 기존 인증된 디스크별 `/api/tracks?album=<UUID>` 조회를 병합, 각 트랙 `source_album_id` 및 상대 경로 유지. 최대 120곡. 실제 DISCNUMBER 태그 임의 수정 없음.
3. 통합 선택·9개 태그 필드 초안 편집 후 `선택 항목 NAS 저장`으로 기존 `tag-plan → tag-apply`를 각 원본 UUID·파일에 순차 수행. 기존 필드·포맷 자격 게이트와 Writer의 CAS/백업/검증 유지.
4. 파일명 변환도 원본 UUID를 사용해 기존 `rename-plan → rename-apply` 순차 적용. 사전 계획 검사는 모두 수행, 첫 곡의 계획만 재사용; NAS Writer의 계획 재검증·동기 색인 유지.
5. 오류·불확실 응답 시 즉시 중단, 자동 재시도 금지, 원본 디스크 UUID별 실제 태그/파일명 재조회. 확정되지 않은 초안은 미저장으로 유지.
6. 단일 앨범 저장 API 및 NAS Writer/DB/색인 코드 변경 없음.

## 신규 변경부 모의 검증
- UI JavaScript 구문: PASS (코드 파싱).
- 원본 파일 소속 검증: CD1→UUID A, CD2→UUID B, 미등록 CD3 거부 PASS.
- 2디스크 태그 저장: 각각 plan/apply, 원본 UUID와 경로 보존, 응답 태그 확인 PASS (격리 모의 API).
- 2디스크 파일명 저장: 각 UUID로 계획·적용, 새 파일 경로 및 브라우저 원본 매핑 갱신 PASS (격리 모의 API).
- CD1 저장 성공 / CD2 HTTP 409 실패: 적용 중단, 자동 재시도 0, 양 디스크 실제 상태 재조회, CD2 미저장 초안 보존 PASS (격리 모의 API).

**미확인:** 실제 NAS 통합 조회, 원본 파일 I/O 및 색인 처리 시간, 2디스크 실제 저장·재조회, PC/모바일 화면. 모의 검증을 현장 통과로 표현하지 않는다.

## 게시·검증 게이트
- `main` 병합/운영 게시: **HOLD**
- 현장 검증은 사용자 지정한 실제 멀티 CD 앨범 1건에 한정하여 우선 읽기 전용 조회, 저장은 별도 격리 시험 파일/동일 기존 인증 경로에서 수행.
- 원본 음원에 대한 무의미한 시험 변경 금지.
- 이미 통과한 단일 앨범 Writer·백업·복구 검증 반복 금지.
- 기존 운영판과 독립 유지; 문제 시 후보 브랜치 폐기 가능.
