# Vinyl Room — Tag Editor 조회 복구 + 3종 저장 동시 적용

**2026-11-22 / 현재 실제 NAS 운영 상태 기준**

## 현재 확인된 사실 (재시험 금지)
- NAS qualified receipt PASS. 현재 `tag_phase2c.py`, `tag_cover_http.py`는 receipt SHA256 MATCH.
- 관리자 `save-capabilities`: HTTP 200, cover/tags/rename/mp3_tags/live_tags 모두 true, FLAC·MP3 및 9개 필드.
- WHEE: 태그/파일명/커버 read-only plan 3/3 PASS; 실제 운영 음원 쓰기 없음.
- 기존 isolated HTTP writer→apply→reread→restore, native qualification 및 저장 경로 검증 PASS 재사용.
- Lee Moon Sae — Memories: `nested_directory_below_disc` 2개로 **읽기용 트랙 조회 HOLD**.
- 후보 소스에서 조회 전용 non-audio ancillary 폴더 허용 패치는 7/7 PASS (Actions 45020377316), NAS 미설치.

## 목표
1. Lee Moon Sae 등 합법적 디스크 부속자료 폴더가 포함된 앨범의 **실제 트랙 조회 복구**.
2. 기존 활성화된 MP3/FLAC **커버 저장, 9종 태그 저장, 파일명 Rename + Catalog 동기 색인** 능력을 유지.
3. 최종 운영 관리자 UI에서 세 버튼의 실제 가용성 확인.
4. 최초 실제 저장·재조회·복구는 **승인된 격리 대상에서만** 수행하고 운영 WHEE/Lee Moon Sae 원본은 변경하지 않는다.

## 절대 금지
- 운영 `candidate/tag_phase2c.py`, `candidate/tag_cover_http.py` 직접 덮어쓰기.
- 현재 `/tag-editor-backups/fullsave-native-qualified.json` 영수증의 해시를 단순 재계산해서 재서명, 무검증 대체.
- 다른 Compose·Catalog·음원·AI 작업 개입, 기합격 시험의 불필요한 반복.
- 새 소스의 원본 SHA와 receipt 불일치 상태로 재시작/게시.

## 단계 1 — 자격 보호되는 신규 후보만 준비 (현재 실행 가능한 안전 작업)

`stage_nested_aux_readonly_nas.py`는 현재 운영에서 자격 인정된 두 원본을 읽고 앵커를 최소 변경하여, **새 stage 디렉터리**에만 수정 후보와 원본/새 SHA 목록을 남긴다. 운영 소스/영수증/Compose/DB/음원 쓰기 0.

```bash
cd /volume1/docker/music-gateway
curl -fLsS --retry 2 -o /tmp/stage_nested_aux_readonly_nas.py \
  https://raw.githubusercontent.com/Jiondad/vinylroom/feature/tag-editor-complete-save-20261122/nas/tag-editor-cover/stage_nested_aux_readonly_nas.py
python3 -m py_compile /tmp/stage_nested_aux_readonly_nas.py
python3 /tmp/stage_nested_aux_readonly_nas.py \
  --stage /volume1/docker/music-gateway/tag-editor-nested-aux-stage-20261122
```

실행 성공 표시는 `NESTED_AUX_STAGE_ONLY_NOT_INSTALLED` + `production_changes:0`. **이 단계에서 서비스의 오류는 아직 해소되지 않는다.**

## 단계 2 — 기존 3종 저장 보호형 신규 자격/전환 설계 필요

현재 백업 영역 owner-only 자격 영수증은 `server.py`, `index_engine.py`, `catalog_lease.py`, `tag_cover_http.py`, `tag_phase2c.py`, `tag_cover_h.py`, `tag_rename_writer.py`, `tag_native_index.py` **8개 소스의 SHA**를 검증한다. 두 소스 변경만으로도 MP3 전체 태그 저장과 Rename이 비활성화될 수 있다.

- **이중 자격/원복을 지원하는 새 배포 어댑터**를 별도 구현·검증한다. 새 후보로 변경 부분만 NAS 격리 검증을 수행하고 새 영수증을 신뢰할 수 있게 발급.
- 기존 영수증을 우회하거나 수동으로 새 해시를 채운 영수증을 PASS로 간주하지 않는다.
- 동일 유지보수 시점에 두 신규 bind와 새 검증된 영수증을 **일관되게 전환**. Health 200 + 기존 admin capability 모두 true + Lee Moon Sae GET `ACTUAL_ALBUM_TAGS` 확인.
- 실패 시 기존 bind와 기존 영수증을 함께 되돌린 후 Health+capability 확인.

## 보존된 3종 저장과 잔여 경계

커버 Writer와 태그 Writer, Native Rename은 별도 독립 재개발이 필요 없다. 현재 일반 앨범에 대한 자격은 이미 존재한다. 그러나 **이문세처럼 CD 아래 하위 폴더가 있는 앨범은 조회 복구 패치 후에도 실제 저장 plan/apply가 여전히 HOLD될 수 있다**. 이번 단계의 조회 패치는 의도적으로 저장용 `inventory` 기본 제한을 변경하지 않았다. 이 앨범까지 저장하게 하려면 해당 앨범의 안전한 파일 트리 경계를 CAS/lease와 연동해 명시적으로 확장한 별도 범위 검증이 필요하다. 이를 숨기고 저장 완료라고 보고하지 않는다.

**작업 판정:** Existing 3 save capabilities qualified; new read-only patch staged only; NAS qualified coordinated switching + Lee Moon Sae verification pending.
