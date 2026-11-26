/** W08: read-only general album approval preview. Writer stays OFF. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA=/^[0-9a-f]{64}$/;
const TYPES=new Set(['Studio','Live','Compilations','Singles & EPs','Bootlegs','ETC']);
export function mountGeneralTypeApproval({host,proposal,api,canManage,signal}){
 const album=proposal?.album_id,id=proposal?.id;
 if(!UUID.test(album||'')||!UUID.test(id||'')||album==='2ecf4e94-f4fb-4da2-afca-a1e91ecdfb65')return ()=>{};
 const path='/v2/ai-classification/admin-review-general-type/'+album+'/'+id;
 host.innerHTML='<section class="vr-admin-caution" aria-label="앨범 유형 승인"><div class="vr-admin-section-head"><h3>앨범 유형 승인</h3></div><div class="proposal-tools"><button type="button" data-preview>승인 내용 확인</button><button type="button" disabled>승인 반영</button></div><p data-status role="status" aria-live="polite">검토 초안을 저장한 후 승인 내용을 확인하세요. 현재 반영은 비활성 상태입니다.</p></section>';
 const local=new AbortController(),button=host.querySelector('[data-preview]'),status=host.querySelector('[data-status]');
 const alive=()=>!local.signal.aborted&&!signal?.aborted&&host.isConnected;
 const allowed=()=>alive()&&canManage();let busy=false;
 const say=s=>{if(alive())status.textContent=s;};
 button.disabled=!allowed();
 button.onclick=async()=>{
  if(busy||!allowed())return;busy=true;button.disabled=true;say('승인 내용 조회 중…');
  try{
   const d=await api(path,{admin:true,signal:AbortSignal.any([local.signal,...(signal?[signal]:[]),AbortSignal.timeout(20000)])});
   if(!allowed())return;
   const r=d?.receipt,receipt=op=>r?.album_id===album&&r.proposal_id===id&&r.operation===op&&r.status==='succeeded'&&r.state===(op==='admin_review_apply'?'completed':'restored')&&SHA.test(r.operation_id||'')&&Number.isSafeInteger(r.feed_seq)&&r.feed_seq>0;
   if(d?.ok===true&&d.historically_applied===true){
    if(d.restored===true&&receipt('admin_review_restore'))say('복구 완료 · 감사 기록 '+r.operation_id);
    else if(d.already_applied===true&&receipt('admin_review_apply'))say('반영 완료 · 감사 기록 '+r.operation_id);
    else throw Error('receipt_invalid');
   }else if(d?.ok===true&&d.album_id===album&&d.proposal_id===id&&d.field==='work.album_type'&&['미확인','unknown','',null].includes(d.before)&&TYPES.has(d.after)&&SHA.test(d.binding_sha256||'')&&d.confirmation_required===true&&Number.isSafeInteger(d.review_revision)&&d.review_revision>0){
    say((d.before||'미확인')+' → '+d.after+' · 미리보기 확인 · 반영 비활성');
   }else throw Error('preview_invalid');
  }catch(e){say('승인 내용 확인 실패'+(Number.isInteger(e?.status)?' (HTTP '+e.status+')':'')+' · 반영 차단');}
  finally{busy=false;if(alive())button.disabled=!allowed();}
 };
 return ()=>local.abort();
}
