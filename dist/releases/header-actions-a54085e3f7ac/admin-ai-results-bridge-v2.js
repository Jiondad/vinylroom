/* Phase 4C: existing admin-authenticated GET -> server evidence-v2 verdicts.
 * Never calculate AUTO status from legacy /results without source evidence.
 * The requestAdminJSON callback MUST be Vinyl Room's existing admin GET handler.
 */
(function(root){
  'use strict';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const STATUS=new Set(['AUTO_EXPLICIT_DRAFT','AUTO_ESTIMATED_DRAFT','REVIEW_EVIDENCE','REVIEW_CONFLICT','BLOCK']);
  const FIELDS=new Set(['album_type','original_date','release_year','genre','artist','title','label','catalog_number']);
  function validatePayload(response){
    if(!response||response.auto_apply_enabled!==false||!Array.isArray(response.items))
      throw Error('NAS 근거 판정 API의 읽기 전용 응답을 확인할 수 없습니다. 기존 /results 화면을 이용하세요.');
    if(response.items.length>500)throw Error('NAS API의 응답 건수 제한 초과');
    return response.items.map(r=>{
      if(!r||!UUID.test(r.album_id)||!FIELDS.has(r.field)||!STATUS.has(r.status)||
         typeof r.before!=='string'||typeof r.candidate!=='string'||
         r.not_applied!==true||r.not_operational_approval!==true)
        throw Error('NAS AI 제안의 필드/보호 상태가 잘못됐습니다.');
      if(r.status.startsWith('AUTO_') && (!Array.isArray(r.evidence)||r.evidence.length===0))
        throw Error('자동 채택 초안에 검증 가능한 근거가 없습니다.');
      return {...r, artist:String(r.artist||'').slice(0,160),title:String(r.title||'').slice(0,160)};
    });
  }
  async function load(options){
    if(!options||typeof options.isAdmin!=='function'||options.isAdmin()!==true)
      throw Error('승인된 관리자 인증이 필요합니다.');
    if(typeof options.requestAdminJSON!=='function')throw Error('기존 관리자 인증형 GET 함수가 필요합니다.');
    const pages=Math.max(1,Math.min(5,Math.floor(Number(options.pages)||1)));
    const offset=Math.max(0,Math.floor(Number(options.offset)||0));
    const output=[];let sourceItems=0;
    for(let page=0;page<pages;page++){
      if(options.isAdmin()!==true)throw Error('관리자 세션 종료');
      const response=await options.requestAdminJSON('/v2/ai-classification/confidence-v2?offset='+(offset+page*50));
      if(options.isAdmin()!==true)throw Error('관리자 세션 종료');
      const rows=validatePayload(response);
      output.push(...rows);
      sourceItems+=Number.isInteger(response.source_items)?response.source_items:rows.length;
      // source_items counts proposals, not changed fields; 50 is the backend page size.
      if(!Number.isInteger(response.source_items)||response.source_items<50)break;
    }
    output.serverItems=sourceItems;
    return output;
  }
  root.VinylRoomAIResultsBridgeV2={load,validatePayload};
  if(typeof module!=='undefined'&&module.exports)module.exports={load,validatePayload};
})(typeof window==='undefined'?globalThis:window);
