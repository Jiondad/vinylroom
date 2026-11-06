# Vinyl Room — GitHub 정식 주소 운영 및 복귀 절차

2026-11-06 KST · **정식 프런트엔드:** https://jiondad.github.io/vinylroom/

## 운영 경계
- 정식 접속 프런트엔드: GitHub Pages. 소스는 `frontend/`, Actions가 `frontend/out/`을 빌드·게시한다.
- 백엔드/API/AI/Catalog/음원: 기존 NAS https://jioni.synology.me:8443 유지.
- 회원 인증: 기존 Supabase; 권한 승인·실제 쓰기 권한은 각 서버에서 검사.
- 이전 Sites 운영판: https://vinylroom.shinekjh.chatgpt.site — **계속 유지**, 자동 동기화되지 않음. 이 주소를 GitHub로 리다이렉트하거나 Sites 게시물을 변경하지 않는다.
- GitHub Pages 정적 호스팅은 공개 저장소의 파일이므로 `frontend/`, `dist/`, Actions 로그에 비밀 키·관리자 JWT·NAS 백업·개인 음원 파일을 넣지 않는다.

## 현재 직접 확인된 경로
- 정식 UI, 앨범·아티스트·사진, 관리자 계정 로그인, 음원 1곡 재생
- 관리자 AI 제안·신뢰도·검토 기록 GET
- AI `review-selections` POST: 관리자 초안 저장 → NAS 재조회 → 감사 원장 일치 확인. **Catalog 적용 없음**
- GitHub Actions: 개발 원본 등록 후 빌드·Pages 배포 성공 (#12). 이후 수정마다 실행 성공 여부는 별도.

## 남은 기능 차이 (완료로 오인하지 않기)
- NAS GitHub Origin 허용 범위는 일부 GET/POST로 제한됨. 미확인 관리 기능을 CORS 전체 허용으로 해결하지 않는다.
- `/v2/edit`, `/v2/hide`, `/v2/artist` 등 앨범·아티스트 관리자 변경 기능은 GitHub Origin에서 동작 확인 없음.
- AI Worker 설정/큐/제어 POST는 별도 승인·검증 없이 GitHub Origin 예외 추가 금지.
- 개인 플레이리스트 생성·곡 추가·새로고침 후 재조회·삭제는 GitHub 정식 주소에서 정상 (2026-11-06 사용자 현장 확인). 회원관리 목록·상태·관리자/회원 구분·정보 수정 화면 표시도 사용자 정상 확인. 회원정보 실제 저장·승인·거절 및 재생 대기열 자동 전환의 동등성은 미확인.
- 공유 링크는 GitHub 정식 URL로 생성되며 새 탭 직접 진입 정상 (2026-11-06 사용자 현장 확인).

## 장애 시 접근 복귀 (서비스 데이터 변경 없이)
1. GitHub Pages 접속·UI·NAS API 연결 장애가 발생하면 사용자는 기존 Sites URL `https://vinylroom.shinekjh.chatgpt.site` 로 접속한다.
2. 기존 Sites는 독립 게시물이며 GitHub 업데이트가 자동 전파되지 않는다. 따라서 GitHub에서만 추가된 UI 기능은 기존 Sites에 없을 수 있다.
3. GitHub 코드 문제라면 GitHub 저장소의 정상 커밋을 확인하고 GitHub Desktop에서 해당 커밋을 `Revert this commit`한 뒤 **Commit/Push** 한다. 임의로 원본 파일을 전부 지우지 않는다.
4. GitHub Actions 결과가 성공하기 전에는 장애 복구 완료를 주장하지 않는다.
5. NAS/AI/Catalog/회원 DB 자체 장애는 GitHub 배포 롤백으로 해결되지 않는다. 별도 서버 장애로 취급하고 기존 백업·운영 절차를 따른다.

## 변경 승인 경계
- 프런트엔드 버전/디자인/링크: GitHub 원본 수정 → Actions 자동 빌드 및 게시
- 서버 CORS와 Origin 예외: 필요 경로·메서드·인증을 특정한 NAS 최소 변경만 허용
- 실제 앨범 메타데이터 쓰기·AI Worker 실행·일괄 색인·계정 권한 변경: 별도 명시적 운영 승인
- 이미 성공한 UI·음원 재생·AI 검토 저장은 정례 재검증하지 않음

## 후속 코드 확인 — 2026-11-06
- **회원 승인/권한 수정:** `frontend/dist/member-management.js`는 Supabase `rpc/vinyl_review_member`, `functions/v1/vinyl-admin-create-member`를 사용한다. NAS Origin 예외 추가 대상이 아니다. 실제 수정/승인 동작은 GitHub 주소에서 별도 확인되지 않음.
- **회원 이름·닉네임 수정:** `frontend/dist/admin-center.js`는 Supabase `rpc/vinyl_admin_update_member_profile`로 직접 요청한다. 회원관리 화면 표시는 사용자 확인 완료, 실제 정보 저장은 미확인.
- **개인 플레이리스트:** `frontend/dist/playlists.js`는 NAS `GET/POST /v2/playlists`에 Bearer 토큰을 전송한다. GitHub 정식 사이트에서 생성·곡 추가·새로고침 후 재조회·삭제 정상 (2026-11-06 사용자 현장 확인).
- **관리자 앨범 변경:** GitHub Origin의 `/v2/edit`, `/v2/artist`, `/v2/hide` OPTIONS 204 및 CORS 헤더 확인 완료(사용자 NAS 로그). 실제 POST는 미검증.
- **공유 링크:** `frontend/dist/album-share.js`가 GitHub 주소에서 `/vinylroom/?album=<UUID>` 형태로 생성하며 브라우저 새 탭 직접 진입 정상 (2026-11-06 사용자 현장 확인).
- 이번 소스 확인으로 NAS 전체 CORS 허용이나 계정/데이터 쓰기 시험은 필요하다고 판단되지 않음.

## Android 잠금화면 재생 브라우저별 현장 결과 (2026-11-06)
- 화면 켜진 상태: Chrome 및 삼성 인터넷 모두 재생 대기열 다음 곡 자동 전환 정상.
- 화면 잠금: 삼성 인터넷 다음 곡 자동 전환 정상, **Chrome만 자동 전환 실패**.
- GitHub 원본 `frontend/dist/next-player/engine.js`에는 다음 트랙 사전 준비(`prepareNext`)가 있으나 곡 종료 시 새 음원에 `audio.play()`를 재호출함. Chrome 백그라운드 제한과 연관 가능성이 있으나 정확한 원인(종료 이벤트 미발생/요청 지연/재생 거부)은 로그 없이는 미확정.
- **판정:** Chrome 잠금화면 재생 이슈 미해결. 삼성 인터넷으로 연속 재생은 가능하며 전체 재생 기능이 고장난 것으로 판단하지 않음.
- 신규 범위는 Chrome 전환 경로에만 한정. 기존 정상 삼성 인터넷·NAS·회원·AI 기능 무변경. 이미 확인된 일반 재생/잠금화면 삼성 인터넷 중복 검증 금지.
- 사용자가 Chrome 잠금 해제 후 **두 번째 곡으로 이동했으나 재생 정지**를 확인. 자동 전환 시 `audio.play()` Promise 요청/성공/실패를 기존 `playbackDiagnostics`에 계측하도록 엔진 수정하고, 관리자센터 → 앨범 분석 관리 → **재생 진단 로그 · Chrome 잠금화면**으로 진단 화면 연결. 브라우저 제약 우회를 위한 자동 재시도는 추가하지 않음.
- 2026-11-06 Chrome 진단 JSON 확보: 화면 숨김 후 18:22:22 첫 자동 곡 전환 `audio-playing`·`play-promise-resolved` 성공, 약 4분간 실제 재생 진행. 18:26:02부터 그다음 곡의 `album-detail` 요청 `TypeError` 연속 실패(로그에 115건), 18:26:32 이전 곡 종료 이후 재생 중단. **Chrome `audio.play()` 정책 차단으로 단정하지 않음.**
- `frontend/dist/next-player/engine.js`에 사전 요청 실패 후 반복 호출 차단, 실제 곡 종료 시 1회 직접 요청 허용 (GitHub b23eca2). Chrome 강제 자동 재시도 없음. 이 변경의 GitHub Actions 배포 및 Chrome 잠금화면 효과는 미확인.
- 사용자 승인 범위는 기존 정상 삼성 인터넷·NAS·회원·AI 기능 무변경. 이미 성공한 일반 재생을 반복 검증하지 않음.

## 다음 정식 이관 게이트
1. NAS POST 라우트에 대한 GitHub Origin 처리 위치를 **읽기 전용**으로 확인하고, 실제 필요한 관리자 기능 목록 확정.
2. ~~공유 링크 생성 및 직접 열기~~ — 사용자 현장 확인 완료.
3. 미확인 쓰기 기능은 대상 API별로 제한적으로 연결하고 한 번씩 확인.
4. 1~3을 마치고 운영과 복원 경로를 최종 확정.

- 2026-11-06 Chrome 후속 진단 보정: 차량 이동 중 노래 중간 끊김은 사용자 현장 설명상 통신 신호 약화가 유력하며 NAS/프로그램 결함으로 판정하지 않는다. Chrome 잠금화면에서 다음 곡 자동 전환 지연만 미해결 대상으로 유지. 실제 `frontend/dist/player.js`의 사전 준비 유효시간 30/40초→300초 수정(커밋 `5eb044c`), 새 빌드/실기기 효과 미확인. 스트리밍 중간 복구 로직 추가 금지.
