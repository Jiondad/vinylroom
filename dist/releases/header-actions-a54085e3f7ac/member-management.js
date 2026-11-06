import {DEFAULT_SUPABASE_URL,DEFAULT_SUPABASE_KEY} from './config.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={pending:'승인 대기',approved:'승인',rejected:'거절',suspended:'이용 정지'};

async function request(token,path,{method='GET',body}={}){
 const response=await fetch(DEFAULT_SUPABASE_URL+'/rest/v1/'+path,{
  method,headers:{apikey:DEFAULT_SUPABASE_KEY,Authorization:'Bearer '+token,
   ...(body!==undefined?{'Content-Type':'application/json'}:{})},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),
  credentials:'omit',redirect:'error'
 });
 const raw=await response.text();
 if(!response.ok)throw Error(JSON.parse(raw||'{}').message||'회원관리 요청에 실패했습니다.');
 return raw?JSON.parse(raw):null;
}

export async function openMemberManagement(accessToken){
 const isAdmin=await request(accessToken,'rpc/vinyl_is_admin',{method:'POST',body:{}});
 if(isAdmin!==true)throw Error('승인된 관리자만 회원을 관리할 수 있습니다.');
 const dialog=document.createElement('dialog');
 dialog.className='vinyl-members-dialog';
 document.body.append(dialog);
 function close(){dialog.close();dialog.remove();}
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 async function draw(){
  const rows=await request(accessToken,'vinyl_members?select=user_id,full_name,nickname,email,status,role,requested_at,reviewed_at&order=requested_at.desc');
  dialog.innerHTML=`<div class="vinyl-members-header"><h2>회원 관리</h2><button type="button" data-close aria-label="닫기">×</button></div><p class="vinyl-members-message">회원 승인 또는 관리자 직접 등록을 진행할 수 있습니다.</p><details class="vinyl-admin-add-member"><summary>＋ 회원 직접 추가</summary><form id="vinyl-admin-member-form"><label>이름<input name="full_name" required maxlength="80" autocomplete="off"></label><label>닉네임<input name="nickname" maxlength="60" autocomplete="off"></label><label>이메일<input type="email" name="email" required maxlength="254" autocomplete="off"></label><label>초기 비밀번호<input type="password" name="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><button type="submit">인증 없이 승인 회원 추가</button></form><small>관리자가 등록한 회원은 이메일 인증 없이 로그인할 수 있으며 최초 비밀번호를 회원에게 안전하게 전달해야 합니다.</small></details><div class="vinyl-members-overflow"><table><thead><tr><th>이름</th><th>닉네임</th><th>이메일</th><th>신청일</th><th>상태</th><th>처리</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${escape(m.full_name||'—')}</td><td>${escape(m.nickname||'—')}</td><td>${escape(m.email)}</td><td>${escape((m.requested_at||'').slice(0,10))}</td><td>${escape(statuses[m.status]||m.status)}</td><td>${m.role==='admin'?'관리자':`<select data-member-id="${escape(m.user_id)}" aria-label="${escape(m.email)} 승인 상태"><option value="">처리 선택</option>${Object.entries(statuses).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>`}</td></tr>`).join('')}</tbody></table></div>`;
  dialog.querySelector('[data-close]').onclick=close;
  dialog.querySelector('#vinyl-admin-member-form').onsubmit=async e=>{
   e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;
   const button=form.querySelector('button[type="submit"]');button.disabled=true;
   try{
    const input=Object.fromEntries(new FormData(form));
    const response=await fetch(DEFAULT_SUPABASE_URL+'/functions/v1/vinyl-admin-create-member',{
     method:'POST',headers:{apikey:DEFAULT_SUPABASE_KEY,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
     body:JSON.stringify(input),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(25000)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.message||'회원 등록 실패');
    form.reset();window.dispatchEvent(new Event('vinyl-members-change'));await draw();
    dialog.querySelector('.vinyl-members-message').textContent='회원이 승인 상태로 추가되었습니다.';
   }catch(error){dialog.querySelector('.vinyl-members-message').textContent=error.message;}
   finally{if(button.isConnected)button.disabled=false;}
  };

  dialog.querySelectorAll('[data-member-id]').forEach(sel=>sel.onchange=async()=>{
   const next=sel.value;if(!next)return;
   if(!confirm(`해당 회원을 '${statuses[next]}' 상태로 변경하시겠습니까?`)){sel.value='';return;}
   sel.disabled=true;
   try{await request(accessToken,'rpc/vinyl_review_member',{method:'POST',body:{target_user_id:sel.dataset.memberId,new_status:next}});window.dispatchEvent(new Event('vinyl-members-change'));await draw();}
   catch(e){sel.disabled=false;dialog.querySelector('.vinyl-members-message').textContent=e.message;}
  });
 }
 dialog.showModal();
 try{await draw();}catch(e){close();throw e;}
}

