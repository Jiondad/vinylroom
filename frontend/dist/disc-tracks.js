// Presentation order only. API track indexes, persisted queues and source tags stay intact.
const positive=value=>{const m=String(value??'').trim().match(/^(\d{1,4})(?:\s*\/\s*\d+)?$/);return m&&Number(m[1])>0?Number(m[1]):null;};
function tag(track,names){for(const name of names){const value=track.raw_tags?.[name];if(value!==undefined){const n=positive(Array.isArray(value)?value[0]:value);if(n)return n;}}return null;}
export function discTrackLayout(tracks){
 let conflict=false;
 let rows=tracks.map((track,index)=>{
  const name=String(track.filename||'').split(/[\\/]/).pop();
  const prefix=name.match(/^(\d{1,2})-(\d{1,3})(?=[\s._]|$)/);
  const compound=String(track.number??'').match(/^(\d{1,2})-(\d{1,3})$/);
  const hint=prefix||compound;
  const td=tag(track,['discnumber','DISCNUMBER','disc','disk']);
  const tn=tag(track,['tracknumber','TRACKNUMBER','track']);
  let disc=td||positive(track.disc),number=tn||positive(track.number);
  if(hint){
   const hd=Number(hint[1]),hn=Number(hint[2]);
   if(hd<1||hn<1)conflict=true;
   else if((disc&&disc!==hd)||(number&&number!==hn))conflict=true;
   else {disc=disc||hd;number=number||hn;}
  }
  if(td&&positive(track.disc)&&td!==positive(track.disc))conflict=true;
  if(tn&&positive(track.number)&&tn!==positive(track.number))conflict=true;
  return {track,index,disc:disc||1,number:number||track.number||index+1,known:!!number&&!!disc,header:false};
 });
 const multi=rows.some(r=>r.disc>=2);
 const complete=rows.every(r=>r.known)&&new Set(rows.map(r=>r.disc+':'+r.number)).size===rows.length;
 const grouped=multi&&complete&&!conflict;
 if(grouped){rows=rows.slice().sort((a,b)=>a.disc-b.disc||a.number-b.number||a.index-b.index);rows.forEach((r,i)=>r.header=i===0||rows[i-1].disc!==r.disc);}
 // Ambiguous albums retain their API order and original display values.
 if(conflict)rows.forEach(r=>{r.number=r.track.number||r.index+1;});
 return {rows,grouped,conflict};
}
