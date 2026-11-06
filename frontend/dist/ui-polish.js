// Presentation only: move existing nodes, retain their handlers and metadata.
export function installCompactUI(doc=document){
 if(doc.querySelector('link[data-vinyl-compact-ui]'))return;
 const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./ui-polish.css',import.meta.url).href;link.dataset.vinylCompactUi='';doc.head.append(link);
}
export function folderEdition(album={}){
 const text=String(album.edition||'').trim();if(!text)return false;
 const same=value=>String(value||'').trim()===text;
 const paths=String(album.relative_path||'').split(/[\\/]/);
 if([album.original_folder,album.folder,album.set_title,...paths].some(value=>value&&same(value)))return true;
 if(/^(?:CD|DISC|DISK)\s*0*\d+$/i.test(text))return true;
 if(/\[(?:FLAC|MP3|WAV|APE|DSD|ALAC)[^\]]*\]/i.test(text))return true;
 return /\d{4}[.\-]\d{2}[.\-]\d{2}/.test(text)&&!!album.title&&text.includes(album.title);
}
export function polishAlbumHeader(root,album){
 if(!root||!album)return;
 const top=root.querySelector('.detail-top'),hero=top?.querySelector('.album-header-info')||top?.querySelector(':scope > div:last-child'),cover=top?.querySelector('.cover');
 if(!hero||!cover)return;
 hero.classList.add('album-header-info');
 const artist=hero.querySelector(':scope > p:not(.album-eyebrow)');artist?.classList.add('album-artist-line');
 // Keep the canonical release-date value in the metadata table; never duplicate it.
 const chips=hero.querySelector('.album-chips'),dateLabel=hero.querySelector('.album-facts dt');
 if(dateLabel?.textContent==='연도')dateLabel.textContent='발매일';
 chips?.remove();
 // Hide only folder-derived display text, never independent edition metadata.
 if(folderEdition(album))for(const label of hero.querySelectorAll('.album-facts dt'))if(label.textContent==='소장 판본')label.parentElement.hidden=true;
 const review=root.querySelector('#review-index');if(review){review.hidden=true;review.setAttribute('aria-hidden','true');}
 for(const action of ['play','download']){const button=root.querySelector('[data-album-action="'+action+'"]');if(button)button.textContent=action==='play'?'▶ 전체 듣기':'↓ 전체 받기';}
 const edit=root.querySelector('#edit-index');
 const share=hero.querySelector('.album-primary-actions');if(share){share.classList.add('album-header-actions');top.append(share);}
 if(edit&&!top.querySelector('.album-cover-tools')){
  const tools=root.ownerDocument.createElement('div');tools.className='album-cover-tools';tools.append(edit);top.append(tools);
  if(review?.parentElement?.children.length===1)review.parentElement.hidden=true;
 }
 // Position by actual rendered edges, not a fixed top:-Npx guess.
 // Only desktop uses side-by-side cover/metadata columns.
 const eyebrow=hero.querySelector('.album-eyebrow');
 if(eyebrow&&root.ownerDocument.defaultView?.matchMedia('(min-width:741px)').matches){
  root.ownerDocument.defaultView.requestAnimationFrame(()=>{
   if(!hero.isConnected||!cover.isConnected)return;
   hero.style.marginTop='0px';
   const delta=cover.getBoundingClientRect().top-eyebrow.getBoundingClientRect().top;
   if(Number.isFinite(delta))hero.style.marginTop=Math.round(delta-2)+'px';
  });
 }
}
