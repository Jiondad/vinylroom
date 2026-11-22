# Full Save NAS 연결 — native adapter 개발 완료 / 운영 확인 대기

2026-11-22 실제 NAS 계약 첨부 결과를 반영했습니다. 과거 계약 재조회 단계는 완료됐습니다.

- 현재 원본 SHA 고정, 기존 Compose 8개 보존.
- 기존 Index.enqueue에 `synchronous=False` 선택 인자만 추가. 동기 분기는 같은 스레드의 기존 execute_job을 호출하고 큐에 중복 등록하지 않습니다.
- 기존 Catalog Lease 안에서 단일 앨범 native 색인 및 새 상대 경로 재조회.
- Folder Index 원문 prefix 보존. 예상 외 설치 확장은 HOLD.
- NAS 신규 전체 태그/Rename은 격리 자격 시험 및 실제 소스 해시 영수증으로 제한.
- 기존 태그·커버 ON은 유지. 실제 관리자 API·파일 저장 확인 전에는 운영 PASS 또는 Pages 게시를 주장하지 않습니다.

구체적인 설치·격리 시험·자격 적용·원복 명령: [NAS_NATIVE_FULLSAVE_COMMANDS.md](NAS_NATIVE_FULLSAVE_COMMANDS.md).
