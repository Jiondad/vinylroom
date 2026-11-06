import {revokeOwnedAudio} from './next-player/engine.js';
import {isGuestAccount} from './browse-policy.js';
// A closed shell is the default, even when modules fail or stale classes change.
let initializing=true;
export function finishAccessInitialization(enabled){initializing=false;setLibraryAccess(enabled);}
export function setLibraryAccess(enabled){
 const allow=enabled===true,browse=document.documentElement.dataset?.vinylBrowse==='true'&&isGuestAccount();
 document.documentElement.setAttribute('data-vinyl-access',initializing?'checking':allow?'approved':browse?'guest':'locked');
 document.body.classList.toggle('vinyl-auth-locked',!allow&&!browse);
 if(!allow){
  document.querySelectorAll('audio').forEach(audio=>{if(revokeOwnedAudio(audio))return;const diagnostics=globalThis.vinylPlaybackDiagnostics;diagnostics?.record('access-force-stop',{reason:'access-state-disabled'},{immediate:true});diagnostics?.requestPause('access-state-disabled');audio.pause();diagnostics?.sourceRemovalRequested('access-state-disabled');audio.removeAttribute('src');diagnostics?.sourceChanged('src-removed-access-state',false);audio.load();});
 }
}
