/** Scoped admin type adoption. Uses existing authenticated API; never accepts a token. */
const SCOPE=Object.freeze({"path":"/v2/ai-classification/admin-review-type","album":"2ecf4e94-f4fb-4da2-afca-a1e91ecdfb65","proposal":"1c486689-5e8c-4a22-a4ee-5bc52ede4243","binding":"596e850e08c484a52ea3a27d1e92aeb4d272a1aa0048aaf903e9b79925898445"});
export function validPreview(d){
 const b=d?.binding;
 return d?.ok===true&&d.apply_enabled===true&&d.confirmation_required===true&&d.binding_sha256===SCOPE.binding&&b?.album_id===SCOPE.album&&b.proposal_id===SCOPE.proposal&&b.field==='work.album_type'&&b.before==='미확인'&&b.after==='Studio'&&b.apply_authorized===false&&Array.isArray(b.excluded_fields)&&b.excluded_fields.length===2&&b.excluded_fields[0]==='work.genre'&&b.excluded_fields[1]==='work.secondary_genres';
}
export function validReceipt(d){
 return d?.state==='completed'&&d.status==='succeeded'&&d.operation==='admin_review_apply'&&d.album_id===SCOPE.album&&d.proposal_id===SCOPE.proposal&&typeof d.operation_id==='string'&&/^[0-9a-f]{64}$/.test(d.operation_id)&&Number.isSafeInteger(d.feed_seq)&&d.feed_seq>0&&(d.catalog_changed===true||d.replayed===true);
}
export function mountAdminTypeApproval({host,api,canManage,signal}){
 host.innerHTML='<section class="vr-admin-caution" aria-label="015B 관리자 유형 승인"><div class="vr-admin-section-head"><h3>015B · 앨범 유형 승인</h3></div><p>015B — 015B / 미확인 → Studio · 장르 및 보조 장르 변경 없음</p><div class="proposal-tools"><button type="button" data-type-preview>승인 내용 확인</button><button type="button" data-type-apply disabled>Studio 승인 반영</button></div><p data-type-status role="status" aria-live="polite">승인 내용 확인 후에만 반영할 수 있습니다.</p></section>';
 const preview=host.querySelector('[data-type-preview]'),apply=host.querySelector('[data-type-apply]'),status=host.querySelector('[data-type-status]');
 let ready=false,busy=false,uncertain=false,done=false;
 const alive=()=>!signal?.aborted&&host.isConnected;
 const allowed=()=>alive()&&canManage();
 const paint=()=>{if(alive()){preview.disabled=busy||!canManage();apply.disabled=busy||!ready||uncertain||done||!canManage();}};
 const say=s=>{if(alive())status.textContent=s;};
 const request=async body=>{
  if(!allowed())throw Error('관리자 인증 확인 필요');
  const d=await api(SCOPE.path,{admin:true,...(body===undefined?{}:{body}),signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(body===undefined?20000:180000)])});
  if(!allowed())throw Error('관리자 화면 또는 로그인 상태 변경');
  return d;
 };
 preview.onclick=async()=>{
  if(busy||!allowed())return;
  ready=false;busy=true;paint();say('현재 승인 내용 조회 중…');
  try{
   const d=await request();
   if(d?.ok===true&&d.already_applied===true&&validReceipt(d.receipt)){done=true;uncertain=false;say('Studio 반영 완료 · 서버 감사 기록 확인 · '+d.receipt.operation_id);}
   else if(d?.ok===true&&d.restored===true){done=true;say('복구된 이력입니다. 새 승인 계획이 필요합니다.');}
   else if(validPreview(d)&&!done){ready=!uncertain;say(uncertain?'반영 결과 미확정 · 자동 재전송하지 않습니다. 관리자 확인이 필요합니다.':'서버 확인 완료 · 미확인 → Studio · 반영 버튼을 누르면 실제 Catalog를 변경합니다.');}
   else{say('승인 대상 또는 현재 입력 불일치 · 반영 차단');}
  }catch(e){say('승인 내용 확인 실패'+(Number.isInteger(e?.status)?' (HTTP '+e.status+')':'')+' · 반영 차단');}
  finally{busy=false;paint();}
 };
 apply.onclick=async()=>{
  if(busy||!ready||uncertain||done||!allowed())return;
  ready=false;busy=true;uncertain=true;paint();say('승인 반영 및 서버 감사 기록 확인 중…');
  try{
   const d=await request({action:'apply_admin_review_type',binding_sha256:SCOPE.binding,confirm:true});
   if(!validReceipt(d))throw Error('receipt_unverified');
   uncertain=false;done=true;say('Studio 반영 완료 · 서버 감사 기록 확인 · '+d.operation_id);
  }catch(e){say('반영 결과 미확정'+(Number.isInteger(e?.status)?' (HTTP '+e.status+')':'')+' · 재전송하지 말고 승인 내용 확인으로 결과를 조회하세요.');}
  finally{busy=false;paint();}
 };
 paint();
}

/** W10: historical receipt only, for the exact original album and proposal. */
export function isScopedTypeHistory(p){return p?.album_id===SCOPE.album&&p?.id===SCOPE.proposal;}
export function mountAdminTypeHistory({host,api,canManage,signal}){
 host.innerHTML='<section class="vr-admin-caution" aria-label="앨범 유형 승인 이력"><h3>앨범 유형 승인 이력</h3><div class="proposal-tools"><button type="button" data-history>승인 이력 조회</button></div><p role="status" aria-live="polite" data-history-status>기존 승인 기록을 조회할 수 있습니다.</p></section>';
 const button=host.querySelector('[data-history]'),status=host.querySelector('[data-history-status]');
 const allowed=()=>host.isConnected&&!signal?.aborted&&canManage();
 button.disabled=!allowed();let busy=false;
 button.onclick=async()=>{if(busy||!allowed())return;busy=true;button.disabled=true;status.textContent='승인 이력 조회 중…';
 try{const d=await api(SCOPE.path,{admin:true,signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(20000)])});if(!allowed())return;
 if(d?.ok===true&&d.already_applied===true&&validReceipt(d.receipt))status.textContent='Studio 반영 완료 · 서버 감사 기록 확인 · '+d.receipt.operation_id;
 else if(d?.ok===true&&d.restored===true)status.textContent='서버에서 복구 상태를 반환했습니다.';
 else status.textContent='확정된 승인 기록을 확인하지 못했습니다. 이 화면은 조회 전용입니다.';
 }catch(e){if(allowed())status.textContent='승인 이력 조회 실패'+(Number.isInteger(e?.status)?' (HTTP '+e.status+')':'');}
 finally{busy=false;if(host.isConnected)button.disabled=!allowed();}
 };
}
