# Vinyl Room — Tag Editor 현행 운영판 통합 및 게시 결과

기준일: 2026-11-21 (KST)

## 현재 판정

**통합 개발 완료 / 운영 게시 보류 — 관리자 로그인 확인 필요**

게시 대상은 https://jiondad.github.io/vinylroom/ 이다. 기존 Sites 운영판에는 게시하지 않았다.

현재 운영 GitHub 소스: `Jiondad/vinylroom`, `main`, 기준 커밋 `79fb8ed8dd784d2dbc350485c56c3fba20880c7d`.
배포 절차는 기존 `.github/workflows/deploy.yml`: main push → frontend/scripts/header-actions-release.mjs → copy-artist-profiles.mjs → frontend/out → GitHub Pages 이다. 워크플로 및 운영 브랜치는 변경하지 않았다.

## 구현 및 기존 자산 재사용

- 기존 관리자센터에 관리자 전용 Tag Editor 메뉴와 화면을 연결했다. 기존 canManage 및 인증된 api(...,{admin:true})를 재사용한다.
- Phase G 화면 구조·트랙 비교·공통 태그 편집·선택·변환 미리보기 UI를 재사용한다. 독립 프레임으로 CSS와 이벤트를 기존 재생 화면에서 분리했다.
- 기존 관리자 GET /v2/folders, /v2/admin-album 및 Catalog 조회 /v2/albums를 이용한다. 임의 URL, 쓰기, 명령 실행 요청은 제공하지 않는다.
- 부모 화면이 인증을 확인한 경우에만 프레임을 초기화한다. 토큰은 프레임에 전달하지 않는다. 계정 변경·탭 이동·화면 종료 시 프레임과 초안을 폐기한다.
- 실제 표시값은 `physical_files[].raw_tags`의 NAS 색인 태그다. 방금 음원 파일을 재독해한 값으로 표시하지 않는다. TITLE 누락을 Catalog 제목이나 파일명으로 보충해 원본인 것처럼 표시하지 않는다.
- Phase 2C 순수 변환 규칙을 브라우저 어댑터로 옮겨 사용한다. Python 서버를 GitHub Pages에 설치하지 않는다. 반복 %dummy%, 모호한 파싱, 기존값 보존, A\B 보호, 다중 GENRE, 두 자리 번호·총수 유지와 파일명 충돌 경고를 연결했다.
- FEATURING은 명시적으로 색인된 featuring 값만 표시하며 TITLE이나 공동 ARTIST에서 임의 생성하지 않는다.
- 실제 저장·이름 변경·삭제·Catalog 쓰기 API는 연결하지 않았다. ‘초안에 반영’은 브라우저 메모리만 변경한다.
- 리소스는 /vinylroom/ 기준 상대 경로로 연결한다. 기존 릴리스 빌더의 해시에 Tag Editor 파일을 포함해 새 버전 캐시 경로를 생성한다.

## 최소 확인 결과

- 신규 연결 검사 5/5 PASS: 인증 전·취소 후 접근 차단, 읽기 경로 제한, 실제 raw_tags 매핑, 반복 dummy 및 공동 아티스트 보호, 선택 범위 충돌·트랙 총수 유지.
- 새 브라우저 변환 어댑터와 기존 Phase 2C 원본 함수의 추가 비교 6/6 일치. 기존 성공 시험 전체는 실행하지 않았다.
- 기존 운영 빌드 절차 실행 성공. 비게시 빌드 식별자: `header-actions-45d96b49e76d` (실제 게시 버전 아님).
- NAS 관리자 상세 API 무인증 요청: HTTP 401. 관리자 권한을 우회하지 않았다.
- 운영 사이트 로그인 시도: 사이트가 `Invalid login credentials`를 반환했다. 관리자 로그인 성공 또는 실제 관리자 태그 조회를 주장하지 않는다.
- 로컬 전용 주소에 대한 Cloud Browser 확인은 연결 거부로 완료하지 못했다. 실제 GitHub Pages 접속은 가능했으며 운영 로그인 화면까지 확인했다.

## 변경 파일 및 SHA256

| 파일 | SHA256 |
|---|---|
| `frontend/dist/admin-center.js` | `72a0862fdb6c854de829aa380c17df5bfb43067895b369269dbe9bd10de91680` |
| `frontend/dist/tag-editor-host.js` | `00410e48cff1aea5ff0a2a1911518e260e719cce2c0b6b9dcd8c16b7e369d811` |
| `frontend/dist/tag-editor-plan.js` | `a64ae64062aa3add207305567f40d9d2585b8d8c399fb54d1e1fac7ea20e4dd2` |
| `frontend/dist/tag-editor-ui.css` | `30f60c3847b19341a91358c0c78f5905ce44522444621ba26527c8dc2b623796` |
| `frontend/dist/tag-editor-ui.html` | `5e4b78f72a2594c0aecf35908475b30d03b49caea201d914c66166778ff5a950` |
| `frontend/dist/tag-editor-ui.js` | `e8f11d63584afeb84642862ceff181cc9ec018f404dfba0f2ec20b7eb8503842` |
| `frontend/scripts/header-actions-release.mjs` | `d0123219591c53fe72c0df8f069562b0d1e33f0d97821ff30de8bdc2562a1246` |
| `frontend/tests/tag-editor-integration.test.mjs` | `60e74316ed683b19f82a5826863f5e45206d9be9230d51a0a18d4159ed5d66ff` |

## 운영 데이터 및 기존 기능 보호

- main 및 운영 Pages: 변경 0건, Tag Editor 미게시.
- NAS 운영 소스·Catalog·AI DB·음원·태그·폴더: 변경 0건.
- Gemini 및 외부 음반 출처 조회: 0회.
- 재생·대기열·색인·AI 분류 소스: 수정하지 않음.
- 별도 Python 서버 운영 설치: 없음.

## 남은 조건 및 게시 절차

1. 기존 운영 사이트의 관리자 로그인을 확인한다. 비밀번호를 채팅으로 전달하지 않는다.
2. 기존 관리자 화면 접근과 NAS 관리자 조회가 가능한지 확인한다. 실제 설치 API가 raw_tags를 제공하지 않으면 해당 부분을 미연결로 표시하고 게시를 보류한다.
3. 준비된 변경을 최신 main과 대조해 충돌이 없으면 기존 main 배포 절차로 게시한다. 현재 사용자 지시에 게시 권한이 포함되어 있으므로 추가 게시 승인 단계는 필요하지 않다.
4. 실제 GitHub Actions 배포 성공·게시 커밋을 확인한 후 관리자센터 → Tag Editor → 실제 앨범/트랙 조회 및 변환 미리보기를 확인한다.

## 알려진 한계

- NAS 색인이 보관하지 않는 태그는 미확인이다. 특히 EasyID3 색인에 없는 MP3 TXXX:FEATURING을 실제로 읽은 것처럼 표시하지 않는다.
- 앨범당 실제 파일 120개까지 미리보기한다. CUE 논리 트랙과 실제 파일 태그는 구분하며 physical_files를 기준으로 표시한다.
- 선택 아티스트의 앨범 조회는 최대 4페이지이며 초과 시 제한을 알린다. 전체 라이브러리를 순회하지 않는다.
- 기존 공동 아티스트 Catalog 키와 폴더를 변경하지 않는다. 공동 표기를 FEATURING으로 전환하지 않는다.
- 실제 게시 버전, 관리자 실데이터 조회, 모바일 실기기 확인은 아직 미완료다.
