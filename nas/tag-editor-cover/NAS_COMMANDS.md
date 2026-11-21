# Phase H NAS 최소 설치 및 원복

운영 음원 쓰기·Catalog/AI DB 변경·커버 정책 변경은 없습니다. 이번 API의 apply/restore는 서버에서 항상 405로 차단됩니다. 기존 Confidence70 및 Gemini 설정을 변경하지 않습니다.

## 1. 준비 및 읽기 전용 확인

패키지를 `/volume1/docker/music-gateway`에 올립니다.

```bash
cd /volume1/docker/music-gateway
python3 -m zipfile -e VinylRoom_TagEditor_PhaseH_Integration_20261121.zip .
cd VinylRoom_TagEditor_PhaseH_Integration_20261121/nas/tag-editor-cover
sha256sum -c SHA256SUMS.txt
python3 nas_phaseh_release.py check > PHASE_H_SOURCE_CHECK.json
cat PHASE_H_SOURCE_CHECK.json
```

`SOURCE_READY_FOR_APPROVAL`, `cover_write=unset/false/off/0`, 현재 server SHA 및 호스트 마운트 매핑이 확인되어야 합니다. 의도하지 않은 파일 충돌·구조 불일치·마운트 누락이면 HOLD합니다. 실제 설치본 전체를 추측해 교체하지 않습니다.

## 2. 소스 설치

기존 색인·AI·태그 작업이 유휴 상태인 유지보수 시점에만 실행합니다. 기존 SIGTERM 정상 종료 계약을 이용하며 ExitCode 0이 아니면 소스 교체 전에 중단합니다.

```bash
python3 nas_phaseh_release.py install --approved-check PHASE_H_SOURCE_CHECK.json --approve-source-install --confirm-maintenance-idle
python3 nas_phaseh_release.py check
```

`SOURCE_BACKUP_READY` 출력에 백업 경로가 먼저 표시됩니다. 최종 `PHASE_H_INSTALLED_WRITE_OFF`, `health=200`을 확인합니다. 커버 쓰기 환경변수를 설정하지 않습니다. 실제 DB/음원 변경은 하지 않습니다. 구동 포트/Health가 현재 계약(컨테이너 내부 8787/health)과 다르면 임의 변경하지 않고 HOLD합니다.

## 3. 원복

설치 출력의 `backup_dir`를 사용합니다. 원본/설치 후 SHA만 허용해 중간 실패 상태도 복구하되 외부 소스 변경은 덮어쓰지 않습니다.

```bash
python3 nas_phaseh_release.py restore --backup-dir '설치_출력의_backup_dir' --approve-source-install --confirm-maintenance-idle
```

프로그램이 비정상 종료로 컨테이너를 멈춘 경우 자동으로 정상 종료로 간주하지 않습니다. 소스 상태와 출력 원인을 확인한 뒤 위 복구만 진행합니다. 백업은 자동 삭제하지 않습니다.

## 4. 프론트엔드 게시 조건

현재 GitHub 개발 브랜치에 UI가 준비되어 있지만 아직 main에 게시하지 않습니다. NAS 설치 후 운영 관리자 세션에서 실제 `/v2/admin/tag-cover/inspect` 응답을 확인한 뒤 기존 Pages 배포 절차로 게시합니다. GitHub Pages에 Python 서버를 올리지 않습니다.

확인할 출력: `EMBEDDED_COVER_INSPECTED`, `source=actual_audio_embedded_front`, `write_enabled=false`, 파일 SHA/원본 커버 SHA. 이 응답은 NAS 원본 파일 읽기이므로 앨범 색인 커버/폴더 0.jpg와 다릅니다.

## 5. 계획과 실제 쓰기 구분

- GET `/v2/admin/tag-cover/inspect?album_id=<UUID>&file=<Catalog 앨범 아래 상대경로>`: 관리자 인증 후 FLAC/MP3 현재 파일 읽기.
- POST `/v2/admin/tag-cover/plan`: 관리자·Origin·선택된 파일·현재 SHA·Catalog digest·이미지 검사. 업로드 이미지는 보호된 임시 디렉터리에서 계획 계산 후 즉시 삭제.
- `/v2/admin/tag-cover/apply`, `/restore`: 환경변수와 무관하게 HTTP 405. 이번 프론트엔드에는 apply 호출이 없음.
- 향후 쓰기 승인 시에만 기존 Phase H 단일 파일 Writer를 별도로 연결. 이 단계에서 활성화하지 않음.
