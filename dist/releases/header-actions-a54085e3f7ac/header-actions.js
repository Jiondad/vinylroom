// Shared presentation owner. Authentication, account and NAS indexing handlers stay intact.
const instances=new WeakMap();
export function installHeaderActions({doc=document,win=window}={}){
 if(instances.has(doc))return instances.get(doc);
 const mainHeader=doc.querySelector('main > header');
 if(!mainHeader)throw Error('Shared page header missing');
 const actions=mainHeader.querySelector('.header-actions')||doc.createElement('div');
 actions.id='vinyl-header-actions';actions.classList.add('header-actions','vinyl-header-actions');
 actions.setAttribute('role','group');actions.setAttribute('aria-label','공통 계정 및 색인');
 const index=doc.getElementById('import');
 const account=doc.getElementById('member-account')||doc.createElement('button');
 account.id='member-account';account.type='button';account.classList.add('account-button');
 if(!account.querySelector('svg'))account.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg><span>로그인</span>';
 account.setAttribute('aria-label','내 계정 및 회원 관리');
 const oldExport=doc.getElementById('export');if(oldExport)oldExport.hidden=true;
 const legacySettings=doc.getElementById('settings');if(legacySettings)legacySettings.hidden=true;
 const sidebar=doc.querySelector('.sidebar'),brand=sidebar?.querySelector('.brand');
 let brandHeader=sidebar?.querySelector('.vinyl-brand-header');
 if(!brandHeader&&brand){brandHeader=doc.createElement('header');brandHeader.className='vinyl-brand-header';brand.before(brandHeader);brandHeader.append(brand);}
 const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('./header-actions.css',import.meta.url).href;style.dataset.vinylHeaderActions='';doc.head.append(style);
 const mobile=win.matchMedia?.('(max-width:740px)');let canIndex=()=>false;
 const permitIndex=()=>{try{return canIndex()===true;}catch{return false;}};
 function refresh(){
  const admin=doc.querySelector('#vinyl-admin-center .vr-admin-header');
  // The existing Admin header joins the same full-width page edge as the library.
  if(admin&&admin.parentElement.id!=='vinyl-admin-center')doc.getElementById('vinyl-admin-center').prepend(admin);
  const album=doc.querySelector('.album-full-page .album-full-bar');
  // Popups retain their own close/actions; the shared group stays on the page.
  const target=admin||(mobile?.matches?brandHeader:album)||mainHeader;
  if(!target)return;
  target.classList.add('vinyl-page-header');
  const allowed=permitIndex();actions.dataset.indexAllowed=String(allowed);
  if(index){if(index.textContent!=='Indexing')index.textContent='Indexing';index.hidden=!allowed;if(index.parentNode!==actions)actions.append(index);}
  if(account.parentNode!==actions||actions.lastElementChild!==account)actions.append(account);
  if(actions.parentNode!==target||target.lastElementChild!==actions)target.append(actions);
 }
 // A hidden control cannot be used to bypass a just-expired UI permission. NAS checks remain.
 actions.addEventListener('click',event=>{if(index?.contains(event.target)&&!permitIndex()){event.preventDefault();event.stopImmediatePropagation();}},true);
 const observer=win.MutationObserver?new win.MutationObserver(()=>refresh()):null;
 observer?.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 for(const name of ['vinyl-account-change','vinyl-approval-change','vinyl-album-page-change'])win.addEventListener(name,refresh);
 mobile?.addEventListener('change',refresh);
 const api={account,actions,refresh,configure(options){canIndex=typeof options.canIndex==='function'?options.canIndex:()=>false;refresh();}};
 instances.set(doc,api);refresh();return api;
}
export function configureHeaderActions(options){installHeaderActions().configure(options);}
export function refreshHeaderActions(){installHeaderActions().refresh();}
