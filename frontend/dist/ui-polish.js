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
 // Place the ALBUM label as a direct grid item alongside the cover.
 // This gives both elements the same grid-row top edge, regardless of typography.
 const alignedLabel=hero.querySelector(':scope > .album-eyebrow');
 if(alignedLabel){
  alignedLabel.classList.add('album-aligned-label');
  top.append(alignedLabel);
 }
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
 // Force the detail-only typographic size at the final render point:
 // legacy global/theme rules must not turn the album title back into a 43px heading.
 const view=root.ownerDocument.defaultView,heading=hero.querySelector('h2');
 if(heading&&view){
  const px=view.matchMedia('(max-width:740px)').matches?21:view.matchMedia('(max-width:1199px)').matches?24:26;
  heading.style.setProperty('font-size',px+'px','important');
  heading.style.setProperty('font-family','"Noto Sans KR",sans-serif','important');
  heading.style.setProperty('font-weight','320','important');
  heading.style.setProperty('line-height','1.28','important');
  heading.style.setProperty('letter-spacing','-.035em','important');
 }
}
