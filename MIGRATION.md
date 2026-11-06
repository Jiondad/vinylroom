# Vinyl Room — GitHub 운영 이관 체크포인트

기준: 2026-11-06 · 운영 Sites v267 유지 / GitHub Pages `https://jiondad.github.io/vinylroom/`

## 현재 확인됨
- [x] `Jiondad/vinylroom` 공개 저장소에 v267 배포물 `dist/` 보관
- [x] GitHub Actions가 `dist/`를 GitHub Pages에 배포
- [x] GitHub 시험판에서 공개 음악 서재 화면 표시
- [x] NAS `/health` 200, `Origin: https://jiondad.github.io`에 CORS 헤더 반환
- [x] AI 분류 적용 표시 프런트엔드 구성 요소 추가 (적용 증거를 API가 제공하기 전에는 숨김)

## 이관 게이트 — 확인 전 운영 주소 전환 금지
- [ ] GitHub 도메인에서 기존 승인 회원 로그인·세션 복원 (실제 사용자가 확인)
- [ ] 승인 회원의 앨범 조회·1곡 재생·다음 곡 전환 (변경된 교차 출처 경로만 확인)
- [ ] 관리자센터 조회·AI 검토 목록 조회 (읽기 우선; 쓰기 검증은 실제 필요 시)
- [ ] GitHub 사이트의 공유 링크·상대경로·페이지 새로고침 확인
- [ ] NAS 허용 출처/요청 경로를 실제 운영 전환에 맞게 최소 보완 (인증·승인은 그대로 서버에서 강제)
- [ ] 사용자 소유 운영 도메인 결정 및 DNS·HTTPS 설정
- [ ] 운영 사이트로 전환하되 Sites v267 및 NAS 백업 복원점 보존

## 변경 금지
- Sites 운영 v267의 기능·주소·배포물
- NAS Catalog/AI DB, 음원, Tag, 플레이리스트, 회원 권한
- 공개 GitHub 저장소에 관리자 토큰, API 비밀 키, NAS 데이터·백업 등록

## 원칙
GitHub를 프런트엔드의 단일 개발 기준으로 사용. GitHub Pages는 정적 파일만 제공하며 NAS/Supabase에서 인증·권한을 검증한다. 이미 통과한 검증은 반복하지 않고 교차 출처 기능만 확인한다.

## 주요 기술 부채
현재 `dist/`는 배포 결과물로, 후속 원본 소스가 완비되었는지 별도 확인 필요. `dist/config.js`의 NAS 주소는 독립 도메인. `dist/album-share.js`는 운영 주소에 공유 링크를 고정. `ai_application` 적용 이력은 현재 API 응답에 미연결.
