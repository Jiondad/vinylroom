export function albumYear(album={}) { return album.original_year||album.release_year||''; }
export function formatLabel(item={}, fallback={}) {
 const format=String(item.format||fallback.format||'미확인');
 if(format.toUpperCase()!=='FLAC')return format;
 const bits=Array.isArray(item.bit_depths)?item.bit_depths:[item.bit_depth??fallback.bit_depth];
 const valid=[...new Set(bits.map(Number).filter(n=>Number.isInteger(n)&&n>0&&n<=64))].sort((a,b)=>a-b);
 return `FLAC ${valid.length?valid.join('/')+'bit':'비트 미확인'}`;
}
export function statsMarkup(albums,artists,tracks) {
 return [['소장본수',albums],['아티스트수',artists],['곡수',tracks]].map(([label,value])=>`<div class="stat"><span>${label}</span><b>${Number.isFinite(value)?value.toLocaleString():'—'}</b></div>`).join('');
}
export function qualityLabel(album={}) {
 const tracks=album.tracks?.length?album.tracks:[album];
 const labels=tracks.map(t=>{
  const format=String(t.format||album.format||'').toUpperCase();
  const parts=[format];
  if(format==='MP3'){
   if(['CBR','VBR','ABR'].includes(t.bitrate_mode))parts.push(t.bitrate_mode);
   if(Number(t.bitrate)>0)parts.push(`${Math.round(t.bitrate/1000)}kbps`);
  }else{
   const bits=t.bit_depth??(format===album.format?album.bit_depth:null);
   const rate=t.sample_rate??(format===album.format?album.sample_rate:null);
   if(Number(bits)>0)parts.push(`${bits}bit`);
   if(Number(rate)>0)parts.push(`${Number(rate)/1000}kHz`);
  }
  return parts.filter(Boolean).join(' ');
 });
 return [...new Set(labels.filter(Boolean))].join(' / ')||'미확인';
}
export function albumFacts(album={}) {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rows=[['연도',albumYear(album)],['유형',album.category],['장르',album.genre||album.styles?.join(', ')],['레이블',album.label],['음질',qualityLabel(album)]];
 return `<dl class="album-facts">${rows.map(([label,value])=>`<dt>${label}</dt><dd>${esc(value||'미확인')}</dd>`).join('')}</dl>`;
}
