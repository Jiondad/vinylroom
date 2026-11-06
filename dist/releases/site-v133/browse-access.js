import {NAS_URL} from './config.js';
let enabled=false;
const publicNames=new Set(['state','albums','album','cover','cover-original','assets','asset','asset-thumb','top100','top100-cover']);
export const publicBrowseEnabled=()=>enabled;
export async function initializeBrowse(){
 try{const r=await fetch(NAS_URL+'/health',{credentials:'omit',signal:AbortSignal.timeout(5000)});const data=await r.json();enabled=r.ok&&data.public_browse===true;}catch{enabled=false;}
 document.documentElement.dataset.vinylBrowse=String(enabled);return enabled;
}
export async function readRequest(url,options={}){
 const parsed=new URL(url);if(parsed.origin!==new URL(NAS_URL).origin)throw Error('로그인과 관리자 승인이 필요합니다.');
 const account=await import('./playlists.js');
 if(account.isApprovedMember()){const r=await fetch(url,{credentials:'omit',redirect:'error',...options,headers:{...options.headers,Authorization:'Bearer '+await account.currentMemberToken()}});if(r.status===401||r.status===403)account.invalidateMemberAccess();return r;}
 const name=parsed.pathname.replace(/^\/v2\//,'');
 if(!enabled||parsed.origin!==new URL(NAS_URL).origin||!publicNames.has(name)||(options.method&&options.method!=='GET'))throw Error('로그인과 관리자 승인이 필요합니다.');
 parsed.pathname='/v2/public/'+name;
 return fetch(parsed.href,{credentials:'omit',redirect:'error',...options,headers:{}});
}
export function installMemberPrompts(isApproved,login){
 const protectedSelector='[data-track-action],[data-mobile-track-play],[data-mobile-track-action],[data-search-play],[data-search-queue],[data-search-list],[data-search-download],[data-top100-tap-play],[data-top100-action],[data-top100-all],#random-play,#random-download,#random-queue,#random-save,#my-playlists,[data-album-action],#play-album,#download-album,#show-queue,[data-queue],[data-toggle],[data-next],[data-previous]';
 document.addEventListener('click',e=>{
  if(isApproved()||!enabled||!e.target.closest(protectedSelector))return;
  e.preventDefault();e.stopImmediatePropagation();
  let dialog=document.querySelector('#vinyl-member-required');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='vinyl-member-required';dialog.innerHTML='<div class="modal-body"><p>음악 재생·다운로드·목록 기능은 로그인한 승인 회원만 이용할 수 있습니다.</p><div class="actions"><button data-login>로그인</button><button data-cancel>취소</button></div></div>';document.body.append(dialog);dialog.querySelector('[data-login]').onclick=()=>{dialog.close();login();};dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});}
  dialog.querySelector('p').textContent=e.target.closest('[data-mobile-track-play],[data-search-play],[data-top100-tap-play],[data-track-action="play"],[data-top100-action="play"],#random-play,[data-album-action="play"],#play-album')?'음악 재생은 로그인한 회원만 이용할 수 있습니다.':'다운로드·대기열·플레이리스트는 로그인한 승인 회원만 이용할 수 있습니다.';
  if(!dialog.open)dialog.showModal();
 },true);
}

