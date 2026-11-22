# NAS native full-save — 최소 실행 명령

이전 계약 조회는 반복하지 않습니다. 현재 6개 원본 SHA를 다시 확인하는 것은 **설치 직전 CAS**입니다. SHA·Compose·함수 계약이 바뀌면 HOLD하며 원본을 덮어쓰지 않습니다. 기존 태그·커버 ON은 유지하고 신규 전체 태그/Rename은 자격 시험 전 OFF입니다.

## 1. 준비 — 운영 소스/DB/음원 변경 없음

ZIP을 `/volume1/docker/music-gateway`에 올린 뒤 실행합니다. 같은 이름의 패키지/단계 폴더가 이미 있으면 새로 덮어쓰지 마십시오.

```bash
cd /volume1/docker/music-gateway
python3 -m zipfile -e VinylRoom_TagEditor_Native_FullSave_20261122.zip .
cd VinylRoom_TagEditor_Native_FullSave_20261122
sha256sum -c SHA256SUMS.txt &&
python3 nas_native_fullsave_release.py prepare --stage /volume1/docker/music-gateway/tag-editor-fullsave-native-20261122 &&
python3 nas_native_fullsave_release.py check --stage /volume1/docker/music-gateway/tag-editor-fullsave-native-20261122
```

`PREPARED_NOT_INSTALLED` → `CANDIDATE_INTEGRITY_PASS`여야 합니다. 기존 서버의 등록 호출이 예상 AST 구조와 다르거나 Folder Index 확장이 알려진 경계 밖에 있으면 준비 단계에서 HOLD합니다. 이때 install로 진행하지 않습니다.

## 2. 최소 설치 및 신규 NAS 격리 시험

재생/수동 색인/태그 저장을 잠시 멈춘 유지보수 시점에 실행합니다. 기존 Catalog lock과 최근 500개 작업 상태를 읽어 idle을 확인합니다. 설치는 컨테이너를 기존 Compose 체인에 추가 오버라이드 1개를 붙여 재생성합니다. 원본 파일은 수정하지 않습니다.

```bash
python3 nas_native_fullsave_release.py install --stage /volume1/docker/music-gateway/tag-editor-fullsave-native-20261122 --confirm-maintenance-idle &&
python3 nas_native_fullsave_release.py qualify --stage /volume1/docker/music-gateway/tag-editor-fullsave-native-20261122
```

설치 결과: `INSTALLED_NEW_FLAGS_OFF`, Health 200. 신규 full-tags/Rename OFF.

격리 시험: `NAS_ISOLATED_QUALIFICATION_PASS`. 같은 NAS 이미지와 실제 Index/Lease 코드를 사용하지만, 별도 fixture 음악/DB만 마운트하고 네트워크를 차단합니다. 서버 및 AI Worker는 실행하지 않습니다. fixture 스캐너는 시험 음원 태그만 읽는 대역입니다. 실제 운영 스캐너·관리자 HTTP 인증 경로의 통과를 대신하지 않습니다.

성공 보고서는 단계 폴더의 `qualification/qualification.json`에 남습니다. 실패 시 신규 Writer는 OFF를 유지하며 **동일 시험 명령을 무조건 반복하지 않습니다**.

## 3. 자격 성공 후 신규 플래그 적용

새로운 승인 요청이 아닙니다. 기존 사용자 승인 범위이며, 위 실제 NAS 자격 결과와 8개 현재 코드 해시가 모두 맞아야만 실행됩니다.

```bash
python3 nas_native_fullsave_release.py enable --stage /volume1/docker/music-gateway/tag-editor-fullsave-native-20261122 --confirm-maintenance-idle
```

`FLAGS_APPLIED_ADMIN_API_VERIFICATION_PENDING`은 **운영 저장 PASS가 아닙니다**. 전용 백업 폴더의 소유자/권한과 실제 소스 해시가 맞는 자격 영수증을 서버가 읽어야 capability가 열립니다. 기존 자격 영수증이 있으면 덮어쓰지 않고 HOLD합니다.

이후 기존 관리자 로그인으로 capability, plan, 승인된 시험 대상 apply, 동일 파일 재조회를 확인해야 합니다. 운영 음원 전체에 시험 쓰기를 하지 마십시오. 현재 Work는 NAS 로그인 세션·승인된 시험 앨범 UUID를 확보하지 못했으므로 이 마지막 실행을 완료로 표시하지 않습니다. 실제 API에 새 기능이 나타나지 않으면 설치/등록 실패를 숨겨 ON으로 표시하지 않습니다.

## 4. 소스·Compose 원복

```bash
python3 nas_native_fullsave_release.py rollback --stage /volume1/docker/music-gateway/tag-editor-fullsave-native-20261122 --confirm-maintenance-idle
```

기존 Compose 8개만 사용해 재생성하고 Health 200을 확인합니다. 원본 SHA가 달라졌으면 HOLD합니다. 이 명령은 **소스·설정 원복**이며 이미 저장된 음원 복구 명령이 아닙니다. 파일별 저장 복구는 기존 operation ID와 Writer restore 경로를 사용합니다. 백업·감사·시험 결과는 삭제하지 않습니다.

## 경계

- `prepare/check`는 설치·운영 DB·음원 쓰기 없음. 준비 산출물은 새 단계 폴더만 기록.
- `install/enable/rollback`은 명시적 NAS 운영 명령으로 컨테이너 재생성 포함.
- `qualify`는 임시 Docker 컨테이너 1개를 사용하고 종료 시 제거. 기존 서비스나 DB는 추가하지 않음.
- Gemini·Confidence70·AI 커서·Folder Index·0.jpg 정책·다른 Compose 환경변수는 변경하지 않음.
- 세 저장 경로의 실제 NAS 연결 및 관리자 실증 전까지 main/Pages 게시 HOLD.
