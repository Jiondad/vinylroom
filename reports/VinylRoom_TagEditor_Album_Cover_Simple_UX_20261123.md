# Vinyl Room — 앨범 대표 커버 편집 UX 단순화

- 기준일: 2026-11-23
- 상태: 후보 구현 완료 / 실제 NAS 저장 현장 검증 별도
- 대상: Tag Editor 내장 커버 편집 모달

## 사용자 관점 변경
- 앨범 단위 전체 파일만 대상으로 함. 선택 트랙 범위 제거.
- 모달 진입 즉시 전체 앨범 파일의 내장 커버 상태를 자동 조회(10곡 단위).
- JPG/PNG 이미지 한 장을 선택해 앨범 전체 대표 내장 커버 초안 생성.
- 저장 시 각 파일 상태에 따라 기존 커버가 있으면 replace, 없으면 add 자동 선택.
- 계획 생성 및 확인 절차는 내부에서 자동 실행하고, 사용자에게는 최종 저장 승인 한 번만 요청.
- 저장 후 동일 파일 재조회, 부분 실패 시 중단·읽기 전용 재조회, 자동 재시도 금지.
- 기존 CD 통합의 원본 디스크 UUID·파일 경로 연결 유지.

## 제거한 UI
- 앨범 전체/선택 트랙 범위 선택
- 수동 현재 상태 조회
- 추가/교체/제거 액션 버튼
- 수동 변경 계획 확인 버튼
- 기술적 초안 취소 절차(이미지 선택 취소로 단순화)

## 구분을 명시한 항목
이 UI가 관리하는 것은 음원 파일 내부의 내장 앞표지다. 폴더 0.jpg와 Vinyl Room 앨범 카드/사이트 대표 이미지는 별도 데이터 경로이므로 이 변경에서 수정하거나 덮어쓰지 않는다.

## 코드 변경
- frontend/dist/tag-editor-cover-draft.js
- frontend/dist/tag-editor-cover-draft.css
- frontend/dist/tag-editor-ui.js
- frontend/dist/tag-editor-ui.html
- frontend/dist/tag-editor-host.js
- frontend/dist/tag-editor-cover-draft.js: 앨범 전체 inspect → 파일별 add/replace 계획 → 저장 승인 → 파일별 apply/재조회.
- CSS 및 캐시 버전 갱신.

## 검증
- 두 JavaScript 파일 구문 파싱 PASS.
- 선택 트랙 UI/수동 계획 버튼/수동 조회 버튼 제거 정적 확인.
- 앨범 전체 범위 및 자동 inspect 진입 정적 확인.
- 파일별 front_covers 상태에 따른 add/replace 분기 코드 확인.
- 실제 NAS 쓰기 호출 0건, 음원/DB 변경 0건.

## 제한
- 실제 NAS의 새 UI 렌더링, 대량 앨범 저장, 폴더 0.jpg/사이트 카드 커버 갱신은 이 변경으로 검증 또는 구현되지 않았다.
- 기존 NAS Writer·백업·복구 시험 반복 금지.
