const rowFor=(target,list)=>target?.closest?.('li[data-queue-index]')?.parentElement===list?target.closest('li[data-queue-index]'):null;

// Desktop uses native drag-and-drop. Touch devices use a hold threshold so
// ordinary vertical scrolling remains available until the user starts dragging.
export function bindQueueReordering(list,player,{document:doc=globalThis.document,longPressMs=420}={}){
 if(!list||list.dataset?.queueReorderBound||list.queueReorderBound)return;
 if(list.dataset)list.dataset.queueReorderBound='true';else list.queueReorderBound=true;
 let from=null,held=null,timer=null,startX=0,startY=0,touchId=null,suppressClickUntil=0;
 const clear=()=>{if(timer!==null)clearTimeout(timer);timer=null;list.querySelectorAll('.queue-dragging,.queue-drop-target').forEach(row=>row.classList.remove('queue-dragging','queue-drop-target'));held=null;touchId=null;};
 const indicate=target=>{list.querySelectorAll('.queue-drop-target').forEach(row=>row.classList.remove('queue-drop-target'));if(target&&target!==held)target.classList.add('queue-drop-target');};
 list.addEventListener('dragstart',event=>{
  const row=rowFor(event.target,list);if(!row||event.target.closest('[data-queue-remove]')){event.preventDefault();return;}
  from=Number(row.dataset.queueIndex);held=row;row.classList.add('queue-dragging');
  if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(from));}
 });
 list.addEventListener('dragover',event=>{if(from===null)return;const row=rowFor(event.target,list);if(row){event.preventDefault();indicate(row);if(event.dataTransfer)event.dataTransfer.dropEffect='move';}});
 list.addEventListener('drop',event=>{if(from===null)return;const row=rowFor(event.target,list);if(!row)return;event.preventDefault();player.move(from,Number(row.dataset.queueIndex));from=null;clear();});
 list.addEventListener('dragend',()=>{from=null;clear();});
 list.addEventListener('touchstart',event=>{
  if(event.touches.length!==1||event.target.closest('[data-queue-remove]'))return;
  const row=rowFor(event.target,list);if(!row)return;
  const touch=event.touches[0];from=Number(row.dataset.queueIndex);startX=touch.clientX;startY=touch.clientY;touchId=touch.identifier;
  timer=setTimeout(()=>{timer=null;held=row;row.classList.add('queue-dragging');suppressClickUntil=Date.now()+700;},longPressMs);
 },{passive:true});
 list.addEventListener('touchmove',event=>{
  const touch=[...event.changedTouches].find(item=>item.identifier===touchId);if(!touch)return;
  if(timer!==null&&Math.hypot(touch.clientX-startX,touch.clientY-startY)>10){clearTimeout(timer);timer=null;from=null;touchId=null;return;}
  if(!held)return;
  event.preventDefault();const target=rowFor(doc.elementFromPoint?.(touch.clientX,touch.clientY)||event.target,list);indicate(target);
 },{passive:false});
 list.addEventListener('touchend',event=>{
  if(![...event.changedTouches].some(item=>item.identifier===touchId))return;
  const touch=[...event.changedTouches].find(item=>item.identifier===touchId);
  if(held){const target=rowFor(doc.elementFromPoint?.(touch.clientX,touch.clientY)||event.target,list);if(target)player.move(from,Number(target.dataset.queueIndex));suppressClickUntil=Date.now()+700;}
  from=null;clear();
 });
 list.addEventListener('touchcancel',()=>{from=null;clear();});
 list.addEventListener('click',event=>{if(Date.now()>suppressClickUntil)return;if(rowFor(event.target,list)){event.preventDefault();event.stopImmediatePropagation();suppressClickUntil=0;}},true);
 list.addEventListener('contextmenu',event=>{if(held)event.preventDefault();});
}
