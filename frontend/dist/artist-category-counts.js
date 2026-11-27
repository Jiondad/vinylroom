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

export function artistHomeSort(value){return value==='recent'?'recent':'year';}
export function artistHomeHidesArtist(row,artist){return typeof artist==='string'&&artist.length>0&&row?.artist===artist;}
export function artistHomeListLabel(category,total){return (category||'전체')+' · '+(Number.isSafeInteger(total)&&total>=0?total.toLocaleString()+'장':'수량 미확인');}

export function artistWorkMode(v){return v==='work'?'work':'';}
export function artistWorkResult(result,artist){
 const count=n=>Number.isSafeInteger(n)&&n>=0;
 if(result?.group!=='work'||!Array.isArray(result.items)||!count(result.total)||!count(result.holdings_total)||!count(result.grouped_holdings)||!count(result.work_groups)||result.total>result.holdings_total||result.grouped_holdings>result.holdings_total||result.total!==result.holdings_total-result.grouped_holdings+result.work_groups)return false;
 const seen=new Set();const valid=m=>m&&m.artist===artist&&typeof m.id==='string'&&m.id.length>0&&typeof m.title==='string';
 for(const a of result.items){if(!valid(a)||!count(a.holding_count)||a.holding_count<1)return false;
  const list=a.holding_count===1?[a]:a.work_members;
  if(!Array.isArray(list)||list.length!==a.holding_count||list[0]?.id!==a.id)return false;
  for(const m of list){if(!valid(m)||seen.has(m.id))return false;seen.add(m.id);}
 }
 return seen.size<=result.holdings_total;
}
export function artistWorkListLabel(category,result){
 return (category||'전체')+' · 표시 '+result.total.toLocaleString()+'개 / 소장본 '+result.holdings_total.toLocaleString()+'장';
}
export function artistWorkEdition(row){
 const e=row?.edition;
 if(typeof e==='string')return e.trim();
 if(Array.isArray(e?.attributes))return e.attributes.filter(x=>typeof x==='string'&&x.trim()).join(' · ');
 return '';
}
export function artistWorkMemberMarkup(a,{esc,formatLabel,catalogTypeLabel}){
 if(!(a.holding_count>1)||!Array.isArray(a.work_members))return '';
 return '<details class="artist-work-editions"><summary>소장본 '+a.holding_count.toLocaleString()+'종</summary><div class="artist-work-edition-list">'+a.work_members.map(m=>{
  const release=typeof m.release_year==='string'||typeof m.release_year==='number'?String(m.release_year).trim():'';
  const rate=Number(m.sample_rate),quality=formatLabel(m)+(Number.isFinite(rate)&&rate>=8000&&rate<=768000?' · '+(rate/1000)+'kHz':'');
  return '<button type="button" data-open="'+esc(m.id)+'" class="artist-work-edition"><strong>'+esc(m.title)+'</strong><small>'+esc([artistWorkEdition(m),release?('판본 연도 '+release):'',catalogTypeLabel(m.category),quality].filter(Boolean).join(' · '))+'</small></button>';
 }).join('')+'</div></details>';
}
