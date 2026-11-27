import {normalizeTarget,relationshipCard,relationshipRows,mountCompactRelationshipEditor} from './artist-relationship-links.js';
// W12 manual artist membership. No inferred identity or external calls.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(v,max,label)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x1f\x7f]/.test(v))throw Error(label+' 형식을 확인하세요.');return v.trim();};
const statuses={current:'현재 멤버',final:'최종 멤버',former:'이전 멤버'};
export function normalizeMembers(input){
 if(!Array.isArray(input)||input.length>100)throw Error('멤버 목록 형식을 확인하세요.');
 const seen=new Set(),targets=new Set();
 const out=input.map(m=>{
  if(!m||typeof m!=='object'||Array.isArray(m)||!Object.hasOwn(statuses,m.status))throw Error('멤버 상태를 선택하세요.');
  const name=text(m.name,150,'이름'),roles=text(m.roles??'',150,'담당 파트');
  if(!name)throw Error('멤버 이름을 입력하세요.');
  const key=name.normalize('NFC').toLocaleLowerCase('en-US');if(seen.has(key))throw Error('중복 멤버: '+name);seen.add(key);
  if(!Array.isArray(m.periods)||m.periods.length>12)throw Error('활동 기간 형식을 확인하세요.');
  const periods=m.periods.map(p=>{const begin=text(p?.begin??'',4,'가입 연도'),end=text(p?.end??'',4,'탈퇴 연도');if((begin&&!/^\d{4}$/.test(begin))||(end&&!/^\d{4}$/.test(end))||(begin&&end&&Number(begin)>Number(end))||(!begin&&!end))throw Error(name+' 활동 기간을 확인하세요.');return {begin,end};});
  const target=normalizeTarget(m.catalog_target);if(target&&targets.has(target.key))throw Error('중복 연결 멤버: '+name);if(target)targets.add(target.key);return {name,roles,status:m.status,periods,...(target?{catalog_target:target}:{})};
 });
 if(out.some(m=>m.status==='current')&&out.some(m=>m.status==='final'))throw Error('현재 멤버와 최종 멤버를 동시에 지정할 수 없습니다.');
 return out;
}
export function renderMembers(input){
 const rows=normalizeMembers(input);if(!rows.length)return '';
 const period=p=>p.begin&&p.end?p.begin+'–'+p.end:p.begin?p.begin+'–':'–'+p.end;
 return '<section class="artist-members" aria-label="밴드 멤버"><h2>Band Members</h2>'+Object.entries(statuses).map(([status,label])=>{const members=rows.filter(m=>m.status===status);return members.length?'<div class="artist-members-group"><h3>'+label+' <small>('+members.length+')</small></h3>'+relationshipRows(members,m=>relationshipCard(m,{roles:m.roles,periods:m.periods.map(period).join(' · ')}))+'</div>':'';}).join('')+'</section>';
}
export function publicMembers(kind,input){if(kind!=='group')return '';try{return renderMembers(input);}catch{return '';}}
export function memberUpdate(kind,rows,originalKind,originalRows){
 if(!['person','group','unknown'].includes(kind))throw Error('아티스트 유형을 확인하세요.');
 if(kind!=='group')return kind===originalKind?null:{artist_kind:kind};
 const members=normalizeMembers(rows);
 return kind===originalKind&&JSON.stringify(members)===JSON.stringify(originalRows)?null:{artist_kind:kind,members};
}
export function mountMembersEditor(host,input,search=null){return mountCompactRelationshipEditor(host,input,{search,normalize:normalizeMembers,member:true});}
