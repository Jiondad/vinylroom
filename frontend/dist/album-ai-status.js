// Read-only album AI state: only display a state explicitly verified by the NAS.
// A proposal/review is not evidence of a successful Catalog change.
const labels={
 proposal_pending:{short:'대기',title:'AI 분석 제안 · 검토 대기',color:'waiting'},
 review_completed:{short:'검토',title:'AI 제안 검토 완료 · Catalog 반영은 별개',color:'reviewed'},
 applied:{short:'완료',title:'AI 정보 반영 완료 · 감사 기록 확인',color:'applied'}
};
export function renderAlbumAiStatus(data,albumId){
 if(!data||data.version!==1||data.album_id!==albumId||!Object.hasOwn(labels,data.state))return '';
 if(data.state==='applied'&&(data.catalog_applied!==true||data.audit_verified!==true))return '';
 if(data.state!=='applied'&&data.catalog_applied===true)return '';
 return {...labels[data.state],state:data.state};
}
export function mountAlbumAiStatus({container,albumId,api,canManage}){
 if(!container||!albumId||!canManage?.())return ()=>{};
 const abort=new AbortController();let disposed=false;
 const root=container.ownerDocument.createElement('span');root.className='vr-album-ai-ribbon';
 root.setAttribute('aria-label','앨범 AI 상태');root.hidden=true;container.append(root);
 if(!container.ownerDocument.querySelector('#vr-album-ai-status-style')){
  const style=container.ownerDocument.createElement('style');style.id='vr-album-ai-status-style';
  style.textContent=`
.album-full-page .detail-top .cover{position:relative}
.vr-album-ai-ribbon{position:absolute;top:8px;right:0;z-index:3;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:21px;padding:0 9px 0 11px;border-radius:2px 0 0 2px;border:1px solid rgba(255,255,255,.35);border-right:0;box-shadow:0 1px 4px rgba(0,0,0,.12);font-family:"Noto Sans KR",system-ui,sans-serif;font-weight:400;font-size:10px;letter-spacing:.01em;white-space:nowrap;line-height:1;cursor:help}
.vr-album-ai-ribbon[hidden]{display:none!important}
.vr-album-ai-ribbon .vr-ai-word{font-size:10px;font-weight:500;letter-spacing:.055em}
.vr-album-ai-ribbon[data-ai-color="waiting"]{background:#b78943;color:#fffaf1}
.vr-album-ai-ribbon[data-ai-color="reviewed"]{background:#648ba5;color:#fff}
.vr-album-ai-ribbon[data-ai-color="applied"]{background:#719479;color:#fff}
@media(max-width:740px){.vr-album-ai-ribbon{height:20px;top:7px;font-size:10px;padding:0 8px 0 10px}}
`;
  container.ownerDocument.head.append(style);
 }
 void (async()=>{
  try{
   const data=await api('/v2/ai-classification/album-status?album_id='+encodeURIComponent(albumId),{admin:true,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(8000)])});
   if(disposed||!root.isConnected||!canManage())return;
   const status=renderAlbumAiStatus(data,albumId);if(!status)return;
   const ai=container.ownerDocument.createElement('span');ai.className='vr-ai-word';ai.textContent='AI';
   const word=container.ownerDocument.createElement('span');word.textContent=status.short;
   root.replaceChildren(ai,word);root.dataset.aiColor=status.color;root.title=status.title;root.setAttribute('aria-label',status.title);root.hidden=false;
  }catch{ /* No verified status, no badge. */ }
 })();
 return ()=>{disposed=true;abort.abort();root.remove();};
}
