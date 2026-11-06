import {parseOriginalDate} from './ai-original-date.js';
export function albumYear(album={}) { return album.original_year||album.release_year||''; }
// original_year in list responses can be coalesced from an edition date.
// Expand only with matching original-date tag evidence; never parse a folder.
export function albumReleaseDate(album={}) {
 const value=String(albumYear(album)).trim(),year=value.match(/\d{4}/)?.[0]||'';
 const original=String(album.original_year??'').trim(),tags=album.raw_tags;
 const evidence=tags&&typeof tags==='object'?Object.entries(tags).filter(([key])=>['originaldate','originalyear'].includes(key.toLowerCase())).flatMap(([,v])=>Array.isArray(v)?v:[v]).map(v=>String(v).trim()):[];
 if(!original||!evidence.includes(original))return year;
 const match=original.match(/^(\d{4})(?:[-.](\d{2})(?:[-.](\d{2}))?)?$/);
 if(!match)return year;
 const [,y,m,d]=match,yn=Number(y),mn=Number(m),dn=Number(d);
 if(yn<1000||yn>9999||m&&(mn<1||mn>12))return year;
 if(d){const days=new Date(Date.UTC(yn,mn,0)).getUTCDate();if(dn<1||dn>days)return year;}
 if(m==='01'&&d==='01')return year;
 return [y,m,d].filter(Boolean).join('.');
}
/** Album detail only: use Catalog fields, never an AI proposal or folder year. */
export function albumDetailDateInfo(album={}) {
 const date=v=>parseOriginalDate(v)?.text.replaceAll('-','.')||'';
 const attributes=typeof album.edition==='string'?album.edition:Array.isArray(album.edition?.attributes)?album.edition.attributes.join(' '):'';
 const editionSpecific=/reissue|re[ -]?release|anniversary|리이슈|재발매|기념판|주년/i.test(attributes);
 if(editionSpecific){
  // Existing AI metadata calls this explicit evidence flag owned_edition_verified.
  // It is accepted only on the Catalog album itself, never from proposal.result.
  if(album.owned_edition_verified!==true)return {value:'',kind:'edition',reason:'판본의 실제 발매일 검증 정보 미확인'};
  return {value:date(album.release_date)||date(album.release_year),kind:'edition',reason:'검증된 판본 발매일'};
 }
 return {value:date(album.original_date)||date(album.original_year),kind:'original',reason:'Catalog 원발매일 · 단순 리마스터 포함'};
}
export function albumDetailReleaseDate(album={}){return albumDetailDateInfo(album).value;}
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
 const mp3=tracks.filter(t=>String(t.format||album.format||'').toUpperCase()==='MP3');
 const mp3Labels=[];
 const rateLabel=rows=>{const rates=[...new Set(rows.map(t=>Math.round(Number(t.bitrate)/1000)).filter(n=>Number.isFinite(n)&&n>0))].sort((a,b)=>a-b);return rates.length?(rates.length===1?String(rates[0]):rates[0]+'–'+rates.at(-1))+'kbps':'';};
 for(const mode of ['VBR','ABR','other']){
  const rows=mp3.filter(t=>mode==='other'?!['VBR','ABR'].includes(String(t.bitrate_mode||'').toUpperCase()):String(t.bitrate_mode||'').toUpperCase()===mode);
  if(!rows.length)continue;
  if(mode==='VBR'){mp3Labels.push('MP3 VBR');continue;}
  const rate=rateLabel(rows);mp3Labels.push(['MP3',mode==='ABR'?'ABR':'',rate].filter(Boolean).join(' '));
  if(rate&&rows.some(t=>!(Number(t.bitrate)>0)))mp3Labels.push('MP3 비트레이트 미확인');
 }
 let mp3Seen=false;
 const labels=tracks.map(t=>{
  const format=String(t.format||album.format||'').toUpperCase();
  const parts=[format];
  if(format==='MP3'){
   if(mp3Seen)return '';mp3Seen=true;return mp3Labels.join(' / ');
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
 const rows=[['발매일',albumDetailReleaseDate(album)],['유형',album.category],['장르',album.genre||album.styles?.join(', ')],['레이블',album.label],['음질',qualityLabel(album)]];
 return `<dl class="album-facts">${rows.map(([label,value])=>`<dt>${label}</dt><dd>${esc(value||'미확인')}</dd>`).join('')}</dl>`;
}
