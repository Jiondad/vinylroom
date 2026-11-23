# Vinyl Room — 앨범 대표 커버 저장 UX 및 HTTP 409 대기열 보완

- 기준일: 2026-11-23
- 범위: Tag Editor 대표 커버 저장
- 기존 음원/DB 변경: 없음

## 사용자 관찰
27곡 상태 조회 후 저장 시 `HTTP 409 · /v2/admin/tag-cover/apply`가 발생했고 0곡 저장으로 종료되었다. 화면은 기존 커버 27곡, 새 대표 이미지와 기존 이미지가 서로 다름을 표시했다. 따라서 27곡 모두 교체 대상이며 저장 완료로 간주하지 않는다.

## 확인된 서버 원인
NAS의 `tag_cover_http.handle`은 `SLOTS`라는 전역 BoundedSemaphore를 non-blocking으로 획득한다. 다른 Tag Editor inspect/plan/apply 요청이 이 슬롯을 잠시 점유하면 저장 요청을 즉시 HTTP 409 `tag_editor_busy`로 거부한다. 파일 자체의 충돌이나 커버 이미지 오류와는 별개다.

## 프런트엔드 변경
- 앨범 대표 커버 저장의 브라우저 확인창 제거. 사용자가 저장 버튼을 누르면 바로 진행한다.
- 이미 선택한 새 이미지 SHA-256과 동일한 파일은 건너뛴다.
- HTTP 409만 최대 5회 재시도하며 대기 간격은 1/2/4/8초다.
- 그 외 오류는 재시도하지 않고 중단한다.
- 기존 파일별 계획, Writer 백업/CAS, 저장 후 동일 파일 검증은 유지한다.
- 모듈 캐시 버전 갱신.

## NAS 서버 변경
- cover apply route만 `SLOTS.acquire(timeout=30)`으로 최대 30초 대기한다.
- inspect/plan 및 다른 save route의 기존 동작은 바꾸지 않는다.
- 기존 runtime maintenance lease, file CAS, backup/verification은 그대로 유지한다.
- `nas/tag-editor-cover/deploy_busy_queue_patch.py`는 현재 컨테이너의 bind mount를 확인하고, 기존 소스 계약이 정확히 일치할 때만 백업 후 `tag_cover_http.py` 한 파일을 원자 교체한다. 컨테이너 정상 종료/기동 및 Health 200을 확인하고, 실패 시 이전 파일 복구를 시도한다.

## 시험
모의 API에서 27곡 중 2곡은 동일 이미지 SHA로 skip, 25곡은 저장 대상으로 계획. 첫 apply에 HTTP 409를 발생시킨 후 제한 재시도 성공을 확인했다.
- inspect 27
- plan 25
- apply 26 (최초 1회 409 후 재시도)
- 이미 동일한 2곡에 apply 요청 없음
- 확인창 호출 없음
- 실제 NAS 요청/음원 쓰기/DB 변경 0

## 배포 구분
프런트엔드는 GitHub Pages 자동 배포 대상이다. NAS Python 서버 파일은 GitHub Pages로 배포되지 않으며, 별도 NAS 설치 스크립트 실행이 필요하다. NAS 패치가 설치되기 전에도 프런트엔드의 제한 재시도는 동작하지만, 지속적인 슬롯 점유 409를 해소하려면 NAS 패치 설치가 필요하다.
