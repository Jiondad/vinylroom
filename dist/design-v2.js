// DESIGN_LOCK: VINYL_ROOM_V2_0_20261030 — presentation adapter, existing nodes retained.
export function installDesignV2(doc=document,{groups=[],describe}={}){
 if(doc.documentElement.dataset.vrDesignLock)return;
 doc.documentElement.dataset.vrDesignLock='VINYL_ROOM_V2_0_20261030';
 doc.body.classList.add('vr-ds-v2');
 doc.documentElement.dataset.vrTypographyAmendment='NOTO_350_DEMO_PARITY_20261102';
 const userWeight=doc.createElement('link');userWeight.rel='stylesheet';userWeight.href=new URL('./site-font-weight.css',import.meta.url).href;doc.head.append(userWeight);
 const albumText=doc.createElement('link');albumText.rel='stylesheet';albumText.href=new URL('./album-text-unify.css',import.meta.url).href;doc.head.append(albumText);
 const typography=doc.createElement('link');typography.rel='stylesheet';typography.href=new URL('./typography-operational.css',import.meta.url).href;doc.head.append(typography);
 for(const file of ['typography-a2.css','design-v2-tokens.css','design-v2.css']){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./'+file,import.meta.url).href;doc.head.append(link);}
 // Approved original demo loader; sizes and playback code are preserved.
 const fontStyles=doc.createElement('link');fontStyles.rel='stylesheet';fontStyles.href='https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300..500&display=swap';const fontStyleReady=new Promise((resolve,reject)=>{fontStyles.onload=resolve;fontStyles.onerror=()=>reject(Error('Noto stylesheet failed'));});fontStyleReady.catch(()=>{});doc.head.append(fontStyles);
 const notoDemoStyles=doc.createElement('link');notoDemoStyles.rel='stylesheet';notoDemoStyles.href=new URL('./noto-demo-sitewide.css',import.meta.url).href;doc.head.append(notoDemoStyles);
 // Opt-in read-only console proof for the deployed renderer; no UI or data writes.
 if(new URL(doc.URL).searchParams.has('font-parity'))fontStyleReady.then(()=>doc.fonts.load('350 12px \"Noto Sans KR\"','한글 Album')).then(()=>doc.fonts.ready).then(()=>import('./font-parity-diagnostics.js')).catch(error=>console.error('FONT_PARITY_FAILED: '+error.message));
 const win=doc.defaultView||window;
 const extra='#nav button,#vinyl-header-actions button,.sidebar .connection,#global-player .player-controls button,.desktop-player button,.mini-controls button,.expanded-controls button,.expanded-actions button,.mobile-player-sheet header button,.queue-sheet-tools button,.ui6-now button,.ui6-queue-header button,.ui6-queue-footer button,.queue-inline-form button,#queue-panel [data-queue-remove],.mobile-queue [data-remove],.ui6-track-table [data-track-action],.mobile-track-more,.vr-ai-root button,.vinyl-admin-page button,#vinyl-admin-center button,.vinyl-members-panel button,.vinyl-ai-panel button,.vinyl-lyrics-panel button,#personal-dialog button,#vinyl-auth-gate button,.album-share-panel button';
 const exclude='#nav button,#member-account,#previous-track,#next-track,.album-open,.album-card,.artist-card,.random-song-card,.random-track>button,.catalog-link,.artist-name,.album-artist-link,.related-artist,[data-proposal],[data-list],[data-list-play],[data-image],[data-mobile-track-play],.ui6-disc-header,.mini-info,.mini-art';
 const inferred=b=>b.matches('[data-remove],[data-queue-remove],[data-clear],#clear-queue,.danger')?'danger':b.matches('[data-toggle],[data-previous],[data-next],[data-shuffle],[data-repeat],[data-mute],[data-queue],[data-close],#nav button,#vinyl-header-actions button,.mobile-track-more>summary')?'icon':b.matches('.primary,[type=submit],[data-album-action=play]')?'primary':'secondary';
 function mark(b,context){
  // Native disclosure containers must retain summary as a direct child.
  // Decorating details itself replaces its native label with browser "Details".
  if(b.matches('details,summary'))return;
  if(b.matches(exclude))return;
  const d=describe?.(b,context);
  b.classList.add('vr-btn');b.classList.remove('vr-ds-button');
  b.dataset.vrRole=d?.role||b.dataset.vrRole||inferred(b);
  if(b.matches('[data-toggle],[data-previous],[data-next],[data-shuffle],[data-repeat],[data-mute]'))b.classList.add('vr-transport');
  if(b.closest('.ui6-now-main')){b.dataset.vrRole='icon';b.classList.add('vr-transport');}
  let face=b.querySelector(':scope>.vr-btn__face');
  if(!face){face=doc.createElement('span');face.className='vr-btn__face';face.append(...b.childNodes);b.append(face);}
  if(b.dataset.trackAction){const icon={lyrics:'가사',play:b.classList.contains('is-playing')?'Ⅱ':'▷',queue:'＋',playlist:'≡+',download:'↓'}[b.dataset.trackAction];if(icon&&face.textContent!==icon)face.textContent=icon;}
  if(b.id==='show-queue'){b.dataset.vrRole='icon';b.setAttribute('aria-label','재생 대기열');if(face.textContent!=='☷')face.textContent='☷';}
  if(b.dataset.albumAction==='play'&&face.textContent.startsWith('▶'))face.textContent=face.textContent.replace('▶','▷');
  if(b.textContent.trim().length>24)b.dataset.vrWrap='true';
 }
 function visit(root){
  for(const [context,selector]of [...groups,['v2',extra]]){
   if(root.matches?.(selector))mark(root,context);
   for(const b of root.querySelectorAll?.(selector)||[])mark(b,context);
  }
 }
 visit(doc);
 const observer=new win.MutationObserver(records=>{
  for(const r of records){if(r.target.matches?.('button.vr-btn'))mark(r.target,'v2');
   for(const n of r.addedNodes)if(n.nodeType===1)visit(n);}
 });
 observer.observe(doc.body,{subtree:true,childList:true});
 return {refresh:()=>visit(doc),disconnect:()=>observer.disconnect()};
}
