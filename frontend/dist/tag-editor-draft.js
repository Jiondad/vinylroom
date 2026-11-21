// Browser-only draft operations. Reuses Phase 2C conversion/number calculations unchanged.
import {previewPlan} from './tag-editor-plan.js?v=20261122-row-ux';
const clone=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const fields={title:'TITLE',artist:'ARTIST',featuring:'FEATURING',genre:'GENRE',tracknumber:'TRACKNUMBER',discnumber:'DISCNUMBER',album:'ALBUM',album_artist:'ALBUMARTIST',date:'DATE'};
export const values=(e,f)=>(e?.tags?.[f]||[]).join(' | ');
export function applyBulkDraft({entries,selected,scope,field,value='',replace=false,format='',start=1,order='filename'}){
 if(!Array.isArray(entries)||entries.length>120||!['selected','album'].includes(scope))throw Error('현재 앨범과 범위를 확인하세요.');
 if(field==='title'&&scope!=='selected')throw Error('TITLE 공통 변경은 선택 트랙에서만 가능합니다.');
 const ids=scope==='album'?entries.map(e=>e.file):selected;
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>!entries.some(e=>e.file===id)))throw Error('변경할 트랙을 선택하세요.');
 const output=clone(entries),renames={},warnings={},changed=new Set();
 if(['from','to','number','normalize'].includes(field)){
  const plan=previewPlan({entries,selected:ids,mode:field,format,replace,start,order});
  for(const row of plan.rows||[]){
   if(['HOLD','UNPARSED'].includes(row.state)){warnings[row.file]=row.reason;continue;}
   const e=output.find(e=>e.file===row.file),updates=clone(row.changes||{});
   if(field==='normalize'&&row.after&&!same(e.tags.tracknumber||[],row.after))updates.tracknumber={after:row.after};
   for(const [f,c] of Object.entries(updates)){if(field==='number'&&!replace&&(e.tags[f]||[]).length){warnings[row.file]='existing_value_preserved';continue;}e.tags[f]=clone(c.after);changed.add(e.file);}
   if(row.state==='RENAME_PROPOSED'){renames[row.file]=row.suggested_file_name;changed.add(e.file);}
   if(Object.values(row.skipped||{}).length)warnings[row.file]=[...new Set(Object.values(row.skipped))].join(', ');
  }
 }else{
  if(!Object.hasOwn(fields,field)||field==='tracknumber')throw Error('지원하지 않는 일괄 필드');
  const v=value.trim();if(v.includes('\0')||v.length>1000)throw Error('값을 확인하세요.');
  if(field==='discnumber'&&v&&!/^(?:[1-9]|[1-9]\d|0[1-9])$/.test(v))throw Error('디스크 번호는 01~99입니다.');
  if(field==='date'&&v&&!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(v))throw Error('DATE는 YYYY 또는 YYYY-MM-DD 형식입니다.');
  const after=v?(['genre','featuring'].includes(field)?[...new Set(v.split(/\s*\|\s*/).filter(Boolean))]:[field==='discnumber'?String(+v):v]):[];
  for(const e of output){if(!ids.includes(e.file))continue;const before=e.tags[field]||[];
   if(['artist','album_artist'].includes(field)&&before.some(v=>v.includes('\\'))&&!same(before,after)){warnings[e.file]='joint_artist_backslash_protected';continue;}
   if(before.length&&!replace&&!same(before,after)){warnings[e.file]='existing_value_preserved';continue;}
   if(!same(before,after)){e.tags[field]=clone(after);changed.add(e.file);}
  }
 }
 return {entries:output,renames,warnings,changed:changed.size,preview_only:true};
}
// Selection tickets reject a late result without clearing the tree or replacing the editor.
export function selectionGate(){let version=0;return {next:()=>++version,current:ticket=>ticket===version};}
