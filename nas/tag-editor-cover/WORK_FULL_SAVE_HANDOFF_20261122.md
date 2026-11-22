# Vinyl Room — Tag Editor 전체 저장 기능 완성 및 운영 게시 (Work 실행 인수인계)

**기준:** 2026-11-22 / GitHub `Jiondad/vinylroom`  
**개발 브랜치:** `feature/tag-editor-complete-save-20261122`  
**운영 `main` 보호:** 최신 `main`에는 앨범 상세 → Tag Editor 직접 이동과 아티스트 검색창 고정 기능이 이미 게시되어 있으므로, 머지 시 반드시 보존한다.

## 최종 목표 (세 가지 모두 완료 후 게시)

1. **커버 저장:** MP3/FLAC 파일 내부의 앞표지 추가·교체·삭제를 실제로 저장하고 동일 파일에서 재조회. 기존 Phase H Writer, 백업, SHA/CAS, Catalog Lease 재사용.
2. **태그 변환 결과 저장:** MP3/FLAC의 TITLE, ARTIST, ALBUM, ALBUMARTIST, DATE, GENRE, FEATURING, TRACKNUMBER, DISCNUMBER을 실제 파일에 반영. 선택한 트랙만 변경; 기존 음원 프레임, 타 태그, 내장 커버 보존; 백업·복구·감사 기록.
3. **파일명 변환 결과 저장:** `%discnumber% - $num(%track%,2). %title%` 기본 패턴. 예: `1 - 01. Death Penalty.flac`. 실제 파일명 변경 전 충돌 검사 및 원본 해시 CAS. 기존 Catalog 정식 폴더/개별 색인 작업 경로를 **같은 Catalog Lease 범위**에서 동기적으로 실행하고 변경 파일명을 다시 조회해 확인한다. 인덱스 갱신이 불가능하면 파일 변경 자체를 HOLD. 직접 SQL 갱신 엔진을 새로 만들지 않는다.

## 구현 후보 및 통과한 검증 재사용

- `nas/tag-editor-cover/tag_cover_h.py`: 이미 자격 시험 통과한 MP3/FLAC 커버 Writer.
- `nas/tag-editor-cover/tag_phase2c.py`: 백업·파일 SHA/CAS·락·감사·복구; 개발 브랜치에서 MP3/FLAC 전체 필드 Writer 후보 추가.
- `nas/tag-editor-cover/tag_cover_http.py`: 태그/커버 저장 API 후보. `full_tags` 적격성 승인과 `VINYL_TAG_EDITOR_FULL_TAG_WRITE_ENABLED` 모두 충족할 때만 신규 필드/MP3 지원. **태그 필드별 적격성 검사를 추가 완료.**
- `nas/tag-editor-cover/tag_rename_writer.py`: 파일명 충돌 보호, RENAME_NOREPLACE, 원본 해시, backup, 감사, Catalog reindex callback이 없으면 HOLD. 이 callback은 현재 NAS 실제 색인 API와 아직 연결되지 않음.
- `frontend/dist/tag-editor-cover-draft.js`: 저장 시작 시 선택 곡의 상태 조회·계획 확인 자동화 후보.
- `frontend/dist/tag-editor-ui.js`: 실제 저장과 프런트엔드 초안 관리 연결 후보. **Rename Writer API 호출/프런트엔드 저장 버튼 연계 아직 미완료.**
- `tests/test_tag_full_save_extension_20261122.py`: 격리 MP3/FLAC 태그 적용·복구, 미승인 필드 차단, 파일명 변경 성공·차단 검사.
- GitHub Actions `Tag Editor scoped full-save fixture` 최신 PASS. 이미 합격한 재생, AI, 색인, UI 대규모 시험을 반복하지 않는다.

## NAS 운영 설치에 앞서 반드시 확인할 것

1. NAS Docker `music-gateway-music-gateway-1`의 현재 **실제 설치본** `/app/server.py`, `/app/tag_cover_http.py`, `/app/tag_phase2c.py`, `/app/tag_cover_h.py` 및 Folder Index API의 현재 SHA와 mount, Compose overlay. 메모리에 있는 과거 SHA를 현재 사실로 가정하지 않는다.
2. 원본 NAS `INDEX`와 Catalog Lease의 실제 개별 폴더 색인 함수, 인덱스 id/path 업데이트 방법, 음악 폴더 쓰기 권한을 **읽기 전용으로만** 확인. 이미 동작하는 수동 색인 엔진 재개발 금지.
3. 기존 백업 디렉터리 및 파일 보존 방식 유지. 원본 음악 파일/DB에 직접 수동 SQL 쓰기를 하지 않는다.
4. 개발 브랜치를 최신 `main`에 맞게 **국소적으로** 통합. 앨범 커버 아래 `정보 수정`·`태그 수정` 버튼, 태그 수정 클릭 시 해당 앨범 자동 선택, 왼쪽 아티스트 검색창 고정/리스트 스크롤, 행 구간 선택/2자리 번호 등 이미 게시된 기능 **절대 축소 금지**.
5. 필요한 최소 개발 코드와 실제 운영 서버 adapter를 준비하되, NAS에 설치 전엔 신규 환경 플래그 **OFF**, 자격 증빙 없는 전역 ON 금지.

## 완료에 필요한 실증

- 기존 격리 시험 PASS 결과 재사용.
- 신규 변경에 대해서만 NAS 격리된 별도 MP3/FLAC fixture 파일로 Cover add/replace/remove, full tag write, rename+정식 Catalog 갱신 및 restore.
- NAS 실제 관리자 API의 GET capability, plan, apply, 결과 재조회. 관리자 인증·Origin·Catalog Lease·충돌 검사 보존.
- 단일 승인된 시험 대상 이외 소급 적용·전체 음원 일괄 변경·전체 색인 실행 금지.
- 이름 충돌, 파일 해시 변경, Catalog 동기화 실패에는 쓰기 차단 또는 검증된 원복; 비정상 복구 시 HOLD.
- 브라우저에서 커버 저장·태그 저장·파일명 저장 버튼이 실제 동작하는지 확인(PC 우선, 모바일 영향 국소 확인). UI는 결과/실패 사유를 정확하게 표시.

## 게시 조건

**세 저장 기능 모두 구현·자체 국소 검증·NAS 운영 연결 PASS 후** GitHub Pages에 게시하고 `main` 배포 SUCCESS 확인. 저장 API는 NAS에 실제 설치·기동·검증된 경우에만 ON 표시. 불합격·NAS 연결 불가·실제 Catalog callback 불확실 시 게시 HOLD, 이유와 정확한 잔여 조건을 보고한다. 승인된 범위 내에서 추가 형식 승인 요청을 반복하지 않는다.

## 최종 결과물

`VinylRoom_TagEditor_FullSave_Final_Report_20261122.md`:
GitHub 최종 커밋, NAS 실제 설치본 SHA 및 Compose overlay, 3종 실제 저장 결과와 백업/복구 상태, Catalog path 확인, API 응답, PC/모바일 국소 검증, Pages 배포 ID/URL, 기존 UI 기능 보존, 미완료 항목. **PDF 불필요.**

**운영 기준:** 기존 엔진·AI·재생·다른 관리자 메뉴 변경 금지. 기존 합격 시험 재실행 금지. 실제 음원 대량 처리 금지. 프런트엔드 단독 게시로 완료를 사칭하지 않는다.
