// Stage A administrator panel. Calls only authenticated NAS APIs; no model keys.
export const escapeAiText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeAiText;
export const stateLabel=state=>({pending:'대기',running:'진행 중',paused:'일시정지',cancelled:'중단',completed:'완료',review_required:'검토 대기',failed:'실패',rate_limited:'호출 제한',stale:'재분류 필요',confirmed:'검토 확정',rejected:'거부'}[state]||state);
export function canOpenAi({approved,email,adminEmail}){return approved===true&&!!adminEmail&&String(email||'').toLowerCase()===adminEmail.toLowerCase();}
export function limitPayload(form,now=Date.now()){
 const fields=['provider_rpm','provider_tpm','provider_rpd','daily_requests','daily_albums','daily_input','daily_output','interval_seconds','batch_size','max_output'];
 const values=Object.fromEntries(fields.map(k=>[k,Number(form.get(k))]));
 if(fields.some(k=>!Number.isSafeInteger(values[k])||values[k]<1))throw Error('한도는 1 이상의 정수로 입력하세요.');
 if(values.batch_size>10)throw Error('배치는 최대 10개입니다.');
 if(form.get('confirm_limits')!=='on')throw Error('AI Studio의 현재 무료 등급과 한도를 확인해 주세요.');
 return {...values,research_mode:form.get('research_mode')||'basic',confirmed_at:now/1000,auto_retry:false,model:'gemini-3.5-flash-lite'};
}

export async function openAiClassification({api,canManage,root=document}){
 if(!canManage())throw Error('승인된 관리자만 사용할 수 있습니다.');
 root.querySelector('#vinyl-ai-panel')?.close();
 if(!root.querySelector('#vinyl-ai-style')){
  const link=root.createElement('link');link.id='vinyl-ai-style';link.rel='stylesheet';link.href=new URL('ai-classification.css',root.baseURI).href;root.head.append(link);
 }
 const panel=root.createElement('dialog');panel.id='vinyl-ai-panel';panel.className='vinyl-ai-panel';
 panel.innerHTML=`<div class="ai-head"><div><p class="ai-eyebrow">VINYL ROOM / ADMIN</p><h1>AI 앨범 분류</h1></div><button data-close aria-label="AI 분류 닫기">×</button></div>
 <p class="ai-note">A단계 · AI 제안과 검토 기록만 저장합니다. 운영 앨범 정보에는 반영하지 않습니다.</p>
 <div class="ai-message" role="status"></div><nav class="ai-tabs" aria-label="AI 관리 화면"><button data-tab="summary" aria-current="page">현황</button><button data-tab="queue">아티스트·작업</button><button data-tab="results">제안 검토</button><button data-tab="settings">사용 한도</button></nav>
 <section data-pane="summary"><div class="ai-stats" data-stats></div><h2>앨범 유형별 제안 현황</h2><div data-type-counts></div><h2>80% 한도 및 처리 권장값</h2><div data-quota></div><h2>모드·배치별 실측</h2><div data-mode-metrics></div><h2>오늘의 사용량</h2><div data-usage></div><div class="ai-actions"><button data-sync>색인 정보 읽기</button><button data-refresh>현황 갱신</button></div><p class="ai-muted">음원 파일은 읽지 않습니다. 신규·변경 판정에는 관리자 요청으로 가져온 색인 정보를 사용합니다.</p><p data-sync-state></p></section>
 <section data-pane="queue" hidden><h2>아티스트별 대기열</h2><p class="ai-muted">등록 후 시작을 눌러야 분석합니다. VA는 앨범별 별도 작업으로 분리됩니다.</p><form data-search><input name="search" placeholder="아티스트 검색" aria-label="아티스트 검색"><button>조회</button></form><div data-artists></div><div class="ai-actions"><button data-artist-prev>이전 아티스트</button><button data-artist-next>다음 아티스트</button></div><h2>분류 작업</h2><p class="ai-muted">일시정지·중단 시 진행 중 요청은 끝까지 기록하되 다음 요청은 시작하지 않습니다. 실패 항목은 명시적으로 재시도합니다.</p><div data-jobs></div></section>
 <section data-pane="results" hidden><h2>기존값과 AI 제안 비교</h2><label>앨범 유형 <select data-type-filter aria-label="AI 앨범 유형 필터"><option value="">모든 유형</option>${['Studio','Live','Compilation','Single','EP','Mini Album','Soundtrack','Demo','Bootleg','Remix','Other','Singles & EPs','Unresolved'].map(t=>`<option value="${t}">${t==='Singles & EPs'?'Singles & EPs · 통합 조회':t==='Unresolved'?'미확인 · 구분 보류':t}</option>`).join('')}</select></label><p class="ai-muted">검토 확정은 독립 저장소의 상태입니다. 운영 반영 또는 외부 사실 검증을 의미하지 않습니다.</p><div data-results></div><div class="ai-actions"><button data-result-prev>이전 결과</button><button data-result-next>다음 결과</button></div></section>
 <section data-pane="settings" hidden><h2>Free Tier 사용 한도</h2><p class="ai-muted">AI Studio에서 현재 프로젝트·모델의 실제 한도를 확인하여 입력하세요. 7일이 지나면 재확인 전까지 호출을 멈춥니다. 다른 프로그램의 프로젝트 사용량은 자동 조회하지 못합니다.</p>
 <form data-limits><div class="ai-fields">${[['provider_rpm','공급자 분당 요청 수 (RPM)'],['provider_tpm','공급자 분당 입력 토큰 (TPM)'],['provider_rpd','공급자 일일 요청 수 (RPD)'],['daily_requests','관리자 일일 최대 요청'],['daily_albums','관리자 일일 최대 앨범'],['daily_input','관리자 일일 최대 입력 토큰'],['daily_output','관리자 일일 최대 출력 토큰'],['interval_seconds','최소 요청 간격 (초)'],['batch_size','아티스트별 배치 (1~10)'],['max_output','요청별 최대 출력 토큰']].map(([name,label])=>`<label>${label}<input type="number" name="${name}" min="1" ${name==='batch_size'?'max="10"':''} required></label>`).join('')}</div>
 <label>분석 모드 <select name="research_mode"><option value="basic">기본 분류 + 짧은 연구</option><option value="classification_only">분류만 (연구 별도)</option></select></label><label class="ai-check"><input type="checkbox" name="confirm_limits" required>현재 Free Tier와 공급자 한도를 직접 확인했습니다.</label><p class="ai-muted">모델: gemini-3.5-flash-lite · 자동 재시도 OFF · 유료 전환 없음</p><button class="ai-primary">한도 저장</button></form><p class="ai-muted">관리자 일일 한도는 한국 날짜, 공급자 RPD는 미국 태평양 날짜를 따로 집계합니다. 429 후에는 날짜가 바뀌어도 자동 재개하지 않습니다.</p></section>`;
 root.body.append(panel);panel.showModal();
 const researchDisposers=new Set();
 const $=s=>panel.querySelector(s);const abort=new AbortController();let timer,disposed=false,refreshing=false,artistOffset=0,resultOffset=0,query='',typeFilter='',lastSettings=false;
 const message=(value,error=false)=>{const node=$('.ai-message');node.textContent=value;node.classList.toggle('ai-error',error);};
 async function call(path,options={}){if(!canManage()){panel.close();throw Error('관리자 권한이 변경됐습니다.');}return api('/v2/ai-classification'+path,{...options,signal:abort.signal});}
 async function guarded(fn){try{await fn();}catch(error){if(!disposed&&error.name!=='AbortError')message(error.message||'요청에 실패했습니다.',true);}}
 function jobsHtml(rows){return rows.length?rows.map(j=>`<article class="ai-job"><div><strong>${esc(j.artist)}</strong><span>${esc(stateLabel(j.state))}</span><small>최근 처리: ${esc(new Date(j.updated*1000).toLocaleString())}</small><small>${esc(Object.entries(j.counts).map(([k,v])=>stateLabel(k)+' '+v).join(' · '))}</small>${j.last_error?`<small class="ai-error">${esc(j.last_error)}</small>`:''}${j.retry_at?`<small>재개 가능 시각: ${esc(new Date(j.retry_at*1000).toLocaleString())}</small>`:''}</div><div class="ai-actions">${[['start','시작'],['pause','정지'],['stop','중단'],['resume','이어하기'],['retry','실패 재시도'],['priority','우선 처리'],['reevaluate','새 버전 재평가']].map(([a,label])=>`<button data-job="${esc(j.id)}" data-action="${a}">${label}</button>`).join('')}</div></article>`).join(''):'<p class="ai-muted">등록된 작업이 없습니다.</p>';}
 function paintSummary(d){
  const s=d.states;const cells=[['전체',d.total],['미분류',s.pending||0],['AI 제안 완료',(s.review_required||0)+(s.completed||0)],['검토 대기',d.reviews.pending||0],['검토 확정',d.reviews.confirmed||0],['재분류 필요',s.stale||0],['오류',s.failed||0],['진행률',d.progress+'%']];
  $('[data-stats]').innerHTML=cells.map(([k,v])=>`<div><span>${k}</span><strong>${esc(v)}</strong></div>`).join('');
  $('[data-type-counts]').innerHTML='<table><thead><tr><th>유형</th><th>AI 제안</th><th>검토 대기</th><th>검토 확정</th></tr></thead><tbody>'+Object.entries(d.type_counts||{}).map(([kind,n])=>`<tr><td>${esc(kind)}</td><td>${n.proposed}</td><td>${n.pending_review}</td><td>${n.confirmed}</td></tr>`).join('')+'</tbody></table><p class="ai-muted">현재 입력과 일치하는 앨범별 제안 1건을 집계합니다. AI 제안은 검증된 사실이 아닙니다.</p>';
  const u=d.usage,settings=d.settings;
  const q=d.quota,r=d.recommendation;
  if(q&&r){$('[data-quota]').innerHTML=`<p class="ai-note">공급자 한도의 최대 80% · 입력 TPM은 분당 예산이며 일일 토큰이 아닙니다.</p><p>유효 RPM ${q.effective.provider_rpm} · 입력 TPM ${q.effective.provider_tpm} · RPD ${q.effective.provider_rpd}</p><p>현재 여유 RPM ${q.rpm_remaining} · TPM ${q.tpm_remaining} · RPD ${q.rpd_remaining} · RPD 사용률 ${esc(q.rpd_usage_percent??'미확인')}%</p><p>배치 ${settings.batch_size} · 다음 일일 목표 권장 ${r.next_daily_goal}개 (현재 ${r.current_daily_goal})</p><p>${esc(r.reason)} 자동 상향 없음 · 보류 사유 ${esc(q.hold_reason||'없음')}</p><p class="ai-muted">다른 프로그램의 동일 프로젝트 사용량은 자동 확인할 수 없습니다.</p>`;}
  $('[data-mode-metrics]').innerHTML=(d.mode_usage||[]).map(m=>`<p>${esc(m.mode)}: 요청 ${m.requests} · 완료 ${m.completed_albums} · 입력 ${m.input_tokens} · 출력(추론 포함) ${m.output_tokens} · 추론 ${m.thought_tokens} · 앨범당 총 토큰 ${m.completed_albums?Math.round(m.total_tokens/m.completed_albums):'미측정'} · 평균 ${m.mean_seconds?.toFixed(3)??'미측정'}초</p>`).join('')||'<p class="ai-muted">실측 없음 · 배치 상한은 10개로 유지합니다.</p>';
  $('[data-mode-metrics]').innerHTML+=(d.batch_metrics||[]).map(b=>`<p>배치 ${b.batch_size} 요청 → 실제 평균 ${b.actual_mean_batch?.toFixed(1)??'미측정'} · ${esc(b.mode)} · 성공 응답 ${b.successful_responses}/${b.requests} · 누락 응답 ${b.partial_responses}</p>`).join('');

  $('[data-usage]').innerHTML=`<dl class="ai-usage">${[['API 요청',u.requests+' / '+settings.daily_requests],['입력 토큰',u.input_tokens+' / '+settings.daily_input],['출력 토큰',u.output_tokens+' / '+settings.daily_output],['총 토큰',u.total_tokens],['완료 앨범',u.completed_albums+' / '+settings.daily_albums],['실패 요청',u.failed_requests],['429 발생',u.rate_limits],['사용량 미확정',u.unresolved_usage],['공급자 날짜 / 요청',d.provider_day+' / '+d.provider_requests]].map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="ai-muted">호출 전 입력 상한·최대 출력을 예약합니다. 사용량이 미확정이면 예약량을 유지하고 안전하게 정지합니다. 실제 청구 내역은 AI Studio에서 확인하세요.</p>`;
  $('[data-sync-state]').textContent='색인 정보 가져오기: '+d.sync.state+' · '+d.sync.count+'개';
  const accountingKey=JSON.stringify(d.unresolved_calls||[]);
  const existingAccounting=panel.querySelector('[data-accounting]');
  if(existingAccounting?.dataset.accountingKey!==accountingKey)existingAccounting?.remove();
  if(d.unresolved_calls?.length&&!panel.querySelector('[data-accounting]')){
   const section=root.createElement('details');section.dataset.accounting='';section.dataset.accountingKey=accountingKey;section.innerHTML=`<summary>사용량 미확정 요청 확인 (${d.unresolved_calls.length})</summary><p class="ai-muted">API 호출 후 통신·저장 장애가 발생한 요청입니다. 공급자 사용 내역과 대조한 값만 입력하세요. 조정은 사용량 기록만 보완하며, 재호출은 하지 않습니다.</p><form data-reconcile><label>요청<select name="id">${d.unresolved_calls.map(c=>`<option value="${esc(c.id)}">${esc(c.id)} · ${esc(c.error)}</option>`).join('')}</select></label><div class="ai-fields">${[['input_tokens','확인한 입력 토큰'],['output_tokens','확인한 출력 토큰 (추론 포함)'],['total_tokens','확인한 총 토큰']].map(([k,label])=>`<label>${label}<input name="${k}" type="number" min="0" required></label>`).join('')}</div><label class="ai-check"><input name="ack" type="checkbox" required>공급자 기록을 확인했으며, 추후 재시도 시 중복 소비 가능성을 이해했습니다.</label><button>사용량 대조 기록</button></form>`;
   $('[data-pane="summary"]').append(section);
   section.querySelector('form').onsubmit=event=>{event.preventDefault();const form=new FormData(event.currentTarget);void guarded(async()=>{await call('/reconcile',{body:{id:form.get('id'),input_tokens:Number(form.get('input_tokens')),output_tokens:Number(form.get('output_tokens')),total_tokens:Number(form.get('total_tokens')),acknowledge_duplicate_risk:form.get('ack')==='on'}});message('사용량을 기록했습니다. 실패 재시도는 별도로 선택하세요.');await refresh();});};
  }

  if(!lastSettings){for(const [key,value] of Object.entries(settings)){const input=$('[data-limits]').elements.namedItem(key);if(input&&input.type!=='checkbox')input.value=String(value);}lastSettings=true;}
 }
 async function refresh(){if(refreshing||disposed)return;refreshing=true;try{const d=await call('/summary');if(disposed)return;paintSummary(d);const node=$('[data-jobs]');const html=jobsHtml(d.jobs);if(node.innerHTML!==html)node.innerHTML=html;}finally{refreshing=false;}}
 async function artists(){const d=await call('/artists?search='+encodeURIComponent(query)+'&offset='+artistOffset);if(disposed)return;$('[data-artists]').innerHTML=d.items.map(a=>`<article class="ai-artist"><div>${esc(a.artist)}<small>${a.total}개 · 제안 ${a.done} · 변경 ${a.stale}</small></div><button data-enqueue="${esc(a.artist_key)}">대기열 등록</button></article>`).join('')||'<p class="ai-muted">아티스트가 없습니다. 현황에서 색인 정보를 먼저 읽어 주세요.</p>';$('[data-artist-prev]').disabled=artistOffset===0;$('[data-artist-next]').disabled=d.items.length<100;}
 async function results(){for(const dispose of researchDisposers)dispose();researchDisposers.clear();const d=await call('/results?offset='+resultOffset+'&album_type='+encodeURIComponent(typeFilter));if(disposed)return;$('[data-results]').innerHTML=d.items.map(p=>`<details class="ai-result"><summary>${esc(p.artist)} · ${esc(p.title)} <small>${esc(stateLabel(p.review_state))}${p.stale?' · 입력 변경됨':''}${p.taxonomy_review?' · 이전 유형 정책 검토':''}</small></summary><p class="ai-note">AI 제안 · 외부 검증 미완료 · 원본 DB 반영 불가</p>${p.stale?`<p class="ai-muted">재검토 필드: ${esc((p.changed_fields||[]).join(', '))}</p>`:''}<div class="ai-table-wrap"><table><thead><tr><th>항목</th><th>기존</th><th>AI 제안</th><th>판정</th></tr></thead><tbody>${p.comparison.map(c=>`<tr><td>${esc(c.field)}</td><td>${esc(c.before)}</td><td>${esc(c.after??'미확인')}</td><td>${esc(c.kind)}${c.manual_protected?' · 수동값 보호':''}</td></tr>`).join('')}</tbody></table></div><h3>작품 정보</h3><pre>${esc(JSON.stringify(p.result.work,null,2))}</pre><h3>소장 판본 제안</h3><pre>${esc(JSON.stringify(p.result.edition,null,2))}</pre><button data-research-album="${esc(p.album_id)}">앨범 연구 기록 보기</button><div data-research-host></div><h3>근거 구분·불확실성</h3><pre>${esc(JSON.stringify({basis:p.result.basis,uncertainties:p.result.uncertainties},null,2))}</pre><div class="ai-actions">${[['confirmed','검토 확정'],['rejected','거부'],['pending','검토 대기']].map(([state,label])=>`<button data-review="${esc(p.id)}" data-state="${state}" ${p.stale&&state==='confirmed'?'disabled':''}>${label}</button>`).join('')}</div></details>`).join('')||'<p class="ai-muted">저장된 AI 제안이 없습니다.</p>';$('[data-result-prev]').disabled=resultOffset===0;$('[data-result-next]').disabled=d.items.length<50;}
 function close(){for(const dispose of researchDisposers)dispose();researchDisposers.clear();disposed=true;clearInterval(timer);abort.abort();root.defaultView?.removeEventListener('vinyl-account-change',accountChanged);panel.remove();}
 function accountChanged(){if(!canManage())panel.close();}
 panel.addEventListener('close',close,{once:true});root.defaultView?.addEventListener('vinyl-account-change',accountChanged);
 panel.addEventListener('click',event=>void guarded(async()=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-close')){panel.close();return;}
  if(b.dataset.tab){panel.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==b.dataset.tab);panel.querySelectorAll('[data-tab]').forEach(t=>t.setAttribute('aria-current',t===b?'page':'false'));if(b.dataset.tab==='queue')await artists();if(b.dataset.tab==='results')await results();return;}
  if(b.hasAttribute('data-sync')){await call('/sync',{body:{}});message('색인 정보를 읽는 중입니다. 음악 파일·운영 DB는 변경하지 않습니다.');}
  if(b.dataset.enqueue){await call('/queue',{body:{artist_keys:[b.dataset.enqueue]}});message('작업을 등록했습니다. 시작 버튼으로 실행하세요.');}
  if(b.dataset.job){await call('/control',{body:{id:b.dataset.job,action:b.dataset.action}});message('작업 상태를 변경했습니다.');}
  if(b.dataset.researchAlbum){const {mountAiResearch}=await import('./ai-research.js');const host=b.parentElement.querySelector('[data-research-host]');host.researchDispose?.();host.replaceChildren();const dispose=mountAiResearch({container:host,albumId:b.dataset.researchAlbum,canManage,api});host.researchDispose=dispose;researchDisposers.add(dispose);host.querySelector('details').open=true;return;}
  if(b.dataset.review){await call('/review',{body:{id:b.dataset.review,state:b.dataset.state}});message('검토 상태를 기록했습니다. 운영 DB는 변경하지 않았습니다.');await results();}
  if(b.hasAttribute('data-artist-next')){artistOffset+=100;await artists();}if(b.hasAttribute('data-artist-prev')){artistOffset=Math.max(0,artistOffset-100);await artists();}
  if(b.hasAttribute('data-result-next')){resultOffset+=50;await results();}if(b.hasAttribute('data-result-prev')){resultOffset=Math.max(0,resultOffset-50);await results();}
  await refresh();
 }));
 $('[data-type-filter]').onchange=event=>{typeFilter=event.target.value;resultOffset=0;void guarded(results);};
 $('[data-search]').onsubmit=event=>{event.preventDefault();query=new FormData(event.currentTarget).get('search');artistOffset=0;void guarded(artists);};
 $('[data-limits]').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;void guarded(async()=>{await call('/settings',{body:limitPayload(new FormData(form))});message('한도를 저장했습니다. 작업은 별도로 시작하세요.');await refresh();});};
 timer=setInterval(()=>void guarded(refresh),10000);await guarded(refresh);
 return {close:()=>panel.close()};
}
