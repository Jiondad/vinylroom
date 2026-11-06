// Presentation adapter for the existing /summary contract; no API or storage writes.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
const show=v=>count(v)===null?'미제공':v.toLocaleString('ko-KR');
const states={pending:'분석 대기',stale:'변경 · 재분석 필요',running:'분석 중',paused:'일시정지',rate_limited:'요청 제한 대기',review_required:'관리자 확인 필요',completed:'완료',failed:'오류',stopped:'중단',unknown:'결과 미확정'};
const reasons={rate_limited:'외부 서비스 요청 제한',limits_unconfirmed:'호출 한도 확인 필요',manual_reconciliation_required:'미확정 호출 확인 필요',request_outcome_unknown:'호출 결과 미확정 · 자동 재호출 안 함',provider_resume_required:'외부 서비스 중단 상태',invalid_model_output:'모델 응답 형식 확인 필요',invalid_date:'날짜 형식 확인 필요',daily_request_limit:'일일 요청 한도 도달',daily_album_limit:'일일 앨범 한도 도달',daily_token_limit:'일일 토큰 한도 도달',minute_wait:'호출 간격 대기',usage_unknown:'사용량 확인 필요',catalog_sync_failed:'입력 동기화 오류'};
Object.assign(reasons,{ready:'실행 조건 충족',not_enabled:'무인 분석 미활성',automation_disabled:'자동 동기화 중지 설정',incremental_sync_not_configured:'기존 증분 동기화 연결 필요',incremental_sync_held:'증분 동기화 보류',unattended_limits_changed:'승인된 시험 한도와 불일치',sync_already_running:'입력 동기화 진행 중',worker_busy:'기존 Worker 처리 중',unattended_connection_error:'무인 분석 연결 확인 필요'});
const reason=v=>reasons[v]||(typeof v==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(v)?'오류 코드: '+v:'서버 상태 확인 필요');
const when=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<8640000000000?new Date(v*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'미제공';
export function aiOperationStatus(data){
 const root=object(data),d=Object.keys(object(root.dashboard)).length?root.dashboard:root,s=object(d.states),reviews=object(d.reviews),usage=object(d.usage);
 const jobs=Array.isArray(root.jobs)?root.jobs.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)):null;
 const unknown=Array.isArray(root.unresolved_calls)?root.unresolved_calls:null;
 const progress=typeof d.progress==='number'&&Number.isFinite(d.progress)&&d.progress>=0&&d.progress<=100?d.progress:null;
 return {d,s,reviews,usage,jobs,unknown,progress,running:Boolean(jobs?.some(j=>j.state==='running')),sync:object(root.sync)};
}
export function renderAiOperationStatus(data){
 const m=aiOperationStatus(data),cards=[['분석 대상',m.d.total],['분석 대기',m.s.pending],['변경 · 재분석 필요',m.s.stale],['관리자 확인 필요',m.s.review_required],['완료',m.s.completed],['분석 오류',m.s.failed]];
 const card=(label,value)=>`<article class="vr-ai-summary-group"><h4>${label}</h4><p>${show(value)}</p></article>`;
 const progress=m.progress===null?'<p>진행률: 서버 미제공</p>':`<p>분석 진행률 ${m.progress}%</p><progress max="100" value="${m.progress}" aria-label="서버 분석 진행률" style="width:100%;accent-color:#b69a64"></progress>`;
 const waiting=m.jobs?.filter(j=>['paused','failed','rate_limited','unknown'].includes(j.state)||j.last_error);
 const jobs=m.jobs===null?'<p>작업 정보: 서버 미제공</p>':m.jobs.length?`<p>최근 작업 ${m.jobs.length}건 · 서버 조회 범위, 전체 작업 수와 다를 수 있습니다.</p><div class="table-wrap"><table><thead><tr><th>대상</th><th>상태</th><th>분석 대기 / 검토 필요 / 오류</th><th>확인 사항</th></tr></thead><tbody>${m.jobs.slice(0,200).map(j=>{const c=object(j.counts);return `<tr><td>${esc(String(j.artist||'대상 미제공').slice(0,150))}</td><td>${esc(states[j.state]||'알 수 없는 상태')}</td><td>${show(c.pending)} / ${show(c.review_required)} / ${show(c.failed)}</td><td>${j.last_error?esc(reason(j.last_error)):'—'}${j.state==='rate_limited'?`<br>다음 허용: ${esc(when(j.retry_at))}`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<p>반환된 작업 없음 · 자동 분석이 활성화됐다는 뜻은 아닙니다.</p>';
 const warnings=[];
 if(m.unknown?.length)warnings.push(`결과 미확정 호출 ${m.unknown.length}건이 반환됐습니다. 자동 재호출하지 않습니다.`);
 if(waiting?.length)warnings.push(`중단·오류·확인이 필요한 작업 ${waiting.length}건이 반환됐습니다.`);
 if(count(m.s.review_required)>0)warnings.push(`분석 결과를 검토할 앨범 ${show(m.s.review_required)}건이 있습니다. 아래 기존 AI 앨범 분류 관리에서 확인하세요.`);
 const syncState=states[m.sync.state]||({idle:'대기',completed:'완료',held:'보류',not_enabled:'미활성'}[m.sync.state])||'서버 미제공';
 return `<p class="vr-admin-caution" data-ai-summary-state>응답 정상 · 서버 집계만 표시합니다. 분석 진행률은 Catalog 반영률이 아닙니다.</p>${progress}<div class="vr-ai-summary-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))">${cards.map(([l,v])=>card(l,v)).join('')}</div><section aria-label="확인 필요"><h4>확인 필요</h4>${warnings.length?warnings.map(x=>'<p>'+esc(x)+'</p>').join(''):'<p>제공된 정보에서 확인 항목이 없습니다. 미제공 정보를 정상으로 판정하지 않습니다.</p>'}</section><section aria-label="분석 작업"><h4>분석 작업</h4>${jobs}</section><details><summary>호출·동기화 상태</summary><p>입력 동기화: ${esc(syncState)} · 입력 동기화와 Gemini 자동 분석은 별개입니다.</p><p>무인 자동 분석: ${m.d.auto_analysis?.version===1?esc(({running:'활성',held:'보류',not_enabled:'미활성'}[m.d.auto_analysis.state]||'상태 확인 필요')+' · '+reason(m.d.auto_analysis.reason)):'서버 연결 상태 미제공 · 활성화 미확인'}</p><p>자동 분석 Worker: ${m.d.worker_connection?.version===1?(m.d.worker_connection.started===true?'기동됨 · 기존 한도·작업 상태에 따라 처리':m.d.worker_connection.enabled===true?'작업 시작 대기':'비활성'):'연결 상태 미제공'}</p><p>오늘 요청 ${show(m.usage.requests)} · 요청 오류 ${show(m.usage.failed_requests)} · 요청 제한 ${show(m.usage.rate_limits)}</p><p>검토 대기 제안 ${show(m.reviews.pending)} · 제안 확인 ${show(m.reviews.confirmed)} · 반려 ${show(m.reviews.rejected)}</p></details><p class="vr-admin-caution">조회만 수행합니다. 검토 저장·확정·Catalog 반영 및 Gemini 호출을 실행하지 않습니다.</p>`;
}
