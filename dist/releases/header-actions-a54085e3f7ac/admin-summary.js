// Preview administrator summaries are read-only projections of existing API data.
// No requests, authentication changes or persistent writes live in this module.
const natural=v=>Number.isSafeInteger(v)&&v>=0?v:null;
export const displayCount=v=>{const n=natural(v);return n===null?'—':n.toLocaleString('ko-KR');};
export const memberCounts=rows=>{
 const users=Array.isArray(rows)?rows.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)):[];
 return {
  all:users.length,
  pending:users.filter(u=>u.status==='pending').length,
  approved:users.filter(u=>u.status==='approved').length,
  limited:users.filter(u=>u.status==='rejected'||u.status==='suspended').length
 };
};
// Role is read from the protected vinyl_members table, never inferred from email or UI labels.
export function splitMembersByRole(rows){
 const users=Array.isArray(rows)?rows.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)):[];
 return {
  admins:users.filter(row=>row.role==='admin'),
  members:users.filter(row=>row.role==='member'),
  unknown:users.filter(row=>row.role!=='admin'&&row.role!=='member')
 };
}
export function validateMemberProfile(fullName,nickname){
 const name=String(fullName??'').trim();
 const nick=String(nickname??'').trim();
 if(!name||name.length>80||/[\u0000-\u001F\u007F]/.test(name))throw Error('이름은 1~80자이며 제어문자를 사용할 수 없습니다.');
 if(nick.length>60||/[\u0000-\u001F\u007F]/.test(nick))throw Error('닉네임은 60자 이하이며 제어문자를 사용할 수 없습니다.');
 return {full_name:name,nickname:nick||null};
}
export function selectMembers(rows,{query='',filter='all',sort='recent'}={}){
 const q=String(query??'').trim().toLocaleLowerCase('ko-KR');
 const members=(Array.isArray(rows)?rows:[]).filter(m=>{
  if(!m||typeof m!=='object'||Array.isArray(m))return false;
  const valid=filter==='all'||(filter==='limited'?m.status==='rejected'||m.status==='suspended':m.status===filter);
  return valid&&(!q||[m.full_name,m.nickname,m.email].some(v=>String(v??'').toLocaleLowerCase('ko-KR').includes(q)));
 });
 const label=m=>String(m.full_name||m.nickname||m.email||'');
 const date=m=>String(m.requested_at||'');
 const rank={pending:0,approved:1,suspended:2,rejected:3};
 const status=m=>Object.prototype.hasOwnProperty.call(rank,m.status)?rank[m.status]:4;
 return members.slice().sort((a,b)=>{
  if(sort==='name')return label(a).localeCompare(label(b),'ko-KR',{numeric:true})||date(b).localeCompare(date(a));
  if(sort==='status')return status(a)-status(b)||date(b).localeCompare(date(a));
  return date(b).localeCompare(date(a));
 });
}
const stamp=value=>{
 if(typeof value!=='string'||!value.trim())return '—';
 const v=value.trim();
 // Do not show unrelated metadata or NAS paths as dates.
 if(!/^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+Z-]+)?$/.test(v))return '—';
 if(/(?:Z|[+-]\d{2}:\d{2})$/.test(v)){
  const date=new Date(v);
  if(!Number.isFinite(date.valueOf()))return '—';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
   timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
   hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return parts.year+'-'+parts.month+'-'+parts.day+' '+parts.hour+':'+parts.minute+':'+parts.second+' KST';
 }
 return v.slice(0,19).replace('T',' ')+' (NAS 시간)';
};
export function catalogSummary(data){
 const d=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
 return {
  albums:displayCount(d.albums),
  artists:displayCount(d.artists),
  tracks:displayCount(d.tracks),
  ready:d.ready===true?'준비됨':d.ready===false?'초기 색인 미완료':'확인되지 않음',
  indexing:d.indexing===true?'진행 중':d.indexing===false?'대기 중':'확인되지 않음',
  lastScan:stamp(d.last_scan),
  nextScan:stamp(d.next_scan)
 };
}

