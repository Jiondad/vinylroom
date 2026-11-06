/** Vinyl Room LRC parsing and playback matching. No network or writes. */
export function parseTimedLyrics(raw){
 const text=String(raw??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 let offset=0;
 for(const line of text.split('\n')){const m=/^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i.exec(line);if(m)offset=Number(m[1])/1000;}
 const cues=[];
 for(const line of text.split('\n')){
  const matches=[...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
  const lyric=line.replace(/\[(\d{1,3}):(\d{2})(?:[.:]\d{1,3})?\]/g,'').trim();
  for(const m of matches){if(Number(m[2])>59)continue;cues.push({time:Math.max(0,Number(m[1])*60+Number(m[2])+Number((m[3]||'').padEnd(3,'0'))/1000+offset),text:lyric});}
 }
 cues.sort((a,b)=>a.time-b.time);
 return {timed:cues.length>0,cues,text:text.trim()};
}
export function activeCueIndex(cues,seconds){
 if(!cues?.length||!Number.isFinite(seconds))return -1;
 let lo=0,hi=cues.length;while(lo<hi){const mid=(lo+hi)>>1;if(cues[mid].time<=seconds)lo=mid+1;else hi=mid;}return lo-1;
}
export function matchesLyricTrack(item,target){
 if(!item||!target)return false;
 if(target.top100_folder)return item.top100_folder===target.top100_folder&&Number(item.top100_rank)===Number(target.top100_rank);
 return item.album_id===target.album_id&&Number(item.index)===Number(target.index);
}
export function lyricPosition(player){return player?.audio?Math.max(0,Number(player.audio.currentTime)-(Number(player.start)||0)):NaN;}

