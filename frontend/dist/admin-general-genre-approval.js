/** W09: read-only administrator genre preview; no POST capability. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA=/^[0-9a-f]{64}$/;
export function mountGeneralGenreApproval({host,proposal,api,canManage,signal}){
 const album=proposal?.album_id,id=proposal?.id;
 if(!UUID.test(album||'')||!UUID.test(id||'')||album==='2ecf4e94-f4fb-4da2-afca-a1e91ecdfb65')return ()=>{};
 const path='/v2/ai-classification/admin-review-general-genre/'+album+'/'+id;
 host.innerHTML='<section class="vr-admin-caution" aria-label="장르 승인"><div class="vr-admin-section-head"><h3>장르 승인</h3></div><div class="proposal-tools"><button type="button" data-preview>승인 내용 확인</button><button type="button" disabled>승인 반영</button></div><p data-status role="status" aria-live="polite">장르 채택 초안을 저장한 후 승인 내용을 확인하세요. 실제 반영은 비활성 상태입니다.</p></section>';
 const local=new AbortController(),button=host.querySelector('[data-preview]'),status=host.querySelector('[data-status]');
 const alive=()=>!local.signal.aborted&&!signal?.aborted&&host.isConnected;
 const allowed=()=>alive()&&canManage();let busy=false;
 const say=s=>{if(alive())status.textContent=s;};
 const styles=v=>Array.isArray(v)&&v.every(x=>typeof x==='string');
 button.disabled=!allowed();
 button.onclick=async()=>{
  if(busy||!allowed())return;busy=true;button.disabled=true;say('장르 승인 내용 조회 중…');
  try{
   const d=await api(path,{admin:true,signal:AbortSignal.any([local.signal,...(signal?[signal]:[]),AbortSignal.timeout(20000)])});
   if(!allowed())return;
   const r=d?.receipt,receipt=op=>r?.album_id===album&&r.proposal_id===id&&r.operation===op&&r.status==='succeeded'&&r.state===(op==='admin_review_apply'?'completed':'restored')&&SHA.test(r.operation_id||'')&&Number.isSafeInteger(r.feed_seq)&&r.feed_seq>0;
   if(d?.ok===true&&d.historically_applied===true){
    if(d.restored===true&&receipt('admin_review_restore'))say('복구 완료 · 감사 기록 '+r.operation_id);
    else if(d.already_applied===true&&receipt('admin_review_apply'))say('반영 완료 · 감사 기록 '+r.operation_id);
    else throw Error('receipt_invalid');
   }else if(d?.ok===true&&d.album_id===album&&d.proposal_id===id&&Array.isArray(d.adopted_fields)&&d.adopted_fields.includes('work.genre')&&d.adopted_fields.every(k=>['work.genre','work.secondary_genres'].includes(k))&&typeof d.storage_after?.genre==='string'&&styles(d.storage_after.styles)&&styles(d.storage_before?.styles)&&SHA.test(d.binding_sha256||'')&&d.confirmation_required===true&&Number.isSafeInteger(d.review_revision)&&d.review_revision>0){
    say('장르: '+(d.storage_before.genre||'미확인')+' → '+d.storage_after.genre+' · 스타일: '+(d.storage_before.styles.join(', ')||'없음')+' → '+(d.storage_after.styles.join(', ')||'없음')+' · 미리보기 확인 · 반영 비활성');
   }else throw Error('preview_invalid');
  }catch(e){const reasons={existing_effective_genre_protected:'이미 유효 장르가 있어 기존 정보를 보호합니다. 추가 반영 불필요.',approval_or_current_state_not_verified:'서버 승인 조건 미충족 · 현재 정보 또는 저장된 초안 확인 필요',native_snapshot_validation_failed:'저장된 검토 초안과 현재 제안이 일치하지 않습니다.',general_preview_disabled:'서버 미리보기 비활성',admin_required:'관리자 권한 확인 필요'};say((Object.hasOwn(reasons,e?.code)?reasons[e.code]:'승인 내용 확인 실패'+(Number.isInteger(e?.status)?' (HTTP '+e.status+')':''))+' · 반영 차단');}
  finally{busy=false;if(alive())button.disabled=!allowed();}
 };
 return ()=>local.abort();
}
