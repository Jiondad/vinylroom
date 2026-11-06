const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
export function searchField(value,query){
 const text=escape(value),needle=normalize(query);
 return needle&&normalize(value).includes(needle)?`<strong>${text}</strong>`:text;
}
