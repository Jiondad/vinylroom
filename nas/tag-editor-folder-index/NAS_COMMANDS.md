# Tag Editor Folder Index — NAS 설치 전 확인 및 별도 승인 후 명령

현재 승인 범위는 비운영 개발·패키지 준비뿐이다. 아래 **check만 읽기 전용**이다. install/restore는 이번 작업에서 실행하지 않았으며 각각 소스 변경·서비스 재생성에 대한 별도 승인이 필요하다. GitHub Pages 게시나 main 병합 명령은 제공·실행하지 않는다.

## 1. 패키지 확인 및 읽기 전용 check

ZIP을 `/volume1/docker/music-gateway/`에 올린 뒤:

```bash
cd /volume1/docker/music-gateway &&
python3 -m zipfile -e VinylRoom_TagEditor_FolderIndex_20261121.zip . &&
cd VinylRoom_TagEditor_FolderIndex_20261121 &&
sha256sum -c SHA256SUMS.txt
```

기존 `/v2/folders` 또는 Tag Editor에서 확인한 **정확한 상대 폴더 경로**를 지정한다. 실제 NAS의 Chet Baker 상위 장르 폴더명은 Work에서 확인하지 않았으므로 임의로 JAZZ/POP & ROCK을 가정하지 않는다.

```bash
TAG_EDITOR_FOLDER='여기에 실제 상대 폴더 경로'
python3 nas/tag-editor-cover/nas_folder_release.py check \
  --folder "$TAG_EDITOR_FOLDER" > FOLDER_INDEX_PREFLIGHT.json
cat FOLDER_INDEX_PREFLIGHT.json
```

check 내용:

- 실행 중 컨테이너 및 기존 Compose 4개(+이미 설치된 Phase H 마운트 오버라이드가 있으면 5개)의 경로·순서·프로젝트 확인
- 실행 중 환경변수와 현재 Compose 환경의 일치. 비밀값은 출력하지 않음
- 서버·모듈의 컨테이너 SHA, 실제 바인드 호스트 SHA 일치
- `server.py`의 기존 Phase H 관리자 라우터 훅과 `tag_cover_http.py`·`tag_phase2c.py` 기준 SHA 확인
- 기존 커버 Writer 소스 SHA 및 PID1 Writer OFF 확인
- 패키지 후보를 메모리에만 로드해 현재 Catalog 스키마와 기존 BINARY `album_path` 인덱스 확인
- 해당 폴더의 최대 21개 요약 행만 읽기 전용으로 조회. 전체 Catalog·JSON data·음원 읽기 없음
- query plan, 요약 수, 추가 페이지 여부와 Catalog 조회시간만 출력. 앨범/음원 경로 값은 출력하지 않음

운영 모듈을 파일로 설치하거나 `server.py`를 import하지 않는다. 서버·스케줄러·AI를 실행하지 않는다. Catalog는 기존 `mode=ro`, `query_only=ON` 계약으로 연다. 실제 HTTP는 하지 않으므로 출력의 `catalog_query_ms`를 기존 브라우저 HTTP 487ms와 직접 비교하면 안 된다.

성공 시 `READY_FOR_SEPARATE_APPROVAL`. **NAS에서 이 출력이 나오기 전에는 설치 적격 확인 완료로 보지 않는다.**

모듈이 없거나 SHA·훅·스키마·인덱스·환경·바인드가 다르면 HOLD. 현재 운영 소스에 자동 병합하지 않는다. `runtime_HOLD:operating_module_baseline_mismatch:...`이면 해당 실제 소스와 SHA를 확보해 개발 기준을 다시 맞춰야 한다. 인덱스가 없다고 새 인덱스를 만들지 않는다.

## 2. 별도 설치 승인 후에만 사용

아래는 **미실행 승인 대기 명령**이다. 유휴 상태는 운영자가 실제 확인해야 하며 도구가 AI·색인 설정을 변경하거나 진행 중 작업을 강제 종료하지 않는다.

```bash
python3 nas/tag-editor-cover/nas_folder_release.py install \
  --folder "$TAG_EDITOR_FOLDER" \
  --approved-check FOLDER_INDEX_PREFLIGHT.json \
  --approve-source-install --approve-service-recreate --confirm-maintenance-idle
```

기존 두 파일의 바인드 호스트 원본만 백업 후 교체한다: `tag_phase2c.py`, `tag_cover_http.py`.

- `server.py`, `index_engine.py`, `tag_cover_h.py` 변경 없음
- 새 모듈·새 마운트·새 Compose 설정 추가 없음
- 기존 Compose 파일과 환경변수 그대로 사용
- 기존 SIGTERM 60초 정상 종료(exit 0) → 같은 파일 목록으로 해당 서비스만 `up -d --no-deps --no-build --pull never --force-recreate music-gateway`
- 개별 파일 바인드의 원자적 교체 후에는 단순 `docker start`로 갱신됐다고 가정하지 않음
- 기존 이미지 ID·런타임·보호 소스·Health 200·Writer OFF 확인

백업 디렉터리는 `SOURCE_BACKUP_READY`에 출력된다. 실패 시 자동 반복·무조건 재시작하지 않는다. 원본 before/after SHA와 백업을 보존한다. 재생성 후 기존에 켜져 있던 스케줄은 기존 설정대로 동작할 수 있다. 이번 도구가 AI를 호출하거나 활성화하는 것은 아니다.

## 3. 별도 승인 후 읽기 전용 기능 확인

설치 승인 후에도 프론트엔드는 자동 게시하지 않는다. 승인된 관리자 API 브리지를 사용하는 개발 화면에서 다음 경로를 한 번 조회한다.

`GET /v2/admin/tag-cover/folder-albums?path=<정확한 상대 폴더>&limit=50`

서버의 기존 인증·Origin·CORS 계약을 유지한다. 관리자 토큰을 iframe이나 명령줄 인수로 전달하지 않는다. 응답 `state=READ_ONLY_FOLDER_ALBUMS`, `version=tag-folder-index-v1`을 확인한다. `has_more`이면 cursor로 이어서 조회한다. 프론트엔드는 기존 참조 엔진과 같은 50개 단위, 최대 4페이지(200개)까지만 받고 `truncated=true`로 미완료 범위를 명시한다.

실측 시 구분할 값:

1. 폴더 탐색 `/v2/folders` 1회(기존 기능)
2. 20개 요약의 folder-albums 1회, `/v2/admin-album` 0회
3. 실제 앨범 클릭 후 `/v2/admin-album` 1회(필요 시 기존 단일 커버 이미지 조회는 별도)
4. 각 API 응답 대기시간과 트랙 DOM 표시시간

기존 7/7 또는 신규 개발 검사를 NAS에서 다시 돌리지 않는다.

## 4. 별도 승인 후 원복

최초 출력된 백업 경로를 사용한다. 패키지/원본 기준과 일치하지 않으면 원복도 CAS HOLD하며 임의 덮어쓰지 않는다.

```bash
python3 nas/tag-editor-cover/nas_folder_release.py restore \
  --backup-dir /실제로/출력된/백업경로 \
  --approve-source-install --approve-service-recreate --confirm-maintenance-idle
```

두 원본 모듈을 복구하고 기존 Compose 파일 목록 그대로 서비스를 재생성한다. Health 200·원본 SHA·Writer OFF를 확인한다. Compose·DB·음원·AI 원장 복구는 수행하지 않는다(수정한 적 없음).

현재 개발 프론트엔드가 나중에 게시된 경우에는 해당 어댑터도 이전 브랜치 버전으로 되돌려야 한다. 백엔드만 원복한 새 어댑터는 상세 폴백을 하지 않고 API 준비 안내로 중단한다. 현재는 운영 프론트엔드 미게시이므로 운영 프론트엔드 원복 대상도 없다.
