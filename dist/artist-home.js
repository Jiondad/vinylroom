import {mergePublicRelated,relatedListMarkup} from './artist-relationship-links.js';
import {publicMembers} from './artist-members.js';
import {NAS_URL} from './config.js';
import {mountArtistPortrait,ensureArtistGalleryStyle} from './artist-gallery-integration.js';
const homeOwners=new WeakMap();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountArtistHome(host,{name,albums=[],total,canManage=()=>false,onArtist=()=>{},photoManagement=null,loadArtistInfo=null}){
 const prior=homeOwners.get(host);prior?.dispose?.();const owner={};homeOwners.set(host,owner);
 const isHomeCurrent=()=>host.isConnected&&homeOwners.get(host)===owner;
 let introduction='',catalogInfo=null,memberMarkup='',manualRelated=[],memberCount=0;
 // Keep the same cascade on direct entry and navigation via Artist Gallery.
 ensureArtistGalleryStyle(host.ownerDocument);
 const styleId='artist-home-style';if(!host.ownerDocument.getElementById(styleId)){const link=host.ownerDocument.createElement('link');link.id=styleId;link.rel='stylesheet';link.href=new URL('./artist-home.css',import.meta.url).href;host.ownerDocument.head.append(link);}
 // CSS can load independently: waiting for a stylesheet delayed photo requests,
 // especially on mobile. The portrait slot already reserves its layout space.
 if(!isHomeCurrent())return;
 let portraitStarted=false,disposePortrait=null;
 const media=host.ownerDocument.defaultView?.matchMedia('(max-width:600px)'),mobileOpen=new Set();
 function syncRelationshipLayout(){for(const block of host.querySelectorAll('.artist-relationship-block')){const open=!media?.matches||mobileOpen.has(block.dataset.relationship);const button=block.querySelector('.artist-relationship-toggle');button.setAttribute('aria-expanded',String(open));button.disabled=!media?.matches;block.querySelector('.artist-relationship-content').hidden=!open;}}
 const onLayout=()=>{if(isHomeCurrent())syncRelationshipLayout();else media?.removeEventListener('change',onLayout);};
 media?.addEventListener('change',onLayout);owner.dispose=()=>{media?.removeEventListener('change',onLayout);disposePortrait?.();};
 function relationshipLayout(members,related){const blocks=[['members','Band Members'+(memberCount?' ('+memberCount+')':''),members],['related','관련 아티스트'+(manualRelated.length?' ('+manualRelated.length+')':''),related]].filter(x=>x[2]);return blocks.length?'<div class="artist-relationship-layout'+(blocks.length===1?' is-single':'')+'">'+blocks.map(([key,label,content])=>'<section class="artist-relationship-block" data-relationship="'+key+'"><button type="button" class="artist-relationship-toggle" aria-expanded="true">'+label+'<span aria-hidden="true"></span></button><div class="artist-relationship-content">'+content+'</div></section>').join('')+'</div>':'';}

 function render(message=''){
 const existingPortrait=portraitStarted?host.querySelector('.artist-portrait-column'):null;
 if(!isHomeCurrent())return;
 const count=Number.isSafeInteger(catalogInfo?.count)?catalogInfo.count:Number(total??0);
 const genre=catalogInfo?.genre||'';
 const summary=introduction;
 host.innerHTML=`<section class="artist-home" aria-label="아티스트 홈"><div class="artist-profile"><div class="artist-portrait-column"><div class="artist-portrait" data-photo-state="loading" aria-busy="true"></div></div><div class="artist-intro"><h1>${esc(name)}</h1>${genre&&!['미분류','미확인'].includes(genre)?`<p class="artist-main-genre">${esc(genre)}</p>`:''}${summary?`<p class="artist-summary">${esc(summary)}</p>`:''}<p class="artist-holdings">소장 앨범 ${count.toLocaleString()}장</p></div></div>${relationshipLayout(memberMarkup,relatedMarkup())}<p class="artist-message" role="status">${esc(message)}</p></section>`;
 if(existingPortrait)host.querySelector('.artist-portrait-column').replaceWith(existingPortrait);
 syncRelationshipLayout();
 host.querySelectorAll('.artist-relationship-toggle').forEach(button=>button.onclick=()=>{if(!media?.matches)return;const key=button.closest('.artist-relationship-block').dataset.relationship;if(mobileOpen.has(key))mobileOpen.delete(key);else mobileOpen.add(key);syncRelationshipLayout();});
 const portrait=host.querySelector('.artist-portrait');
 if(!portraitStarted){portraitStarted=true;void mountArtistPortrait(portrait,name,isHomeCurrent,photoManagement).then(dispose=>{if(!isHomeCurrent())dispose();else disposePortrait=dispose;});}
 }
 function relatedMarkup(){return manualRelated.length?'<section class="related-artists" aria-label="관련 아티스트">'+relatedListMarkup(manualRelated)+'</section>':'';}
 render();
 if(typeof loadArtistInfo==='function')void loadArtistInfo().then(value=>{if(isHomeCurrent()&&value?.name===name){catalogInfo=value;render();}}).catch(()=>{});
 void fetch(NAS_URL+'/v2/public/artist-profiles/profile?'+new URLSearchParams({name}),{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async response=>{
  if(!response.ok)return;const value=await response.json();
  if(isHomeCurrent()&&value.name===name){if(typeof value.introduction==='string')introduction=value.introduction;memberMarkup=publicMembers(value.artist_kind,value.members);memberCount=memberMarkup&&Array.isArray(value.members)?value.members.length:0;manualRelated=mergePublicRelated(value.related_artists,value.reverse_relationships);render();}
 }).catch(()=>{});
}
