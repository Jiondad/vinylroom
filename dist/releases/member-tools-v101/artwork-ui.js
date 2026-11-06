import {loadMemberImage,clearMemberImage} from './member-images.js';
import {NAS_URL} from './config.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const assetUrl=(albumId,index)=>NAS_URL+'/v2/asset?id='+encodeURIComponent(albumId)+'&asset='+index;
export const thumbUrl=(albumId,index)=>NAS_URL+'/v2/asset-thumb?id='+encodeURIComponent(albumId)+'&asset='+index;
export const PAGE_SIZE=12;
export function adjacentArtworkIndex(index,total,direction){
 if(!Number.isInteger(index)||!Number.isInteger(total)||total<=0)return -1;
 return Math.max(0,Math.min(total-1,index+direction));
}
export function artworkKeyTarget(key,index,total){
 if(key==='Home')return total>0?0:-1;
 if(key==='End')return total>0?total-1:-1;
 if(key==='ArrowLeft')return adjacentArtworkIndex(index,total,-1);
 if(key==='ArrowRight')return adjacentArtworkIndex(index,total,1);
 return null;
}

export function artworkPage(assets,page=0,group='all'){
 const rows=assets.map((asset,index)=>({...asset,index:asset.index??index})).filter(a=>group==='all'||a.asset_group===group);
 const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
 const safePage=Math.max(0,Math.min(page,pages-1));
 return {rows:rows.slice(safePage*PAGE_SIZE,(safePage+1)*PAGE_SIZE),total:rows.length,pages,page:safePage};
}

// Append an optional, independently loaded panel. Failure never blocks playback.
export function attachArtwork(dialog,albumId){
 const tab=document.createElement('section');
 tab.className='album-artwork';
 tab.innerHTML='<details open><summary>이미지 자료 · 북클릿</summary><p class="artwork-status" role="status">이미지 자료를 확인하려면 펼쳐 주세요.</p><div class="artwork-content"></div></details>';
 const tracks=dialog.querySelector('.table-wrap');
 if(tracks)tracks.after(tab);
 else dialog.querySelector('.modal-body')?.append(tab);
 const details=tab.querySelector('details');
 const status=tab.querySelector('.artwork-status');
 const content=tab.querySelector('.artwork-content');
 let assets=[],group='all',page=0,loaded=false,active=-1;
 const alive=()=>dialog.isConnected&&tab.isConnected&&dialog.contains(tab)&&(dialog.open!==false);
 const viewer=document.createElement('div');
 viewer.className='artwork-viewer';
 viewer.hidden=true;
 viewer.setAttribute('role','dialog');
 viewer.setAttribute('aria-modal','true');
 viewer.setAttribute('aria-label','앨범 이미지 확대 보기');
 viewer.innerHTML='<div class="artwork-viewer-bar"><button data-close type="button">닫기 (Esc)</button><span data-title></span><span data-counter></span></div><div class="artwork-viewer-frame"><img alt="선택한 앨범 자료"></div><div class="artwork-viewer-buttons"><button data-prev type="button">← 이전</button><button data-next type="button">다음 →</button></div>';
 document.body.append(viewer);
 let previousFocus=null;
 function close(){
   swipeStart=null;resetZoom();viewer.hidden=true;active=-1;clearMemberImage(viewer.querySelector('img'));
   if(previousFocus?.isConnected)previousFocus.focus();
 }
 function show(index){
   if(!alive()||!assets[index])return;
   resetZoom();active=index;viewer.hidden=false;
   loadMemberImage(viewer.querySelector('img'),assetUrl(albumId,assets[index].index)).catch(()=>{});
   viewer.querySelector('[data-title]').textContent=assets[index].filename;
   viewer.querySelector('[data-counter]').textContent=(index+1)+' / '+assets.length;
   viewer.querySelector('[data-prev]').disabled=index===0;
   viewer.querySelector('[data-next]').disabled=index===assets.length-1;
   viewer.querySelector('[data-close]').focus();
 }
 const image=viewer.querySelector('img');
 const frame=viewer.querySelector('.artwork-viewer-frame');
 let swipeStart=null,ignoreBackdropClick=false,swipeReset=null;
 frame.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&zoom===1)swipeStart={x:e.clientX,y:e.clientY};});
 frame.addEventListener('pointerup',e=>{if(!swipeStart||zoom!==1)return;const moveX=e.clientX-swipeStart.x,moveY=e.clientY-swipeStart.y;swipeStart=null;if(Math.abs(moveX)>60&&Math.abs(moveX)>Math.abs(moveY)*1.3){ignoreBackdropClick=true;clearTimeout(swipeReset);swipeReset=setTimeout(()=>{ignoreBackdropClick=false;},120);if(moveX<0)next();else prev();}});
 frame.addEventListener('pointercancel',()=>{swipeStart=null;});
 let zoom=1,dx=0,dy=0,drag=null;
 const applyZoom=()=>{image.style.transform='translate('+dx+'px,'+dy+'px) scale('+zoom+')';image.style.cursor=zoom>1?'grab':'zoom-in';};
 const resetZoom=()=>{zoom=1;dx=0;dy=0;drag=null;applyZoom();};
 image.draggable=false;
 image.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(1,Math.min(4,zoom*(e.deltaY<0?1.2:1/1.2)));if(zoom===1)dx=dy=0;applyZoom();},{passive:false});
 image.addEventListener('dblclick',e=>{e.preventDefault();resetZoom();});
 image.addEventListener('pointerdown',e=>{if(zoom===1)return;drag={x:e.clientX,y:e.clientY,dx,dy};image.setPointerCapture(e.pointerId);});
 image.addEventListener('pointermove',e=>{if(!drag)return;dx=drag.dx+e.clientX-drag.x;dy=drag.dy+e.clientY-drag.y;applyZoom();});
 image.addEventListener('pointerup',()=>{drag=null;applyZoom();});
 image.addEventListener('pointercancel',()=>{drag=null;applyZoom();});
 const prev=()=>show(adjacentArtworkIndex(active,assets.length,-1)),next=()=>show(adjacentArtworkIndex(active,assets.length,1));
 viewer.querySelector('[data-close]').onclick=close;
 viewer.addEventListener('click',e=>{if(ignoreBackdropClick){ignoreBackdropClick=false;return;}if(e.target===viewer||e.target===frame)close();});
 viewer.querySelector('[data-prev]').onclick=prev;
 viewer.querySelector('[data-next]').onclick=next;
 function keydown(e){
   if(viewer.hidden)return;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
   else if(artworkKeyTarget(e.key,active,assets.length)!==null){e.preventDefault();show(artworkKeyTarget(e.key,active,assets.length));}
   else if(e.key==='Tab'){e.preventDefault();const buttons=[...viewer.querySelectorAll('button:not([disabled])')];const at=buttons.indexOf(document.activeElement);buttons[(at+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}
 }
 document.addEventListener('keydown',keydown,true);
 function cleanup(){clearTimeout(swipeReset);close();document.removeEventListener('keydown',keydown,true);viewer.remove();dialog.removeEventListener('close',cleanup);dialog.removeEventListener('album-page-close',cleanup);}
 dialog.addEventListener('close',cleanup);
 dialog.addEventListener('album-page-close',cleanup);
 function render(){
   if(!alive())return;
   const groups=['all',...new Set(assets.map(a=>a.asset_group))];
   const counts=Object.create(null);for(const asset of assets)counts[asset.asset_group]=(counts[asset.asset_group]||0)+1;
   const result=artworkPage(assets,page,group);page=result.page;
   status.textContent=result.total?result.total+'개 이미지 · 원본은 NAS에 보관':'이 앨범에 등록된 북클릿 이미지가 없습니다.';
   const pageOptions=Array.from({length:result.pages},(_,i)=>'<option value="'+i+'" '+(i===page?'selected':'')+'>'+(i+1)+' / '+result.pages+'</option>').join('');
   const filterButtons=groups.map(g=>'<button type="button" data-group="'+esc(g)+'" aria-pressed="'+(g===group)+'">'+(g==='all'?'전체':esc(g))+' ('+(g==='all'?assets.length:counts[g])+')</button>').join('');
   const thumbs=result.rows.map(a=>'<button type="button" data-image="'+assets.findIndex(asset=>asset.index===a.index)+'" title="'+esc(a.filename)+'"><img loading="lazy" decoding="async" data-member-src="'+esc(thumbUrl(albumId,a.index))+'" alt="'+esc(a.filename)+'"><span>'+esc(a.filename)+'</span></button>').join('');
   content.innerHTML='<div class="artwork-filters">'+filterButtons+'</div><div class="artwork-grid">'+(result.total?thumbs:'')+'</div><div class="artwork-pagination"><button type="button" data-page="-1" '+(page===0?'disabled':'')+'>이전</button><label class="artwork-page-select">페이지 <select aria-label="북클릿 페이지 이동" data-jump>'+pageOptions+'</select></label><button type="button" data-page="1" '+(page===result.pages-1?'disabled':'')+'>다음</button></div>';
   content.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{group=b.dataset.group;page=0;render();});
   content.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page+=Number(b.dataset.page);render();});
   const jump=content.querySelector('[data-jump]');if(jump)jump.onchange=()=>{page=Number(jump.value);render();};
   content.querySelectorAll('[data-image]').forEach(b=>b.onclick=()=>{previousFocus=b;show(Number(b.dataset.image));});
   content.querySelectorAll('.artwork-grid img').forEach(img=>{img.onerror=()=>{img.style.opacity='.25';img.alt='썸네일을 불러올 수 없습니다: '+img.alt;};loadMemberImage(img,img.dataset.memberSrc).catch(()=>img.onerror());});
 }
 const load=async()=>{
   if(!details.open||loaded||!alive())return;
   loaded=true;status.textContent='이미지 자료를 불러오는 중…';
   try{
     const response=await fetch(NAS_URL+'/v2/assets?id='+encodeURIComponent(albumId),{headers:{Authorization:'Bearer '+await (await import('./playlists.js')).currentMemberToken()},credentials:'omit',signal:AbortSignal.timeout(20000)});
     if(!response.ok)throw Error('이미지 목록을 불러오지 못했습니다.');
     const json=await response.json();
     if(!Array.isArray(json.assets))throw Error('이미지 목록 응답이 올바르지 않습니다.');
     if(!alive())return;
     assets=json.assets.map((asset,index)=>({...asset,index})).sort((a,b)=>String(a.filename).localeCompare(String(b.filename),'en',{numeric:true,sensitivity:'base'}));render();
   }catch(error){if(alive()){status.textContent=error.message;loaded=false;}}
 };
 details.addEventListener('toggle',load);
 load();
}
