// Presentation-only inline form. All identity, limits, persistence and revision
// checks remain owned by the existing playlists.js callbacks.
export async function mountInlinePlaylist({host,tracks,canSave,load,save,getItems}){
 host.replaceChildren();host.className='queue-inline-form';
 const doc=host.ownerDocument,status=doc.createElement('p');status.setAttribute('role','status');
 try{
  if(!canSave())throw Error('로그인과 관리자 승인이 필요합니다.');
  await load();if(!canSave()||!host.isConnected)return;
  const form=doc.createElement('form'),label=doc.createElement('label'),select=doc.createElement('select');
  label.textContent='저장할 플레이리스트';select.name='id';select.setAttribute('aria-label','저장할 플레이리스트');
  const fresh=doc.createElement('option');fresh.value='';fresh.textContent='새 플레이리스트';select.append(fresh);
  for(const item of getItems()){const option=doc.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}
  label.append(select);const nameLabel=doc.createElement('label');nameLabel.textContent='새 목록 이름';
  const name=doc.createElement('input');name.name='name';name.maxLength=100;name.placeholder='나의 음악';nameLabel.append(name);
  const actions=doc.createElement('div');actions.className='actions';
  const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>host.remove();
  const submit=doc.createElement('button');submit.type='submit';submit.textContent='저장';submit.className='primary';
  actions.append(cancel,submit);form.append(label,nameLabel,actions,status);host.append(form);
  let busy=false;form.onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;submit.disabled=true;cancel.disabled=true;
   try{if(!canSave())throw Error('로그인과 관리자 승인이 필요합니다.');await load();if(!canSave())throw Error('회원 세션을 확인해 주세요.');
    const id=select.value,title=name.value.trim()||'나의 음악',items=getItems();
    if(id&&!items.some(item=>item.id===id))throw Error('저장 대상 목록이 변경됐습니다. 다시 확인해 주세요.');
    const copied=tracks.map(track=>({...track}));
    await save(id?items.map(item=>item.id===id?{...item,tracks:[...item.tracks,...copied]}:item):[...items,{id:crypto.randomUUID(),name:title,tracks:copied}]);
    form.replaceChildren();status.textContent='플레이리스트에 저장했습니다.';form.append(status);const done=doc.createElement('button');done.type='button';done.textContent='닫기';done.onclick=()=>host.remove();form.append(done);
   }catch(error){status.textContent=error.message;submit.disabled=false;cancel.disabled=false;}finally{busy=false;}
  };
 }catch(error){status.textContent=error.message;host.append(status);const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='닫기';cancel.onclick=()=>host.remove();host.append(cancel);}
}
