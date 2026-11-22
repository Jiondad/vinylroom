# Full Save NAS 연결 — 현재는 설치 및 게시 HOLD

이 브랜치는 전체 태그·커버·Rename 저장 연결 후보입니다. 실제 NAS 파일을 과거 GitHub 파일로 덮어쓰는 설치 패키지가 아닙니다.

## 현재까지 재사용/개발한 사항

- 기존 Phase H MP3/FLAC 커버 Writer·백업·복구는 변경하지 않았습니다.
- 기존 전체 필드 Writer와 필드별 자격 검증을 유지하고 ID3v2.3 다중 값·ID3v1 원본 보존을 보완했습니다.
- Rename plan/apply/restore 및 관리자 HTTP 연결, 프런트엔드 저장 연결, 원본 태그와 변경 초안 보존을 구현했습니다.
- 파일 이동은 RENAME_NOREPLACE. 파일 SHA/CAS, 동일 부모 폴더, 정규화·대소문자 충돌, 백업·감사를 적용합니다.
- 실패 시 파일 원복뿐 아니라 Catalog의 원본 상대 경로 복구도 검증합니다. 원복이 입증되지 않으면 HOLD_MANUAL_RECOVERY입니다.

## NAS 현재 설치본 확인

`nas_fullsave_contract_readonly.py`를 NAS에 업로드한 뒤 실행합니다.

```bash
cd /volume1/docker/music-gateway
python3 nas_fullsave_contract_readonly.py > NAS_FULLSAVE_CONTRACT.json
```

이 도구는 현재 실행 중인 컨테이너의 소스 SHA, 개별 마운트, Compose 파일 경로, Writer 플래그, INDEX의 기존 함수와 Catalog Lease 구현만 stdout으로 출력합니다. 서버/AI 애플리케이션 모듈을 import하지 않고 SQL·음원 접근·재시작·설정을 실행하지 않습니다. `NAS_FULLSAVE_CONTRACT.json`은 운영 파일을 포함한 전체 서버 덤프가 아니라 저장/색인 연결 부분으로 제한된 증거입니다.

## 실제 어댑터에서 확인할 조건

`configure_save_context`에 설치된 기존 runtime guard를 그대로 유지합니다. 추가 Rename 연결은 서버 내부 `configure_rename_context(native_reindex_callback, qualification_passed=True)` 인터페이스를 사용합니다. 이는 HTTP에서 호출할 수 없습니다.

native callback은 **현재 설치된 기존 정식 개별/폴더 색인 경로를 동기적으로** 호출해야 합니다. 전체 Rename 실행을 감싼 기존 Catalog Lease가 색인 완료까지 유지되어야 합니다. queue에 넣고 즉시 반환하거나 수동 SQL로 paths만 수정하는 구현은 허용하지 않습니다. 별도 스레드가 같은 Lease를 기다리는 구조도 허용하지 않습니다.

기존 `enqueue`가 queue 삽입만 지원하는지, 동기 실행 분기가 있는지와 중첩 Lease의 현재 계약은 실제 설치 소스로 확인해야 합니다. 이 증거가 없으므로 이 패키지는 추정으로 native adapter를 생성하거나 신규 플래그를 ON하지 않습니다.

## 운영 적용 조건

1. 현재 NAS 소스·mount·Compose 증거를 받아 정확한 baseline SHA 고정.
2. Folder Index 및 실제 runtime guard를 보존하는 국소 어댑터 작성.
3. NAS의 별도 fixture MP3/FLAC에서 신규 연결만 실행: cover add/replace/remove, 전체 태그, rename+정식 색인+restore. 기존 합격 시험은 재사용.
4. 실제 관리자 API capability/plan/apply/동일 파일 재조회 및 복구 확인.
5. 세 기능 모두 PASS한 경우에만 신규 full-tags/Rename 플래그 활성화와 main/Pages 게시.

확인 전에는 `VINYL_TAG_EDITOR_FULL_TAG_WRITE_ENABLED`, `VINYL_TAG_EDITOR_RENAME_WRITE_ENABLED`를 새로 ON하지 않습니다. 기존 운영 태그·커버 기능이나 ON/OFF 설정을 이 문서로 변경하지 않습니다.
