import {catalogLink} from './catalog-links.js';
// Explicit administrator selection only. Public targets are revalidated by NAS.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeTarget(v){if(v==null)return null;if(typeof v!=='object'||Array.isArray(v)||typeof v.name!=='string'||!v.name.trim()||v.name.length>250||typeof v.key!=='string'||!v.key.trim()||v.key.length>512)throw Error('연결 아티스트 정보를 확인하세요.');return {name:v.name,key:v.key};}
export function relationshipName(row){let target=null;try{target=normalizeTarget(row.catalog_target);}catch{}return target?catalogLink('artist',target.name,row.name,{trusted:false}):esc(row.name);}
export function normalizeRelated(input){if(!Array.isArray(input)||input.length>100)throw Error('관련 아티스트 목록을 확인하세요.');const seen=new Set(),keys=new Set();return input.map(row=>{if(!row||typeof row.name!=='string'||!row.name.trim()||row.name.length>250||typeof (row.label??'')!=='string'||(row.label??'').length>150||/[\x00-\x1f\x7f]/.test(row.name+(row.label??'')))throw Error('관련 아티스트 이름·관계를 확인하세요.');const name=row.name.trim(),label=(row.label??'').trim(),id=name.normalize('NFC').toLowerCase(),target=normalizeTarget(row.catalog_target);if(seen.has(id)||target&&keys.has(target.key))throw Error('중복 관련 아티스트: '+name);seen.add(id);if(target)keys.add(target.key);return {name,label,...(target?{catalog_target:target}:{})};});}
// Only the relationship API's server-generated public image paths are accepted.
export function relationshipPhotoPath(value,kind='thumb'){return typeof value==='string'&&/^images\/[0-9a-f]{24}-(thumb|full)\.webp$/.test(value)&&value.endsWith('-'+kind+'.webp')?value:'';}
export function relationshipPhotoFields(row){if(!row||row.catalog_target)return {};const thumb=relationshipPhotoPath(row.photo_thumb),full=relationshipPhotoPath(row.photo_full,'full');return thumb&&full?{photo_thumb:thumb,photo_full:full}:{};}
export function relationshipPhotoSavedRow(row,savedName,saved){return !!row&&!row.catalog_target&&savedName===row.name&&saved?.name===row.name&&!saved.catalog_target;}
export function mountRelationshipPhotoEditor(host,{getRow,eligible,save,assetUrl,onPhoto}){
 const doc=host.ownerDocument,node=(tag,t)=>{const e=doc.createElement(tag);if(t)e.textContent=t;return e;};
 const box=node('fieldset');box.className='artist-relation-photo-editor';box.append(node('legend','사진'));
 const layout=node('div');layout.className='artist-relation-photo-layout';
 const preview=node('div');preview.className='artist-relation-photo-preview';const img=node('img');img.alt='등록된 사진';img.hidden=true;const placeholder=node('span','사진 없음');preview.append(placeholder,img);
 const side=node('div');side.className='artist-relation-photo-side';const drop=node('label');drop.className='artist-relation-photo-drop';const input=node('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.setAttribute('aria-label','사진 등록 또는 변경');drop.append(input,node('span','사진 등록·변경'),node('small','끌어다 놓기 또는 클릭 · 즉시 저장'));
 const clear=node('button','사진 삭제');clear.type='button';const notice=node('small');notice.setAttribute('role','status');notice.className='artist-relation-photo-notice';
 side.append(drop,clear,notice);layout.append(preview,side);box.append(layout);host.append(box);
 let busy=false;function refresh(){const row=getRow(),path=relationshipPhotoPath(row?.photo_thumb),ok=eligible();
  const url=path?assetUrl(path):'';if(url){if(img.getAttribute('src')!==url){img.hidden=true;placeholder.hidden=false;img.src=url;}}else{img.removeAttribute('src');img.hidden=true;placeholder.hidden=false;}
  drop.hidden=!ok;clear.hidden=!ok||!path;input.disabled=busy||!ok;clear.disabled=busy||!ok;
  if(!busy&&!ok)notice.textContent='이름·연결 상태를 먼저 저장하면 사진을 등록할 수 있습니다.';else if(!busy&&ok&&notice.textContent.startsWith('이름·연결'))notice.textContent='';
 }
 img.onload=()=>{if(img.getAttribute('src')){img.hidden=false;placeholder.hidden=true;}};img.onerror=()=>{img.hidden=true;placeholder.hidden=false;};
 async function run(file,remove=false){if(busy||!eligible())return;const target=getRow();if(!target)return;
  if(!remove&&(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<1||file.size>25000000)){notice.textContent='JPEG·PNG·WebP, 최대 25MB 사진을 선택하세요.';return;}
  busy=true;refresh();notice.textContent=remove?'사진 삭제 중…':'사진 저장 중…';
  try{const result=await save(target.name,remove?null:file);onPhoto(target.name,result);notice.textContent=remove?'사진 삭제 완료':'사진 저장 완료';}
  catch(e){notice.textContent=e.message||'사진 저장 실패';}finally{busy=false;input.value='';refresh();}
 }
 input.onchange=()=>{const files=input.files;if(files?.length===1)void run(files[0]);else input.value='';};
 drop.addEventListener('dragover',e=>{e.preventDefault();if(eligible()&&!busy)drop.classList.add('is-dragging');});
 drop.addEventListener('dragleave',()=>drop.classList.remove('is-dragging'));
 drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-dragging');if(e.dataTransfer?.files?.length===1)void run(e.dataTransfer.files[0]);else notice.textContent='사진은 한 장씩 선택하세요.';});
 clear.onclick=()=>{if(eligible()&&!busy&&doc.defaultView.confirm('등록한 사진을 삭제할까요?'))void run(null,true);};refresh();return refresh;
}

export function mergePublicRelated(manual,reverse){const out=[],byKey=new Map();for(const row of [...(Array.isArray(manual)?manual:[]),...(Array.isArray(reverse)?reverse:[])]){if(typeof row?.name!=='string'||!row.name.trim())continue;let target=null;try{target=normalizeTarget(row.catalog_target);}catch{}const key=target?'key:'+target.key:'text:'+row.name.normalize('NFC').toLowerCase();let item=byKey.get(key);if(!item){item={name:row.name,labels:[],...(target?{catalog_target:target}:relationshipPhotoFields(row))};out.push(item);byKey.set(key,item);}if(typeof row.label==='string'&&row.label&&!item.labels.includes(row.label))item.labels.push(row.label);}return out;}
// Public rows share one presentation; only an explicit NAS-validated target can link or load a photo.
export function relationshipCard(row,{roles='',periods='',label=''}={}){
 let target=null;try{target=normalizeTarget(row.catalog_target);}catch{}
 const direct=relationshipPhotoPath(relationshipPhotoFields(row).photo_thumb);const photo='<span class="artist-relation-thumb"'+(target?' data-relation-photo="'+esc(target.name)+'"':direct?' data-relation-direct-photo="'+esc(direct)+'"':'')+' aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></svg></span>';
 const info='<span class="artist-relation-info"><strong>'+esc(row.name)+'</strong>'+((roles||label)?'<small class="artist-relation-subtitle">'+esc([roles,label].filter(Boolean).join(' · '))+'</small>':'')+'</span>';
 const content=photo+info+(periods?'<span class="artist-relation-period">'+esc(periods)+'</span>':'')+(target?'<span class="artist-relation-arrow" aria-hidden="true">›</span>':'');
 // Use the existing verified Catalog navigation handler, not a new navigation path.
 const link=target?catalogLink('artist',target.name,row.name,{trusted:false}):'';
 const end='>'+esc(row.name)+'</button>';
 return '<article class="artist-relation-item">'+(target&&link.endsWith(end)?link.slice(0,-end.length)+'>'+content+'</button>':'<div class="artist-relation-static">'+content+'</div>')+'</article>';
}
export function relationshipRows(rows,render,limit=5){
 if(!rows.length)return '';
 const first=rows.slice(0,limit).map(render).join(''),rest=rows.slice(limit);
 return '<div class="artist-relation-list">'+first+(rest.length?'<details class="artist-relation-more"><summary><span class="artist-more-open">전체 보기 ('+rows.length+'명)</span><span class="artist-more-close">접기</span></summary><div class="artist-relation-list">'+rest.map(render).join('')+'</div></details>':'')+'</div>';
}
export function relatedListMarkup(rows){return relationshipRows(rows,row=>relationshipCard(row,{label:row.labels.join(' · ')}));}
export function mountRelationshipPicker(host,row,search,onSelect){
 const doc=host.ownerDocument,node=(tag,txt)=>{const el=doc.createElement(tag);if(txt)el.textContent=txt;return el;};
 const box=node('div');box.className='artist-relationship-picker';
 const status=node('small',row.catalog_target?'연결: '+row.catalog_target.name:'미연결 · 직접 입력 가능');
 const input=node('input');input.placeholder='Vinyl Room 아티스트 검색';input.setAttribute('aria-label','Vinyl Room 아티스트 검색');input.maxLength=100;input.value=row.name||'';
 const searchButton=node('button','검색');searchButton.type='button';const unlink=node('button','연결 해제');unlink.type='button';unlink.hidden=!row.catalog_target;
 const results=node('div');results.className='artist-relationship-results';results.setAttribute('role','status');let ticket=0;
 async function run(){const q=input.value.trim(),id=++ticket;results.replaceChildren();if(!q){results.textContent='검색어를 입력하세요.';return;}results.textContent='검색 중…';try{const items=await search(q);if(id!==ticket||!box.isConnected)return;results.replaceChildren();for(const raw of items){let t;try{t=normalizeTarget(raw);}catch{continue;}if(!t)continue;const b=node('button',t.name);b.type='button';b.onclick=()=>{++ticket;onSelect(t);};results.append(b);}if(!results.childNodes.length)results.textContent='검색 결과 없음 · 이름 직접 입력 가능';}catch(e){if(id===ticket&&box.isConnected)results.textContent=e.message||'검색 실패';}}
 searchButton.onclick=run;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();void run();}};input.oninput=()=>{++ticket;results.replaceChildren();};unlink.onclick=()=>{++ticket;onSelect(null);};box.append(status,input,searchButton,unlink,results);host.append(box);
}
// One search field per list. A result click stages a row; saving stays explicit.
export function stageRelationshipRow(rows,name,target,defaults={},max=150){
 const t=normalizeTarget(target);name=(t?t.name:String(name??'')).trim();
 if(!name||name.length>max||/[\x00-\x1f\x7f]/.test(name))throw Error('이름을 확인하세요.');
 if(rows.length>=100)throw Error('최대 100명까지 등록할 수 있습니다.');
 const key=name.normalize('NFC').toLowerCase();
 if(rows.some(r=>r.name.normalize('NFC').toLowerCase()===key||t&&r.catalog_target?.key===t.key))throw Error('이미 추가된 아티스트입니다.');
 return {name,...defaults,...(t?{catalog_target:t}:{})};
}
// Role choices use the existing comma-separated roles field; no NAS schema change.
export const MEMBER_ROLE_OPTIONS=Object.freeze(['Vocal','Guitar','Lead Guitar','Rhythm Guitar','Acoustic Guitar','Slide Guitar','Bass','Drums','Piano','Keyboard','Synth','Percussion','Violin','Flute','Harmonica','Sitar','Chorus']);
export function memberRoleKey(value){const k=String(value??'').trim().normalize('NFC').toLowerCase();return k==='rythm guitar'?'rhythm guitar':k;}
export function memberRoleParts(value){return String(value??'').split(',').map(v=>v.trim()).filter(Boolean);}
export function toggleMemberRole(value,role){
 const name=String(role??'').trim(),key=memberRoleKey(name);
 if(!key||/[\x00-\x1f\x7f,]/.test(name))throw Error('담당 파트 이름을 확인하세요.');
 const parts=memberRoleParts(value),exists=parts.some(v=>memberRoleKey(v)===key);
 const next=(exists?parts.filter(v=>memberRoleKey(v)!==key):[...parts,name]).join(', ');
 if(next.length>150)throw Error('담당 파트는 150자까지 저장할 수 있습니다.');
 return next;
}
export function mountMemberRolePicker(host,value,onChange){
 const doc=host.ownerDocument,node=(tag,t)=>{const e=doc.createElement(tag);if(t)e.textContent=t;return e;};
 const button=(label,action)=>{const b=node('button',label);b.type='button';b.onclick=action;return b;};
 const group=node('fieldset');group.className='artist-role-picker';group.append(node('legend','담당 파트 · 복수 선택'));
 const grid=node('div');grid.className='artist-role-choices';const message=node('small');message.className='artist-role-message';message.setAttribute('role','status');
 const custom=node('div');custom.className='artist-role-custom';const entry=node('input');entry.type='text';entry.placeholder='기타 파트 직접 입력';entry.setAttribute('aria-label','기타 담당 파트');entry.maxLength=150;
 let current=String(value??'');const choices=[...MEMBER_ROLE_OPTIONS];const known=new Set(choices.map(memberRoleKey));
 for(const part of memberRoleParts(current)){const key=memberRoleKey(part);if(!known.has(key)){choices.push(part);known.add(key);}}
 function update(role){try{const next=toggleMemberRole(current,role);current=next;onChange(next);message.textContent='';draw();return true;}catch(e){message.textContent=e.message;return false;}}
 function draw(){const selected=new Set(memberRoleParts(current).map(memberRoleKey));grid.replaceChildren();for(const role of choices){const b=button(role,()=>{if(update(role))Array.from(grid.children).find(x=>x.textContent===role)?.focus();});b.className='artist-role-chip';b.setAttribute('aria-pressed',String(selected.has(memberRoleKey(role))));grid.append(b);}}
 function add(){const role=entry.value.trim(),key=memberRoleKey(role);if(!key){message.textContent='파트 이름을 입력하세요.';return;}if(memberRoleParts(current).some(v=>memberRoleKey(v)===key)){message.textContent='이미 선택된 파트입니다.';return;}const existing=choices.find(v=>memberRoleKey(v)===key);if(!existing){choices.push(role);known.add(key);}if(update(existing||role)){entry.value='';entry.focus();}else if(!existing){choices.pop();known.delete(key);}}
 const addButton=button('추가',add);entry.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();add();}};custom.append(entry,addButton);group.append(grid,custom,message);host.append(group);draw();
}

export function mountCompactRelationshipEditor(host,input,{search=null,normalize,member=false,photo=null}){
 let rows=normalize(input),savedRows=new Map(),savedNames=new WeakMap(),opened=null,status=rows.some(r=>r.status==='final')?'final':'current',query='',ticket=0;
 function setSavedRows(input,initial=false){const old=savedRows;savedRows=new Map(input.map(r=>[r.name,{name:r.name,catalog_target:r.catalog_target,...(initial?relationshipPhotoFields(r):(!r.catalog_target?relationshipPhotoFields(old.get(r.name)):{}))}]));savedNames=new WeakMap();for(const r of rows)if(savedRows.has(r.name)&&Boolean(r.catalog_target)===Boolean(savedRows.get(r.name).catalog_target))savedNames.set(r,r.name);if(!initial)draw();}
 setSavedRows(input,true);
 const doc=host.ownerDocument,node=(tag,t)=>{const el=doc.createElement(tag);if(t)el.textContent=t;return el;};
 const button=(label,action)=>{const b=node('button',label);b.type='button';b.onclick=action;return b;};
 const field=(label,value,max,change)=>{const l=node('label',label),i=node('input');i.value=value;i.maxLength=max;i.oninput=()=>change(i.value);l.append(i);return l;};
 const states=[['current','현재 멤버'],['final','최종 멤버'],['former','이전 멤버']];
 const selector=(value,change)=>{const s=node('select');for(const [v,t] of states){const o=node('option',t);o.value=v;s.append(o);}s.value=value;s.onchange=()=>change(s.value);return s;};
 const notice=node('p');notice.className='artist-list-notice';notice.setAttribute('role','status');
 const bar=node('div');bar.className='artist-compact-add';const heading=node('strong',member?'멤버 추가':'관련 아티스트 추가');bar.append(heading);
 if(member){const label=node('label','추가할 멤버 상태');label.append(selector(status,v=>status=v));bar.append(label);}
 const line=node('div');line.className='artist-compact-search';const inputBox=node('input');inputBox.placeholder='아티스트 이름 검색 또는 직접 입력';inputBox.setAttribute('aria-label',member?'멤버 이름 검색':'관련 아티스트 이름 검색');inputBox.maxLength=member?150:250;
 const results=node('div');results.className='artist-compact-results';results.setAttribute('aria-live','polite');const list=node('div');list.className='artist-compact-list';
 const textAdd=button('직접 추가',()=>add(null));textAdd.disabled=true;
 function add(target){try{const entry=stageRelationshipRow(rows,query,target,member?{roles:'',status,periods:[]}:{label:''},member?150:250);rows.push(entry);opened=null;query='';inputBox.value='';textAdd.disabled=true;++ticket;results.replaceChildren();notice.textContent=entry.name+' 추가됨 · 저장 전';draw();inputBox.focus();}catch(e){notice.textContent=e.message;}}
 async function run(){const id=++ticket;results.replaceChildren();if(!query.trim()){notice.textContent='아티스트 이름을 입력하세요.';return;}if(!search){notice.textContent='직접 추가를 사용하세요.';return;}results.textContent='검색 중…';try{const items=await search(query.trim());if(id!==ticket||!host.isConnected)return;results.replaceChildren();for(const raw of items){let target;try{target=normalizeTarget(raw);}catch{continue;}if(!target)continue;const exists=rows.some(r=>r.catalog_target?.key===target.key||r.name.normalize('NFC').toLowerCase()===target.name.normalize('NFC').toLowerCase());const b=button(target.name+(exists?' · 추가됨':' +'),()=>add(target));b.disabled=exists;results.append(b);}if(!results.childNodes.length)results.textContent='검색 결과 없음 · 직접 추가 가능';}catch(e){if(id===ticket&&host.isConnected)results.textContent=e.message||'검색 실패';}}
 const searchButton=button('검색',run);searchButton.hidden=!search;inputBox.oninput=()=>{query=inputBox.value;++ticket;results.replaceChildren();textAdd.disabled=!query.trim();notice.textContent='';};inputBox.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(search)void run();else add(null);}};
 line.append(inputBox,searchButton);bar.append(line,results,textAdd,notice);
 function detail(r,refreshSummary){const box=node('div');box.className='artist-compact-detail';let refreshPhoto=()=>{};const name=field('이름',r.name,member?150:250,v=>{r.name=v;refreshPhoto();});if(r.catalog_target)name.querySelector('input').readOnly=true;box.append(name);if(photo&&!r.catalog_target){const eligible=()=>photo.allowed()&&relationshipPhotoSavedRow(r,savedNames.get(r),savedRows.get(r.name))&&!rows.some(x=>x!==r&&x.name===r.name);refreshPhoto=mountRelationshipPhotoEditor(box,{getRow:()=>({name:r.name,...(eligible()?relationshipPhotoFields(savedRows.get(r.name)):{})}),eligible,assetUrl:photo.assetUrl,save:photo.save,onPhoto:(name,result)=>{const saved=savedRows.get(name);if(saved){delete saved.photo_thumb;delete saved.photo_full;Object.assign(saved,relationshipPhotoFields(result));}}});}if(member)mountMemberRolePicker(box,r.roles,v=>{r.roles=v;refreshSummary();});else box.append(field('관계',r.label,150,v=>{r.label=v;refreshSummary();}));if(member){const l=node('label','멤버 상태');l.append(selector(r.status,v=>{r.status=v;draw();}));box.append(l);const periods=node('div');periods.className='artist-compact-periods';r.periods.forEach((p,i)=>{const row=node('div');row.className='artist-member-edit-period';row.append(field('가입 연도',p.begin,4,v=>p.begin=v),field('탈퇴 연도',p.end,4,v=>p.end=v),button('삭제',()=>{r.periods.splice(i,1);draw();}));periods.append(row);});box.append(periods,button('＋ 활동 기간',()=>{if(r.periods.length<12){r.periods.push({begin:'',end:''});draw();}}));}if(search)mountRelationshipPicker(box,r,search,t=>{if(t){if(rows.some(x=>x!==r&&(x.catalog_target?.key===t.key||x.name.normalize('NFC').toLowerCase()===t.name.normalize('NFC').toLowerCase()))){notice.textContent='이미 추가된 아티스트입니다.';return;}if(t.name.length>(member?150:250)){notice.textContent='이름이 너무 깁니다.';return;}r.catalog_target=t;r.name=t.name;}else delete r.catalog_target;draw();});box.append(button('편집 닫기',()=>{opened=null;draw();}));return box;}
 function draw(){list.replaceChildren();if(!rows.length){list.append(node('p',member?'등록된 멤버가 없습니다.':'등록된 관련 아티스트가 없습니다.'));return;}const groups=member?states:[['all','등록 목록']];for(const [key,label] of groups){const selected=member?rows.filter(r=>r.status===key):rows;if(!selected.length)continue;const caption=node('h3',label+' · '+selected.length+'명');list.append(caption);for(const r of selected){const item=node('div');item.className='artist-compact-item';const info=node('div');info.className='artist-compact-info';info.append(node('strong',r.name));const sub=node('small');const refreshSummary=()=>{sub.textContent=[member?r.roles:r.label,r.catalog_target?'연결됨':'직접 입력'].filter(Boolean).join(' · ');};refreshSummary();info.append(sub);const edit=button(opened===r?'접기':'편집',()=>{opened=opened===r?null:r;draw();});edit.setAttribute('aria-expanded',String(opened===r));const remove=button('×',()=>{rows=rows.filter(x=>x!==r);if(opened===r)opened=null;notice.textContent=r.name+' 삭제 예정 · 저장 전';draw();});remove.setAttribute('aria-label',r.name+' 삭제');item.append(info,edit,remove);list.append(item);if(opened===r)list.append(detail(r,refreshSummary));}}}
 host.replaceChildren(bar,list);draw();return {value:()=>normalize(rows),setSavedRows,dispose:()=>{++ticket;host.replaceChildren();}};
}
export function mountRelatedEditor(host,input,search,photo=null){return mountCompactRelationshipEditor(host,input,{search,normalize:normalizeRelated,photo});}
