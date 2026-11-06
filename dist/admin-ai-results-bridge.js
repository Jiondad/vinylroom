/* Vinyl Room phase 4B: authenticated, read-only /results bridge.
 * Based on the existing NAS ai_metadata/Store.proposals() response.
 * IMPORTANT: /results omits source payload.hints/tags, so it cannot support
 * evidence-based confidence v2 auto decisions. NEVER auto-accept its rows.
 */
(function (root) {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const FIELDS = {
    artist:'artist', title:'title', category:'album_type', original_year:'original_date',
    release_year:'release_year', genre:'genre', label:'label', catalog_number:'catalog_number'
  };
  const SAFE_LIMIT = 250;
  function string(v) {
    if (v === null || v === undefined) return '';
    return typeof v === 'string' ? v.slice(0,800) : String(v).slice(0,800);
  }
  function plainJson(v) {
    if (typeof v !== 'string') return v;
    try {return JSON.parse(v);} catch (_) {return null;}
  }
  function protectedFields(p) {
    const v=plainJson(p);
    if (Array.isArray(v)) return new Set(v.map(String));
    if (v && typeof v==='object') return new Set(Object.entries(v).filter(([_, val]) => val===true || val==='confirmed' || val==='protected').map(([key])=>key));
    return new Set();
  }
  function statusFor(item, diff, currentValue) {
    if (item.stale===true || item.taxonomy_review===true) return ['BLOCK','제안이 오래되었거나 유형 규칙 재검토가 필요합니다.'];
    const p=protectedFields(item.protected);
    if (diff.manual_protected===true || p.has(diff.field) || p.has(FIELDS[diff.field])) return ['BLOCK','관리자 보호 필드입니다.'];
    if (currentValue!==undefined && string(currentValue)!==string(diff.before)) return ['BLOCK','현재값과 제안 생성 당시 값이 다릅니다.'];
    if (diff.after===null || diff.after===undefined || string(diff.after)==='') return ['BLOCK','정보 손실 또는 변경 후보 없음'];
    const key=FIELDS[diff.field];
    if (key==='artist'||key==='title') return ['REVIEW_CONFLICT','아티스트명·앨범명 변경은 ID 연결 보호를 위해 개별 검토해야 합니다.'];
    if (key==='original_date' && /^\d{4}-\d\d-\d\d$/.test(string(diff.before)) && /^\d{4}$/.test(string(diff.after))) return ['BLOCK','정확한 기존 원발매일을 연도로 축소할 수 없습니다.'];
    if (key==='original_date' && /^\d{4}/.test(string(diff.before)) && /^\d{4}/.test(string(diff.after)) && string(diff.before).slice(0,4)!==string(diff.after).slice(0,4)) return ['REVIEW_CONFLICT','기존 원발매 연도와 AI 제안 연도가 다릅니다.'];
    if (diff.field==='category' && string(diff.before)==='정규' && string(diff.after)==='Studio') return ['REVIEW_EVIDENCE','유효한 세분화 후보이나 서버 응답에 녹음 유형 근거가 없습니다.'];
    if (diff.kind==='conflict' || (string(diff.before)!=='' && string(diff.before)!=='미확인' && string(diff.before)!=='미설정')) return ['REVIEW_CONFLICT','기존 값 변경: 폴더·태그 근거 확인 필요'];
    return ['REVIEW_EVIDENCE','제안은 있으나 서버 응답에 폴더·태그 근거가 포함되지 않았습니다.'];
  }
  function fromResults(data) {
    if (!data || !Array.isArray(data.items)) throw Error('NAS /results 응답의 items 배열을 확인할 수 없습니다.');
    if(data.items.length>SAFE_LIMIT)throw Error('한 번에 표시할 최대 후보 수를 초과했습니다.');
    const seen=new Set(),rows=[];
    for (const item of data.items) {
      if (!item || !UUID.test(string(item.album_id))) continue;
      // Already reviewed proposals belong in history, not the pending review queue.
      if (item.review_state==='confirmed' || item.review_state==='rejected') continue;
      const diffs=plainJson(item.comparison);
      if (!Array.isArray(diffs)) continue;
      const current=plainJson(item.current)||{};
      for (const diff of diffs) {
        if(!diff || !Object.prototype.hasOwnProperty.call(FIELDS,diff.field)) continue;
        const key=FIELDS[diff.field],fingerprint=item.album_id+'\u0000'+key;
        // /results orders newer proposals first. Do not silently overwrite a fresh row with older history.
        if(seen.has(fingerprint))continue;
        seen.add(fingerprint);
        const before=string(diff.before),after=string(diff.after);
        if(before===after)continue;
        const cur= current && typeof current==='object' ? current[diff.field] : undefined;
        const [status,reason]=statusFor(item,diff,cur);
        const empty=before===''||['미설정','미확인','unknown','other'].includes(before.toLowerCase());
        rows.push({album_id:item.album_id,field:key,before,candidate:after,status,
          kind:empty?'FILL':diff.field==='category'&&before==='정규'&&after==='Studio'?'REFINE':'OVERRIDE',
          approximate:false,
          evidence:['저장된 NAS AI 제안 조회','Gemini 응답은 외부 사실 검증 전'],
          blockers:status==='BLOCK'||status==='REVIEW_CONFLICT'?[reason]:[],
          basis:'server_proposal_unverified',
          policy:'vinylroom-server-results-readonly-bridge-1',
          decision:'pending_manual'});
      }
    }
    return rows;
  }
  async function load(options) {
    if (!options || typeof options.isAdmin!=='function' || options.isAdmin()!==true) throw Error('확인된 관리자 인증이 필요합니다.');
    if (typeof options.requestAdminJSON!=='function')throw Error('사이트의 관리자 인증이 연결된 GET 함수를 제공해야 합니다.');
    const pages=Math.max(1,Math.min(5,Number(options.pages)||1));
    const items=[];
    for(let i=0;i<pages;i++) {
      if(options.isAdmin()!==true)throw Error('관리자 세션이 종료되었습니다.');
      const json=await options.requestAdminJSON('/v2/ai-classification/results?offset='+i*50);
      if(options.isAdmin()!==true)throw Error('관리자 세션이 종료되었습니다.');
      if(!json || !Array.isArray(json.items))throw Error('NAS AI 결과 조회 응답이 잘못됐습니다.');
      if(json.items.length>50)throw Error('NAS API 페이지 제한과 응답이 일치하지 않습니다.');
      items.push(...json.items);
      if(json.items.length<50)break;
    }
    const rows=fromResults({items});
    rows.serverItems=items.length;
    return rows;
  }
  root.VinylRoomAIResultsBridge={fromResults,load};
})(window);
