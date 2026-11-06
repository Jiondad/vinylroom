// UI-6 presentation adapters. No audio ownership, queue mutation or playback algorithms.
import {decorateQueueControl,bindDesktopQueueInline} from './queue-controls.js';
import {decorateAlbumAction} from './album-action-icons.js';
import {playbackWindow} from './mobile-player.js';
const clock=value=>{const s=Number(value);return Number.isFinite(s)&&s>=0?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'—';};
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalogDurations=new Map(),albums=new Set(),views=new WeakMap();
export function installReferenceStyle(doc=document){if(doc.querySelector('link[data-ui6]'))return;const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./reference-ui.css',import.meta.url).href;link.dataset.ui6='';doc.head.append(link);}
const shareMarkup='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="m7 12 10-6M7 12l10 6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/></svg>';
let turntableSequence=0;
function turntableMarkup(){const id='vr-turntable-'+(++turntableSequence);return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}-body" x2="1" y2="1"><stop stop-color="#fffdf5"/><stop offset=".55" stop-color="#e5dfd1"/><stop offset="1" stop-color="#c4bcab"/></linearGradient><linearGradient id="${id}-metal" x2="1" y2="1"><stop stop-color="#f6f5ec"/><stop offset=".22" stop-color="#b6b6ac"/><stop offset=".45" stop-color="#faf9ef"/><stop offset=".7" stop-color="#a4a69f"/><stop offset="1" stop-color="#e9e7dc"/></linearGradient><linearGradient id="${id}-gold" x2="1" y2="1"><stop stop-color="#e4d4ab"/><stop offset=".5" stop-color="#a8894a"/><stop offset="1" stop-color="#f4e8c9"/></linearGradient></defs><rect x="2" y="5" width="60" height="54" rx="3" fill="url(#${id}-body)" stroke="#bdb39e"/><rect x="5" y="8" width="54" height="48" rx="2" fill="#efede5" stroke="#d0c7b4" stroke-width=".6"/><g class="vr-disc-rotor"><circle cx="26" cy="33" r="22" fill="#6f6d61"/><circle cx="26" cy="33" r="21" fill="url(#${id}-metal)" stroke="#b5a078" stroke-width="1"/><g fill="none" stroke="#7c7f78" stroke-opacity=".28" stroke-width=".4"><circle cx="26" cy="33" r="19.5"/><circle cx="26" cy="33" r="18"/><circle cx="26" cy="33" r="16.5"/><circle cx="26" cy="33" r="15"/><circle cx="26" cy="33" r="13.5"/></g><circle cx="26" cy="33" r="7" fill="url(#${id}-gold)" stroke="#7b725b" stroke-width=".8"/><path d="M25 29h2v3h-2z" fill="#f6edcf"/><circle cx="26" cy="33" r="1.4" fill="#5c5c54"/><circle cx="25.6" cy="32.6" r=".6" fill="#fff"/></g><path d="M53 13v36" stroke="#ad9b72" stroke-width="1"/><circle cx="53" cy="14" r="5" fill="url(#${id}-gold)" stroke="#a18c60"/><path d="m55 11-2 8-4 17-8 9" fill="none" stroke="#766b50" stroke-width="3.4" stroke-linecap="round"/><path d="m55 11-2 8-4 17-8 9" fill="none" stroke="url(#${id}-gold)" stroke-width="2.2" stroke-linecap="round"/><path d="m40 43 3 3-4 3-2-2z" fill="#b69b61" stroke="#86744c" stroke-width=".6"/><circle cx="8" cy="11" r="1.2" fill="#c5b68d"/><circle cx="8" cy="53" r="1.2" fill="#c5b68d"/></svg>`;}
const motionDocuments=new WeakSet();
function decorateShare(button){if(!button)return;button.setAttribute('aria-label','공유');button.classList.add('vr-sns-share');button.innerHTML=shareMarkup;}
function installDecorativeMotion(doc){if(motionDocuments.has(doc))return;motionDocuments.add(doc);const sync=()=>doc.documentElement.toggleAttribute('data-vr-decor-paused',doc.visibilityState==='hidden');sync();doc.addEventListener('visibilitychange',sync);}
const key=t=>t?`${t.album_id}:${t.index}`:'';
export function referencePlaybackState(player){const item=player.items[player.index],loaded=!!item&&(!('loadedItem' in player)||player.loadedItem===item)&&!!player.audio.getAttribute('src');return {item,loaded,state:player.failure?'error':player.loading?'loading':!loaded?'idle':player.audio.ended?'ended':player.audio.paused?'paused':Number(player.audio.readyState??4)<3?'loading':'playing',...playbackWindow(player)};}
export function mountAlbumReference(root,album,rows,{player,onPlaylist,onQueue}={}){
 if(!root||root.dataset.ui6Album)return;root.dataset.ui6Album='true';root.classList.add('ui6-album');installDecorativeMotion(root.ownerDocument);installReferenceStyle(root.ownerDocument);const doc=root.ownerDocument;let layoutCleanup=()=>{};
 decorateShare(root.querySelector('[data-album-share]'));
 const top=root.querySelector('.detail-top'),title=top?.querySelector('h2'),artist=top?.querySelector('.album-artist-line'),cover=top?.querySelector('.cover'),actions=top?.querySelector('.album-primary-actions');
 if(top&&title&&cover){const allFacts=[...top.querySelectorAll('.album-facts')];const info=doc.createElement('div');info.className='ui6-album-info';const label=doc.createElement('small');label.className='ui6-eyebrow';label.textContent='ALBUM';info.append(label,title);if(artist)info.append(artist);
 if(actions){if(onPlaylist){const button=doc.createElement('button');button.type='button';button.className='ui6-album-list';button.textContent='＋ 목록에 추가';button.onclick=onPlaylist;const download=actions.querySelector('[data-album-action="download"]');download?download.before(button):actions.append(button);}}
 if(actions){
  if(onQueue){const queue=doc.createElement('button');queue.type='button';queue.className='ui6-album-queue';queue.onclick=onQueue;const play=actions.querySelector('[data-album-action=play]');play?play.after(queue):actions.prepend(queue);decorateAlbumAction(queue,'queue','대기열에 추가');}
  decorateAlbumAction(actions.querySelector('[data-album-action=play]'),'play','전체 듣기');
  decorateAlbumAction(actions.querySelector('.ui6-album-list'),'playlist','플레이리스트에 추가');
  decorateAlbumAction(actions.querySelector('[data-album-action=download]'),'download','전체 받기');
  const share=actions.querySelector('[data-album-share]');if(share)share.title='공유';
 }
 // One permanent cover column owns the existing cover and permission-filtered edit button.
 const column=doc.createElement('div');column.className='ui6-cover-column';column.append(cover);
 const edit=top.querySelector('#edit-index'),review=top.querySelector('#review-index');
 if(edit){const tools=doc.createElement('div');tools.className='album-cover-tools';tools.append(edit);column.append(tools);}
 // Preserve metadata nodes, without ever constructing a disclosure/summary trigger.
 const factsArea=doc.createElement('div');factsArea.className='ui6-album-facts';
 for(const facts of allFacts)factsArea.append(facts);if(review)factsArea.append(review);
 // Reparent the original action group immediately after the primary five-row facts.
 if(actions){const primary=factsArea.querySelector('.album-facts');primary?primary.after(actions):factsArea.append(actions);}
 if(factsArea.children.length)info.append(factsArea);
 if(typeof album.description==='string'&&album.description.trim()){const intro=doc.createElement('p');intro.className='ui6-album-description';intro.textContent=album.description;info.append(intro);}

 top.replaceChildren(column,info);layoutCleanup=mobileHeader(top,info,actions,factsArea,doc);}

 const wrap=root.querySelector('.table-wrap'),table=wrap?.querySelector('table'),trackRows=table?[...table.querySelectorAll('tbody>tr:not(.album-disc-heading)')]:[];
 if(!table)return;
 const total=rows.reduce((n,r)=>n+(Number(r.track.duration)||0),0);const heading=wrap.previousElementSibling;if(heading?.tagName==='H3'){heading.className='ui6-track-heading';heading.innerHTML=`수록곡 <small>${rows.length}곡${total?' · '+clock(total):''}</small>`;}
 wrap.classList.add('ui6-disc-list');const groups=[];let group;
 rows.forEach((r,i)=>{if(!group||String(group.disc)!==String(r.disc)){group={disc:r.disc,rows:[],nodes:[]};groups.push(group);}group.rows.push(r);group.nodes.push(trackRows[i]);catalogDurations.set(`${album.id}:${r.index}`,Number(r.track.duration)||0);if(catalogDurations.size>2000)catalogDurations.delete(catalogDurations.keys().next().value);});
 const fragments=[];
 for(const group of groups){const card=doc.createElement('section');card.className='ui6-disc-card';const bar=doc.createElement('button');bar.type='button';bar.className='ui6-disc-header';bar.setAttribute('aria-expanded','true');const duration=group.rows.reduce((n,r)=>n+(Number(r.track.duration)||0),0);bar.innerHTML=`<span class="ui6-vinyl" aria-hidden="true">${turntableMarkup()}</span><strong>DISC ${escape(group.disc||1)}</strong><small>${group.rows.length}곡${duration?' · '+clock(duration):''}</small><span class="ui6-chevron" aria-hidden="true">⌃</span>`;
 const grid=doc.createElement('table');grid.className='ui6-track-table';grid.setAttribute('aria-label',`DISC ${group.disc||1} 트랙`);const approved=!!table.querySelector('[data-track-action="play"]');grid.innerHTML='<colgroup>'+Array.from({length:approved?10:5},(_,i)=>`<col class="ui6-col-${i}">`).join('')+'</colgroup>';const head=table.querySelector('thead')?.cloneNode(true);if(head){head.className='ui6-sr-only';grid.append(head);}const tbody=doc.createElement('tbody');grid.append(tbody);
 group.nodes.forEach((row,i)=>{if(!row)return;const r=group.rows[i];row.classList.add('ui6-track-row');row.dataset.ui6Track=String(r.index);const number=row.cells?.[0]||row.querySelector('td');if(number){const label=doc.createElement('span');label.className='ui6-track-number';label.append(...number.childNodes);const equalizer=doc.createElement('span');equalizer.className='ui6-track-equalizer';equalizer.setAttribute('aria-hidden','true');equalizer.innerHTML=[3,4,5,4,3].map(count=>'<span class="ui6-pixel-column">'+'<i></i>'.repeat(count)+'</span>').join('');number.append(label,equalizer);}if(approved){const progress=doc.createElement('td');progress.className='ui6-track-progress';progress.innerHTML='<small></small><progress max="1" value="0" aria-label="현재 곡 진행"></progress>';row.append(progress);}tbody.append(row);});
 bar.onclick=()=>{grid.hidden=!grid.hidden;bar.setAttribute('aria-expanded',String(!grid.hidden));};card.append(bar,grid);fragments.push(card);}
 wrap.replaceChildren(...fragments);const record={root,albumId:album.id,player,cleanup:layoutCleanup};albums.add(record);for(const item of albums)if(!item.root.isConnected){item.cleanup?.();albums.delete(item);};if(player)updateAlbum(record);return ()=>{layoutCleanup();albums.delete(record);};
}

// Keep metadata and its original actions together at every breakpoint.
function mobileHeader(top,info,actions,factsArea,doc){
 const media=doc.defaultView?.matchMedia?.('(max-width:740px)');if(!media)return ()=>{};
 const list=actions?.querySelector('.ui6-album-list'),listText=list?.textContent;
 const place=()=>{
  if(media.matches){info.insertBefore(factsArea,info.querySelector('.ui6-album-description'));factsArea.classList.add('ui6-mobile-metadata');}
  else{info.insertBefore(factsArea,info.querySelector('.ui6-album-description'));factsArea.classList.remove('ui6-mobile-metadata');}
  if(list&&!list.dataset.vrAlbumIcon){list.textContent=media.matches?'목록 추가':listText;if(media.matches)list.setAttribute('aria-label','목록 추가');else list.removeAttribute('aria-label');}
 };
 place();media.addEventListener?.('change',place);return ()=>media.removeEventListener?.('change',place);
}

function updateAlbum({root,albumId,player}){if(!root.isConnected)return;const state=referencePlaybackState(player);for(const row of root.querySelectorAll('[data-ui6-track]')){const active=state.loaded&&state.item.album_id===albumId&&Number(state.item.index)===Number(row.dataset.ui6Track);if(active)row.setAttribute('data-ui6-current',state.state);else row.removeAttribute('data-ui6-current');const p=row.querySelector('.ui6-track-progress');if(p){p.hidden=!active;if(active){p.querySelector('small').textContent=clock(state.position)+' / '+clock(state.duration);p.querySelector('progress').max=state.duration||1;p.querySelector('progress').value=state.position;}}}}
export function mountReferencePlayer(player,host){if(views.has(host))return views.get(host);installReferenceStyle(host.ownerDocument);host.classList.add('ui6-player');const doc=host.ownerDocument,win=doc.defaultView||window,panels=new Map();let showAll=false;
 function make(panel){panel.classList.add('ui6-queue');const now=doc.createElement('section');now.className='ui6-now';now.innerHTML='<div class="ui6-now-main"><img alt=""><div><small>NOW PLAYING</small><strong></strong><span></span></div><button type="button" aria-label="재생 또는 일시정지"></button></div><div class="ui6-now-timeline"><input type="range" min="0" max="1" value="0" step="0.1" aria-label="현재 곡 재생 위치"><small></small></div>';const label=doc.createElement('div');label.className='ui6-up-next';label.innerHTML='<span>UP NEXT</span><span>다음 재생곡</span>';const list=panel.querySelector('ol');if(!list)return;list.before(now,label);
 const actions=panel.querySelector('.actions,.queue-sheet-tools'),save=actions?.querySelector('#save-queue,[data-save]'),clear=actions?.querySelector('#clear-queue,[data-clear]');
 let header=panel.querySelector(':scope > header');
 if(!header){header=doc.createElement('header');header.innerHTML='<div><h2>재생 대기열</h2><small></small></div><button type="button" aria-label="대기열 닫기">×</button>';header.querySelector('button').onclick=()=>{panel.hidden=true;update();};panel.prepend(header);}
 header.classList.add('ui6-queue-header');
 if(panel.matches('.mobile-queue')){const title=header.querySelector('h2'),count=actions?.querySelector('[data-queue-count]');if(count){const info=doc.createElement('div');info.append(title,count);header.prepend(info);}}
 const close=header.querySelector('[data-close],button'),tools=doc.createElement('div');tools.className='ui6-queue-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','대기열 작업');
 const all=doc.createElement('button');all.type='button';all.onclick=()=>{showAll=!showAll;update();};
 decorateQueueControl(all,'list-music','전체 목록');decorateQueueControl(save,'bookmark-plus','플레이리스트에 저장');decorateQueueControl(clear,'trash-2','대기열 비우기');decorateQueueControl(close,'x','대기열 닫기');
 tools.append(all);if(save)tools.append(save);if(clear)tools.append(clear);if(close)tools.append(close);header.append(tools);actions?.remove();
 if(panel.id==='queue-panel')bindDesktopQueueInline(panel,save,clear,()=>player.items);
 now.querySelector('button').onclick=()=>host.querySelector(win.matchMedia('(max-width:740px)').matches?'.mobile-mini-player [data-toggle]':'.desktop-player [data-toggle]')?.click();now.querySelector('input').addEventListener('input',e=>{const seek=host.querySelector(win.matchMedia('(max-width:740px)').matches?'.mobile-mini-player [data-seek]':'.desktop-player [data-seek]');if(seek){seek.value=e.target.value;seek.dispatchEvent(new win.Event('input',{bubbles:true}));}});panels.set(panel,{now,list});}
 function progress(){const state=referencePlaybackState(player);for(const [panel,{now}] of panels){const seek=now.querySelector('input');seek.max=String(state.duration||1);seek.value=String(state.position);seek.disabled=!state.loaded||!state.duration;seek.style.setProperty('--progress',(state.duration?state.position/state.duration*100:0)+'%');now.querySelector('.ui6-now-timeline small').textContent=clock(state.position)+' / '+clock(state.duration);}
 for(const a of albums){if(!a.root.isConnected){a.cleanup?.();albums.delete(a);}else if(a.player===player)updateAlbum(a);}}
 function update(){for(const panel of doc.querySelectorAll('#queue-panel,.mobile-queue')){if(panels.has(panel)&&!panels.get(panel).now.isConnected)panels.delete(panel);if(!panels.has(panel))make(panel);}const state=referencePlaybackState(player),cover=host.querySelector('#player-cover'),src=state.loaded&&cover&&!cover.hidden?cover.getAttribute('src'):null;
 for(const [panel,{now,list}] of panels){const title=now.querySelector('strong'),artist=now.querySelector('.ui6-now-main div>span'),button=now.querySelector('button'),img=now.querySelector('img');title.textContent=state.loaded?state.item.title:'곡을 선택하세요';artist.textContent=state.loaded?state.item.artist||'':'';now.dataset.state=state.state;button.textContent=state.state==='loading'?'…':state.state==='playing'?'Ⅱ':'▷';button.setAttribute('aria-label',state.state==='playing'?'일시정지':'재생');button.disabled=player.loading||!player.items.length;img.hidden=!src;if(src&&img.getAttribute('src')!==src)img.src=src;
 const allButton=panel.querySelector('[data-queue-control="list-music"]');if(allButton){const label=showAll?'다음 재생곡만 표시':'전체 목록';allButton.setAttribute('aria-label',label);allButton.title=label;allButton.setAttribute('aria-pressed',String(showAll));}
 const count=panel.querySelector('.ui6-queue-header small');if(count)count.textContent=`QUEUE · ${player.items.length} TRACKS`;
 [...list.children].forEach(row=>{const index=Number(row.dataset.queueIndex),item=player.items[index];row.hidden=!showAll&&state.loaded&&index<=player.index;if(!row.querySelector('.ui6-queue-time')){const duration=doc.createElement('small');duration.className='ui6-queue-time';row.querySelector('[data-queue-remove],[data-remove]')?.before(duration);}row.querySelector('.ui6-queue-time').textContent=clock(item?.duration??catalogDurations.get(key(item)));if(!row.querySelector('.ui6-drag-handle,.mobile-queue-grip')){const grip=doc.createElement('span');grip.className='ui6-drag-handle';grip.textContent='⠿';grip.setAttribute('aria-hidden','true');row.prepend(grip);}});}
 progress();}
 const observer=new win.MutationObserver(records=>{if(records.some(r=>r.type==='attributes'&&['queue-panel','player-cover'].includes(r.target.id)||r.type==='childList'&&r.target.matches?.('#queue-panel,.mobile-queue-list'))){update();}});observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','src']});for(const e of ['timeupdate','durationchange','loadedmetadata','seeked'])player.audio.addEventListener(e,progress);for(const e of ['play','playing','pause','ended','emptied','waiting','stalled','error','abort','loadstart','seeking'])player.audio.addEventListener(e,update);win.addEventListener('resize',update);const api={update,progress};views.set(host,api);update();return api;
}
