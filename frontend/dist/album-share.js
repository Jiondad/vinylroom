// Reuses the earlier albumShareUrl / albumShareData candidate; no NAS or media requests.
export const LEGACY_ORIGIN='https://vinylroom.shinekjh.chatgpt.site';
export const GITHUB_PREVIEW='https://jiondad.github.io/vinylroom/';
const shareBase=(origin)=>{
 const u=new URL(origin);
 if(u.username||u.password||u.search||u.hash)return null;
 if(u.origin===LEGACY_ORIGIN&&u.pathname==='/')return LEGACY_ORIGIN+'/';
 if(u.origin==='https://jiondad.github.io'&&u.pathname==='/vinylroom/')return GITHUB_PREVIEW;
 return null;
};
export function currentShareOrigin(location=globalThis.location){
 if(location?.origin==='https://jiondad.github.io'&&location?.pathname?.startsWith('/vinylroom/'))return GITHUB_PREVIEW;
 return LEGACY_ORIGIN;
}
export const validAlbumId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function albumShareUrl({origin=LEGACY_ORIGIN,albumId}){
 const base=shareBase(origin);
 if(!base)throw new TypeError('approved share origin required');
 if(!validAlbumId(albumId))throw new TypeError('invalid album id');
 const link=new URL(base);link.searchParams.set('album',albumId);return link.href;
}
export function albumShareData({origin=LEGACY_ORIGIN,albumId,title,artist}){
 const clean=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,200);
 return {title:clean(title),text:[clean(artist),clean(title),'Vinyl Room 앨범 정보'].filter(Boolean).join(' · '),url:albumShareUrl({origin,albumId})};
}
export function albumShareRoute(href){
 const url=new URL(href),ids=url.searchParams.getAll('album');
 if(!ids.length)return {kind:'none'};
 return ids.length===1&&validAlbumId(ids[0])?{kind:'album',id:ids[0]}:{kind:'invalid'};
}
export function albumHistoryPath(href,id){
 const url=new URL(href);url.search='';url.hash='';
 if(id){if(!validAlbumId(id))throw new TypeError('invalid album id');url.searchParams.set('album',id);}
 return url.pathname+url.search;
}
export const canReadAlbumMetadata=(account,publicBrowse)=>account?.approved===true||(account?.authenticated===false&&publicBrowse===true);
export async function copyAlbumShareLink(url,clipboard){
 if(typeof clipboard?.writeText!=='function')return {copied:false};
 try{await clipboard.writeText(url);return {copied:true};}catch{return {copied:false};}
}
export function supportsAlbumShare(navigator,data){
 try{return typeof navigator?.share==='function'&&(typeof navigator.canShare!=='function'||navigator.canShare(data));}catch{return false;}
}
export async function shareAlbum(data,navigator){
 if(!supportsAlbumShare(navigator,data))return {state:'unsupported'};
 try{await navigator.share(data);return {state:'shared'};}
 catch(error){return {state:error?.name==='AbortError'?'cancelled':'failed'};}
}
export function bindAlbumShare(root,album,{navigator=globalThis.navigator}={}){
 const button=root.querySelector('[data-album-share]');if(!button)return;
 // Only public identity fields may enter a share payload; never spread the album object.
 const data=albumShareData({origin:currentShareOrigin(root.ownerDocument?.defaultView?.location),albumId:album.id,title:album.title,artist:album.artist});
 let dialog=null;
 function close(){if(!dialog)return;const node=dialog;dialog=null;if(node.open)node.close();node.remove();}
 button.onclick=()=>{
  if(dialog?.open)return;
  const node=root.ownerDocument.createElement('dialog');dialog=node;node.className='album-share-dialog';node.setAttribute('aria-label','앨범 공유');
  node.innerHTML='<div class="album-share-head"><h3>앨범 공유</h3><button type="button" data-close aria-label="공유창 닫기">×</button></div><p>앨범 정보 페이지를 공유합니다. 재생은 승인 회원만 이용할 수 있습니다.</p><label>공유 링크<input data-share-url readonly aria-label="앨범 공유 링크"></label><div class="album-share-buttons"><button type="button" data-copy>링크 복사</button><button type="button" data-native>기기 공유</button></div><p data-share-status role="status" aria-live="polite"></p><small>카카오톡 등 공유 대상은 기기와 앱의 지원에 따라 다릅니다. 인스타그램 게시물·스토리 직접 게시는 지원하지 않습니다.</small>';
  node.querySelector('[data-share-url]').value=data.url;
  node.querySelector('[data-close]').onclick=close;
  node.addEventListener('close',()=>{if(dialog===node)dialog=null;node.remove();},{once:true});
  const status=node.querySelector('[data-share-status]'),native=node.querySelector('[data-native]');
  native.disabled=!supportsAlbumShare(navigator,data);
  if(native.disabled)status.textContent='이 브라우저에서는 링크 복사를 이용해 주세요.';
  node.querySelector('[data-copy]').onclick=async()=>{
   const result=await copyAlbumShareLink(data.url,navigator?.clipboard);if(!node.isConnected)return;
   status.textContent=result.copied?'공유 링크를 복사했습니다.':'자동 복사를 사용할 수 없습니다. 링크를 선택해 직접 복사해 주세요.';
   if(!result.copied){const input=node.querySelector('[data-share-url]');input.focus();input.select();}
  };
  native.onclick=async()=>{
   // Called directly from the click handler: keep transient user activation.
   const result=await shareAlbum(data,navigator);if(!node.isConnected)return;
   status.textContent={shared:'기기 공유 요청을 완료했습니다.',cancelled:'공유를 취소했습니다.',failed:'기기 공유를 완료하지 못했습니다. 링크 복사를 이용해 주세요.',unsupported:'이 브라우저에서는 링크 복사를 이용해 주세요.'}[result.state];
  };
  root.ownerDocument.body.append(node);node.showModal();
 };
 root.addEventListener('album-page-close',close,{once:true});
}
