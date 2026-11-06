import {typeNote} from './ai-type-presentation.js';
import {originalDateRows,dateChoice,dateChoicePatch,parseOriginalDate} from './ai-original-date.js';
/** Field decisions are proposals only. No Catalog/Tag apply. */
export const fieldMap={artist:'work.artist',title:'work.title',category:'work.album_type',original_year:'work.original_year',original_date:'work.original_date',genre:'work.genre',secondary_genres:'work.secondary_genres',styles:'work.styles',release_attributes:'work.release_attributes',release_year:'edition.year',release_date:'edition.date',label:'edition.label',catalog_number:'edition.catalog_number',country:'edition.country',edition:'edition.attributes'};
export const fieldPaths=new Set(Object.values(fieldMap));
export const emptyValue=v=>v==null||(Array.isArray(v)?v.length===0||v.every(emptyValue):typeof v==='string'&&['','미확인','미분류','정보 없음','정보없음','실제 정보 없음','unknown','n/a','none','null','not available'].includes(v.trim().toLowerCase()));
export function valueRisk(before,after){
 const a=String(before??''),b=String(after??''),date=/^\d{4}(?:-\d{2})?(?:-\d{2})?$/;
 const datePair=date.test(a)&&date.test(b),lessDate=datePair&&a.length>b.length,moreDate=datePair&&b.length>a.length;
 const samePrefix=datePair&&(a.startsWith(b)||b.startsWith(a));
 const loss=!emptyValue(before)&&(emptyValue(after)||lessDate);
 return {loss,precision:lessDate?(samePrefix?'기존 날짜가 더 상세함':'정밀도 감소·날짜 충돌'):moreDate?(samePrefix?'AI 날짜가 더 상세함 · 추가 검증 필요':'정밀도 증가·날짜 충돌'):null,conflict:!emptyValue(before)&&!emptyValue(after)&&JSON.stringify(before)!==JSON.stringify(after)&&!samePrefix};
}
export function recommendation(r){
 const path=r.path||fieldMap[r.field]||r.field;
 const normalized=v=>Array.isArray(v)?v.map(x=>String(x).trim().toLowerCase()).sort():typeof v==='string'?v.trim().toLowerCase():v;
 const equal=JSON.stringify(normalized(r.before))===JSON.stringify(normalized(r.after))||(emptyValue(r.before)&&emptyValue(r.after));
 const valid=path==='work.genre'?typeof r.after==='string'&&r.after.trim().length<=100&&!emptyValue(r.after):path==='work.secondary_genres'?Array.isArray(r.after)&&r.after.length<=20&&r.after.length>0&&r.after.every(x=>typeof x==='string'&&x.trim().length<=100&&!emptyValue(x)):false;
 if(r.protected||r.loss)return {defaultChoice:'keep',recommendationReason:r.protected?'보호된 기존 정보를 유지합니다.':'기존 정보 손실을 막기 위해 유지합니다.'};
 if(!r.changed||equal)return {defaultChoice:'keep',recommendationReason:'실질적으로 같은 값입니다.'};
 if(r.confidence?.status==='BLOCK'||r.adoptionBlocked||r.identityUncertain)return {defaultChoice:'defer',recommendationReason:'근거 충돌 또는 앨범 식별 확인이 필요합니다.'};
 if(emptyValue(r.before)&&valid)return {defaultChoice:'adopt',optimistic:true,recommendationReason:'빈 분류를 보완하는 유효한 AI 제안입니다. 직접 검토 후 저장하세요.'};
 return {defaultChoice:'defer',recommendationReason:r.precision||'기존 정보와 차이가 있어 근거를 확인하세요.'};
}
const contractEmpty=v=>v==null||v===''||(Array.isArray(v)&&v.length===0)||['미확인','unknown'].includes(String(v).toLowerCase());
export function selectionRows(rows){return rows.map(r=>{const path=fieldMap[r.field]||r.field;const risk=valueRisk(r.before,r.after),changed=r.changed&&!(contractEmpty(r.before)&&contractEmpty(r.after));const row={...r,path,...risk,loss:r.loss===true||risk.loss,changed,supported:fieldPaths.has(path),candidate:emptyValue(r.before)&&!emptyValue(r.after)};return {...row,...recommendation(row)};});}
export function initialChoices(rows){return Object.fromEntries(rows.filter(r=>r.supported).map(r=>[r.path,r.defaultChoice]));}
export function selectionBlock(p,rows,choices){
 if(p.stale!==false||!p.input_fingerprint)return '최신 fingerprint 일치가 확인되지 않았습니다.';
 if(p.reviewable===false||p.taxonomy_review)return '서버의 읽기 전용 또는 분류 재검토 제한입니다.';
 if(rows.some(r=>!r.supported))return '등록되지 않은 필드 경로가 있습니다.';
 for(const r of rows){const c=choices[r.path];if(!['keep','adopt','defer'].includes(c)||(r.changed&&c==='defer'))return '보류·미선택 항목을 모두 결정하세요.';if(c==='adopt'&&(r.protected||r.loss))return '보호값 또는 정보 손실 항목은 기존 값을 유지해야 합니다.';}
 return '';
}
/** Gate C only accepts the preserved G3-1C operational GET contract. */
const same=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
function normalize(v){return Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v??null;}
export function validateSelectionRead(p,rows,d){
 const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
 if(d?.capability!=='field_selections_v1'||d.protocol_version!==1||d.environment!=='operational'||d.catalog_updated!==false||d.apply_enabled!==false)throw Error('운영 읽기 계약 불일치');
 if(!p.id||!p.album_id||d.proposal_id!==p.id||d.album_id!==p.album_id||!hash(d.input_fingerprint)||d.input_fingerprint!==p.input_fingerprint)throw Error('제안·앨범 ID 또는 fingerprint 불일치');
 if(!hash(d.snapshot_digest)||!hash(d.proposal_revision)||(p.snapshot_digest&&p.snapshot_digest!==d.snapshot_digest)||(p.proposal_revision&&p.proposal_revision!==d.proposal_revision))throw Error('snapshot 또는 제안 버전 불일치');
 if(!d.fields||typeof d.fields!=='object'||Array.isArray(d.fields)||Object.keys(d.fields).length!==rows.length||new Set(rows.map(r=>r.path)).size!==rows.length)throw Error('운영 필드 목록 불일치');
 for(const r of rows){const f=d.fields[r.path];if(!r.supported||!f||!same(f.before,r.before)||!same(f.after,r.after)||typeof f.protected!=='boolean'||f.protected!==r.protected||typeof f.loss!=='boolean'||typeof f.changed!=='boolean'||f.changed!==!!r.changed)throw Error('운영 현재값·후보값·보호 상태 불일치');}
 const merged=rows.map(r=>({...r,loss:r.loss||d.fields[r.path].loss}));
 let choices=initialChoices(merged.map(r=>({...r,...recommendation(r)})));
 if(d.review!=null){const v=d.review;
  if(v.proposal_id!==p.id||v.album_id!==p.album_id||v.input_fingerprint!==p.input_fingerprint||v.snapshot_digest!==d.snapshot_digest||!Number.isInteger(v.revision)||v.revision<1||!['draft','finalized','cancelled'].includes(v.state)||v.proposal_review_state!==p.review_state||v.proposal_review_state!==(v.state==='finalized'?'confirmed':'pending'))throw Error('저장된 검토 snapshot 불일치');
  const saved=JSON.parse(v.choices),fields=JSON.parse(v.fields);
  if(!same(fields,d.fields)||!saved||Object.keys(saved).length!==rows.length)throw Error('저장된 검토 필드 불일치');
  for(const r of merged){const c=saved[r.path];if(!['keep','adopt','defer'].includes(c)||((r.protected||!r.changed)&&c!=='keep')||(r.loss&&c==='adopt')||(v.state==='finalized'&&c==='defer'))throw Error('저장된 검토 선택 불일치');}
  choices=saved;
 }
 return {rows:merged,choices};
}
export function draftPolicyAllowed(d){const w=d?.write_policy;return w?.version===1&&w.draft_save_enabled===true&&w.finalize_enabled===false&&w.cancel_enabled===false&&w.audit_receipts===true;}
export function validateDraftReceipt(body,receipt,read){
 if(!draftPolicyAllowed(receipt)||!draftPolicyAllowed(read)||receipt?.ok!==true||receipt.state!=='draft'||receipt.review_state!=='pending'||receipt.catalog_updated!==false||receipt.apply_enabled!==false||receipt.revision!==body.expected_revision+1)throw Error('초안 저장 영수증 불일치');
 for(const k of ['proposal_id','album_id','input_fingerprint','snapshot_digest'])if(receipt[k]!==body[k]||read[k]!==body[k])throw Error('저장·재조회 식별자 불일치');
 if(!same(receipt.choices,body.choices)||!read.review||read.review.state!=='draft'||read.review.revision!==receipt.revision||read.review.reviewer!==receipt.reviewer||!same(JSON.parse(read.review.choices),body.choices))throw Error('저장 후 결정 재조회 불일치');
 for(const d of [receipt,read])if(d.audit?.recorded!==true||d.audit.operation_id!==body.operation_id||d.audit.revision!==receipt.revision||d.audit.reviewer!==receipt.reviewer||d.audit.state!=='draft')throw Error('기존 감사 원장 확인 실패');
 return true;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>emptyValue(v)?'미확인':typeof v==='object'?JSON.stringify(v):String(v);
export function mountFieldSelection({host,proposal:p,rows:baseRows,api,canManage,signal,onSaved,cache,confidencePending=false}){
 let rows=selectionRows(baseRows.map(r=>({...r,identityUncertain:r.identityUncertain||p.taxonomy_review===true||p.stale!==false})));const key=JSON.stringify([p.id,p.input_fingerprint,p.current,p.result,p.protected]);
 let state=cache.get(p.id);
 if(!state||(state.key!==key&&!state.dirty)){state={key,choices:initialChoices(rows),revision:0,snapshot:null,available:false,dirty:false,uncertain:false};cache.set(p.id,state);}
 state.available=false;let showSame=false,stopped=false,busy=true,message='운영 AI 제안·검토 기록 조회 중…';const abort=new AbortController();
 const check=()=>{if(stopped||!canManage())throw Error('관리자 권한이 변경되었습니다.');};
 const request=(suffix='',body)=>{check();if(body!==undefined&&(suffix||body.action!=='save'||!state.writeAllowed))throw Error('초안 저장 외 요청은 차단됩니다.');return api('/v2/ai-classification/review-selections'+suffix,{admin:true,...(body===undefined?{}:{body}),signal:AbortSignal.any([...(signal?[signal]:[]),abort.signal,AbortSignal.timeout(20000)])});};
 function sourceValues(r,side){if(!r.members)return '';return r.members.map(m=>{const d=parseOriginalDate(m[side]),precision=d?['','연도','연월','연월일'][d.precision]:'미확인/원문';return `<small class="date-source"><span>${esc(m.path)}</span>: ${esc(format(m[side]))} · ${esc(precision)}</small>`;}).join('');}
 function choiceControls(r,i){
  const lockedReason=!state.available?'운영 응답 일치 확인 전에는 선택할 수 없습니다.':busy?'조회·저장 중에는 변경할 수 없습니다.':state.uncertain?'저장 결과 확인 전에는 변경할 수 없습니다.':state.savedState==='finalized'?'기존 확정 기록입니다. Gate C에서는 조회만 가능합니다.':r.protected?'수동 보호 항목은 기존 유지로 고정됩니다.':!r.changed?'동일한 값은 변경 대상에서 제외됩니다.':'';
  const lossReason=r.loss?(r.members?'원본 필드 정보 손실 제한 · 통합 채택 불가':r.precision?'AI 제안의 날짜 정밀도가 낮아 채택할 수 없습니다.':'기존 정보가 사라지는 AI 제안은 채택할 수 없습니다.'):'';
  const reason=lockedReason||lossReason||(r.members&&dateChoice(r,state.choices)==='mixed'?'기존 필드별 선택이 다릅니다. 통합 선택을 다시 확인하세요.':''),reasonId='field-choice-reason-'+i;
  return `<div class="field-radio-group" role="radiogroup" aria-label="${esc(r.label)} 선택" ${reason?`aria-describedby="${reasonId}"`:''}>${[['keep','기존 유지'],['adopt','AI 채택'],['defer','보류']].map(([value,label])=>{const disabled=!!lockedReason||(value==='adopt'&&((confidencePending&&!r.optimistic)||r.loss||r.adoptionBlocked||r.confidence?.status==='BLOCK'||p.stale!==false||p.reviewable===false||p.taxonomy_review));return `<label class="field-radio ${disabled?'is-disabled':''}"><input type="radio" name="field-choice-${esc(p.id)}-${i}" aria-label="${esc(r.label)} · ${label}" data-field-choice="${i}" value="${value}" ${dateChoice(r,state.choices)===value?'checked':''} ${disabled?'disabled':''}><span>${label}${value==='adopt'&&r.defaultChoice==='adopt'?' 추천':''}</span></label>`;}).join('')}</div>${reason?`<small class="field-choice-reason" id="${reasonId}">${esc(reason)}</small>`:''}`;
 }
 function paint(){if(stopped)return;const viewRows=originalDateRows(rows),folded=r=>r.path==='edition.year'||!r.changed&&!r.explicitDateProposal;const blocked=p.stale!==false?'최신 입력 일치 미확인 · 채택 불가':p.reviewable===false||p.taxonomy_review?'서버 읽기 전용·분류 재검토 제한 · 채택 불가':'';const counts={keep:0,adopt:0,defer:0};for(const r of viewRows){const c=dateChoice(r,state.choices);if(c in counts)counts[c]++;}
 host.innerHTML=`<p class="proposal-note">${state.writeAllowed?'채택·유지·보류를 검토 초안으로 저장합니다. 확정·Catalog 반영은 차단됩니다.':'검토는 화면 초안입니다. NAS 초안 저장 연결 전까지 저장은 차단됩니다.'}</p><div class="field-selection-table"><div class="field-row field-head"><span>항목</span><span>현재 데이터</span><span>AI 제안·신뢰도</span><span>관리자 선택</span></div>${viewRows.map((r,i)=>({r,i})).filter(({r})=>showSame||!folded(r)).sort((a,b)=>Number(b.r.changed)-Number(a.r.changed)).map(({r,i})=>`<div class="field-row ${r.changed?'changed':'same'}"><div><strong>${esc(r.label)}</strong><small>${r.protected?'수동 보호 · 유지 고정':r.changed?'차이 있음':'동일 · 변경 제외'}</small></div><div><small class="field-mobile-label">현재 데이터</small>${esc(format(r.before))}${sourceValues(r,'before')}</div><div><small class="field-mobile-label">Gemini AI 제안</small>${esc(format(r.after))}${sourceValues(r,'after')}${typeNote(r.path,r.after)?`<small>${esc(typeNote(r.path,r.after))}</small>`:''}${r.confidence?`<details class="field-confidence"><summary>근거 보기</summary><strong>${esc(r.confidence.label)}</strong>${(r.confidence.evidence||[]).map(x=>`<small>${esc(x)}</small>`).join('')}${(r.confidence.blockers||[]).map(x=>`<small>${esc(x)}</small>`).join('')}</details>`:''}<small>${esc(r.recommendationReason||r.precision||'')}</small></div><div>${r.supported?choiceControls(r,i):'등록되지 않은 필드 · 확정 차단'}</div></div>`).join('')}</div><div class="proposal-actions"><button type="button" data-toggle-same>${showSame?'기본 검토만 보기':'동일 항목·소장판 연도 보기'} (${viewRows.filter(folded).length})</button><button type="button" data-keep-all ${busy||state.uncertain||!state.available||state.savedState==='finalized'?'disabled':''}>기존 값 모두 유지</button><button type="button" data-selection-save ${busy||!state.available||!state.writeAllowed||!state.dirty||state.uncertain||state.savedState==='finalized'||p.stale!==false||p.reviewable===false||p.taxonomy_review?'disabled':''}>검토 결과 저장</button>${state.uncertain?'<button type="button" data-selection-recheck>저장 결과 재조회</button>':''}</div><p role="status" data-draft-status>${esc(message)}</p><p>유지 ${counts.keep} · 채택 ${counts.adopt} · 보류 ${counts.defer}${state.dirty?' · 화면 초안 변경 있음 · 서버 미저장':''}</p>${!state.available&&!busy?`<p class="proposal-warning">${esc(message)}</p>`:''}<details><summary>조회·저장 제한 확인</summary><p>선택 revision ${state.revision} · snapshot ${esc(state.snapshot||'미확인')}</p>${rows.some(r=>r.path==='work.original_year'||r.path==='work.original_date')?`<details><summary>원발매일 원본 필드·선택 대응</summary>${rows.filter(r=>r.path==='work.original_year'||r.path==='work.original_date').map(r=>`<p>${esc(r.path)}: ${esc(format(r.before))} → ${esc(format(r.after))} · ${esc(state.choices[r.path])}${r.loss?' · 원본 loss 차단':''}${r.protected?' · 보호':''}${r.confidence?` · ${esc(r.confidence.label)} · ${esc((r.confidence.evidence||[]).join(' / '))}`:''}</p>`).join('')}</details>`:''}<p data-selection-message role="status">${esc(message)}</p>${blocked?`<p class="proposal-warning">${esc(blocked)}</p>`:''}<p>기존 앨범 전체 검토 상태(${esc(p.review_state)})와 항목 선택 확정은 별도입니다. 서버 측 확정 차단 보장 전에는 finalize를 허용하지 않습니다.</p></details>`;
 }
 async function read(){try{const d=await request('?proposal_id='+encodeURIComponent(p.id));check();
  const validated=validateSelectionRead(p,rows,d);
  if(state.dirty&&(state.key!==key||state.snapshot!==d.snapshot_digest||state.proposalRevision!==d.proposal_revision||state.revision!==(d.review?.revision||0))){state.available=false;message='서버 정보가 변경됐습니다. 직접 선택한 초안은 유지되며 저장은 차단됩니다. 새 제안을 확인하세요.';return;}
  rows=validated.rows;
  // Reuse local drafts only for exactly the same server snapshot and revision.
  const preserve=state.dirty&&state.snapshot===d.snapshot_digest&&state.proposalRevision===d.proposal_revision&&state.revision===(d.review?.revision||0);
  state.choices=preserve?state.choices:validated.choices;
  for(const r of rows)if(r.protected||!r.changed||r.loss&&state.choices[r.path]==='adopt')state.choices[r.path]='keep';
  state.dirty=preserve||(!d.review&&Object.values(state.choices).includes('adopt'));state.available=true;state.snapshot=d.snapshot_digest;state.proposalRevision=d.proposal_revision;state.revision=d.review?.revision||0;state.savedState=d.review?.state;state.writeAllowed=draftPolicyAllowed(d);state.serverRead=d;
  message=state.writeAllowed?'필드 일치 확인 · 검토 초안 저장 가능 · 확정·Catalog 반영 차단':'운영 GET 연결 · NAS 초안 저장 패치 미설치 또는 비활성 · 저장 차단';
 }catch(e){state.available=false;message='운영 조회 확인 실패: '+e.message+' · 선택·저장은 차단됩니다.';}
 finally{busy=false;paint();}}
 async function save(){
  try{check();if(busy||!state.available||!state.writeAllowed||!state.dirty||state.uncertain||state.savedState==='finalized'||p.stale!==false||p.reviewable===false||p.taxonomy_review)return;
   for(const r of rows){const c=state.choices[r.path];if(!r.supported||!['keep','adopt','defer'].includes(c)||((r.protected||!r.changed)&&c!=='keep')||(c==='adopt'&&((confidencePending&&!r.optimistic)||r.loss||r.adoptionBlocked||r.confidence?.status==='BLOCK')))throw Error('보호·정보 손실·선택 상태를 확인하세요.');}
   state.pendingBody={proposal_id:p.id,album_id:p.album_id,input_fingerprint:p.input_fingerprint,snapshot_digest:state.snapshot,expected_revision:state.revision,operation_id:crypto.randomUUID(),action:'save',choices:{...state.choices}};
   busy=true;message='검토 초안 저장·재조회 중…';paint();
   let receipt;
   try{receipt=await request('',state.pendingBody);}catch(e){state.uncertain=true;throw e;}
   check();state.pendingReceipt=receipt;
   await verifySaved();
  }catch(e){if(!stopped){state.uncertain=!!state.pendingBody;message='저장 확인 미완료: '+e.message+' · 자동 재전송하지 않습니다.';}}
  finally{busy=false;paint();}
 }
 async function verifySaved(){
  const d=await request('?proposal_id='+encodeURIComponent(p.id));check();
  validateSelectionRead(p,rows,d);
  const receipt=state.pendingReceipt||{...d.review,ok:true,choices:d.review?JSON.parse(d.review.choices):{},review_state:d.review?.proposal_review_state,catalog_updated:d.catalog_updated,apply_enabled:d.apply_enabled,write_policy:d.write_policy,audit:d.audit};
  validateDraftReceipt(state.pendingBody,receipt,d);
  state.revision=d.review.revision;state.savedState='draft';state.choices=JSON.parse(d.review.choices);state.serverRead=d;state.dirty=false;state.uncertain=false;state.pendingBody=null;state.pendingReceipt=null;
  message='검토 초안 저장·재조회·감사 기록 확인 완료 · 확정·Catalog 반영 없음';onSaved?.(d);
 }
 async function recheck(){if(busy||!state.pendingBody)return;busy=true;try{await verifySaved();}catch(e){message='저장 결과 미확정: '+e.message+' · 재전송 없이 조회만 수행했습니다.';}finally{busy=false;paint();}}
 host.addEventListener('change',change);function change(e){const n=e.target.dataset.fieldChoice;if(n===undefined||state.uncertain||busy||!state.available||!canManage()||state.savedState==='finalized')return;const r=originalDateRows(rows)[Number(n)],value=e.target.value;if(!r||r.protected||!r.changed||!['keep','adopt','defer'].includes(value)||value==='adopt'&&((confidencePending&&!r.optimistic)||r.loss||r.adoptionBlocked||r.confidence?.status==='BLOCK'||p.stale!==false||p.reviewable===false||p.taxonomy_review))return;Object.assign(state.choices,r.members?dateChoicePatch(r,value):{[r.path]:value});state.touched=true;state.dirty=true;paint();host.querySelector(`input[data-field-choice="${n}"][value="${value}"]`)?.focus?.({preventScroll:true});}
 host.addEventListener('click',click);function click(e){const b=e.target.closest('button');if(!b||b.disabled)return;if(b.hasAttribute('data-selection-save')){void save();return;}if(b.hasAttribute('data-selection-recheck')){void recheck();return;}if(b.hasAttribute('data-toggle-same')){showSame=!showSame;paint();}if(b.hasAttribute('data-keep-all')&&!state.uncertain&&state.available&&canManage()&&state.savedState!=='finalized'){for(const r of rows)if(r.supported)state.choices[r.path]='keep';state.touched=true;state.dirty=true;paint();}}
 paint();void read();const dispose=()=>{stopped=true;abort.abort();host.removeEventListener('change',change);host.removeEventListener('click',click);};
 dispose.setConfidence=bindings=>{if(stopped)return;confidencePending=false;rows=rows.map(r=>{const next={...r,confidence:bindings.get(r.path)};return {...next,...recommendation(next)};});if(state.available&&!state.touched&&!state.serverRead?.review){state.choices=initialChoices(rows);state.dirty=Object.values(state.choices).includes('adopt');}paint();};return dispose;
}
