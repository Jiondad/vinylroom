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
- 개인 플레이리스트 저장/갱신, 회원관리 수정, 재생 대기열 자동 전환은 GitHub 정식 주소에서 전체 동등성 미확인.
- 공유 링크의 새 사이트 주소 생성 코드 반영, 실제 생성 후 URL 직접 방문 결과는 아직 미확인.

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
- **회원 이름·닉네임 수정:** `frontend/dist/admin-center.js`는 Supabase `rpc/vinyl_admin_update_member_profile`로 직접 요청한다. 실제 정보 수정은 수행하지 않음.
- **개인 플레이리스트:** `frontend/dist/playlists.js`는 NAS `GET/POST /v2/playlists`에 Bearer 토큰을 전송한다. GitHub Origin의 OPTIONS/POST 허용 경로는 이전부터 존재하지만 플레이리스트 저장·재조회 성공까지 확인된 것은 아님.
- **관리자 앨범 변경:** GitHub Origin의 `/v2/edit`, `/v2/artist`, `/v2/hide` OPTIONS 204 및 CORS 헤더 확인 완료(사용자 NAS 로그). 실제 POST는 미검증.
- **공유 링크:** `frontend/dist/album-share.js`가 GitHub 주소에서는 `/vinylroom/?album=<UUID>` 형태를 생성하도록 수정됐으나 브라우저에서 생성/직접 열기는 아직 미확인.
- 이번 소스 확인으로 NAS 전체 CORS 허용이나 계정/데이터 쓰기 시험은 필요하다고 판단되지 않음.

## 다음 정식 이관 게이트
1. NAS POST 라우트에 대한 GitHub Origin 처리 위치를 **읽기 전용**으로 확인하고, 실제 필요한 관리자 기능 목록 확정.
2. 공유 링크 `https://jiondad.github.io/vinylroom/?album=...` 1건의 생성/직접 열기만 확인.
3. 미확인 쓰기 기능은 대상 API별로 제한적으로 연결하고 한 번씩 확인.
4. 1~3을 마치고 운영과 복원 경로를 최종 확정.
