import {normalizeTarget,relationshipName,mountRelationshipPicker} from './artist-relationship-links.js';
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
 return '<section class="artist-members" aria-label="밴드 멤버"><h2>Band Members</h2>'+Object.entries(statuses).map(([status,label])=>{const members=rows.filter(m=>m.status===status);return members.length?'<div class="artist-members-group"><h3>'+label+'</h3><div class="artist-members-grid">'+members.map(m=>'<article><strong>'+relationshipName(m)+'</strong>'+(m.roles?'<span>'+esc(m.roles)+'</span>':'')+(m.periods.length?'<small>'+esc(m.periods.map(period).join(' · '))+'</small>':'')+'</article>').join('')+'</div></div>':'';}).join('')+'</section>';
}
export function publicMembers(kind,input){if(kind!=='group')return '';try{return renderMembers(input);}catch{return '';}}
export function memberUpdate(kind,rows,originalKind,originalRows){
 if(!['person','group','unknown'].includes(kind))throw Error('아티스트 유형을 확인하세요.');
 if(kind!=='group')return kind===originalKind?null:{artist_kind:kind};
 const members=normalizeMembers(rows);
 return kind===originalKind&&JSON.stringify(members)===JSON.stringify(originalRows)?null:{artist_kind:kind,members};
}
export function mountMembersEditor(host,input,search=null){
 const doc=host.ownerDocument;let rows=normalizeMembers(input);const node=(tag,txt)=>{const el=doc.createElement(tag);if(txt)el.textContent=txt;return el;};
 const button=(label,action)=>{const b=node('button',label);b.type='button';b.onclick=action;return b;};
 const field=(label,value,change,max)=>{const l=node('label',label),i=node('input');i.value=value;i.maxLength=max;i.oninput=()=>change(i.value);l.append(i);return l;};
 function draw(){host.replaceChildren();rows.forEach((m,index)=>{const row=node('div');row.className='artist-member-edit-row';const nameField=field('이름',m.name,v=>m.name=v,150);if(m.catalog_target)nameField.querySelector('input').readOnly=true;row.append(nameField,field('담당 파트',m.roles,v=>m.roles=v,150));if(search)mountRelationshipPicker(row,m,search,t=>{if(t){m.catalog_target=t;m.name=t.name;}else delete m.catalog_target;draw();});const label=node('label','상태'),select=node('select');Object.entries(statuses).forEach(([v,t])=>{const opt=node('option',t);opt.value=v;select.append(opt);});select.value=m.status;select.onchange=()=>m.status=select.value;label.append(select);row.append(label);m.periods.forEach((p,i)=>{const period=node('div');period.className='artist-member-edit-period';period.append(field('가입 연도',p.begin,v=>p.begin=v,4),field('탈퇴 연도',p.end,v=>p.end=v,4),button('기간 삭제',()=>{m.periods.splice(i,1);draw();}));row.append(period);});row.append(button('활동 기간 추가',()=>{if(m.periods.length<12){m.periods.push({begin:'',end:''});draw();}}),button('멤버 삭제',()=>{rows.splice(index,1);draw();}));host.append(row);});host.append(button('멤버 추가',()=>{if(rows.length<100){rows.push({name:'',roles:'',status:'current',periods:[]});draw();}}));}
 draw();return {value:()=>normalizeMembers(rows),dispose:()=>host.replaceChildren()};
}
