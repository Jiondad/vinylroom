import {g2Baseline} from './g2-source-guard.mjs';
import {normalizeMobileAdminChange} from './mobile-admin-source-guard.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const hash=value=>createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(readFileSync('docs/g0/v150-protection-manifest.json','utf8'));
const g1=process.argv.includes('--g1');
if(process.argv.slice(2).some(value=>value!=='--g1'))throw Error('Unknown protection option');
function originalPolicySource(file,text){
 if(file==='dist/browse-access.js')return text.replace("import {isGuestAccount} from './browse-policy.js';\n",'').replace('publicBrowseEnabled=()=>enabled&&isGuestAccount();','publicBrowseEnabled=()=>enabled;').replace('if(!enabled||!isGuestAccount()||parsed.origin','if(!enabled||parsed.origin');
 if(file==='dist/access-state.js')return text.replace("import {isGuestAccount} from './browse-policy.js';\n",'').replace("browse=document.documentElement.dataset?.vinylBrowse==='true'&&isGuestAccount()","browse=document.documentElement.dataset?.vinylBrowse==='true'");
 return text;
}
for(const [file,digest] of Object.entries(manifest.files)){
 let content=['dist/browse-access.js','dist/access-state.js'].includes(file)?originalPolicySource(file,readFileSync(file,'utf8')):readFileSync(file);
 content=normalizeMobileAdminChange(file,content);
 content=g2Baseline(file,content);
 if(g1&&file==='dist/media.js'){
  let text=content.toString();
  text=text.replace("export function bindMedia(repo,album,trackOrder=null,approved=document.documentElement.dataset.vinylAccess==='approved'){","export function bindMedia(repo,album,trackOrder=null){");
  text=text.replace('actions.innerHTML=approved===true?',"actions.innerHTML=document.documentElement.dataset.vinylAccess==='approved'?");
  text=text.replace(" const share=hero?.querySelector('.album-share-actions');\n if(share){share.classList.add('album-primary-actions');share.prepend(actions);",'').replace("}\n else if(dialog.matches",' if(dialog.matches');
  const a=text.indexOf("  if(button.dataset.trackAction==='lyrics'){"),b=text.indexOf("  try{\n\n   const base=NAS_URL;",a);
  assert.ok(a>=0&&b>a,'Explicit lyric branch missing');text=text.slice(0,a)+text.slice(b);
  text=text.replace("syncPlayButtons,matchTrack} from './player.js';","syncPlayButtons} from './player.js';").replace("import {showLyricDialog} from './lyrics-dialog.js';\n",'');
  const base=readFileSync('docs/g1/media.v150.js','utf8');assert.equal(hash(base),digest,'Baseline media reference changed');
  text=text.replace(/^export function mediaPanel[^\n]+/m,base.match(/^export function mediaPanel[^\n]+/m)[0]);content=text;
 }
 if(file==='dist/admin-center.css'){const text=content.toString(),at=text.indexOf('/* G1-C:');if(at>=0){assert.equal(hash(text.slice(at)),'7ca2a0aeffd98c0ca9cdb40736af26ea2a2f6ac54a1670704350ba5f43a48fe0','Unexpected G1-C CSS change');content=Buffer.from(text.slice(0,at-1));}}
 assert.equal(hash(content),digest,'Protected file changed outside exact policy/G1 regions: '+file);
}
const app=readFileSync('dist/app-index.js','utf8');
for(const [key,a,b] of [['indexing','async function indexing(){',"$('#genre').innerHTML"],['api','async function api(','\nlet albumPage'],['updateAuth','function updateAuth(){','\nfunction cover(']]){
 assert.ok(app.includes(a)&&app.includes(b));assert.equal(hash(app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)))),manifest.app_segments[key],key+' changed');
}
for(const line of manifest.handlers)assert.ok(app.includes(line),'Header indexing handler changed');
const tail="\n// Read-only access flags for shared metadata entry; no token/session data exported.\nexport const albumAccessSnapshot=()=>({authenticated:session!==null,approved:isApprovedMember()});\n";
const auth=normalizeMobileAdminChange(manifest.append_only_auth_file,readFileSync(manifest.append_only_auth_file)).toString().replace("import {setAccountPresence} from './browse-policy.js';\n",'').replace('function accountChanged(persist=true){setAccountPresence(session!==null);setLibraryAccess(isApprovedMember());armExpiry();','function accountChanged(persist=true){armExpiry();').replace('try{await restoreSavedSession();}finally{setAccountPresence(session!==null);account.disabled=false;}','try{await restoreSavedSession();}finally{account.disabled=false;}');
assert.ok(auth.endsWith(tail),'Only the allowlisted read-only access export may be appended');
assert.equal(hash(auth.slice(0,-tail.length)),manifest.append_only_auth_base_sha256,'Existing auth/session/playlists code changed');
console.log(JSON.stringify({G0:'PASS',base_commit:manifest.base_commit,protected_files:Object.keys(manifest.files).length,byte_identical_files:Object.keys(manifest.files).length-2-(g1?1:0),authorized_media_patch:g1,allowlisted_policy_files:['browse-access.js','access-state.js'],indexing_api_and_header_handlers:'unchanged',auth_existing_code:'original after exact account-presence hook removal',operating_NAS_requests:0}));
