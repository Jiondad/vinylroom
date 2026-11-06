export const newArtistId=(uuid=()=>crypto.randomUUID())=>'ar_'+uuid();
// Separate sidecar contract. Never derives an identity from a display name or artist_key.
export function validateRegistry(r){
 if(r?.version!==1||!Array.isArray(r.artists)||!Array.isArray(r.bindings))throw Error('지원하지 않는 아티스트 메타데이터');
 const ids=new Set();for(const p of r.artists){if(!/^ar_[0-9a-f-]{36}$/.test(p.id)||ids.has(p.id)||!['person','group'].includes(p.kind)||typeof p.name!=='string'||!p.name.trim())throw Error('아티스트 식별 정보 오류');ids.add(p.id);if(!Number.isSafeInteger(p.revision)||p.revision<1)throw Error('revision 오류');if(!Array.isArray(p.sources)||p.sources.length===0||p.verified!==true)throw Error('검증 출처 필요');}
 const albums=new Set();for(const b of r.bindings){if(!['name','albums'].includes(b.scope)||!ids.has(b.artistId)||b.reviewed!==true||typeof b.catalogName!=='string')throw Error('검토된 매핑 필요');for(const id of b.albumIds||[]){if(albums.has(id))throw Error('중복 앨범 매핑');albums.add(id);}}
 for(const p of r.artists)for(const relation of p.relations||[])if(!ids.has(relation.artistId))throw Error('관계 대상 없음');return r;
}
// A reviewed snapshot is an allow-list, not permission to absorb future names or albums.
export function scopedCatalogBinding(b){
 const e=b.catalogEvidence;
 return b.reviewed===true&&b.scope==='albums'&&e?.status==='VERIFIED_SCOPED_READ_ONLY'&&typeof e.catalogRevision==='string'&&e.catalogRevision.length>0&&Array.isArray(b.albumIds)&&b.albumIds.length>0&&new Set(b.albumIds).size===b.albumIds.length&&e.facts&&Object.keys(e.facts).length===b.albumIds.length&&b.albumIds.every(id=>typeof e.facts[id]?.title==='string')&&b.albumIds.includes(e.anchorId);
}
export function catalogArtistTarget(r,artistId){
 const safe=r.bindings.filter(b=>b.artistId===artistId&&b.reviewed===true&&(b.scope==='name'&&!b.catalogEvidence&&b.provenance!=='ACTUAL_PUBLIC_CATALOG_READ_ONLY'||scopedCatalogBinding(b))&&!r.bindings.some(x=>x.catalogName===b.catalogName&&x.artistId!==artistId));
 const names=[...new Set(safe.map(b=>b.catalogName))];return names.length===1?names[0]:null;
}
export function resolveArtist(r,name,albumIds=[],observedAlbums=[]){
 validateRegistry(r);const bindings=r.bindings.filter(b=>b.catalogName===name);const unique=[...new Set(bindings.map(b=>b.artistId))];
 if(unique.length!==1)return {status:unique.length?'REVIEW_REQUIRED':'NOT_FOUND',candidates:unique};
 const b=bindings.filter(b=>b.artistId===unique[0]);
 const scoped=b.filter(x=>x.catalogEvidence||x.provenance==='ACTUAL_PUBLIC_CATALOG_READ_ONLY');
 if(scoped.length&&(!albumIds.length||observedAlbums.length!==albumIds.length||scoped.some(x=>!scopedCatalogBinding(x))||observedAlbums.some((a,i)=>a.id!==albumIds[i]||!scoped.some(x=>x.albumIds.includes(a.id)&&a.artist===x.catalogName&&a.title===x.catalogEvidence.facts[a.id]?.title&&String(a.original_year??'')===x.catalogEvidence.facts[a.id]?.original_year))))return {status:'REVIEW_REQUIRED',candidates:unique};
 // Homonyms require explicit album bindings; never assign the existing aggregate to one person.
 if(b.some(x=>x.scope==='albums')&&albumIds.some(id=>!b.some(x=>(x.albumIds||[]).includes(id))))return {status:'REVIEW_REQUIRED',candidates:unique};
 return {status:'RESOLVED',profile:r.artists.find(p=>p.id===unique[0])};
}
export function updateSynthetic(r,id,revision,patch,authorized){
 if(!authorized)throw Error('관리자 권한 필요');const p=r.artists.find(p=>p.id===id);if(!p||p.revision!==revision)throw Error('revision 충돌');
 const allowed=['name','aliases','country','started','ended','genres','summary','biography','milestones','musicalFeatures','relations','externalIds','photo'];
 if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('지원하지 않는 필드');
 const next=structuredClone(r);Object.assign(next.artists.find(p=>p.id===id),patch,{revision:revision+1,updated:new Date().toISOString()});validateRegistry(next);return next;
}
let adapter={synthetic:false,load:async()=>structuredClone((await import('./artist-verified-sidecar.js')).default)};
export function configureArtistMetadata(next){if(!next||typeof next.load!=='function')throw Error('metadata adapter 필요');adapter=next;}
export function artistMetadataAdapter(){return adapter;}

export function resolveAlbumArtist(r,albumId){validateRegistry(r);const matches=r.bindings.filter(b=>(b.albumIds||[]).includes(albumId));return matches.length===1&&(!matches[0].catalogEvidence&&matches[0].provenance!=='ACTUAL_PUBLIC_CATALOG_READ_ONLY'||scopedCatalogBinding(matches[0]))?{status:'RESOLVED',artistId:matches[0].artistId}:{status:'REVIEW_REQUIRED'};}
