/* Vinyl Room Phase 4 - confidence v2 admin review, additive browser module.
 * Requires host's real admin session via isAdmin() callback; never calls remote API.
 * Accepts exported local draft JSON or server-normalized rows with identical contract.
 */
(function (root) {
  'use strict';
  const STATES = {
    AUTO_EXPLICIT_DRAFT: '명시 근거 자동 채택안',
    AUTO_ESTIMATED_DRAFT: '추정 자동 보완안',
    REVIEW_EVIDENCE: '관리자 검토 · 근거 부족',
    REVIEW_CONFLICT: '관리자 검토 · 근거 충돌',
    BLOCK: '자동 처리 차단'
  };
  const SAFE_DECISIONS = new Set(['auto_explicit_draft','auto_estimated_draft','pending_manual','manual_accept_draft','reject_draft']);
  const NAMES = {album_type:'앨범 유형',original_date:'원발매일',release_year:'판본 발매연도',genre:'대표 장르',artist:'아티스트',title:'앨범명',label:'음반사',catalog_number:'카탈로그 번호'};
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const MAX_RECORDS = 5000;
  function el(tag, cls, value) {
    const n = document.createElement(tag);
    if (cls) n.className = 'vr-ai-' + cls;
    if (value !== undefined) n.textContent = String(value);
    return n;
  }
  function normalize(input) {
    const rows = Array.isArray(input) ? input : input && Array.isArray(input.decisions) ? input.decisions : null;
    if (!rows || rows.length > MAX_RECORDS) throw Error('검토안 형식 또는 건수 제한을 확인하세요.');
    const ids = new Set();
    return rows.map((r) => {
      if (!r || typeof r !== 'object' || !UUID.test(r.album_id) || !/^[a-z][a-z0-9_]{0,49}$/i.test(r.field) || !Object.hasOwnProperty.call(STATES, r.status)) throw Error('앨범 ID·필드·판정 상태가 잘못됐습니다.');
      if (typeof r.candidate !== 'string' || r.candidate.length > 800 || typeof r.before !== 'string' || r.before.length > 800) throw Error('변경 전후 값이 잘못됐습니다.');
      const k = r.album_id + '\u0000' + r.field;
      if (ids.has(k)) throw Error('중복 앨범/필드 제안: ' + r.field);
      ids.add(k);
      const initial = SAFE_DECISIONS.has(r.decision) ? r.decision : 'pending_manual';
      const decision = r.status.startsWith('AUTO_') ? initial : (initial.startsWith('auto_') ? 'pending_manual' : initial);
      return {
        album_id:r.album_id,artist:String(r.artist||'').slice(0,160),title:String(r.title||'').slice(0,160),field:r.field,before:r.before,candidate:r.candidate,status:r.status,
        kind: String(r.kind || ''),approximate:r.approximate === true,
        evidence:Array.isArray(r.evidence)?r.evidence.slice(0,15).map(x=>String(x).slice(0,300)):[],
        blockers:Array.isArray(r.blockers)?r.blockers.slice(0,15).map(x=>String(x).slice(0,300)):[],
        basis:String(r.basis || ''),policy:String(r.policy || 'vinylroom-field-gates-v2.0'),
        decision
      };
    });
  }
  function parseFileContents(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (_) {
      // The prior offline v2 HTML has an inert JSON data script. Do not execute it.
      const dom = new DOMParser().parseFromString(text, 'text/html');
      const node = dom.getElementById('candidate-data');
      if (!node || node.type !== 'application/json') throw Error('v2 HTML 또는 검토안 JSON이 아닙니다.');
      data = JSON.parse(node.textContent);
    }
    return normalize(data);
  }
  function download(name, data) {
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function mount(target, options) {
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target) throw Error('관리자 화면 연결 위치가 없습니다.');
    if (!options || typeof options.isAdmin !== 'function' || options.isAdmin() !== true) {
      target.replaceChildren(el('p','fail','관리자 인증 후 사용할 수 있습니다.'));
      return {unmount(){target.replaceChildren();}};
    }
    let rows = [], filter = 'all', disposed=false, source='unloaded', serverItems=0;
    const frame = el('section','root');
    const head = el('div','head');
    head.append(el('h2','','AI 분류 · 신뢰도 평가 v2'));
    head.append(el('p','note','실제 운영 반영 없음 · 자동 채택은 검토 초안입니다.'));
    const controls = el('div','controls');
    const file = el('input');file.type='file';file.accept='.json,.html,application/json,text/html';file.setAttribute('aria-label','로컬 v2 검토안 가져오기');
    const refresh = el('button');refresh.type='button';refresh.textContent='서버 후보 조회';
    const exportButton = el('button');exportButton.type='button';exportButton.textContent='검토안 JSON 저장';
    const summary = el('div','summary','후보가 없습니다.');
    const filters = el('div','filters');
    [['all','전체'],['AUTO_EXPLICIT_DRAFT','명시 근거'],['AUTO_ESTIMATED_DRAFT','추정 보완'],['manual','관리자 검토']].forEach(([value,label])=>{
      const b=el('button');b.type='button';b.textContent=label;b.dataset.filter=value;
      b.addEventListener('click',()=>{filter=value;render();});filters.append(b);
    });
    const cards = el('div','cards');
    const error = el('p','error');error.setAttribute('role','alert');
    controls.append(file,refresh,exportButton);frame.append(head,controls,summary,filters,error,cards);target.replaceChildren(frame);
    function isStillAdmin() {return !disposed && options.isAdmin()===true;}
    function render() {
      if (!isStillAdmin()) {rows=[]; target.replaceChildren(el('p','fail','관리자 세션이 종료되었습니다.'));return;}
      const counts={AUTO_EXPLICIT_DRAFT:0,AUTO_ESTIMATED_DRAFT:0,REVIEW_EVIDENCE:0,REVIEW_CONFLICT:0,BLOCK:0};
      rows.forEach(r=>counts[r.status]++);
      summary.textContent=source==='unloaded'?'서버 제안을 조회하지 않았습니다.':source==='server'&&serverItems===0?'저장된 AI 후보 0건':`${source==='local'?'로컬 시험 파일 · ':`서버 저장 결과 ${serverItems}건 · `}검토 후보 ${rows.length}건 · 명시 근거 ${counts.AUTO_EXPLICIT_DRAFT}건 · 추정 ${counts.AUTO_ESTIMATED_DRAFT}건 · 검토/차단 ${counts.REVIEW_EVIDENCE+counts.REVIEW_CONFLICT+counts.BLOCK}건`;
      [...filters.children].forEach(x=>x.setAttribute('aria-pressed', String(x.dataset.filter===filter)));
      cards.replaceChildren();
      const selected=rows.filter(r=> filter==='all'||r.status===filter||(filter==='manual'&&!r.status.startsWith('AUTO_')));
      const grouped = new Map();selected.forEach(r=>{if(!grouped.has(r.album_id))grouped.set(r.album_id,[]);grouped.get(r.album_id).push(r);});
      if(!selected.length){cards.append(el('p','empty',source==='server'&&serverItems===0?'저장된 AI 후보가 없습니다.':source==='unloaded'?'서버 후보 조회를 눌러 확인하세요.':'현재 필터에 표시할 제안이 없습니다.'));return;}
      for(const [albumId,fields] of grouped){
        const card=el('article','card');const albumName=[fields[0].artist,fields[0].title].filter(Boolean).join(' — ');card.append(el('h3','',albumName||'앨범 정보 미확인'));card.append(el('small','album-id','앨범 ID: '+albumId));
        const table=el('table');const thead=el('thead');const tr=el('tr');
        ['필드','기존','AI 후보','판정·근거','임시 검토'].forEach(x=>tr.append(el('th','',x)));thead.append(tr);table.append(thead);
        const tbody=el('tbody');
        for(const row of fields){
          const tr=el('tr',row.status.startsWith('AUTO_')?'auto':'manual');
          const td=(label,value)=>{const cell=el('td','',value);cell.dataset.label=label;return cell;};tr.append(td('필드',NAMES[row.field]||row.field));tr.append(td('기존',row.before||'—'));tr.append(td('AI 후보',row.candidate));
          const note=el('td');note.dataset.label='판정·근거';note.append(el('strong','',STATES[row.status]));
          if(row.approximate)note.append(el('small','','근사치 · 확정 정보 아님'));
          for(const t of row.evidence)note.append(el('small','',t));
          for(const t of row.blockers)note.append(el('small','warning',t));tr.append(note);
          const action=el('td');action.dataset.label='임시 검토';const select=el('select');
          const choices= row.status.startsWith('AUTO_')
            ? [[row.status==='AUTO_EXPLICIT_DRAFT'?'auto_explicit_draft':'auto_estimated_draft','자동 초안 유지'],['pending_manual','보류'],['manual_accept_draft','수동 채택안'],['reject_draft','거절안']]
            : [['pending_manual','보류'],['manual_accept_draft','수동 채택안'],['reject_draft','거절안']];
          for(const [v,l] of choices){const opt=el('option','',l);opt.value=v;select.append(opt);}
          select.value=choices.some(x=>x[0]===row.decision)?row.decision:'pending_manual';
          select.addEventListener('change',()=>{if(isStillAdmin())row.decision=select.value;});
          action.append(select);tr.append(action);tbody.append(tr);
        }
        table.append(tbody);const wrap=el('div','tablewrap');wrap.append(table);card.append(wrap);cards.append(card);
      }
    }
    function setRows(data,origin='server') {if(!isStillAdmin())throw Error('관리자 인증이 필요합니다.');const next=normalize(data);serverItems=origin==='server'&&Number.isSafeInteger(data.serverItems)?data.serverItems:0;rows=next;source=origin;error.textContent='';render();return rows.length;}
    file.addEventListener('change', async ()=>{
      try{if(!isStillAdmin())throw Error('관리자 세션이 종료되었습니다.');const f=file.files?.[0];if(!f)return;
        if(f.size>5*1024*1024)throw Error('파일 크기 5MB를 초과합니다.');setRows(parseFileContents(await f.text()),'local');
      }catch(e){error.textContent=String(e.message||e);}finally{file.value='';}
    });
    refresh.disabled=typeof options.loadCandidates!=='function';
    refresh.addEventListener('click',async()=>{if(!isStillAdmin())return;
      if(typeof options.loadCandidates!=='function')return;
      refresh.disabled=true;try{setRows(await options.loadCandidates(),'server');}catch(e){error.textContent='후보 조회 실패: '+String(e.message||e);}
      finally{refresh.disabled=false;}
    });
    exportButton.addEventListener('click',()=>{if(!isStillAdmin())return;
      download('vinylroom-ai-confidence-v2-review-draft.json', {
        schema:'vinylroom-confidence-v2-local-draft',policy_version:'vinylroom-field-gates-v2.0',
        not_operational_approval:true,not_applied:true,
        generated_at:new Date().toISOString(),decisions:rows.map(r=>({...r,not_verified:true,not_applied:true}))
      });
    });
    render();
    return {setRows,getRows:()=>rows.map(r=>({...r})),unmount(){disposed=true;rows=[];target.replaceChildren();}};
  }
  root.VinylRoomConfidenceV2={mount,normalize,parseFileContents,states:Object.freeze({...STATES}),exportDraft:rows=>download('vinylroom-ai-confidence-v2-reference.json',{schema:'vinylroom-confidence-v2-local-draft',not_operational_approval:true,not_applied:true,decisions:rows})};
})(window);
