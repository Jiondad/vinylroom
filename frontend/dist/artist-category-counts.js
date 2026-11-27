// W12-C1: display only complete, exact-artist counts returned by the existing Catalog lookup.
export const ARTIST_ALBUM_TYPES=Object.freeze(['Studio','Live','Compilations','Singles & EPs','Bootlegs','OST','ETC','미확인']);
export function artistCategoryCounts(row,name){
 if(!row||row.name!==name||!Number.isSafeInteger(row.count)||row.count<0||!Number.isSafeInteger(row.category_unmapped_count)||row.category_unmapped_count<0)return null;
 const raw=row.category_counts;if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const counts={};let sum=row.category_unmapped_count;
 for(const k of ARTIST_ALBUM_TYPES){const n=raw[k];if(!Object.hasOwn(raw,k)||!Number.isSafeInteger(n)||n<0)return null;counts[k]=n;sum+=n;}
 if(!Number.isSafeInteger(sum)||sum!==row.count)return null;
 return {name,total:row.count,counts,unmapped:row.category_unmapped_count};
}
export function paintArtistCategoryCounts(nav,notice,snapshot){
 if(!nav)return;
 for(const b of nav.querySelectorAll('[data-category]')){
  const label=b.dataset.category||'전체',n=snapshot?(b.dataset.category?snapshot.counts[b.dataset.category]:snapshot.total):undefined;
  const badge=b.querySelector('.artist-category-count');
  if(!badge)continue;
  const valid=Number.isSafeInteger(n)&&n>=0;
  badge.hidden=!valid;badge.textContent=valid?n.toLocaleString():'';
  b.toggleAttribute('data-category-empty',valid&&n===0);
  if(valid)b.setAttribute('aria-label',label+' '+n.toLocaleString()+'장');else b.removeAttribute('aria-label');
 }
 if(notice){notice.hidden=!snapshot?.unmapped;notice.textContent=snapshot?.unmapped?'기존 유형 필터에 포함되지 않는 소장본 '+snapshot.unmapped.toLocaleString()+'장 (전체에 포함)':'';}
}
