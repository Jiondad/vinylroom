// Visible only when the Catalog API explicitly confirms a committed AI/trusted-source application.
// A Gemini proposal, an ordinary genre, or an album.sources entry is not proof of an apply.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fieldNames={genre:'장르',styles:'세부 장르',secondary_genres:'보조 장르',original_date:'원발매일',original_year:'원발매 연도',category:'앨범 유형',label:'레이블'};
export function aiAppliedBadge(album={}) {
  const evidence=album.ai_application;
  if(!evidence||evidence.applied!==true||typeof evidence.operation_id!=='string'||!evidence.operation_id.trim())return '';
  const fields=Array.isArray(evidence.fields)?[...new Set(evidence.fields.filter(field=>typeof field==='string'&&fieldNames[field]).map(field=>fieldNames[field]))]:[];
  const sources=Array.isArray(evidence.sources)?[...new Set(evidence.sources.filter(source=>typeof source==='string'&&/^(MusicBrainz|Discogs)$/i.test(source)).map(source=>source.trim()))]:[];
  const details=[fields.length?'적용 항목: '+fields.join(', '):'',sources.length?'확인 출처: '+sources.join(' · '):''].filter(Boolean);
  const description=details.length?'<span class="ai-applied-details">'+escapeHtml(details.join(' | '))+'</span>':'';
  return '<div class="ai-applied-meta"><span class="ai-applied-badge" aria-label="AI 분류 실제 적용 완료">✦ AI 분류 적용</span>'+description+'</div>';
}
