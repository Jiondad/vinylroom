/* Artist Experience / isolated opt-in module.
   No auth, Catalog, index, playback, or existing UI state is changed by this module. */
const cache = new Map();
const manifestSnapshots = new Map(), manifestExpiry = new Map(), imageGeometry = new Map(), decodedPhotos = new Map();
const LIVE_MANIFEST_MS = 30000;
const manifestErrors=new Set();
import {NAS_URL} from './config.js';
const IMAGE_PATH = /^images\/[a-f0-9]{24}-(?:thumb|full)\.webp$/;
const STATIC_MANIFEST='/artist-profiles/profiles.json';
const STATIC_ASSETS='/artist-profiles/';
let openDialog = null;

export function safeImagePath(path, type = null) {
  if (typeof path !== 'string' || !IMAGE_PATH.test(path)) return false;
  return !type || path.endsWith(`-${type}.webp`);
}
export function normalizeArtist(item) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.key !== 'string' || !item.key.trim()) return null;
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.key;
  const albumCount = Number.isFinite(item.albumCount) && item.albumCount >= 0 ? Math.floor(item.albumCount) : null;
  return {key:item.key, name, albumCount, genre:typeof item.genre === 'string'?item.genre:''};
}
export function profileFor(profiles, key) {
  if (!profiles || typeof profiles !== 'object' || typeof key !== 'string') return null;
  const entry = Object.prototype.hasOwnProperty.call(profiles,key)?profiles[key]:null;
  if (!entry || !safeImagePath(entry.thumb,'thumb') || !safeImagePath(entry.full,'full')) return null;
  return entry;
}
export function sameOriginAssetBase(baseUrl) {
  const origin = new URL(window.location.href).origin;
  const resolved = new URL(baseUrl.endsWith('/')?baseUrl:baseUrl+'/',window.location.href);
  if (resolved.origin !== origin && resolved.origin !== new URL(NAS_URL).origin) throw Error('artist_asset_requires_trusted_origin');
  return resolved;
}
export async function loadArtistProfiles(manifestUrl) {
  const url = new URL(manifestUrl,window.location.href);
  if (url.origin !== window.location.origin && url.origin !== new URL(NAS_URL).origin) throw Error('artist_manifest_requires_trusted_origin');
  const live=url.origin===new URL(NAS_URL).origin;
  if(live && cache.has(url.href) && manifestExpiry.has(url.href) && Date.now()>=manifestExpiry.get(url.href)){cache.delete(url.href);manifestExpiry.delete(url.href);}
  if (!cache.has(url.href)) {
    const pending = fetch(url.href,{credentials:'omit',redirect:'error',cache:live?'no-store':'default',signal:AbortSignal.timeout(10000)}).then(async response=>{
      if (!response.ok) throw Error(`artist_manifest_http_${response.status}`);
      const content = await response.json();
      if (content?.schema !== 1 || !content.profiles || typeof content.profiles !== 'object' || Array.isArray(content.profiles))
        throw Error('artist_manifest_invalid');
      manifestErrors.delete(url.href);
      return Object.fromEntries(Object.entries(content.profiles).map(([key,entry])=>
        [key,{...entry,assetBaseUrl:live?NAS_URL+'/v2/public/artist-profiles/':STATIC_ASSETS}]));
    }).catch(async error=>{
      manifestErrors.add(url.href);
      if(live){const previous=manifestSnapshots.get(url.href);if(previous)return previous;try{return await loadArtistProfiles(STATIC_MANIFEST);}catch{}}
      cache.delete(url.href);throw error;
    });
    cache.set(url.href,pending);
    pending.then(profiles=>{if(cache.get(url.href)===pending){manifestSnapshots.set(url.href,profiles);manifestExpiry.set(url.href,Date.now()+LIVE_MANIFEST_MS);}},()=>{});
  }
  return cache.get(url.href);
}
// Begin the manifest and a small portrait request as soon as an artist is chosen.
// Never fetch the full image for a small Artist Home slot; full remains viewer-only.
const artistThumbPreloads=new Map();
export function prefetchArtistHomePortrait(manifestUrl,artistKey){
 if(typeof artistKey!=='string'||!artistKey.trim())return;
 void loadArtistProfiles(manifestUrl).then(profiles=>{
  const entry=profileFor(profiles,artistKey);if(!entry)return;
  const url=new URL(entry.thumb,sameOriginAssetBase(entry.assetBaseUrl||STATIC_ASSETS)).href;
  if(artistThumbPreloads.has(url))return;
  const img=new Image();img.decoding='async';img.src=url;
  artistThumbPreloads.set(url,img);
  if(artistThumbPreloads.size>24)artistThumbPreloads.delete(artistThumbPreloads.keys().next().value);
 }).catch(()=>{});
}
export async function previousArtistProfile(key){
 try{return profileFor(await loadArtistProfiles(STATIC_MANIFEST),key);}catch{return null;}
}
export function invalidateArtistProfiles(manifestUrl) {
  const url=new URL(manifestUrl,window.location.href);
  cache.delete(url.href);manifestErrors.delete(url.href);manifestSnapshots.delete(url.href);manifestExpiry.delete(url.href);imageGeometry.clear();decodedPhotos.clear();
}

function safeCreditUrl(value){
  try{const u=new URL(value);return typeof value==='string'&&u.protocol==='https:'&&u.hostname&&!u.username&&!u.password;}catch{return false;}
}
function creditNode(entry) {
  const line=document.createElement('div');line.className='vr-ae-credit';
  const c=entry.credit||{};
  const author = typeof c.author==='string'?c.author:'';
  const license=typeof c.license==='string'?c.license:'';
  const label=document.createElement('span');label.textContent=[author,license].filter(Boolean).join(' · ') || '프로필 이미지';line.append(label);
  if (safeCreditUrl(c.source)) {
    const link=document.createElement('a');link.href=c.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent='출처';line.append(link);
  }
  if (safeCreditUrl(c.license_url)) {
    const a=document.createElement('a');a.href=c.license_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='라이선스';line.append(a);
  }
  return line;
}
export function closeArtistImageViewer(){openDialog?.();}
export function openArtistImageViewer({entry, assetBaseUrl, title}) {
  if (!entry || !safeImagePath(entry.full,'full')) return ()=>{};
  if (openDialog) openDialog();
  const root=sameOriginAssetBase(entry.assetBaseUrl||assetBaseUrl);
  const sourceButton=document.activeElement;
  const oldOverflow=document.body.style.overflow;
  const backdrop=document.createElement('div');backdrop.className='vr-ae-backdrop';
  backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-modal','true');
  backdrop.setAttribute('aria-label',`${title||entry.name||'아티스트'} 프로필 확대`);
  const panel=document.createElement('div');panel.className='vr-ae-viewer';
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='vr-ae-viewer-close';closeButton.textContent='×';closeButton.setAttribute('aria-label','사진 닫기');
  const message=document.createElement('p');message.className='vr-ae-viewer-status';message.setAttribute('role','status');message.textContent='사진 불러오는 중…';
  const photo=document.createElement('img');photo.className='vr-ae-large-photo';
  photo.addEventListener('load',()=>{message.textContent='';imageGeometry.set(photo.src,[photo.naturalWidth,photo.naturalHeight]);});photo.addEventListener('error',async()=>{
    const older=await previousArtistProfile(title||entry.name);
    if(older&&(older.full!==entry.full||older.assetBaseUrl!==entry.assetBaseUrl)){
      entry=older;photo.src=new URL(older.full,sameOriginAssetBase(older.assetBaseUrl)).href;return;
    }
    message.textContent='사진 원본을 불러오지 못했습니다.';photo.hidden=true;
  });photo.src=new URL(entry.full,root).href;
  photo.alt=`${title||entry.name||'아티스트'} 프로필 사진`;photo.decoding='async';
  panel.append(closeButton,photo,message,creditNode(entry));backdrop.append(panel);
  function close(){document.removeEventListener('keydown',onKey);backdrop.remove();document.body.style.overflow=oldOverflow;if(openDialog===close)openDialog=null;if(sourceButton&&sourceButton.isConnected&&typeof sourceButton.focus==='function')sourceButton.focus();}
  function onKey(event){
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='Tab'){
      const focusable=[...backdrop.querySelectorAll('button,a[href]')].filter(el=>el.offsetParent!==null);
      if(!focusable.length) return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  }
  closeButton.addEventListener('click',close);
  backdrop.addEventListener('click',ev=>{if(ev.target===backdrop)close();});
  document.body.append(backdrop);document.body.style.overflow='hidden';
  document.addEventListener('keydown',onKey);closeButton.focus();openDialog=close;
  return close;
}
// Keep geometry separate from DOM: a later Home can reserve the decoded ratio immediately.
export function artistHomeImageHint(manifestUrl,artistKey){
  const profiles=manifestSnapshots.get(new URL(manifestUrl,window.location.href).href);
  const entry=profileFor(profiles,artistKey);
  if(profiles&&!entry)return {unavailable:true};
  if(!entry)return null;
  const url=new URL(entry.full,sameOriginAssetBase(entry.assetBaseUrl||STATIC_ASSETS)).href;
  const dimensions=imageGeometry.get(url)||entry.full_dimensions;
  return Array.isArray(dimensions)&&dimensions.length===2&&dimensions.every(n=>Number.isFinite(n)&&n>0)?{width:dimensions[0],height:dimensions[1]}:null;
}
export async function mountArtistHomeImage({target,artistKey,artistName,manifestUrl,assetBaseUrl,onManage=null,isAdmin=()=>false,openViewer=null,isCurrent=()=>target.isConnected}) {
  if (!(target instanceof Element) || !artistKey || typeof artistKey!=='string') throw Error('artist_home_invalid_target_or_key');
  let entry=null,active=true,manager=null;
  const current=()=>active&&isCurrent()&&target.isConnected;
  const hint=artistHomeImageHint(manifestUrl,artistKey);
  const column=target.parentElement;
  // Cold manifests have no aspect metadata. Retain this reserved lane until navigation.
  target.classList.add('vr-ae-home-slot');
  if(hint?.unavailable){target.classList.add('vr-ae-home-known-empty');}
  else if(hint){
    const ratio=hint.width/hint.height;
    column.style.setProperty('--vr-photo-reserved-pc',Math.min(400,200*ratio)+'px');
    column.style.setProperty('--vr-photo-reserved-mobile',Math.min(400,130*ratio)+'px');
    target.style.setProperty('--vr-photo-ratio',String(ratio));
  }
  function state(value){if(!current())return;target.dataset.photoState=value;target.setAttribute('aria-busy',String(value==='loading'));}
  function fallback(value){if(!current())return;state(value);target.classList.add('vr-ae-home-fallback');const icon=document.createElement('span');icon.textContent='♪';icon.setAttribute('aria-hidden','true');target.replaceChildren(icon);}
  target.replaceChildren();state('loading');
  // Reuse the existing auth callback; text-only updates never recreate this button.
  if(typeof onManage==='function' && typeof isAdmin==='function' && isAdmin()) {
    manager=document.createElement('button');manager.type='button';manager.className='vr-ae-manage';
    manager.textContent='Edit';manager.setAttribute('aria-label',`${artistName||artistKey} 사진 관리`);
    manager.addEventListener('click',()=>{if(current()&&isAdmin())onManage({artistKey,artistName,entry});});
    target.insertAdjacentElement('afterend',manager);
  }
  const dispose=()=>{active=false;if(manager)manager.remove();};
  try {entry=profileFor(await loadArtistProfiles(manifestUrl),artistKey);}
  catch {fallback('error');return dispose;}
  if(!current())return dispose;
  if(!entry){fallback(manifestErrors.has(new URL(manifestUrl,window.location.href).href)?'error':'unavailable');return dispose;}
  async function prepare(selected){
    const url=new URL(selected.thumb,sameOriginAssetBase(selected.assetBaseUrl||assetBaseUrl)).href;
    const cached=decodedPhotos.get(url);
    if(cached&&cached.until>Date.now()&&!cached.img.isConnected)return cached.img;
    const img=artistThumbPreloads.get(url)||document.createElement('img');
    artistThumbPreloads.delete(url);
    img.className='vr-ae-home-photo';img.alt=`${artistName||selected.name||'아티스트'} 프로필`;img.loading='eager';img.decoding='async';
    await new Promise((resolve,reject)=>{
      let finished=false;
      const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);img.onload=img.onerror=null;error?reject(error):resolve();};
      const timer=setTimeout(()=>finish(Error('artist_photo_timeout')),10000);
      img.onload=()=>{if(typeof img.decode==='function')img.decode().then(()=>finish(),finish);else finish();};
      img.onerror=()=>finish(Error('artist_photo_failed'));
      if(img.complete&&img.naturalWidth){img.onload();return;}
      img.src=url;
    });
    imageGeometry.set(url,[img.naturalWidth,img.naturalHeight]);
    decodedPhotos.delete(url);decodedPhotos.set(url,{img,until:Date.now()+LIVE_MANIFEST_MS});
    if(decodedPhotos.size>16)decodedPhotos.delete(decodedPhotos.keys().next().value);
    return img;
  }
  let img;
  try {img=await prepare(entry);}
  catch {
    if(!current())return dispose;
    const older=await previousArtistProfile(artistKey);
    if(!current())return dispose;
    if(older&&(older.full!==entry.full||older.assetBaseUrl!==entry.assetBaseUrl)){
      try {img=await prepare(older);entry=older;}catch{}
    }
    if(!img){fallback('error');return dispose;}
  }
  if(!current())return dispose;
  const trigger=document.createElement('button');trigger.type='button';trigger.className='vr-ae-home-trigger';
  trigger.setAttribute('aria-label',`${artistName||entry.name||'아티스트'} 프로필 사진 확대`);
  trigger.append(img);target.replaceChildren(trigger);state('ready');
  trigger.addEventListener('click',()=>{if(!current())return;if(typeof openViewer==='function')openViewer({entry,artistKey,artistName});else openArtistImageViewer({entry,assetBaseUrl,title:artistName});});
  return dispose;
}
