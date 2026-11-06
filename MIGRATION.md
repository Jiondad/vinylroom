# Vinyl Room — GitHub 운영 이관 체크포인트

기준: 2026-11-06 · 사용자 지정 **정식 프런트엔드 주소**: https://jiondad.github.io/vinylroom/ · 기존 Sites v267은 병행 운영/복원 주소로 유지

## 운영 주소 결정
- [x] 정식 사용자 접속 주소는 현재 GitHub Pages `https://jiondad.github.io/vinylroom/` 사용 (사용자 승인)
- [x] 별도 도메인 등록·DNS 변경 불필요. NAS 요청의 Origin은 `https://jiondad.github.io`로 유지.
- [ ] **아직 모든 권한/기능이 이전된 것은 아님**. 기존 Sites를 중단하지 않고 신규 주소의 기능 동등성을 보완한다.

## 검증 완료 — 사용자 현장 확인 재사용
- [x] v267 프로덕션 형식 `publish/`의 216개 정적 파일을 GitHub `dist/`로 교체
- [x] 실행 진입점 `releases/header-actions-a54085e3f7ac/entry.js` 적용 및 최신 UI 표시 확인
- [x] GitHub Actions Pages 자동 배포 및 NAS 공개 앨범·아티스트·사진 조회
- [x] 관리자 로그인, 앨범 상세, 실제 음원 1곡 재생
- [x] AI 제안 목록 및 검토 선택·confidence-v2 조회: GitHub 출처의 GET/OPTIONS 허용
- [x] AI 검토 초안 저장 1건: NAS 저장 → 재조회 → 감사 기록 확인 완료. **확정 및 Catalog 반영 없음**
- [x] `review-selections` POST 사전 요청 허용 및 AI API 내부 GitHub Origin 별도 허용(해당 POST만)
- [x] 구형 `dev-audio-owner` 진입점을 게시하지 않도록 Actions 진입점 사전 검사 추가
- [x] GitHub Actions에 `frontend/` 존재 시 기존 v267 빌더 실행·`frontend/out` 게시, 미존재 시 기존 `dist/` 유지하는 전환 경로 구성

## 남은 정식 운영 전환 게이트 — 미확인을 완료로 표시하지 않음
- [x] 프런트엔드 개발 원본 `frontend/` GitHub 업로드 (155개 파일 경량 패키지) 및 Actions #12 자동 빌드·게시 성공
- [x] NAS 관리자 앨범 수정·아티스트 장르 수정·앨범 숨기기 3종의 GitHub Origin OPTIONS 204 및 허용 헤더 확인 (2026-11-06, 실제 POST 쓰기는 미검증)
- [x] 코드상 회원 승인·권한/정보 수정은 Supabase 직접 연결, NAS 플레이리스트는 `/v2/playlists` 사용 확인 — NAS CORS 확대 불필요
- [x] 개인 플레이리스트 NAS 저장·재조회·삭제까지 정상 (사용자 현장 확인)
- [x] GitHub 정식 사이트 회원관리 화면·회원 목록·승인 상태·관리자/일반회원 구분·정보 수정 화면 정상 (2026-11-06 사용자 현장 확인; 직전 요청 범위)
- [ ] 실제 회원 승인·거절·회원정보 저장 등 쓰기 성공은 미검증 (별도 데이터 변경 시험 없이 유지)
- [x] GitHub 정식 사이트 개인 플레이리스트 생성·곡 추가·새로고침 후 재조회·삭제 정상 (2026-11-06, 사용자 현장 확인)
- [ ] Android Chrome 잠금화면: 현장 진단 로그에서 첫 번째 자동 전환은 `play-promise-resolved` 및 음원 시간 진행 정상. 다음 전환 전 `album-detail` 사전 요청이 약 0.27초 간격으로 115회 TypeError 실패. `NextQueuePlayer` 실패한 prefetch 재요청 반복 차단·곡 종료 시 직접 재요청 1회로 최소 수정 (b23eca2, 2026-11-06). **수정 후 GitHub 배포·실기기 결과 미확인**
- [x] 정식 주소의 앨범 공유 링크 `/vinylroom/?album=...` 생성·새 탭 진입 정상 (사용자 현장 확인)
- [x] 별도 소유 도메인 대신 현 GitHub Pages 주소 채택: DNS·사용자 지정 도메인 작업 불필요
- [x] GitHub 정식 주소에서 앨범 공유 링크 생성·새 탭 직접 진입 정상 (2026-11-06, 사용자 현장 확인)
- [ ] Sites v267 병행 유지 기간·복구 절차 확정 (GitHub 접속 장애 시 기존 Sites URL로 복귀)
- [ ] 남은 쓰기 기능의 GitHub Origin 서버 권한 및 접근 통제를 필요한 범위에서만 확인

## 정식 운영 및 복귀 매뉴얼
- [x] GitHub Pages 현재 주소를 기본 접속 주소로 채택하고, 이전 Sites 주소를 병행·복원용으로 유지
- [x] GitHub 배포 문제 발생 시 Sites 접속으로 즉시 우회, GitHub 코드 롤백과 NAS 장애를 구분한 `OPERATIONS_CUTOVER.md` 작성
- [x] NAS 관리자 쓰기 3종 `/v2/edit`, `/v2/artist`, `/v2/hide` GitHub Origin 사전 요청 204 확인. 실제 POST는 미검증
- [ ] 나머지 관리 API는 여전히 제한된 상태이며 요청별 필요성 확인 전 전체 허용 금지
- [x] 앨범 공유 링크 GitHub URL 직접 열기 정상 (사용자 현장 확인)

## 보존 및 보안
- 기존 Sites v267 운영 중단·재게시 금지
- NAS Catalog/AI DB, 음원, Tag, 회원 권한, Gemini 실행 조건 임의 변경 금지
- GitHub 공개 저장소에 관리자 토큰, 서버 비밀 키, DB, 백업, 로그 업로드 금지
- NAS 인증·승인과 AI 검토의 검증/감사/확정 차단은 서버가 최종 판정
- 이미 통과한 시험과 기능을 일괄 재검증하지 않음

## 현재 구조와 주의사항
- `dist/`: Sites v267 소스 커밋 `f332919160bd66bf97e284c0205c549f6371040e`의 기존 빌드로 생성한 게시 후보로, 운영 TAR 바이트 동일성은 **미확인**
- 배포된 UI는 사용자 스크린샷으로 확인됨. 실제 NAS 데이터/음원은 원격 연동으로 유지
- 빌드 원본의 운영용 스크립트는 `frontend/scripts/header-actions-release.mjs`, `frontend/scripts/copy-artist-profiles.mjs`이며 산출물은 `frontend/out/`. GitHub Actions #12 자동 빌드·게시 성공
- `frontend/dist/album-share.js`: 사이트별 공유 링크 선택. GitHub 시험판의 공개 링크는 `/vinylroom/?album=...`, Sites 기존 주소는 계속 유지. 사용자 지정 도메인은 아직 미설정
- AI 적용 배지는 과거 시험 코드에만 존재; 현행 프로덕션 빌드에는 **미통합**. NAS 적용 감사 자료와 실제 앨범 API 읽기 계약 연결 필요
- GitHub Pages URL은 사용자가 채택한 정식 프런트엔드 주소. 단, 기존 Sites는 계속 사용 가능하며 운영 기능 완전 동등성은 미확인

## 개발 원본 등록 준비 (2026-11-06)
- 사용자 업로드 `VinylRoom_v267_Production_Frontend.zip`의 `source/`에서 과거 릴리스 1,687개를 제외한 현재 원본 155개를 `frontend/`로 분리한 업로드 ZIP 생성.
- 원본과 동일한 `header-actions-a54085e3f7ac` 진입점 생성, 정적 결과 216개 확인. 개발 원본 GitHub 등록 완료.
- GitHub Actions가 기존 `dist/` 대신 `frontend/out/`을 게시 중. 변경 시 GitHub Pages 시험판만 영향을 받으며 Sites 운영판과 NAS는 유지.

- 2026-11-06 Chrome 후속 진단 보정: 차량 이동 중 노래 중간 끊김은 사용자 현장 설명상 통신 신호 약화가 유력하며 NAS/프로그램 결함으로 판정하지 않는다. Chrome 잠금화면에서 다음 곡 자동 전환 지연만 미해결 대상으로 유지. 실제 `frontend/dist/player.js`의 사전 준비 유효시간 30/40초→300초 수정(커밋 `5eb044c`), 새 빌드/실기기 효과 미확인. 스트리밍 중간 복구 로직 추가 금지.
