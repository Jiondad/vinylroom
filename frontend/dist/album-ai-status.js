// Read-only album AI state. Server must affirm exact album identity and audit-based application.
// No inference from proposal, review, album metadata or draft selections.
const labels={
 proposal_pending:['AI 분석 제안 · 검토 대기','AI 분석 결과가 있습니다. 운영 앨범 정보에는 반영되지 않았습니다.'],
 review_completed:['AI 제안 검토 완료','검토 기록이 저장되어 있습니다. 운영 앨범 정보 반영 여부와는 별개입니다.'],
 applied:['AI 정보 반영 완료','현재 Catalog에 반영된 AI 변경 내역이 확인됐습니다.']
};
export function renderAlbumAiStatus(data,albumId){
 if(!data||data.version!==1||data.album_id!==albumId||!Object.hasOwn(labels,data.state))return '';
 if(data.state==='applied'&&(data.catalog_applied!==true||data.audit_verified!==true))return '';
 if(data.state!=='applied'&&data.catalog_applied===true)return '';
 const [title,description]=labels[data.state];
 return {title,description,state:data.state};
}
export function mountAlbumAiStatus({container,albumId,api,canManage}){
 if(!container||!albumId||!canManage?.())return ()=>{};
 const abort=new AbortController();let disposed=false;
 const root=container.ownerDocument.createElement('section');root.className='vr-album-ai-status';
 root.setAttribute('aria-label','앨범 AI 분석 상태');root.hidden=true;container.append(root);
 if(!container.ownerDocument.querySelector('#vr-album-ai-status-style')){
  const style=container.ownerDocument.createElement('style');style.id='vr-album-ai-status-style';
  style.textContent='.vr-album-ai-status{border:1px solid #e8e5df;border-left:2px solid #b59a73;border-radius:4px;padding:11px 15px;margin:12px 0 20px;background:#fdfcf9;font-family:"Noto Sans KR",system-ui,sans-serif;font-weight:320}.vr-album-ai-status strong{display:block;color:#394b58;font-size:12px;font-weight:400}.vr-album-ai-status p{margin:4px 0 0;color:#77848c;font-size:11px;line-height:1.6}@media(max-width:740px){.vr-album-ai-status{padding:10px 12px;margin:10px 0 14px}}';
  container.ownerDocument.head.append(style);
 }
 void (async()=>{
  try{
   const data=await api('/v2/ai-classification/album-status?album_id='+encodeURIComponent(albumId),{admin:true,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(8000)])});
   if(disposed||!root.isConnected||!canManage())return;
   const status=renderAlbumAiStatus(data,albumId);if(!status)return;
   const heading=container.ownerDocument.createElement('strong');heading.textContent='✧ '+status.title;
   const note=container.ownerDocument.createElement('p');note.textContent=status.description;
   root.replaceChildren(heading,note);root.dataset.aiState=status.state;root.hidden=false;
  }catch{ /* Unsupported endpoint, lack of permission, or network failure: no misleading badge. */ }
 })();
 return ()=>{disposed=true;abort.abort();root.remove();};
}
