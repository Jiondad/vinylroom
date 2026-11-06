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
- [ ] GitHub 사이트에서 회원·관리자 **다른 쓰기 기능**의 필요 범위 확인 및 최소 권한 연결
- [ ] 재생 대기열 자동 전환·개인 플레이리스트 등 변경 출처 관련 기능의 동등성 확인(필요할 때만; 대규모 회귀 금지)
- [x] 현재 정식 주소의 앨범 공유 링크는 `/vinylroom/?album=...` 형태로 생성하도록 개발 원본 수정 (게시 반영 별도 확인 필요)
- [x] 별도 소유 도메인 대신 현 GitHub Pages 주소 채택: DNS·사용자 지정 도메인 작업 불필요
- [ ] 공유 링크 생성 및 새 탭 직접 진입은 변경 경로에 대해 1회 확인
- [ ] Sites v267 병행 유지 기간·복구 절차 확정 (GitHub 접속 장애 시 기존 Sites URL로 복귀)
- [ ] 남은 쓰기 기능의 GitHub Origin 서버 권한 및 접근 통제를 필요한 범위에서만 확인

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
