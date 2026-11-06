import {setLibraryAccess} from './access-state.js';
import {openMemberManagement} from './member-management.js';
import {loginStorage,withSessionLock} from './session-storage.js';
import {DEFAULT_SUPABASE_URL,DEFAULT_SUPABASE_KEY,NAS_URL,ADMIN_EMAIL} from './config.js';
import {getPlayer} from './player.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='music-personal-playlists-v1';
let session=null,expires=0,items=[],revision=0,busy=false,epoch=0;
let approved=false,expiryTimer=null,renewTimer=null;
setLibraryAccess(false);
let lastAccessState=null;
function accessChanged(){const next=isApprovedMember();if(next===lastAccessState)return;lastAccessState=next;if(!next)void refreshPendingMembers();setLibraryAccess(next);window.dispatchEvent(new Event('vinyl-approval-change'));}
function armExpiry(){
 clearTimeout(expiryTimer);clearTimeout(renewTimer);
 if(!session)return;const version=epoch;
 renewTimer=setTimeout(()=>renewSession(version),Math.max(1000,expires-Date.now()-60000));
 expiryTimer=setTimeout(()=>{if(version===epoch&&session){approved=false;accessChanged();window.dispatchEvent(new Event('vinyl-account-change'));}},Math.max(0,expires-Date.now()));
}
async function renewSession(version=epoch){
 if(version!==epoch||!session)return;
 try{await token();}
 catch{if(version===epoch&&session){if(Date.now()>=expires){approved=false;accessChanged();window.dispatchEvent(new Event('vinyl-account-change'));}clearTimeout(renewTimer);renewTimer=setTimeout(()=>renewSession(version),30000);}}
}
export const isApprovedMember=()=>approved===true&&!!session?.access_token&&!!session?.user?.email_confirmed_at&&Date.now()<expires;
export const currentMemberToken=async()=>{if(!session){setLibraryAccess(false);throw Error('로그인과 관리자 승인이 필요합니다.');}const access=await token();if(!isApprovedMember())throw Error('로그인과 관리자 승인이 필요합니다.');return access;};
export function invalidateMemberAccess(){approvalGeneration++;approved=false;accessChanged();}
let approvalGeneration=0;
async function verifyApproval(accessOverride=null){
 const request=++approvalGeneration,version=epoch;
 const previouslyApproved=isApprovedMember();
 if(!previouslyApproved)approved=false;
 if(!session){accessChanged();return false;}
 try{
  const r=await fetch(DEFAULT_SUPABASE_URL+'/rest/v1/rpc/vinyl_is_approved',{method:'POST',headers:{apikey:DEFAULT_SUPABASE_KEY,Authorization:'Bearer '+(accessOverride||await token()),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
  if(!r.ok&&r.status!==401&&r.status!==403)throw Error('승인 확인 연결 오류');
  const result=r.ok&&(await r.json())===true;
  if(request!==approvalGeneration||version!==epoch||!session)return false;
  approved=result;
 }catch{if(request!==approvalGeneration||version!==epoch)return false;approved=previouslyApproved&&!!session&&Date.now()<expires;}
 accessChanged();
 window.dispatchEvent(new Event('vinyl-account-change'));
 void refreshPendingMembers();
 return approved;
}
const dialog=document.createElement('dialog');dialog.id='personal-dialog';document.body.append(dialog);
const nav=document.createElement('button');nav.id='my-playlists';nav.innerHTML="<svg class=\"nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 5h12M3 10h12M3 15h6m9-5v9m0-9 4-1\"/><ellipse cx=\"15\" cy=\"19\" rx=\"3\" ry=\"2\"/></svg><span>My Playlist</span>";document.querySelector('#nav').append(nav);
const account=document.createElement('button');account.id='member-account';account.className='account-button';account.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg><span>로그인</span>';document.querySelector('header').append(account);
account.setAttribute('aria-label','내 계정 및 회원 관리');
// Move existing controls; their handlers and desktop order are retained.
if(window.matchMedia){
 const mobile=window.matchMedia('(max-width:740px)');
 const desktopHeader=document.querySelector('main header');
 const desktopActions=desktopHeader?.querySelector('.header-actions');
 const indexButton=document.querySelector('#import');
 const modeLabel=document.querySelector('#mode-label');
 const statsBar=document.querySelector('#stats');
 const sidebarBottom=document.querySelector('.sidebar .side-bottom');
 const mobileActions=document.createElement('div');mobileActions.id='vinyl-mobile-account-actions';
 document.querySelector('.sidebar')?.append(mobileActions);
 const placeAccount=()=>{
  if(mobile.matches){if(indexButton)mobileActions.append(indexButton);mobileActions.append(account);if(modeLabel&&statsBar)statsBar.append(modeLabel);}
  else{if(indexButton&&desktopActions)desktopActions.append(indexButton);desktopHeader?.append(account);if(modeLabel&&sidebarBottom)sidebarBottom.append(modeLabel);}
 };
 placeAccount();mobile.addEventListener('change',placeAccount);
}
// Show a subtle notification only for approved administrators with pending applications.
let pendingCheckSerial=0;
async function refreshPendingMembers(){
 const serial=++pendingCheckSerial;
 const isAdmin=isApprovedMember()&&session.user?.email?.toLowerCase()===ADMIN_EMAIL;
 if(!isAdmin){account.classList.remove('has-pending-members');account.removeAttribute?.('data-pending-count');account.title='';return;}
 try{
  const version=epoch;
  const access=await token();
  if(serial!==pendingCheckSerial||version!==epoch||!isApprovedMember())return;
  const response=await fetch(DEFAULT_SUPABASE_URL+'/rest/v1/vinyl_members?select=user_id&status=eq.pending&limit=1000',{
   headers:{apikey:DEFAULT_SUPABASE_KEY,Authorization:'Bearer '+access},
   signal:AbortSignal.timeout(12000),credentials:'omit',redirect:'error'});
  if(!response.ok)throw Error('승인 대기 확인 실패');
  const rows=await response.json();
  if(serial!==pendingCheckSerial||!isApprovedMember()||session.user?.email?.toLowerCase()!==ADMIN_EMAIL)return;
  const count=Array.isArray(rows)?rows.length:0;
  account.classList.toggle('has-pending-members',count>0);
  if(count)account.dataset.pendingCount=String(count);else account.removeAttribute?.('data-pending-count');
  account.title=count?'승인 대기 회원 '+count+'명':'승인 대기 회원 없음';
 }catch{if(serial===pendingCheckSerial){account.classList.remove('has-pending-members');account.removeAttribute?.('data-pending-count');}}
}
window.addEventListener('focus',()=>{if(session&&approved)refreshPendingMembers();});
document.addEventListener?.('visibilitychange',()=>{if(!document.hidden&&session&&approved)refreshPendingMembers();});
window.addEventListener('vinyl-members-change',()=>{void refreshPendingMembers();});
function modal(title,body){const resetScroll=!dialog.open||dialog.querySelector('h2')?.textContent!==title;dialog.classList.toggle('playlist-form-dialog',/id="(?:name-form|add-list-form|delete-list-confirm)"/.test(body));dialog.classList.remove('account-dialog');dialog.innerHTML=`<div class="modal-head"><h2>${esc(title)}</h2><button id="close-personal" aria-label="닫기">×</button></div><div class="modal-body">${body}<p id="personal-status" role="status"></p></div>`;dialog.querySelector('#close-personal').onclick=()=>dialog.close();if(!dialog.open)dialog.showModal();if(resetScroll){dialog.scrollTop=0;dialog.querySelector('.modal-body').scrollTop=0;}}
function notice(message){const status=dialog.querySelector('#personal-status');if(status)status.textContent=message;}
function guarded(fn){return async e=>{e?.preventDefault();if(busy)return;busy=true;const b=e?.currentTarget;if(b?.tagName==='BUTTON')b.disabled=true;try{await fn(e);}catch(err){notice(err.message);}finally{busy=false;if(b?.isConnected)b.disabled=false;}};}
async function auth(path,body,token){const r=await fetch(DEFAULT_SUPABASE_URL+'/auth/v1/'+path,{method:'POST',headers:{apikey:DEFAULT_SUPABASE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const d=await r.json().catch(()=>({}));if(!r.ok){const error=Error(d.msg||d.error_description||d.message||'로그인 요청에 실패했습니다.');error.status=r.status;error.code=d.error_code||d.code||d.error||null;throw error;}return d;}
let refreshing=null,rememberLogin=false;
const savedLogin=loginStorage(sessionStorage,localStorage);
function rejectedRefresh(error){
 // Auth errors are not interchangeable with temporary network/provider failures.
 if(error.code)return ['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','user_banned','user_not_found','invalid_grant','invalid_credentials'].includes(error.code);
 return [401,403].includes(error.status);
}
function accountChanged(persist=true){armExpiry();if(!session){approvalGeneration++;approved=false;accessChanged();void refreshPendingMembers();}try{if(persist)savedLogin.save(session,rememberLogin);}catch{notice('브라우저 저장소를 사용할 수 없어 로그인 유지가 제한됩니다.');}account.querySelector('span').textContent=session?'내 계정':'로그인';window.dispatchEvent(new Event('vinyl-account-change'));}
export function connectAccount(repo,onChange){
 const sync=()=>{repo.session=Date.now()<expires&&session?.user?.email?.toLowerCase()===ADMIN_EMAIL?session:null;repo.expires=expires;};
 sync();repo.refresh=async()=>{await token();sync();};
 window.addEventListener('vinyl-account-change',()=>{const was=repo.admin;sync();if(was!==repo.admin)onChange();});
}
async function token(){
 if(!session)throw Error('로그인이 필요합니다.');
 if(Date.now()>=expires-60000){
  if(!refreshing){const version=epoch;let attempted=null;
   refreshing=withSessionLock(async()=>{
    if(epoch!==version||!session)throw Error('계정이 변경됐습니다.');
    const latest=savedLogin.read(rememberLogin);
    attempted=latest||{refresh_token:session.refresh_token,remember:rememberLogin};
    const s=await auth('token?grant_type=refresh_token',{refresh_token:attempted.refresh_token});
    if(epoch!==version)throw Error('계정이 변경됐습니다.');
    if(!s.access_token||!s.refresh_token||!(Number(s.expires_in)>0)||!s.user?.email_confirmed_at)throw Object.assign(Error('로그인 응답을 확인하지 못했습니다.'),{status:502,code:'invalid_session_response'});
    session=s;expires=Date.now()+s.expires_in*1000;accountChanged();await verifyApproval(s.access_token);
   }).catch(err=>{
    if(epoch===version){
     if(rejectedRefresh(err)){savedLogin.discard(attempted);epoch++;session=null;items=[];accountChanged(false);}
     else if(Date.now()>=expires){approved=false;accessChanged();window.dispatchEvent(new Event('vinyl-account-change'));}
    }
    throw err;
   }).finally(()=>{refreshing=null;});
  }
  await refreshing;
 }
 if(!session)throw Error('다시 로그인해 주세요.');
 return session.access_token;
}
async function cloud(body){const version=epoch;const access=await token();const r=await fetch(NAS_URL+'/v2/playlists',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+access,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),credentials:'omit'});const d=await r.json();if(epoch!==version)throw Error('계정이 변경됐습니다.');if(!r.ok)throw Error(d.message||'플레이리스트를 불러오지 못했습니다.');return d;}
function local(){const data=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(data))throw Error('이 기기의 목록을 읽지 못했습니다.');return data;}
async function load(){if(session){if(!approved)throw Error('관리자 승인 후 이용할 수 있습니다.');const d=await cloud();items=d.items;revision=d.revision;}else items=local();}
async function save(next){if(next.length>100||next.reduce((n,p)=>n+p.tracks.length,0)>2000)throw Error('목록 100개, 전체 2,000곡까지 저장할 수 있습니다.');if(session){const d=await cloud({items:next,revision});items=d.items;revision=d.revision;}else{throw Error('로그인한 승인 회원만 플레이리스트를 저장할 수 있습니다.');}}
async function changeOwnPassword(){
 if(!session?.user?.email)throw Error('로그인이 필요합니다.');
 modal('비밀번호 변경',`<form id="vinyl-password-change"><div class="fields"><label>현재 비밀번호<input type="password" name="current_password" autocomplete="current-password" required></label><label>새 비밀번호<input type="password" name="new_password" autocomplete="new-password" minlength="8" required></label><label>새 비밀번호 확인<input type="password" name="confirm_password" autocomplete="new-password" minlength="8" required></label></div><div class="actions"><button type="submit" class="primary">비밀번호 변경</button><button type="button" id="password-change-back">취소</button></div></form>`);
 dialog.classList.add('account-dialog');
 dialog.querySelector('#password-change-back').onclick=()=>login();
 dialog.querySelector('#vinyl-password-change').onsubmit=guarded(async()=>{
  const form=dialog.querySelector('#vinyl-password-change');if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));
  if(data.new_password!==data.confirm_password)throw Error('새 비밀번호가 일치하지 않습니다.');
  if(data.current_password===data.new_password)throw Error('현재 비밀번호와 다른 비밀번호를 사용해 주세요.');
  const version=epoch;
  const verified=await auth('token?grant_type=password',{email:session.user.email,password:data.current_password});
  if(!verified.access_token||verified.user?.id!==session?.user?.id)throw Error('계정 확인에 실패했습니다.');
  if(version!==epoch||!session)throw Error('로그인 상태가 변경됐습니다.');
  const response=await fetch(DEFAULT_SUPABASE_URL+'/auth/v1/user',{method:'PUT',headers:{apikey:DEFAULT_SUPABASE_KEY,Authorization:'Bearer '+verified.access_token,'Content-Type':'application/json'},body:JSON.stringify({password:data.new_password}),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.msg||result.error_description||result.message||'비밀번호를 변경하지 못했습니다.');
  if(version!==epoch||!session)throw Error('로그인 상태가 변경됐습니다.');
  session=verified;expires=Date.now()+verified.expires_in*1000;accountChanged();
  form.reset();notice('비밀번호가 변경되었습니다. 다른 기기에서는 다시 로그인이 필요할 수 있습니다.');
 });
}
export function login(){
 if(session){modal('내 계정',`<p>${esc(session.user.email)}</p><p class="hint">${approved?'승인된 회원':'관리자 승인 대기 · 승인이 완료되면 확인 버튼을 눌러 주세요.'}</p><button id="vinyl-check-approval">승인 상태 확인</button><p class="hint">${session.user.email.toLowerCase()===ADMIN_EMAIL?'관리자 · 서재 편집 및 색인 가능':'내 플레이리스트가 계정에 저장됩니다.'}</p>${session.user.email.toLowerCase()===ADMIN_EMAIL?'<button id="vinyl-manage-members">회원 관리</button>':''}<button id="vinyl-change-password">비밀번호 변경</button><button id="member-logout">로그아웃</button>`);dialog.querySelector('#vinyl-check-approval').onclick=guarded(async()=>{await verifyApproval();if(approved){dialog.close();}else notice('아직 승인 대기 중입니다. 관리자가 승인한 후 다시 확인해 주세요.');});if(dialog.querySelector('#vinyl-manage-members'))dialog.querySelector('#vinyl-manage-members').onclick=guarded(async()=>{await openMemberManagement(await token());void refreshPendingMembers();});dialog.querySelector('#vinyl-change-password').onclick=()=>changeOwnPassword();dialog.querySelector('#member-logout').onclick=guarded(async()=>{const access=session?.access_token;epoch++;session=null;items=[];accountChanged();dialog.close();try{if(access)await auth('logout',{},access);}catch{}});dialog.classList.add('account-dialog');return;}
 modal('로그인',`<p class="hint">나만의 플레이리스트를 어디서든 이어서 즐기세요.</p><form id="member-form"><div class="fields"><label>이메일<input name="email" type="email" required autocomplete="username"></label><label>비밀번호<input name="password" type="password" required minlength="8" autocomplete="current-password"></label></div><label class="remember-login"><input type="checkbox" name="remember" id="remember-login" aria-describedby="remember-warning">로그인 유지</label><p id="remember-warning" class="remember-warning">로그인 유지를 선택하면 브라우저를 닫아도 로그인이 유지됩니다. 공용 PC에서는 선택하지 마세요.</p><div class="actions"><button type="submit" class="primary">로그인</button><button type="button" id="member-signup">회원가입</button></div></form>`);
 const submit=async()=>{const form=dialog.querySelector('#member-form');if(!form.reportValidity())return;const f=Object.fromEntries(new FormData(form));const keep=f.remember==='on';delete f.remember;await withSessionLock(async()=>{const result=await auth('token?grant_type=password',f);if(!result.user?.email_confirmed_at){notice('이메일 인증 후 로그인해 주세요.');return;}if(!result.access_token||!result.refresh_token||!(Number(result.expires_in)>0))throw Error('로그인 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');try{savedLogin.save(result,keep);}catch{throw Error('브라우저에 로그인 정보를 저장하지 못했습니다. 사이트 저장소 설정을 확인하거나 로그인 유지를 해제해 주세요.');}epoch++;rememberLogin=keep;session=result;expires=Date.now()+result.expires_in*1000;accountChanged();await verifyApproval();dialog.close();if(!approved)modal('관리자 승인 대기','<p>계정 로그인은 완료됐지만 관리자 승인이 필요합니다. 승인 후 서재를 이용할 수 있습니다.</p>');});};
 dialog.classList.add('account-dialog');
 dialog.querySelector('#member-form').onsubmit=guarded(submit);
 dialog.querySelector('#member-signup').onclick=()=>signupRequest();

}
export function signupRequest(){
 modal('회원가입 신청',`<p class="hint">신청 후 이메일 인증과 관리자 승인이 완료되어야 음악 서재를 이용할 수 있습니다.</p><form id="vinyl-signup-form"><label>이름 (필수)<input name="full_name" required maxlength="80" autocomplete="name"></label><label>닉네임 (선택)<input name="nickname" maxlength="60" autocomplete="nickname"></label><label>이메일 (필수)<input name="email" type="email" required autocomplete="email"></label><label>비밀번호 (로그인용)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><div class="actions"><button type="submit" class="primary">가입 신청</button><button type="button" id="signup-back">로그인으로 돌아가기</button></div></form>`);
 dialog.classList.add('account-dialog');
 dialog.querySelector('#signup-back').onclick=()=>login();
 dialog.querySelector('#vinyl-signup-form').onsubmit=guarded(async()=>{
  const form=dialog.querySelector('#vinyl-signup-form');
  if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));
  const full_name=data.full_name.trim(),nickname=data.nickname.trim();
  if(!full_name){notice('이름을 입력해 주세요.');return;}
  await auth('signup?redirect_to='+encodeURIComponent(location.origin),{
   email:data.email,password:data.password,
   data:{full_name,nickname:nickname||null}
  });
  modal('가입 신청 접수','<p>신청이 접수됐습니다. 이메일 인증 후 관리자 승인을 기다려 주세요. 승인 전에는 서재를 이용할 수 없습니다.</p><div class="actions"><button id="signup-done">확인</button></div>');
  dialog.querySelector('#signup-done').onclick=()=>dialog.close();
 });
}
async function show(){if(!approved){login();return;}try{sessionStorage.setItem('vinyl-playlist-open','1');}catch{}modal('내 플레이리스트','<p>목록을 불러오는 중…</p>');await load();render();}
function render(){modal('내 플레이리스트',`<p class="hint">${session?'계정에 저장된 목록 · '+esc(session.user.email):'이 브라우저에 저장된 목록 · 다른 기기에서 사용하려면 로그인하세요.'}</p><div class="actions"><button id="create-list">새 플레이리스트</button>${!session?'<button id="playlist-login">로그인</button>':'<button id="import-local-lists">이 기기의 목록 가져오기</button>'}</div><ul class="playlist-list">${items.map(p=>`<li><button data-list="${esc(p.id)}"><strong>${esc(p.name)}</strong><span>${p.tracks.length}곡</span></button></li>`).join('')}</ul>${!items.length?'<p>아직 플레이리스트가 없습니다. 곡의 ‘＋ 목록’을 눌러 추가하세요.</p>':''}`);dialog.querySelector('#create-list').onclick=()=>editName();dialog.querySelector('#playlist-login')?.addEventListener('click',login);dialog.querySelector('#import-local-lists')?.addEventListener('click',guarded(async()=>{const rows=local();await save([...items,...rows.map(p=>({...p,id:crypto.randomUUID()}))]);render();notice(rows.length+'개 목록을 가져왔습니다.');}));dialog.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>openList(b.dataset.list));}
function editName(id){const list=items.find(p=>p.id===id);modal(list?'이름 변경':'새 플레이리스트',`<form id="name-form"><label>목록 이름<input name="name" maxlength="100" value="${esc(list?.name||'')}" required></label><div class="playlist-form-actions"><button type="button" id="name-cancel">취소</button><button type="submit" class="primary">저장</button></div></form>`);dialog.querySelector('#name-cancel').onclick=()=>list?openList(id):render();dialog.querySelector('#name-form').onsubmit=guarded(async e=>{const name=new FormData(e.target).get('name').trim();if(!name)throw Error('이름을 입력해 주세요.');await save(list?items.map(p=>p.id===id?{...p,name}:p):[...items,{id:crypto.randomUUID(),name,tracks:[]}]);render();});}
function openList(id){const p=items.find(x=>x.id===id);if(!p)return render();modal(p.name,`<div class="actions"><button id="list-back">목록으로</button><button id="list-play" ${p.tracks.length?'':'disabled'}>전체 재생</button><button id="list-rename">이름 변경</button><button id="list-delete">목록 삭제</button></div><ol class="playlist-tracks">${p.tracks.map((t,i)=>`<li><button data-list-play="${i}"><span class="playlist-track-title" title="${esc(t.title)}">${esc(t.title)}</span><small title="${esc(t.artist)} · ${esc(t.album_title)}">${esc(t.artist)} · ${esc(t.album_title)}</small></button><div class="actions"><button data-move="${i}" data-delta="-1" ${i?'':'disabled'} aria-label="${esc(t.title)} 위로">위</button><button data-move="${i}" data-delta="1" ${i===p.tracks.length-1?'disabled':''} aria-label="${esc(t.title)} 아래로">아래</button><button data-remove="${i}" aria-label="${esc(t.title)} 목록에서 제거">삭제</button></div></li>`).join('')}</ol>${p.tracks.length?'':'<p>곡을 추가해 주세요.</p>'}`);dialog.querySelector('#list-back').onclick=render;dialog.querySelector('#list-rename').onclick=()=>editName(id);dialog.querySelector('#list-play').onclick=()=>{const player=getPlayer();player.clear();player.add(p.tracks.map(t=>({...t})));player.play(0);dialog.close();};dialog.querySelector('#list-delete').onclick=()=>{modal('플레이리스트 삭제',`<p>‘${esc(p.name)}’ 목록을 삭제할까요? 음악 파일은 유지됩니다.</p><div class="playlist-form-actions"><button id="delete-list-cancel">취소</button><button id="delete-list-confirm" class="playlist-danger">목록 삭제</button></div>`);dialog.querySelector('#delete-list-cancel').onclick=()=>openList(id);dialog.querySelector('#delete-list-confirm').onclick=guarded(async()=>{await save(items.filter(x=>x.id!==id));render();});};dialog.querySelectorAll('[data-list-play]').forEach(b=>b.onclick=()=>{const player=getPlayer();player.add([{...p.tracks[+b.dataset.listPlay]}]);player.play(player.items.length-1);dialog.close();});dialog.querySelectorAll('[data-move],[data-remove]').forEach(b=>b.onclick=guarded(async()=>{const tracks=[...p.tracks];if(b.dataset.remove!==undefined)tracks.splice(+b.dataset.remove,1);else{const i=+b.dataset.move,j=i+(+b.dataset.delta);[tracks[i],tracks[j]]=[tracks[j],tracks[i]];}await save(items.map(x=>x.id===id?{...x,tracks}:x));openList(id);}));}
window.addEventListener('save-playlist-tracks',e=>{guarded(async()=>{const tracks=e.detail.map(t=>({...t}));await load();modal('플레이리스트에 추가',`<p>${tracks.length}곡을 추가할 목록을 선택하세요.</p><form id="add-list-form"><label>목록<select name="id"><option value="">새 플레이리스트</option>${items.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><label>새 목록 이름<input name="name" maxlength="100" placeholder="나의 음악"></label><div class="playlist-form-actions"><button type="button" id="add-list-cancel">취소</button><button type="submit" class="primary">추가</button></div></form>`);dialog.querySelector('#add-list-cancel').onclick=()=>dialog.close();dialog.querySelector('#add-list-form').onsubmit=guarded(async ev=>{const f=new FormData(ev.target),id=f.get('id'),name=f.get('name').trim()||'나의 음악';await save(id?items.map(p=>p.id===id?{...p,tracks:[...p.tracks,...tracks]}:p):[...items,{id:crypto.randomUUID(),name,tracks}]);render();notice('곡을 추가했습니다.');});})();});
nav.onclick=guarded(show);account.onclick=login;

// A temporary outage must not erase this device's remembered refresh credential.
async function restoreSavedSession(){
 return withSessionLock(async()=>{
  const version=epoch;
  for(const saved of savedLogin.candidates()){
   if(epoch!==version)return false;
   rememberLogin=saved.remember;
   try{
    const restored=await auth('token?grant_type=refresh_token',{refresh_token:saved.refresh_token});
    if(epoch!==version)return false;
    if(!restored.access_token||!restored.refresh_token||!(Number(restored.expires_in)>0)||!restored.user?.email_confirmed_at)throw Object.assign(Error('로그인 응답을 확인하지 못했습니다.'),{status:502,code:'invalid_session_response'});
    session=restored;expires=Date.now()+restored.expires_in*1000;accountChanged();await verifyApproval(restored.access_token);return true;
   }catch(error){
    if(epoch!==version)return false;
    if(rejectedRefresh(error)){savedLogin.discard(saved);continue;}
    clearTimeout(renewTimer);renewTimer=setTimeout(()=>resumeSession(),30000);return false;
   }
  }
  return false;
 });
}
account.disabled=true;
try{await restoreSavedSession();}finally{account.disabled=false;}

dialog.addEventListener('close',()=>{try{sessionStorage.removeItem('vinyl-playlist-open');}catch{}});
// Recheck after suspension without treating the temporary check as a logout.
let resuming=null;
function resumeSession(){
 if(document.hidden)return Promise.resolve();
 if(resuming)return resuming;
 resuming=(async()=>{
  if(!session){await restoreSavedSession();return;}
  const needsRefresh=Date.now()>expires-60000;
  await token();if(!needsRefresh)await verifyApproval();
 })().catch(()=>{}).finally(()=>{resuming=null;});return resuming;
}
for(const event of ['pageshow','focus','online'])window.addEventListener(event,resumeSession);
document.addEventListener?.('visibilitychange',()=>{if(!document.hidden)void resumeSession();});
window.addEventListener('storage',event=>{if(event.key==='vinyl-room-login-v1'&&event.newValue===null&&rememberLogin){epoch++;session=null;items=[];accountChanged();}});
export async function restorePlaylistPage(){try{if(sessionStorage.getItem('vinyl-playlist-open')==='1')await guarded(show)();}catch{}}


