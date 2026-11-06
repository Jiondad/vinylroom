import {aiOperationStatus,renderAiOperationStatus} from './ai-operation-status.js';
import {attachReviewToAdminPanel} from './admin-ai-review-panel.js';
import {REVIEW_ENDPOINT} from './admin-ai-review-report.js';
import {mountProposalReview} from './ai-proposal-review.js';
/** Vinyl Room preview administrator center. No automatic writes or Gemini requests. */
import {NAS_URL,DEFAULT_SUPABASE_URL,DEFAULT_SUPABASE_KEY} from './config.js';
import {catalogSummary,displayCount,memberCounts,selectMembers,splitMembersByRole,validateMemberProfile} from './admin-summary.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function classifyAiApiError(error){
 const raw=error?.status??error?.response?.status??error?.statusCode;
 const status=raw==null?null:Number(raw);
 if(Number.isInteger(status)){
  if(status===400)return {state:'요청 오류',detail:'HTTP 400'};
  if(status===401)return {state:'인증 필요',detail:'HTTP 401'};
  if(status===403)return {state:'접근 거부',detail:'HTTP 403'};
  if(status===404)return {state:'미지원',detail:'HTTP 404'};
  if(status===503)return {state:'서버 오류',detail:'HTTP 503 · 일시적 서비스 오류'};
  if(status>=500)return {state:'서버 오류',detail:'HTTP '+status};
  if(status>=400)return {state:'요청 실패',detail:'HTTP '+status};
 }
 const message=String(error?.message||'');
 if(error?.name==='TypeError'||/failed to fetch|networkerror|load failed|network request failed/i.test(message))return {state:'네트워크 연결 실패',detail:'HTTP 응답을 받지 못했습니다.'};
 return {state:'원인 미확정',detail:'요청 결과를 확인할 수 없습니다.'};
}
export function listResultCount(data){
 if(Array.isArray(data))return {known:true,count:data.length};
 if(!data||typeof data!=='object')return {known:false,count:null};
 for(const key of ['items','results','albums','proposals'])if(Array.isArray(data[key]))return {known:true,count:data[key].length};
 return {known:false,count:null};
}

export function summaryResponseState(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return 'invalid';
 return Object.keys(data).length?'received':'empty';
}
let dismissCurrent=null;
export function closeAdminCenter(){dismissCurrent?.();}
export function mountAdminCenter({canManage,getAccessToken,openMembers,openIndexing,openPlaybackDiagnostics,api}={}){
 if(!canManage?.())throw Error('승인된 관리자만 이용할 수 있습니다.');
 dismissCurrent?.();
 const page=document.createElement('section');page.id='vinyl-admin-center';page.className='vinyl-admin-page';
 page.setAttribute('aria-label','Vinyl Room Admin');
 page.innerHTML=`<div class="vr-admin-inner"><header class="vr-admin-header"><div><p>VINYL ROOM / ADMIN</p><h1>Admin</h1></div><button type="button" data-close>← 앨범으로</button></header>
 <nav class="vr-admin-tabs" aria-label="관리자 메뉴">
  <button type="button" data-tab="members" aria-current="page"><strong>회원 관리</strong><small>승인 · 권한 · 접속 통계</small></button>
  <button type="button" data-tab="analysis" aria-current="false"><strong>앨범 분석 관리</strong><small>색인 · AI · API · 정합성</small></button>
  <button type="button" data-tab="catalog" aria-current="false"><strong>앨범 통계 관리</strong><small>소장 현황 · 변화 추이</small></button>
 </nav>
 <p class="vr-admin-status" role="status" aria-live="polite"></p>
 <section data-pane="members">
  <div class="vr-admin-section-head"><div><h2>회원 관리</h2><p>가입 승인, 계정 상태 및 권한과 접속 활동을 관리합니다.</p></div><button data-action="members">회원 승인·권한 관리 ↗</button></div>
  <div class="vr-admin-section-head"><h3>회원 접속 기록</h3><button data-action="stats">기록 연결 확인</button></div>
  <div data-access-result><p>최근 7일·30일 활동 회원과 회원별 마지막 활동 기록을 표시합니다. 별도 DB 설치 이전에는 통계 수집을 시작하지 않습니다.</p></div>
 </section>
 <section data-pane="analysis" hidden>
  <div class="vr-admin-section-head"><div><h2>앨범 분석 관리</h2><p>AI 분석 현황부터 분류 제안, 검토 이력, 연동 상태까지 순서대로 확인합니다. 조회만으로 분석·승인·적용이 실행되지 않습니다.</p></div></div>
  <nav class="vr-ai-section-nav" aria-label="AI 관리 목차" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 20px">
   <a href="#vr-ai-overview" data-ai-jump="vr-ai-overview">01 현황</a>
   <a href="#vr-ai-review" data-ai-jump="vr-ai-review">02 AI 앨범 분류 관리</a>
   <a href="#vr-ai-connection" data-ai-jump="vr-ai-connection">03 API 연동</a>
   <a href="#vr-ai-index" data-ai-jump="vr-ai-index">04 색인·정합성</a>
  </nav>
  <section id="vr-ai-overview" class="vr-admin-caution" aria-label="AI 분석 현황">
   <div class="vr-admin-section-head"><div><h3>01 · AI 분석 현황</h3><p>기존 NAS가 제공하는 분석 대상, 작업 상태 및 호출 한도를 조회합니다. 수치는 서버 응답만 표시합니다.</p></div><button type="button" data-action="ai-summary">현황 조회</button></div>
   <p><button type="button" data-action="ai-operations">기존 분석 작업·한도 관리</button></p><div data-ai-summary-result role="status" aria-live="polite"><p>아직 조회하지 않았습니다.</p></div>
  </section>
  <section id="vr-ai-review" class="vr-admin-caution" aria-label="AI 분류 제안 및 검토">
   <div class="vr-admin-section-head"><div><h3>02 · AI 앨범 분류 관리</h3><p>앨범별 현재값·AI 후보·신뢰도 근거를 확인합니다. 초안 저장은 NAS 연결 확인 후 사용할 수 있습니다. 확정·Catalog 반영은 차단됩니다.</p></div><button type="button" data-action="ai">AI 앨범 분류 관리 열기</button></div>
   <div data-ai-review-result aria-live="polite"><p>제안·검토 조회를 누르면 NAS의 실제 AI 제안을 불러옵니다.</p></div>
   <details><summary>Pilot 참고 보고서</summary><div data-ai-pilot-report></div></details>
  </section>
  <section id="vr-ai-connection" class="vr-admin-caution" aria-label="AI 연동 및 API 상태">
   <div class="vr-admin-section-head"><div><h3>03 · AI 연동·API 상태</h3><p>기본 NAS 조회, 분류 결과, 검토 API 및 전달 상태를 점검합니다. 인증 정보와 원본 응답은 표시하지 않습니다.</p></div><button type="button" data-action="ai-api">연결 상태 조회</button></div>
   <div data-ai-api-status role="status" aria-live="polite"><p>아직 조회하지 않았습니다.</p></div>
  </section>
  <section id="vr-ai-index" class="vr-admin-caution" aria-label="색인 및 데이터 정합성">
   <div class="vr-admin-section-head"><div><h3>04 · 색인·정합성</h3><p>기존 NAS 파일 색인은 AI 분류와 별개로 관리합니다. 정합성 자동 검토는 준비 단계입니다.</p></div></div>
   <div class="vr-admin-cards">
    <article><small>INDEX</small><h3>수동 색인</h3><p>변경분 색인, 진행 상태 및 로그를 기존 화면에서 확인합니다.</p><button type="button" data-action="indexing">기존 색인 관리 열기 ↗</button></article>
    <article><small>QUALITY</small><h3>정합성 점검</h3><p>앨범명·날짜·판본·멀티 CD 오류 후보의 별도 검토 기능입니다.</p><button type="button" disabled>기능 준비 중</button></article>
   </div>
   <button type="button" data-action="catalog">기존 카탈로그 상태 조회</button>
   <p><button type="button" data-action="playback-diagnostics">재생 진단 로그 · Chrome 잠금화면</button></p>
  </section>
 </section>
 <section data-pane="catalog" hidden>
  <div class="vr-admin-section-head"><div><h2>앨범 통계 관리</h2><p>NAS 카탈로그의 실제 집계만 표시합니다.</p></div><button data-action="catalog">새로고침</button></div>
  <div data-catalog-result><p>아직 통계를 조회하지 않았습니다.</p></div>
  <p class="vr-admin-caution">장르별·연대별 집계는 조회 API가 확인된 이후에 제공합니다. 추정 통계는 표시하지 않습니다.</p>
 </section></div>`;

 // AI_VIEW_COMPACT_20261106: simplify presentation only; existing API actions stay intact.
 const analysisPane=page.querySelector('[data-pane="analysis"]');
 analysisPane.querySelector('.vr-ai-section-nav')?.remove();
 const analysisHead=analysisPane.querySelector(':scope > .vr-admin-section-head');
 analysisHead.querySelector('h2').textContent='AI 앨범 분석';
 analysisHead.querySelector('p').textContent='분석 현황과 검토할 항목을 확인합니다.';
 const overviewHead=analysisPane.querySelector('#vr-ai-overview .vr-admin-section-head');
 overviewHead.querySelector('h3').textContent='분석 현황';
 overviewHead.querySelector('p').remove();
 overviewHead.querySelector('[data-action="ai-summary"]').textContent='새로고침';
 const reviewHead=analysisPane.querySelector('#vr-ai-review .vr-admin-section-head');
 reviewHead.querySelector('h3').textContent='AI 제안 검토';
 reviewHead.querySelector('p').textContent='분석 결과를 비교하고 검토 이력을 확인합니다.';
 reviewHead.querySelector('[data-action="ai"]').textContent='검토 화면 열기';
 const operationButton=analysisPane.querySelector('#vr-ai-overview [data-action="ai-operations"]');
 operationButton.closest('p').remove();
 const support=document.createElement('section');support.className='vr-ai-support';
 support.innerHTML='<h3>운영 도구</h3><div class="vr-ai-support-body"></div>';
 const supportBody=support.querySelector('.vr-ai-support-body');
 operationButton.textContent='작업·한도 설정';
 supportBody.append(operationButton);
 supportBody.append(analysisPane.querySelector('#vr-ai-connection'));
 supportBody.append(analysisPane.querySelector('#vr-ai-index'));
 analysisPane.append(support);
 // Historical pilot reference is retained in source but not displayed as a nested accordion.
 const report=analysisPane.querySelector('#vr-ai-review details');
 if(report)report.hidden=true;
 reviewHead.querySelector('[data-action="ai"]').remove();
 analysisPane.querySelector('#vr-ai-review [data-ai-review-result]').firstElementChild.textContent='분석 제안을 불러오는 중…';

 // VINYLROOM_ADMIN_UX_V2: compact page, actual read-only member snapshot, no writes.
 const mode='<div class="vr-preview-mode"><strong>회원 관리</strong><span>관리자와 일반 회원을 구분하여 조회합니다. 승인·권한 관리는 기존 회원관리 화면을 사용합니다.</span></div>';
 page.querySelector('.vr-admin-header').insertAdjacentHTML('afterend',mode);
 page.querySelector('[data-pane="members"] .vr-admin-section-head h2').textContent='회원 현황';
 page.querySelector('[data-pane="members"] .vr-admin-section-head p').textContent='승인 대기자·회원 상태와 접속 기록을 한곳에서 확인합니다.';
 const adminSection='<section class="vr-admin-account-section"><div class="vr-admin-section-head"><h3>관리자 계정</h3><small>일반 회원과 분리 · 권한 및 정보 수정 제한</small></div><div data-admin-accounts class="vr-admin-account-list"><p class="vr-preview-member-empty">관리자 계정을 확인하는 중…</p></div></section>';
 const memberStats='<div class="vr-preview-member-stats" aria-label="회원 상태 요약"><div><span>일반 회원</span><strong data-member-count="all">—</strong></div><div><span>승인 대기</span><strong data-member-count="pending">—</strong></div><div><span>승인 회원</span><strong data-member-count="approved">—</strong></div><div><span>이용 제한</span><strong data-member-count="limited">—</strong></div></div>';
 const memberListing='<div class="vr-preview-member-list"><div class="vr-preview-member-head"><h3>일반 회원 목록</h3><div><input type="search" data-member-search aria-label="회원 검색" placeholder="회원 검색" autocomplete="off"> <select data-member-filter aria-label="회원 상태 필터"><option value="all">전체 상태</option><option value="pending">승인 대기</option><option value="approved">승인</option><option value="limited">이용 제한</option></select> <select data-member-sort aria-label="회원 정렬"><option value="recent">신청일 최신순</option><option value="name">이름순</option><option value="status">상태별</option></select></div></div><div data-member-table class="vr-preview-member-scroll"><p class="vr-preview-member-empty">회원 현황을 조회하는 중…</p></div><div class="vr-preview-member-footer"><span data-member-showing>조회 중</span><button type="button" data-action="members">기존 회원 승인·권한 관리 ↗</button></div></div>';
 const header=page.querySelector('[data-pane="members"] .vr-admin-section-head');
 header.insertAdjacentHTML('afterend',adminSection+memberStats+memberListing);
 const oldManage=page.querySelector('[data-action="members"]');
 if(oldManage){oldManage.textContent='회원 승인·권한 관리 ↗';}
 const indexButton=page.querySelector('[data-action="indexing"]');
 if(indexButton){indexButton.textContent='기존 색인 관리 열기 ↗';}
 document.body.append(page);document.body.classList.add('vinyl-admin-page-open');
 let closed=false,version=0,accountRevision=0,disposeProposals=null,disposePilotReport=null,summaryRequest=null,summaryTimer=null,summarySeen=false,summaryLive=false,operationsPanel=null;const controller=new AbortController(),q=s=>page.querySelector(s);
 function notice(msg){if(!closed)q('.vr-admin-status').textContent=String(msg??'');}
 function close(){if(closed)return;closed=true;operationsPanel?.close();clearTimeout(summaryTimer);document.removeEventListener('visibilitychange',onSummaryVisibility);disposePilotReport?.();disposePilotReport=null;version++;controller.abort();disposeProposals?.();editor?.close();editor?.remove();editor=null;page.remove();document.body.classList.remove('vinyl-admin-page-open');window.removeEventListener('vinyl-account-change',onAccount);window.removeEventListener('vinyl-approval-change',onAccount);window.removeEventListener('keydown',onKey);document.removeEventListener('click',onSidebar,true);if(dismissCurrent===close)dismissCurrent=null;}
 function onAccount(){accountRevision++;if(!canManage())notice('관리자 인증을 확인해 주세요. 검토 화면은 유지되며 권한 확인 전 저장은 차단됩니다.');}
 function onKey(e){if(e.key==='Escape'&&page.isConnected){e.preventDefault();close();}}
 function onSidebar(e){if(e.target.closest('.sidebar #nav button, .sidebar .brand'))close();}
 function check(){if(!canManage()){notice('관리자 인증을 확인해 주세요. 검토 화면은 유지됩니다.');throw Error('관리자 인증 확인 전 요청할 수 없습니다.');}}
 function tab(t){check();clearTimeout(summaryTimer);if(t!=='analysis'){disposePilotReport?.();disposePilotReport=null;}for(const el of page.querySelectorAll('[data-pane]'))el.hidden=el.dataset.pane!==t;for(const b of page.querySelectorAll('[data-tab]'))b.setAttribute('aria-current',String(b.dataset.tab===t?'page':'false'));notice('');if(t==='analysis'&&!summarySeen)void readAiSummary();else if(t==='analysis'&&summaryLive)void readAiSummary();if(t==='analysis'&&!disposeProposals)void readAiReview();if(t==='catalog')void catalog().catch(error=>{if(!closed)notice(error?.message||'카탈로그 상태를 조회하지 못했습니다.');});}
 function openPilotReport(){
  check();if(disposePilotReport)return;
  disposePilotReport=attachReviewToAdminPanel({adminRoot:q('[data-ai-pilot-report]'),isAdminVerified:true,
   getAccessToken:async()=>{check();const token=await getAccessToken();check();return token;},
   fetcher:async(path,options)=>{check();if(path!==REVIEW_ENDPOINT||options.method!=='GET')throw Error('HOLD: unexpected review request');const response=await fetch(NAS_URL+path,options);check();return response;}
  });
 }
 async function catalog(){
  const seq=++version,host=q('[data-catalog-result]');
  host.textContent='NAS 카탈로그 상태를 조회하는 중…';
  try{
   const data=await api('/v2/state');check();
   if(closed||seq!==version)return;
   const summary=catalogSummary(data);
   host.innerHTML=`<div class="vr-admin-metrics"><div><span>앨범</span><strong>${summary.albums}</strong></div><div><span>아티스트</span><strong>${summary.artists}</strong></div><div><span>트랙</span><strong>${summary.tracks}</strong></div></div>
   <div class="vr-admin-readonly-details"><div><span>카탈로그 준비</span><strong>${summary.ready}</strong></div><div><span>현재 색인</span><strong>${summary.indexing}</strong></div><div><span>마지막 색인</span><strong>${esc(summary.lastScan)}</strong></div><div><span>다음 정기 색인</span><strong>${esc(summary.nextScan)}</strong></div></div>
   <p class="vr-admin-readonly-note">공용 NAS의 기존 상태 조회 결과입니다. 이 화면에서는 색인이나 데이터 수정을 실행하지 않습니다.</p>`;
  }catch(error){
   if(!closed&&seq===version)host.textContent='상태를 불러오지 못했습니다. 새로고침을 눌러 다시 확인하세요.';
   throw error;
  }
 }
 async function access(){const seq=++version;const host=q('[data-access-result]');host.textContent='접속 통계 확인 중…';
  const token=await getAccessToken();check();
  const response=await fetch(DEFAULT_SUPABASE_URL+'/rest/v1/rpc/vinyl_admin_member_access_stats',{
   method:'POST',headers:{apikey:DEFAULT_SUPABASE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:'{}',signal:controller.signal,credentials:'omit',redirect:'error'});
  if(closed||seq!==version)return;
  if(response.status===404){host.textContent='접속 기록 저장 기능은 아직 설치되지 않았습니다. 회원 기록은 소급 생성되지 않습니다.';return;}
  if(!response.ok)throw Error('접속 통계 조회 실패 (HTTP '+response.status+')');
  const d=await response.json();
  if(!d||!Array.isArray(d.daily)||!Array.isArray(d.members))throw Error('통계 응답 형식이 올바르지 않습니다.');
  const safe=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  host.innerHTML=`<div class="vr-admin-metrics"><div><span>최근 7일 활동 회원</span><strong>${safe(d.summary?.active_7d)}</strong></div><div><span>최근 30일 활동 회원</span><strong>${safe(d.summary?.active_30d)}</strong></div><div><span>최근 30일 활동 구간</span><strong>${safe(d.summary?.activity_slots_30d)}</strong></div></div><p>회원별 최근 접속</p><div style="overflow:auto"><table><thead><tr><th>회원</th><th>최근 활동</th><th>30일 활동 일수</th></tr></thead><tbody>${d.members.slice(0,200).map(x=>`<tr><td>${esc(x.name||'—')}</td><td>${esc(x.last_seen||'기록 없음')}</td><td>${safe(x.active_days)}</td></tr>`).join('')}</tbody></table></div><p>IP·위치·재생 기록은 수집하지 않습니다.</p>`;
 }

 const count=displayCount;
 const statusLabels={pending:'승인 대기',approved:'승인',rejected:'거절',suspended:'이용 정지'};
 let previewMembers=[],adminAccounts=[],memberQuery='',memberFilter='all',memberSort='recent',membersReady=false,editor=null;
 function drawAdmins(){
  const host=q('[data-admin-accounts]');
  if(!adminAccounts.length){host.innerHTML='<p class="vr-preview-member-empty">등록된 관리자 계정을 확인하지 못했습니다.</p>';return;}
  host.innerHTML=adminAccounts.map(m=>'<div class="vr-admin-account-row"><div><strong>'+esc(m.full_name||m.nickname||'관리자')+'</strong><small>'+esc(m.email||'—')+'</small></div><span class="vr-admin-protected-role">관리자 · 보호 계정</span></div>').join('');
 }
 async function editMember(userId){
  check();
  const member=previewMembers.find(m=>m.user_id===userId&&m.role==='member');
  if(!member)throw Error('수정할 일반 회원을 찾지 못했습니다.');
  if(editor){editor.close();editor.remove();editor=null;}
  const dlg=document.createElement('dialog');dlg.className='vr-member-editor';
  dlg.innerHTML='<form data-profile-form><header><div><small>VINYL ROOM / MEMBER</small><h3>회원정보 수정</h3></div><button type="button" data-cancel aria-label="닫기">×</button></header><div class="vr-member-edit-fields"><label>이름<input name="full_name" required maxlength="80" autocomplete="off" value="'+esc(member.full_name||'')+'"></label><label>닉네임<input name="nickname" maxlength="60" autocomplete="off" value="'+esc(member.nickname||'')+'"></label><label>이메일 · 변경 불가<input type="email" value="'+esc(member.email||'')+'" readonly aria-readonly="true"></label></div><p>이름과 닉네임만 수정합니다. 이메일·비밀번호·회원 상태·관리자 권한은 변경하지 않습니다.</p><p data-edit-message role="status"></p><footer><button type="button" data-cancel>취소</button><button type="submit" data-save>변경 내용 저장</button></footer></form>';
  page.append(dlg);editor=dlg;
  const dismiss=()=>{if(dlg.open)dlg.close();else dlg.remove();};
  dlg.querySelectorAll('[data-cancel]').forEach(btn=>btn.onclick=dismiss);
  dlg.addEventListener('cancel',event=>{if(dlg.querySelector('[data-save]').disabled)event.preventDefault();});
  dlg.addEventListener('close',()=>{dlg.remove();if(editor===dlg)editor=null;},{once:true});
  dlg.querySelector('form').onsubmit=async event=>{
   event.preventDefault();const form=event.currentTarget,save=form.querySelector('[data-save]'),message=form.querySelector('[data-edit-message]');
   if(save.disabled||!form.reportValidity())return;
   let profile;
   try{profile=validateMemberProfile(new FormData(form).get('full_name'),new FormData(form).get('nickname'));}
   catch(error){message.textContent=error.message;return;}
   if(profile.full_name===member.full_name&&profile.nickname===(member.nickname||null)){message.textContent='변경된 항목이 없습니다.';return;}
   save.disabled=true;dlg.querySelectorAll('[data-cancel]').forEach(button=>button.disabled=true);message.textContent='회원정보를 저장하는 중…';
   try{
    check();const token=await getAccessToken();check();
    const response=await fetch(DEFAULT_SUPABASE_URL+'/rest/v1/rpc/vinyl_admin_update_member_profile',{
     method:'POST',headers:{apikey:DEFAULT_SUPABASE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({target_user_id:member.user_id,new_full_name:profile.full_name,new_nickname:profile.nickname,expected_full_name:member.full_name,expected_nickname:member.nickname||null}),
     signal:controller.signal,credentials:'omit',redirect:'error'
    });
    const updated=await response.json().catch(()=>null);
    if(!response.ok)throw Error(updated?.message||'회원정보 저장에 실패했습니다. 권한 또는 서버 설정을 확인하세요.');
    if(!updated||updated.user_id!==member.user_id||updated.full_name!==profile.full_name||(updated.nickname??null)!==profile.nickname)throw Error('저장 응답이 올바르지 않습니다. 회원 목록을 새로고침해 확인하세요.');
    dismiss();notice('회원 이름·닉네임을 저장했습니다.');window.dispatchEvent(new Event('vinyl-members-change'));
    const reloaded=await loadPreviewMembers();if(reloaded===false)notice('회원정보는 저장됐지만 목록 재조회에 실패했습니다. 새로고침해 확인하세요.');
   }catch(error){if(!closed&&dlg.isConnected)message.textContent=error?.message||'수정하지 못했습니다.';}
   finally{if(save.isConnected)save.disabled=false;dlg.querySelectorAll('[data-cancel]').forEach(button=>button.disabled=false);}
  };
  dlg.showModal();dlg.querySelector('[name="full_name"]').focus();
 }
 function drawPreviewMembers(){
  const filtered=selectMembers(previewMembers,{query:memberQuery,filter:memberFilter,sort:memberSort});
  const host=q('[data-member-table]');
  q('[data-member-showing]').textContent=count(Math.min(filtered.length,200))+'명 표시 · 검색 결과 '+count(filtered.length)+'명 / 조회 '+count(previewMembers.length)+'명'+(previewMembers.length===1000?' (조회 상한 1,000명)':'');
  if(!filtered.length){host.innerHTML='<p class="vr-preview-member-empty">조건에 맞는 회원이 없습니다.</p>';return;}
  host.innerHTML='<table><thead><tr><th>이름</th><th>이메일</th><th>상태</th><th>신청일</th><th>관리</th></tr></thead><tbody>'+filtered.slice(0,200).map(m=>{
   const known=Object.prototype.hasOwnProperty.call(statusLabels,m.status)?m.status:'unknown';
   return '<tr><td>'+esc(m.full_name||m.nickname||'이름 없음')+(m.full_name&&m.nickname&&m.nickname!==m.full_name?'<small class="vr-member-nickname">'+esc(m.nickname)+'</small>':'')+'</td><td>'+esc(m.email||'—')+'</td><td><span class="vr-status" data-status="'+known+'">'+esc(statusLabels[known]||'확인 필요')+'</span></td><td>'+esc(String(m.requested_at||'').slice(0,10)||'—')+'</td><td><button type="button" class="vr-member-edit-btn" data-edit-member="'+esc(m.user_id)+'" aria-label="'+esc(m.full_name||m.nickname||'회원')+' 정보 수정">수정</button></td></tr>';
  }).join('')+'</tbody></table>';
 }
 async function loadPreviewMembers(){
  try{
   check();const token=await getAccessToken();check();
   const response=await fetch(DEFAULT_SUPABASE_URL+'/rest/v1/vinyl_members?select=user_id,role,full_name,nickname,email,status,requested_at&order=requested_at.desc&limit=1000',{
    headers:{apikey:DEFAULT_SUPABASE_KEY,Authorization:'Bearer '+token},signal:controller.signal,credentials:'omit',redirect:'error'});
   if(!response.ok)throw Error('회원 정보 조회 오류 (HTTP '+response.status+')');
   const data=await response.json();check();if(closed||!Array.isArray(data))return;
   const partitions=splitMembersByRole(data);adminAccounts=partitions.admins;previewMembers=partitions.members;membersReady=true;
   drawAdmins();
   const counts=memberCounts(previewMembers);
   for(const [key,val] of Object.entries(counts))q('[data-member-count="'+key+'"]').textContent=count(val);
   drawPreviewMembers();return true;
  }catch(e){if(!closed&&e.name!=='AbortError'){q('[data-member-table]').innerHTML='<p class="vr-preview-member-empty">회원 현황을 불러오지 못했습니다. 계정 상태를 확인한 뒤 새로고침해 주세요.</p>';q('[data-admin-accounts]').innerHTML='<p class="vr-preview-member-empty">관리자 정보를 불러오지 못했습니다.</p>';}return false;}
 }

 function onSummaryVisibility(){if(!document.hidden&&!closed&&!q('[data-pane="analysis"]').hidden&&summaryLive)void readAiSummary();}
 document.addEventListener('visibilitychange',onSummaryVisibility);
 function readAiSummary(){
  check();if(summaryRequest)return summaryRequest;clearTimeout(summaryTimer);
  const host=q('[data-ai-summary-result]'),identity=accountRevision;host.setAttribute('aria-busy','true');
  if(!summarySeen)host.textContent='AI 분석 현황 조회 중… (읽기 전용)';
  summaryRequest=(async()=>{try{
   const data=await api('/v2/ai-classification/summary',{admin:true,signal:controller.signal});check();
   if(closed||identity!==accountRevision)return;
   const state=summaryResponseState(data);if(state==='invalid')throw Error('AI 현황 응답 형식이 확인되지 않았습니다.');
   summarySeen=true;summaryLive=aiOperationStatus(data).running;
   host.innerHTML=state==='empty'?'<p>정상 응답 · 반환된 집계 항목이 없습니다. 0건으로 간주하지 않습니다.</p>':renderAiOperationStatus(data);
   if(summaryLive&&!q('[data-pane="analysis"]').hidden&&!document.hidden)summaryTimer=setTimeout(()=>void readAiSummary(),15000);
  }catch(error){
   if(closed||error?.name==='AbortError'||identity!==accountRevision)return;
   summaryLive=false;const status=classifyAiApiError(error);
   // Keep the last successful snapshot visibly marked as stale after a refresh failure.
   const msg='분석 현황 · '+status.state+' ('+status.detail+').';
   if(summarySeen){let warning=host.querySelector('[data-ai-refresh-error]');if(!warning){warning=document.createElement('p');warning.dataset.aiRefreshError='';host.prepend(warning);}warning.textContent=msg+' 이전 조회 결과입니다.';}else host.textContent=msg;
  }finally{host.removeAttribute('aria-busy');summaryRequest=null;}})();return summaryRequest;
 }
 async function checkAiApis(){
  const host=q('[data-ai-api-status]');check();
  host.textContent='AI API 응답 확인 중…';
  const endpoints=[
   ['일반 NAS 공개 조회','/v2/public/albums',false],
   ['분류 결과','/v2/ai-classification/results',true],
   ['관리자 검토','/v2/ai-classification/corrections',true],
   ['전달 상태','/v2/ai-classification/corrections/delivery-status',true]
  ];
  const rows=[];
  for(const [name,path,admin] of endpoints){
   try{
    check();const start=performance.now();
    const data=await api(path,{admin,signal:controller.signal});
    check();
    const seconds=((performance.now()-start)/1000).toFixed(1);
    const result=listResultCount(data);
    rows.push({name,state:result.known?(result.count===0?'결과 없음':'정상'):'응답 정상',detail:(result.known?result.count.toLocaleString('ko-KR')+'건 · 서버 목록 응답':'응답 수신 · 목록 건수 미확인')+' · '+seconds+'초'});
   }catch(error){
    if(closed||error?.name==='AbortError')return;
    const status=classifyAiApiError(error);rows.push({name,state:status.state,detail:status.detail});
   }
  }
  if(closed)return;
  const diagnosis='API마다 응답을 따로 표시합니다. 한 경로의 실패만으로 AI 전체 장애를 단정하지 않으며, 결과 없음은 서버가 빈 목록을 명시한 경우에만 표시합니다.';
  host.innerHTML='<p class="vr-admin-caution">'+esc(diagnosis)+'</p><div class="vr-preview-member-list"><table><thead><tr><th>API</th><th>연결 상태</th><th>조회 결과</th></tr></thead><tbody>'+
   rows.map(row=>'<tr><td>'+esc(row.name)+'</td><td>'+esc(row.state)+'</td><td>'+esc(row.detail)+'</td></tr>').join('')+
   '</tbody></table></div><p class="vr-admin-caution">조회 시점의 결과이며, Gemini API 직접 호출이나 AI 작업 실행 여부를 뜻하지 않습니다.</p>';
 }
 async function readAiReview(){
  check();if(disposeProposals)return;
  disposeProposals=mountProposalReview({container:q('[data-ai-review-result]'),api,canManage:()=>!closed&&canManage()});
 }
 page.querySelector('[data-member-table]').addEventListener('click',event=>{const btn=event.target.closest('[data-edit-member]');if(!btn)return;void editMember(btn.dataset.editMember).catch(error=>notice(error.message));});
 page.querySelector('[data-member-search]').addEventListener('input',e=>{memberQuery=e.target.value.trim().toLowerCase();if(membersReady)drawPreviewMembers();});
 page.querySelector('[data-member-filter]').addEventListener('change',e=>{memberFilter=e.target.value;if(membersReady)drawPreviewMembers();});
 page.querySelector('[data-member-sort]').addEventListener('change',e=>{memberSort=e.target.value;if(membersReady)drawPreviewMembers();});
 page.querySelectorAll('[data-ai-jump]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  check();
  const target=page.querySelector('#'+link.dataset.aiJump);
  if(target&&!target.closest('[data-pane]').hidden)target.scrollIntoView({behavior:'smooth',block:'start'});
 }));
 page.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
 q('[data-close]').onclick=close;
 page.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-action]');if(!btn||btn.disabled)return;
  btn.disabled=true;
  try{check();if(btn.dataset.action==='members')await openMembers();else if(btn.dataset.action==='indexing')await openIndexing();else if(btn.dataset.action==='stats')await access();else if(btn.dataset.action==='ai')await readAiReview();else if(btn.dataset.action==='ai-operations'){const {openAiClassification}=await import('./ai-classification.js');check();operationsPanel?.close();operationsPanel=await openAiClassification({api:(path,opts={})=>{check();return api(path,{...opts,admin:true});},canManage:()=>!closed&&canManage(),operationsOnly:true});}else if(btn.dataset.action==='ai-summary')await readAiSummary();else if(btn.dataset.action==='ai-api')await checkAiApis();else if(btn.dataset.action==='catalog')await catalog();else if(btn.dataset.action==='playback-diagnostics')openPlaybackDiagnostics?.();}
  catch(err){if(!closed)notice(err?.message||'요청을 완료하지 못했습니다.');}
  finally{if(btn.isConnected)btn.disabled=false;}
 });
 window.addEventListener('vinyl-account-change',onAccount);
 window.addEventListener('vinyl-approval-change',onAccount);
 window.addEventListener('keydown',onKey);
 document.addEventListener('click',onSidebar,true);
 dismissCurrent=close;
 void loadPreviewMembers();
 return {close,tab};
}

