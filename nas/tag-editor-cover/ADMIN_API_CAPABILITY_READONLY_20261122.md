# Vinyl Room Tag Editor — 관리자 저장 Capability 읽기 전용 확인

기준: 2026-11-22 / Work 중단 후 일반 채팅으로 인계.
Work의 NAS FULL_TAG/Rename 플래그 ON + Health 200 응답은 확인했으나, **관리자 인증을 거친 실제 capability 응답은 미확인**이다. 플래그 ON을 운영 저장 PASS로 인정하지 않는다.

## 실행 위치

이미 **관리자 계정으로 로그인한** https://jiondad.github.io/vinylroom/ 페이지의 브라우저 개발자 도구 콘솔(F12 → Console)에서만 다음을 실행한다.

- 동일 출처의 현재 게시된 release 모듈에서 기존 사용자 세션의 access token을 **메모리 내부에서만 사용**한다.
- 원격 코드/스크립트 추가 로딩 없음. NAS로 보내는 요청은 **GET 1회**. POST, PLAN, APPLY, 파일 쓰기 없음.
- 콘솔에는 **토큰/UUID/경로/개인정보를 출력하지 않고** 상태 코드 및 capability 허용값만 출력한다.
- 브라우저에서 기존 로그인 권한이 없으면 HOLD한다.

```javascript
(async () => {
  try {
    const script = [...document.querySelectorAll('script[type="module"][src]')]
      .find(s => /\/releases\/header-actions-[a-f0-9]+\/entry\.js(?:\?|$)/.test(s.src));
    if (!script) throw Error('현재 운영 release entrypoint를 찾지 못했습니다.');
    const root = new URL('./', script.src);
    const [{currentMemberToken},{NAS_URL}] = await Promise.all([
      import(new URL('playlists.js', root).href),
      import(new URL('config.js', root).href)
    ]);
    const response = await fetch(NAS_URL+'/v2/admin/tag-cover/save-capabilities', {
      method:'GET',
      headers:{Authorization:'Bearer '+await currentMemberToken()},
      credentials:'omit',
      cache:'no-store',
      redirect:'error'
    });
    const body = await response.json();
    const fields = ['state','version','tags','cover','rename','mp3_tags',
      'live_tags','tag_formats','tag_fields','rename_reason','reason'];
    const safe = {http_status:response.status};
    for (const key of fields) if (Object.hasOwn(body,key)) safe[key]=body[key];
    console.log('VINYL_FULL_SAVE_CAPABILITY_READONLY',JSON.stringify(safe,null,2));
  } catch (error) {
    console.log('VINYL_FULL_SAVE_CAPABILITY_HOLD',String(error?.message||error));
  }
})();
```

## 판정

- **HTTP 200 +** `tags:true,cover:true,rename:true,mp3_tags:true` 및 `tag_formats`에 `flac`,`mp3`: NAS 자격 영수증과 관리자 API 연결이 인식됨. 이후 단일 앨범 읽기 조회 및 `rename-plan`, `tag-plan`을 검토하되 **운영 파일 쓰기 전** 시험 대상/백업·restore 경로를 별도 확인.
- `rename:false` 또는 `mp3_tags:false`: 플래그 ON만 되었을 수 있음. 기존 NAS 격리 시험 재실행 대신 `fullsave-native-qualified.json` 영수증·서버 런타임 등록 경로와 운영 소스 해시를 **읽기 전용으로** 특정한다.
- HTTP 401/403: 기존 관리자 승인/Origin/세션 확인. 권한 우회 금지.
- HTTP 404/5xx 또는 연결 오류: 새 NAS adapter 설치/요청 라우팅/브라우저의 기존 CORS 경로 확인. 전역 ON 반복 금지.

**절대 조건:** 이 검사는 프로덕션 미디어·Catalog를 변경하지 않는다. `main` / GitHub Pages 저장 기능 확장은 세 경로의 실제 검증 전 게시 HOLD. 기존 Tag Editor UI, Top100 실시간 가사, 재생, 색인 등 보호.
