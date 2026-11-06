import {catalogLink} from './catalog-links.js';
import {mountFieldSelection,fieldMap,selectionRows,validateSelectionRead} from './ai-field-selection.js';
/** NAS proposal review only. No catalog mutation, analysis enqueue or trial fallback. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const reviewLabels={pending:'신규·보류',confirmed:'제안 승인',rejected:'반려'};
const labels={artist:'아티스트',title:'앨범명',original_year:'원발매년도',original_date:'원발매일',release_year:'소장판 연도',release_date:'소장판 발매일',genre:'장르',secondary_genres:'보조 장르',styles:'스타일',album_type:'앨범 유형',category:'앨범 유형',label:'레이블',catalog_number:'카탈로그 번호',country:'국가',year:'발매년도',date:'발매일',attributes:'판본 속성',release_attributes:'발매 속성'};
const fmt=v=>v==null||v===''?'미확인':typeof v==='object'?JSON.stringify(v):String(v);
const when=v=>typeof v==='number'&&Number.isFinite(v)?new Date(v*1000).toLocaleString('ko-KR'):'API 미제공';
const mappings={artist:'artist',title:'title',album_type:'category',original_year:'original_year',original_date:'original_date',genre:'genre',secondary_genres:'secondary_genres',styles:'styles',year:'release_year',date:'release_date',label:'label',catalog_number:'catalog_number',country:'country',attributes:'edition'};
export function proposalRows(p){
 if(!p||!Array.isArray(p.comparison)||!p.result||typeof p.result!=='object')throw Error('제안 응답 형식 오류: comparison 배열과 result가 필요합니다.');
 const rows=p.comparison.map(c=>({...c,field:String(c.field??c.path??''),protected:c.manual_protected===true||c.protected===true||(p.protected||[]).includes(c.field)||(p.protected||[]).includes(fieldMap[c.field])}));
 for(const section of ['work','edition'])for(const [key,value] of Object.entries(p.result[section]||{})){
  const field=mappings[key]||key,path=section+'.'+key;
  if(rows.some(r=>r.field===field||r.field===path))continue;
  rows.push({field:path,before:p.current?.[field],after:value,protected:(p.protected||[]).includes(field)||(p.protected||[]).includes(path)});
 }
 return rows.map(r=>({...r,label:labels[r.field.split('.').at(-1)]||r.field,changed:JSON.stringify(r.before??null)!==JSON.stringify(r.after??null)}));
}
export function approvalBlock(p){
 if(p.stale!==false)return '현재 입력과의 일치 여부를 확인해야 승인할 수 있습니다.';
 if(p.reviewable===false)return '이 응답은 읽기 전용입니다. 서버의 검토 권한을 확인하세요.';
 if(p.taxonomy_review)return '분류 정책 재검토가 필요한 제안입니다.';
 if(proposalRows(p).some(r=>r.protected&&r.changed))return '수동 보호값과 다른 제안이 있습니다. 관리자 확인이 필요합니다.';
 return '';
}
/** Identity binding only: verdicts are supplied by the existing v2 API, never inferred. */
export function bindConfidenceRows(p,baseRows,selection,data){
 const bindings=new Map();let omitted=0;
 validateSelectionRead(p,selectionRows(baseRows),selection);
 const paths=new Map(baseRows.map(r=>[fieldMap[r.field]||r.field,r]));
 const groups=new Map();
 for(const c of data){
  if(c.album_id!==p.album_id)continue;
  const path=c.field==='album_type'?'work.album_type':fieldMap[c.field]||c.field;
  if(!groups.has(path))groups.set(path,[]);groups.get(path).push(c);
 }
 const comparable=v=>v==null?'':typeof v==='object'?JSON.stringify(v):String(v);
 for(const [path,items] of groups){const c=items[0],r=paths.get(path);
  if(items.length!==1||!r||c.proposal_id!==p.id||c.input_fingerprint!==p.input_fingerprint||
    (c.proposal_revision!==undefined&&c.proposal_revision!==selection.proposal_revision)||
    (c.snapshot_digest!==undefined&&c.snapshot_digest!==selection.snapshot_digest)||
    (c.protected!==undefined&&c.protected!==r.protected)||
    c.before!==comparable(r.before)||c.candidate!==comparable(r.after)) {omitted+=items.length;continue;}
  bindings.set(path,{...c,label:window.VinylRoomConfidenceV2.states[c.status]});
 }
 return {bindings,omitted};
}
function detail(p){
 const blocked=approvalBlock(p);
 return `<h3>${catalogLink('artist',p.current?.artist||p.artist,p.current?.artist||p.artist||'아티스트 미상')} — ${catalogLink('album',p.album_id,p.title||p.current?.title||'앨범명 미상')}</h3>${blocked?`<p class="proposal-warning">${esc(blocked)}</p>`:''}<p data-confidence-status role="status" hidden></p><div data-field-selection></div><details><summary>근거·기술적 진단</summary><p>${esc(p.model||'모델 정보 미제공')} · ${esc(when(p.created))}</p><p>앨범 ID ${esc(p.album_id)} · 제안 ID ${esc(p.id)}</p><p>fingerprint ${esc(p.input_fingerprint)}</p><p data-confidence-diagnostic></p><button type="button" data-confidence-export disabled>신뢰도 자료 JSON 저장</button>${['basis','uncertainties','external_verification_needed','dimensions','research','verification','owned_edition_verified'].filter(k=>p.result[k]!==undefined).map(k=>`<details><summary>${esc(({basis:'근거',uncertainties:'불확실성',external_verification_needed:'외부 검증 필요',dimensions:'분류 차원',research:'연구 정보',verification:'검증 상태',owned_edition_verified:'소장판 검증 여부'})[k])}</summary><pre>${esc(JSON.stringify(p.result[k],null,2))}</pre></details>`).join('')}<p>현재 검토: ${esc(reviewLabels[p.review_state]||p.review_state)} · ${esc(when(p.reviewed))}</p></details>`;
}
export function mountProposalReview({container,api,canManage}){
 if(!canManage())throw Error('승인된 관리자만 이용할 수 있습니다.');
 const doc=container.ownerDocument,abort=new AbortController();let disposed=false,loading=false,offset=0,items=[],selected=null,seq=0,detailSeq=0,detailKey='',exportRows=[];
 const selectionCache=new Map(),readCache=new Map(),confidencePages=new Map();let disposeSelection=null;
 const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('./ai-proposal-review.css',import.meta.url).href;doc.head.append(style);
 container.innerHTML=`<div class="nas-proposals"><div class="proposal-tools"><input type="search" data-find aria-label="앨범·아티스트 검색" placeholder="앨범·아티스트 검색"><select data-filter aria-label="제안 검토 상태"><option value="active">검토할 항목</option><option value="confirmed">승인 완료</option><option value="rejected">반려 완료</option><option value="">전체 이력</option></select><button type="button" data-refresh>새로고침</button></div><p data-message role="status" aria-live="polite"></p><div class="proposal-layout"><div><div data-list role="list" aria-label="AI 제안 목록"></div><div class="proposal-pager"><button type="button" data-prev>이전</button><small data-page></small><button type="button" data-next>다음</button></div></div><article data-detail aria-label="선택한 AI 앨범 분류 관리"></article></div></div>`;
 const q=s=>container.querySelector(s),message=s=>{if(!disposed)q('[data-message]').textContent=s;};
 function check(){if(disposed||!canManage())throw Error('관리자 권한을 다시 확인하세요.');}
 const get=(path,opts={})=>{check();if(opts.body!==undefined||opts.method&&opts.method!=='GET')throw Error('운영 저장·확정은 차단되어 있습니다.');return api(path,{admin:true,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])});};
 const cachedGet=(path,opts={})=>{check();if(opts.body!==undefined||opts.method&&opts.method!=='GET')throw Error('읽기 전용 화면입니다.');if(!readCache.has(path))readCache.set(path,get(path,opts));return readCache.get(path);};
 const selectionApi=(path,opts={})=>{
  check();const base='/v2/ai-classification/review-selections';
  if(opts.body!==undefined){if(path!==base||opts.body.action!=='save')throw Error('검토 초안 저장만 허용됩니다.');readCache.delete(base+'?proposal_id='+encodeURIComponent(opts.body.proposal_id));return api(path,{...opts,admin:true});}
  // Re-read saved decisions from NAS; never satisfy save verification from a stale promise.
  if(path.startsWith(base+'?'))return get(path,opts);
  return cachedGet(path,opts);
 };
 function confidencePage(pageOffset){
  if(!confidencePages.has(pageOffset))confidencePages.set(pageOffset,(async()=>{
   await Promise.all([import('./admin-ai-confidence-v2.js'),import('./admin-ai-results-bridge-v2.js')]);check();
   return window.VinylRoomAIResultsBridgeV2.load({isAdmin:()=>!disposed&&canManage(),offset:pageOffset,pages:1,requestAdminJSON:cachedGet});
  })());return confidencePages.get(pageOffset);
 }
 async function attachConfidence(p,rows,mounted,n,pageOffset){
  try{const [selection,data]=await Promise.all([cachedGet('/v2/ai-classification/review-selections?proposal_id='+encodeURIComponent(p.id)),confidencePage(pageOffset)]);check();if(n!==detailSeq)return;
   const result=bindConfidenceRows(p,rows,selection,data);mounted.setConfidence(result.bindings);
   exportRows=[...result.bindings.values()];
   q('[data-confidence-status]').textContent=result.bindings.size?'신뢰도 연결 확인 '+result.bindings.size+'개 필드':'신뢰도 연결 미확인 · 판정 합치지 않음';
   q('[data-confidence-diagnostic]').textContent='제안·앨범 ID, fingerprint, 필드 및 전후 값 일치 확인. 연결 불가 '+result.omitted+'건은 표시하지 않습니다. API가 제공하지 않는 ID·버전은 추정하지 않습니다.';
   q('[data-confidence-export]').disabled=!exportRows.length;
  }catch(e){if(disposed||n!==detailSeq)return;mounted.setConfidence(new Map());q('[data-confidence-status]').textContent='신뢰도 연결 미확인 · 현재값·제안 조회 유지';q('[data-confidence-diagnostic]').textContent=e.message;}
 }
 function paint(){
  if(disposed)return;
  const term=q('[data-find]').value.trim().toLocaleLowerCase(),filter=q('[data-filter]').value;
  const shown=items.filter(p=>(filter==='active'?!(['confirmed','rejected'].includes(p.review_state)&&p.stale!==true):(!filter||p.review_state===filter))&&[p.artist,p.title,p.current?.artist,p.current?.title].some(v=>String(v??'').toLocaleLowerCase().includes(term)));
  if(!shown.some(p=>p.id===selected))selected=shown[0]?.id??null;
  q('[data-list]').innerHTML=shown.map(p=>`<button role="listitem" type="button" data-proposal="${esc(p.id)}" aria-pressed="${p.id===selected}"><strong>${esc(p.artist||p.current?.artist||'아티스트 미상')}</strong><span>${esc(p.title||p.current?.title||'앨범명 미상')}</span><small>${esc(reviewLabels[p.review_state]||p.review_state)}${p.stale?' · 입력 변경됨':''}</small></button>`).join('')||'<p>조건에 맞는 제안이 없습니다.</p>';
  const p=items.find(p=>p.id===selected),key=p?JSON.stringify([p.id,p.input_fingerprint,p.current,p.result,p.protected,p.review_state]):'';
  if(key!==detailKey){detailKey=key;const n=++detailSeq;disposeSelection?.();disposeSelection=null;exportRows=[];q('[data-detail]').innerHTML=p?detail(p):(shown.length?'제안을 선택하세요.':'현재 조회 페이지에 해당 상태의 제안이 없습니다. 다른 페이지 또는 전체 이력을 확인하세요.');
   if(p){const rows=proposalRows(p);const mounted=mountFieldSelection({host:q('[data-field-selection]'),proposal:p,rows,api:selectionApi,canManage,signal:abort.signal,cache:selectionCache,confidencePending:true});disposeSelection=mounted;void attachConfidence(p,rows,mounted,n,offset);}
  }
  q('[data-prev]').disabled=loading||offset===0;q('[data-next]').disabled=loading||items.length<50;q('[data-refresh]').disabled=loading;
  q('[data-page]').textContent=`${Math.floor(offset/50)+1}페이지 · 표시 ${shown.length}건 / 조회 ${items.length}건`;
 }
 async function load(){
  if(loading||disposed)return;loading=true;const n=++seq;message('NAS 제안 조회 중…');paint();
  try{const d=await get('/v2/ai-classification/results?offset='+offset);check();if(n!==seq)return;if(!Array.isArray(d?.items))throw Error('제안 목록 응답 형식 오류');for(const p of d.items)proposalRows(p);items=d.items;detailSeq++;readCache.clear();confidencePages.clear();message(items.length?'검토할 항목을 우선 표시합니다. 승인·반려된 제안은 상태 필터에서 다시 조회할 수 있으며 NAS 기록은 보존됩니다.':'저장된 AI 제안이 없습니다.');}
  catch(e){if(!disposed){message('조회 실패: '+e.message+' · 이전 화면과 선택을 유지합니다.');}}
  finally{loading=false;if(!disposed)paint();}
 }
 container.addEventListener('click',onClick);function onClick(e){const b=e.target.closest('button');if(!b||b.disabled||disposed)return;if(b.dataset.proposal){selected=b.dataset.proposal;paint();}if(b.hasAttribute('data-refresh'))void load();if(b.hasAttribute('data-next')&&!loading){offset+=50;void load();}if(b.hasAttribute('data-prev')&&!loading){offset=Math.max(0,offset-50);void load();}if(b.hasAttribute('data-confidence-export')){check();window.VinylRoomConfidenceV2.exportDraft(exportRows);}}
 q('[data-find]').oninput=paint;q('[data-filter]').onchange=paint;void load();
 return ()=>{disposed=true;seq++;detailSeq++;disposeSelection?.();abort.abort();container.removeEventListener('click',onClick);style.remove();container.replaceChildren();};
}
