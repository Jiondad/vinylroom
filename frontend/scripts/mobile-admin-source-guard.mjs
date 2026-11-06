import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const baseCommit='ec71e574d4aee0774a8b2f0cd73bc1b0ac6104f9';
const cache=new Map();
const approvedCurrentSources={
 'dist/playlists.js':'eb2d2efd07930d8f9820cf6f3edf109dae9d53d79badf01927fd637803939b27',
 'dist/theme.css':'b8a5994e697ff284d26eca57d268cb33f568c229aae7f175c4b9c87cccb64348'
};
function baseline(file){
 if(!cache.has(file))cache.set(file,execFileSync('git',['show',`${baseCommit}:${file}`],{encoding:'utf8'}));
 return cache.get(file);
}
function replaceOnce(source,from,to,file){
 const at=source.indexOf(from);
 if(at<0||source.indexOf(from,at+from.length)>=0)throw Error(`Pinned mobile Admin guard anchor mismatch: ${file}`);
 return source.slice(0,at)+to+source.slice(at+from.length);
}

export function normalizeMobileAdminChange(file,input){
 const original=Buffer.from(input),base=baseline(file);
 const approvedHash=approvedCurrentSources[file];
 if(approvedHash&&createHash('sha256').update(original).digest('hex')===approvedHash)return Buffer.from(base);
 let expected=base;
 if(file==='dist/app-index.js'){
  expected=replaceOnce(expected,'connectAccount(repo,()=>render());','connectAccount(repo,()=>render(),{openAdminCenter:()=>openAdminCenter()});',file);
 }else if(file==='dist/playlists.js'){
  expected=replaceOnce(expected,'let approved=false,expiryTimer=null,renewTimer=null;\n','let approved=false,expiryTimer=null,renewTimer=null;\nlet openAdminCenterAction=null;\n',file);
  expected=replaceOnce(expected,'export function connectAccount(repo,onChange){\n','export function connectAccount(repo,onChange,{openAdminCenter}={}){\n openAdminCenterAction=typeof openAdminCenter===\'function\'?openAdminCenter:null;\n',file);
  expected=replaceOnce(expected," if(session){modal('내 계정',"," if(session){const isAdminAccount=session.user.email?.toLowerCase()===ADMIN_EMAIL;const showAdminCenter=isAdminAccount&&isApprovedMember()&&globalThis.matchMedia?.('(max-width: 740px)').matches===true;modal('내 계정',",file);
  expected=replaceOnce(expected,"${session.user.email.toLowerCase()===ADMIN_EMAIL?'관리자 · 서재 편집 및 색인 가능':'내 플레이리스트가 계정에 저장됩니다.'}","${isAdminAccount?'관리자 · 서재 편집 및 색인 가능':'내 플레이리스트가 계정에 저장됩니다.'}",file);
  expected=replaceOnce(expected,"${session.user.email.toLowerCase()===ADMIN_EMAIL?'<button id=\"vinyl-manage-members\">회원 관리</button>':''}","${isAdminAccount?'<button id=\"vinyl-manage-members\">회원 관리</button>':''}",file);
  expected=replaceOnce(expected,"?'<button id=\"vinyl-manage-members\">회원 관리</button>':''}<button id=\"vinyl-change-password\">","?'<button id=\"vinyl-manage-members\">회원 관리</button>':''}${showAdminCenter?'<button id=\"vinyl-open-admin-center\" class=\"mobile-admin-entry\" type=\"button\">Admin 관리센터</button>':''}<button id=\"vinyl-change-password\">",file);
  expected=replaceOnce(expected,"if(dialog.querySelector('#vinyl-manage-members'))dialog.querySelector('#vinyl-manage-members').onclick=guarded(async()=>{await openMemberManagement(await token());void refreshPendingMembers();});dialog.querySelector('#vinyl-change-password')","if(dialog.querySelector('#vinyl-manage-members'))dialog.querySelector('#vinyl-manage-members').onclick=guarded(async()=>{await openMemberManagement(await token());void refreshPendingMembers();});const adminCenterButton=dialog.querySelector('#vinyl-open-admin-center');if(adminCenterButton)adminCenterButton.onclick=guarded(async()=>{if(!isApprovedMember()||session?.user?.email?.toLowerCase()!==ADMIN_EMAIL){dialog.close();return;}dialog.close();if(typeof openAdminCenterAction==='function')await openAdminCenterAction();});dialog.querySelector('#vinyl-change-password')",file);
 }else if(file==='dist/theme.css'){
  const navRule=' .sidebar #nav button{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;width:100%;min-width:0;height:52px;min-height:52px;padding:4px 0;line-height:13px;letter-spacing:-.025em;white-space:nowrap;border:0;border-radius:4px;box-shadow:none}\n';
  expected=replaceOnce(expected,navRule,navRule+' .sidebar #nav #vinyl-admin-center-nav{display:none!important}\n',file);
  expected=replaceOnce(expected,'}\n@media(max-width:359px){','}\n@media(max-width:740px){#personal-dialog.account-dialog #vinyl-open-admin-center{display:block;width:100%;min-height:34px;margin-top:8px;padding:7px 10px;border:1px solid var(--vr-line);border-radius:var(--vr-radius);background:#f3eee3;color:#526170;font-size:12px;font-weight:400}}\n@media(max-width:359px){',file);
 }else{return original;}
 return input.equals(Buffer.from(expected))?Buffer.from(base):original;
}
