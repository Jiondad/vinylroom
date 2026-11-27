import {mergePublicRelated,relatedListMarkup} from './artist-relationship-links.js';
import {publicMembers} from './artist-members.js';
import {NAS_URL} from './config.js';
import {mountArtistPortrait,ensureArtistGalleryStyle} from './artist-gallery-integration.js';
import {relatedArtists,importMusicBrainz,mergeRelationships} from './artist-relations.js';
import {artistMetadataAdapter,resolveArtist,catalogArtistTarget} from './artist-metadata.js';
const homeOwners=new WeakMap();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const photoSrc=p=>/^artist-photo-[0-9a-f]{64}\.jpg$/.test(p?.cacheFile||'')?new URL('../../'+p.cacheFile,import.meta.url).href:p?.url;
const list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()):[];
const https=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
export function photoAllowed(p){return p?.approved===true&&p.identityVerified===true&&['CC0','Public domain','CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY-SA 3.0'].includes(p.license)&&!!https(p.url)&&!!https(p.source)&&!!p.author;}
export async function mountArtistHome(host,{name,albums=[],total,canManage=()=>false,onArtist=()=>{},photoManagement=null,loadArtistInfo=null}){
 const prior=homeOwners.get(host);prior?.dispose?.();const owner={};homeOwners.set(host,owner);
 const isHomeCurrent=()=>host.isConnected&&homeOwners.get(host)===owner;
 const source=artistMetadataAdapter();let registry=null,profile=null,status='NOT_FOUND',expanded=false,relationMessage='';let introduction=null,catalogInfo=null,memberMarkup='',manualRelated=[],memberCount=0;
 // Keep the same cascade on direct entry and navigation via Artist Gallery.
 if(host.ownerDocument.defaultView?.matchMedia('(max-width:600px)').matches)ensureArtistGalleryStyle(host.ownerDocument);
 const styleId='artist-home-style';if(!host.ownerDocument.getElementById(styleId)){const link=host.ownerDocument.createElement('link');link.id=styleId;link.rel='stylesheet';link.href=new URL('./artist-home.css',import.meta.url).href;host.ownerDocument.head.append(link);}
 // CSS can load independently: waiting for a stylesheet delayed photo requests,
 // especially on mobile. The portrait slot already reserves its layout space.
 if(!isHomeCurrent())return;
 let portraitStarted=false,disposePortrait=null;
 const media=host.ownerDocument.defaultView?.matchMedia('(max-width:600px)'),mobileOpen=new Set();
 function syncRelationshipLayout(){for(const block of host.querySelectorAll('.artist-relationship-block')){const open=!media?.matches||mobileOpen.has(block.dataset.relationship);const button=block.querySelector('.artist-relationship-toggle');button.setAttribute('aria-expanded',String(open));button.disabled=!media?.matches;block.querySelector('.artist-relationship-content').hidden=!open;}}
 const onLayout=()=>{if(isHomeCurrent())syncRelationshipLayout();else media?.removeEventListener('change',onLayout);};
 media?.addEventListener('change',onLayout);owner.dispose=()=>{media?.removeEventListener('change',onLayout);disposePortrait?.();};
 function relationshipLayout(members,related){const blocks=[['members','Band Members'+(memberCount?' ('+memberCount+')':''),members],['related','관련 아티스트',related]].filter(x=>x[2]);return blocks.length?'<div class="artist-relationship-layout'+(blocks.length===1?' is-single':'')+'">'+blocks.map(([key,label,content])=>'<section class="artist-relationship-block" data-relationship="'+key+'"><button type="button" class="artist-relationship-toggle" aria-expanded="true">'+label+'<span aria-hidden="true"></span></button><div class="artist-relationship-content">'+content+'</div></section>').join('')+'</div>':'';}

 function render(message=''){
 const existingPortrait=portraitStarted?host.querySelector('.artist-portrait-column'):null;
 if(!isHomeCurrent())return;const p=profile||{name},photo=photoAllowed(p.photo)?p.photo:null;
 const totals=p.holdings?.verified===true?p.holdings:null;
 const count=Number.isSafeInteger(catalogInfo?.count)?catalogInfo.count:Number(totals?.albums??total??0);
 const genre=catalogInfo?catalogInfo.genre:list(p.genres).join(' · ');
 const summary=introduction===null?p.summary:introduction;
 host.innerHTML=`<section class="artist-home" aria-label="아티스트 홈"><div class="artist-profile"><div class="artist-portrait-column"><div class="artist-portrait" data-photo-state="loading" aria-busy="true"></div></div><div class="artist-intro"><h1>${esc(p.name||name)}</h1>${p.country?`<p class="artist-facts">${esc(p.country)}</p>`:''}${genre&&!['미분류','미확인'].includes(genre)?`<p class="artist-main-genre">${esc(genre)}</p>`:''}${summary?`<p class="artist-summary">${esc(summary)}</p>`:''}<p class="artist-holdings">소장 앨범 ${count.toLocaleString()}장</p></div></div>${relationshipLayout(memberMarkup,relatedMarkup())}<p class="artist-message" role="status">${esc(message)}</p></section>`;
 if(existingPortrait)host.querySelector('.artist-portrait-column').replaceWith(existingPortrait);
 syncRelationshipLayout();
 host.querySelectorAll('.artist-relationship-toggle').forEach(button=>button.onclick=()=>{if(!media?.matches)return;const key=button.closest('.artist-relationship-block').dataset.relationship;if(mobileOpen.has(key))mobileOpen.delete(key);else mobileOpen.add(key);syncRelationshipLayout();});
 const portrait=host.querySelector('.artist-portrait');
 if(!portraitStarted){portraitStarted=true;void mountArtistPortrait(portrait,name,isHomeCurrent,photoManagement).then(dispose=>{if(!isHomeCurrent())dispose();else disposePortrait=dispose;});}
 host.querySelector('[data-related-all]')?.addEventListener('click',()=>{expanded=!expanded;render();});
 host.querySelectorAll('.related-artist img').forEach(img=>img.addEventListener('error',()=>{img.parentElement.textContent='♪';}));
 host.querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>{const name=catalogArtistTarget(registry,b.dataset.related);if(name)onArtist(name);else render('연결 앨범의 명시적 매핑 검토가 필요합니다.');});
 host.querySelector('[data-profile-edit]')?.addEventListener('click',()=>editor());
 }
 function relatedMarkup(){const linkedNames=new Set(manualRelated.filter(r=>r.catalog_target).map(r=>r.catalog_target.name));const rows=(profile?relatedArtists(registry,profile.id):[]).filter(r=>!r.catalogName||!linkedNames.has(r.catalogName));if(!rows.length&&!manualRelated.length&&!relationMessage)return '';const shown=expanded?rows:rows.slice(0,8);return `<section class="related-artists" aria-label="관련 아티스트"><div class="related-heading"><h2>관련 아티스트</h2>${rows.length>8?`<button type="button" data-related-all aria-expanded="${expanded}">${expanded?'접기':'전체 보기 ('+rows.length+')'}</button>`:''}</div>${relatedListMarkup(manualRelated)}<div class="related-grid">${shown.map(row=>`<button type="button" class="related-artist" ${row.catalogName?`data-related="${esc(row.artist.id)}"`:'disabled title="정확한 소장 아티스트 매핑 필요"'}><span class="related-photo">${photoAllowed(row.artist.photo)?`<img src="${esc(photoSrc(row.artist.photo))}" alt="${esc(row.artist.name)}" loading="lazy">`:'♪'}</span><span><strong>${esc(row.artist.name)}</strong><small>${esc(row.labels.join(' · '))}${row.owned?' · 소장':''}</small></span></button>`).join('')}</div>${shown.some(row=>photoAllowed(row.artist.photo))?`<details class="artist-sources"><summary>사진 출처</summary>${shown.filter(row=>photoAllowed(row.artist.photo)).map(row=>{const p=row.artist.photo;return `<p>${esc(row.artist.name)} · ${esc(p.author)} · <a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">출처</a> · ${https(p.licenseUrl)?`<a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a>`:esc(p.license)} · ${esc(p.changes||'')}</p>`;}).join('')}</details>`:''}${relationMessage?`<p class="hint">${esc(relationMessage)}</p>`:''}</section>`;}
 function editor(){if(!canManage()||!source.synthetic||!source.save)return;const form=host.ownerDocument.createElement('form');form.className='artist-editor';form.innerHTML=`<label>합성 메타데이터 JSON<textarea aria-label="합성 프로필 수정" rows="8">${esc(JSON.stringify(Object.fromEntries(['name','aliases','country','started','ended','genres','summary','biography','relations','externalIds','photo'].filter(k=>profile[k]!==undefined).map(k=>[k,profile[k]])),null,2))}</textarea></label><button type="submit">합성 저장</button><button type="button">취소</button><p role="status"></p>`;host.append(form);form.querySelector('[type="button"]').onclick=()=>form.remove();form.onsubmit=async e=>{e.preventDefault();try{if(!canManage())throw Error('관리자 권한 필요');registry=await source.save(profile.id,profile.revision,JSON.parse(form.querySelector('textarea').value));profile=registry.artists.find(x=>x.id===profile.id);render('합성 저장 완료 · 운영 반영 없음');}catch(e){form.querySelector('[role="status"]').textContent=e.message;}};}
 render();
 if(typeof loadArtistInfo==='function')void loadArtistInfo().then(value=>{if(isHomeCurrent()&&value?.name===name){catalogInfo=value;render();}}).catch(()=>{});
 void fetch(NAS_URL+'/v2/public/artist-profiles/profile?'+new URLSearchParams({name}),{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async response=>{
  if(!response.ok)return;const value=await response.json();
  if(isHomeCurrent()&&value.name===name){if(typeof value.introduction==='string')introduction=value.introduction;memberMarkup=publicMembers(value.artist_kind,value.members);memberCount=memberMarkup&&Array.isArray(value.members)?value.members.length:0;manualRelated=mergePublicRelated(value.related_artists,value.reverse_relationships);render();}
 }).catch(()=>{});
 try{registry=await source.load();if(!isHomeCurrent())return;const resolved=resolveArtist(registry,name,albums.map(a=>a.id),albums);status=resolved.status;profile=resolved.profile||null;render();
 if(profile&&source.loadRelations&&profile.externalIdsVerified===true&&profile.externalIds?.musicbrainz){try{const payload=await source.loadRelations(profile.externalIds.musicbrainz);if(!isHomeCurrent())return;const imported=importMusicBrainz(registry,profile.id,payload);registry={...registry,relationships:mergeRelationships(registry.relationships,imported.edges)};if(imported.pending.length)relationMessage='일부 외부 아티스트는 정확한 ID 매핑 검토가 필요합니다.';render();}catch{relationMessage='외부 관계 조회 실패 · 기존 소장 앨범은 계속 이용할 수 있습니다.';render();}}}catch{render('프로필을 불러오지 못했습니다. 소장 앨범은 계속 이용할 수 있습니다.');}
}
