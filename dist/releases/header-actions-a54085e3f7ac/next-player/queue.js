// Queue policy is independent of media, DOM, authentication and network I/O.
export class QueueModel {
 constructor(random=Math.random){this.items=[];this.index=-1;this.shuffle=false;this.repeat='off';this.shuffleBag=[];this.history=[];this.random=random;this.nextChoice=undefined;}
 changed(){this.nextChoice=undefined;this.onQueueChange?.();this.notify?.();}
 add(items){if(this.disposed)return;const first=this.items.length;this.items.push(...items);if(this.shuffle)this.shuffleBag.push(...items.map((_,i)=>first+i));this.changed();}
 move(from,to){
  if(this.disposed||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=this.items.length||to>=this.items.length||from===to)return false;
  const remap=i=>i===from?to:from<to&&i>from&&i<=to?i-1:from>to&&i>=to&&i<from?i+1:i;
  const [item]=this.items.splice(from,1);this.items.splice(to,0,item);this.index=remap(this.index);this.history=this.history.map(remap);this.shuffleBag=this.shuffleBag.map(remap);this.changed();return true;
 }
 setShuffle(value){if(this.disposed)return;this.shuffle=!!value;this.shuffleBag=this.items.map((_,i)=>i).filter(i=>i!==this.index);this.history=[];this.changed();}
 setRepeat(value){if(!this.disposed&&['off','all','one'].includes(value)){this.repeat=value;this.changed();}}
 peekNextIndex(){
  if(this.nextChoice!==undefined)return this.nextChoice;
  let next=null;
  if(this.shuffle){
   this.shuffleBag=this.shuffleBag.filter(i=>i>=0&&i<this.items.length&&i!==this.index);
   if(!this.shuffleBag.length&&this.repeat==='all')this.shuffleBag=this.items.map((_,i)=>i).filter(i=>i!==this.index);
   if(this.shuffleBag.length)next=this.shuffleBag[Math.floor(this.random()*this.shuffleBag.length)];
   else if(this.repeat==='all'&&this.items.length===1)next=0;
  }else next=this.index+1<this.items.length?this.index+1:this.repeat==='all'&&this.items.length?0:null;
  this.nextChoice=next;return next;
 }
}
