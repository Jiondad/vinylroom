// Read-only album AI state: only display a state explicitly verified by the NAS.
// A proposal/review is not evidence of a successful Catalog change.
const labels={
 proposal_pending:{title:'AI 분석 제안 · 검토 대기',color:'waiting'},
 review_completed:{title:'AI 제안 검토 완료 · Catalog 반영은 별개',color:'reviewed'},
 applied:{title:'AI 정보 반영 완료 · 감사 기록 확인',color:'applied'}
};
export function renderAlbumAiStatus(data,albumId){
 if(!data||data.version!==1||data.album_id!==albumId||!Object.hasOwn(labels,data.state))return '';
 if(data.state==='applied'&&(data.catalog_applied!==true||data.audit_verified!==true))return '';
 if(data.state!=='applied'&&data.catalog_applied===true)return '';
 return {...labels[data.state],state:data.state};
}
export function mountAlbumAiStatus({container,albumId,api,canManage}){
 if(!container||!albumId||!canManage?.())return ()=>{};
 const detailTop=container.closest('.detail-top');
 if(!detailTop)return ()=>{};
 const abort=new AbortController();let disposed=false;
 const doc=container.ownerDocument,view=doc.defaultView;
 const root=doc.createElement('span');root.className='vr-album-ai-ribbon';
 root.setAttribute('aria-label','앨범 AI 상태');root.hidden=true;
 // Render at the album grid level, outside the rounded cover's clip boundary.
 detailTop.style.position='relative';detailTop.append(root);
 const place=()=>{
  if(disposed||!root.isConnected)return;
  const c=container.getBoundingClientRect(),p=detailTop.getBoundingClientRect();
  root.style.left=Math.round(c.right-p.left-35)+'px';
  root.style.top=Math.round(c.top-p.top-5)+'px';
 };
 place();
 const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(place):null;
 resizeObserver?.observe(container);
 view?.addEventListener('resize',place);
 view?.requestAnimationFrame(place);
 if(!doc.querySelector('#vr-album-ai-status-style')){
  const style=doc.createElement('style');style.id='vr-album-ai-status-style';
  style.textContent=`
.album-full-page .detail-top > .vr-album-ai-ribbon{
 position:absolute;z-index:3;
 display:flex;align-items:flex-start;justify-content:center;
 width:23px;height:34px;box-sizing:border-box;
 padding:9px 0 0;margin:0;
 border:0;border-radius:0;box-shadow:none;
 clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 6px),0 100%);
 color:#fff;font-family:"Noto Sans KR",sans-serif;font-size:10px;font-weight:500;
 letter-spacing:.01em;line-height:10px;cursor:help;
}
.album-full-page .detail-top > .vr-album-ai-ribbon .vr-ai-word{
 font-family:"Noto Sans KR",sans-serif;font-size:10px;font-weight:500;line-height:10px;
}
.album-full-page .detail-top > .vr-album-ai-ribbon[hidden]{display:none!important}
.album-full-page .detail-top > .vr-album-ai-ribbon[data-ai-color="waiting"]{background:#ED9500}
.album-full-page .detail-top > .vr-album-ai-ribbon[data-ai-color="reviewed"]{background:#1685E6}
.album-full-page .detail-top > .vr-album-ai-ribbon[data-ai-color="applied"]{background:#16A05D}
`;
  doc.head.append(style);
 }
 void (async()=>{
  try{
   const data=await api('/v2/ai-classification/album-status?album_id='+encodeURIComponent(albumId),{admin:true,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(8000)])});
   if(disposed||!root.isConnected||!canManage())return;
   const status=renderAlbumAiStatus(data,albumId);if(!status)return;
   const ai=container.ownerDocument.createElement('span');ai.className='vr-ai-word';ai.textContent='AI';
   root.replaceChildren(ai);root.dataset.aiColor=status.color;root.title=status.title;root.setAttribute('aria-label',status.title);root.hidden=false;
  }catch{ /* No verified status, no badge. */ }
 })();
 return ()=>{disposed=true;abort.abort();resizeObserver?.disconnect();view?.removeEventListener('resize',place);root.remove();};
}
