// A closed shell is the default, even when modules fail or stale classes change.
export function setLibraryAccess(enabled){
 const allow=enabled===true;
 document.documentElement.setAttribute('data-vinyl-access',allow?'approved':'locked');
 document.body.classList.toggle('vinyl-auth-locked',!allow);
 if(!allow){
  document.querySelectorAll('audio').forEach(audio=>{audio.pause();audio.removeAttribute('src');audio.load();});
 }
}
