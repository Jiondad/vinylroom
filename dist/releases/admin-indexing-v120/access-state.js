// A closed shell is the default, even when modules fail or stale classes change.
let initializing=true;
export function finishAccessInitialization(enabled){initializing=false;setLibraryAccess(enabled);}
export function setLibraryAccess(enabled){
 const allow=enabled===true,browse=document.documentElement.dataset?.vinylBrowse==='true';
 document.documentElement.setAttribute('data-vinyl-access',initializing?'checking':allow?'approved':browse?'guest':'locked');
 document.body.classList.toggle('vinyl-auth-locked',!allow&&!browse);
 if(!allow){
  document.querySelectorAll('audio').forEach(audio=>{audio.pause();audio.removeAttribute('src');audio.load();});
 }
}
