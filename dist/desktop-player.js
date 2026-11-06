import {playbackDiagnostics} from './playback-diagnostics.js';
import {playbackWindow,seekPlayback} from './mobile-player.js';
const clock=s=>{s=Number.isFinite(s)?Math.max(0,s):0;return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');};
const svg=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
const icons={play:svg('<path d="m9 5 11 7-11 7z"/>'),pause:svg('<path d="M9 5v14m7-14v14" stroke-width="1.6"/>'),previous:svg('<path d="M5 5v14m14-14L8 12l11 7z"/>'),next:svg('<path d="M19 5v14M5 5l11 7-11 7z"/>'),shuffle:svg('<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-2 5-4m2-4c2-3 3-4 5-4h3m-4-4 4 4-4 4"/>'),repeat:svg('<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>'),volume:svg('<path d="M11 4 6 8H2v8h4l5 4zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>')};
export function mountDesktopPlayer(player,host){
 const audio=player.audio,root=document.createElement('div');root.className='desktop-player';
 root.innerHTML='<div class="desktop-transport"><button data-shuffle aria-label="셔플 켜기" aria-pressed="false" title="셔플">'+icons.shuffle+'</button><button data-previous aria-label="이전 곡" title="이전 곡">'+icons.previous+'</button><button class="desktop-toggle" data-toggle aria-label="재생" title="재생">'+icons.play+'</button><button data-next aria-label="다음 곡" title="다음 곡">'+icons.next+'</button><button data-repeat aria-label="반복 꺼짐" aria-pressed="false" title="반복 꺼짐">'+icons.repeat+'<small hidden>1</small></button></div><div class="desktop-timeline"><span data-position>0:00</span><input data-seek type="range" min="0" max="1" value="0" step="0.1" aria-label="재생 위치"><span data-duration>0:00</span></div><div class="desktop-volume"><button data-mute aria-label="음소거" title="음소거">'+icons.volume+'</button><input data-volume type="range" min="0" max="1" step="0.01" aria-label="볼륨"></div>';
 host.querySelector('.player-controls').prepend(root);
 // Keep the original queue button and listener inside the same desktop flex row.
 const queueButton=host.querySelector('#show-queue');if(queueButton)root.querySelector('.desktop-volume').append(queueButton);
 const $=s=>root.querySelector(s),seek=$('[data-seek]'),volume=$('[data-volume]');
 function progress(){const {position,duration}=playbackWindow(player);seek.max=String(duration||1);seek.value=String(position);seek.disabled=!duration;seek.style.setProperty('--progress',(duration?position/duration*100:0)+'%');seek.setAttribute('aria-valuetext',clock(position)+' / '+clock(duration));$('[data-position]').textContent=clock(position);$('[data-duration]').textContent=clock(duration);}
 function update(){const playing=!audio.paused&&!!audio.getAttribute('src'),toggle=$('[data-toggle]');toggle.innerHTML=playing?icons.pause:icons.play;toggle.setAttribute('aria-label',playing?'일시정지':'재생');toggle.title=playing?'일시정지':'재생';toggle.disabled=player.loading||!player.items.length;
  $('[data-shuffle]').setAttribute('aria-pressed',String(player.shuffle));$('[data-shuffle]').setAttribute('aria-label',player.shuffle?'셔플 끄기':'셔플 켜기');
  const repeat=$('[data-repeat]'),label={off:'반복 꺼짐',all:'전체 반복',one:'한 곡 반복'}[player.repeat];repeat.setAttribute('aria-pressed',String(player.repeat!=='off'));repeat.setAttribute('aria-label',label);repeat.title=label;repeat.querySelector('small').hidden=player.repeat!=='one';
  $('[data-previous]').disabled=player.shuffle?!player.history.length:player.index<=0&&player.repeat!=='all';$('[data-next]').disabled=!player.items.length||(!player.shuffle&&player.index+1>=player.items.length&&player.repeat!=='all');
  volume.value=String(audio.volume);volume.style.setProperty('--progress',audio.muted?'0%':audio.volume*100+'%');$('[data-mute]').setAttribute('aria-pressed',String(audio.muted));$('[data-mute]').setAttribute('aria-label',audio.muted?'음소거 해제':'음소거');progress();
 }
 $('[data-toggle]').onclick=async()=>{if(!player.items.length)return;try{if(!audio.getAttribute('src')){const resume=host.querySelector('#resume-playback');if(resume)resume.click();else await player.play(Math.max(0,player.index));}else if(audio.paused){const id=playbackDiagnostics.playPromiseRequested();try{await audio.play();playbackDiagnostics.playPromiseResolved(id);}catch(error){playbackDiagnostics.playPromiseRejected(id,error);throw error;}}else{playbackDiagnostics.requestPause('desktop-player-toggle');audio.pause();}}catch{player.message='재생 버튼을 다시 눌러 주세요.';player.onChange();}update();};
 $('[data-previous]').onclick=()=>player.previous();$('[data-next]').onclick=()=>player.next();
 $('[data-shuffle]').onclick=()=>player.setShuffle(!player.shuffle);$('[data-repeat]').onclick=()=>player.setRepeat({off:'all',all:'one',one:'off'}[player.repeat]);
 $('[data-mute]').onclick=()=>{audio.muted=!audio.muted;};volume.addEventListener('input',()=>{audio.volume=Number(volume.value);audio.muted=false;});seek.addEventListener('input',()=>{seekPlayback(player,seek.value);progress();});
 for(const event of ['timeupdate','durationchange','loadedmetadata','seeked'])audio.addEventListener(event,progress);
 for(const event of ['play','pause','ended','emptied','volumechange'])audio.addEventListener(event,update);
 update();return {update};
}
