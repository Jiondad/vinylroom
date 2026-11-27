// Browser port of the existing Phase 2C pure format/number planning contract.
// No filesystem, network, SQL or persistent storage. No apply/writer capability.
const F={artist:'artist',albumartist:'album_artist',album:'album',date:'date',year:'date',discnumber:'discnumber',disc:'discnumber',track:'tracknumber',tracknumber:'tracknumber',title:'title',genre:'genre',featuring:'featuring',dummy:null};
const common=new Set(['album','album_artist','date']);
const norm=s=>String(s).normalize('NFKC').trim().toLowerCase(),base=s=>s.split('/').pop(),parent=s=>s.slice(0,s.lastIndexOf('/')+1),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function parseFormat(fmt,dummy=true){
 if(typeof fmt!=='string'||!fmt||fmt.length>400)throw Error('invalid_format_string');
 // Exact Mp3tag $num(%track%,2) syntax shares the existing two-digit %track% formatter.
 fmt=fmt.replace(/\$num\(\s*%track%\s*,\s*2\s*\)/gi,'%track%');
 if(/\$num\s*\(/i.test(fmt))throw Error('unsupported_num_expression');
 let chunks=[],lit='',seen=new Set();const flush=()=>{if(lit){chunks.push(['lit',lit]);lit='';}};
 for(let i=0;i<fmt.length;){if(fmt[i]!=='%'){lit+=fmt[i++];continue;}if(fmt[i+1]==='%'){lit+='%';i+=2;continue;}const end=fmt.indexOf('%',i+1);if(end<0)throw Error('unclosed_format_placeholder');const name=fmt.slice(i+1,end).toLowerCase();if(!Object.hasOwn(F,name))throw Error('unsupported_placeholder:'+name);if(name==='dummy'&&!dummy)throw Error('dummy_cannot_generate_filename');if(F[name]!=null){if(seen.has(F[name]))throw Error('repeated_output_field:'+F[name]);seen.add(F[name]);}flush();chunks.push(['var',name]);i=end+1;}
 flush();if(!chunks.some(c=>c[0]==='var'))throw Error('pattern_has_no_variables');if(chunks.some((c,i)=>i&&c[0]==='var'&&chunks[i-1][0]==='var'))throw Error('adjacent_variables_ambiguous');return chunks;
}
function piece(name,s){s=s.trim();if(!s||s.includes('\0'))return null;if(['track','tracknumber','disc','discnumber'].includes(name)){if(!/^\d{1,2}$/.test(s)||+s<1||+s>99)return null;return F[name]==='tracknumber'?s.padStart(2,'0'):String(+s);}if(name==='year'&&(!/^\d{4}$/.test(s)||+s<1))return null;if(name==='date'&&!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(s))return null;return s.length<=500?s:null;}
export function extractFormat(filename,fmt){
 const chunks=parseFormat(fmt),name=base(filename),dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,solutions=[];let budget=0;
 function walk(i,pos,captured){if(++budget>20000)throw Error('ambiguous_filename_format');if(solutions.length>1)return;if(i===chunks.length){if(pos===stem.length)solutions.push(captured);return;}const [kind,val]=chunks[i];if(kind==='lit'){if(stem.startsWith(val,pos))walk(i+1,pos+val.length,captured);return;}if(i+1===chunks.length){const p=piece(val,stem.slice(pos));if(p!=null)walk(i+1,stem.length,[...captured,[val,stem.slice(pos),p]]);return;}const sep=chunks[i+1][1];let start=pos+1;while(start<=stem.length){const k=stem.indexOf(sep,start);if(k<0)break;const p=piece(val,stem.slice(pos,k));if(p!=null)walk(i+1,k,[...captured,[val,stem.slice(pos,k),p]]);if(solutions.length>1)break;start=k+1;}}
 walk(0,0,[]);if(!solutions.length)return {state:'UNPARSED',reason:'filename_does_not_match_format'};if(solutions.length>1)return {state:'HOLD',reason:'ambiguous_filename_format'};const fields={},discarded_dummy_parts=[];for(const [name,raw,p]of solutions[0])F[name]==null?discarded_dummy_parts.push(raw.trim()):fields[F[name]]=[p];return {state:'PARSED',fields,discarded_dummy_parts};
}
const component=v=>{const m=/^0*(\d{1,2})(?:\s*\/\s*\d{1,3})?$/.exec(String(v?.[0]||'').trim());return m&&+m[1]>=1&&+m[1]<=99?+m[1]:null;};
const track=(n,old)=>String(n).padStart(2,'0')+(String(old||'').trim().match(/^0*\d{1,2}(\s*\/\s*\d{1,3})$/)?.[1]||'').replaceAll(' ','');
export function renderFormat(fmt,tags){let out='';for(const [kind,name]of parseFormat(fmt,false)){if(kind==='lit'){out+=name;continue;}const f=F[name],v=tags[f];if(!v?.length)throw Error('missing_tag_for_format:'+f);if(['tracknumber','discnumber'].includes(f)){const n=component(v);if(n==null)throw Error('invalid_'+f+'_for_filename');out+=f==='tracknumber'?String(n).padStart(2,'0'):n;}else if(name==='year'){const m=/^\d{4}/.exec(v[0]);if(!m)throw Error('missing_year_for_filename');out+=m[0];}else if(['genre','featuring'].includes(f))out+=v.join(', ');else{if(v.length>1)throw Error('multivalue_field_for_filename:'+f);out+=v[0];}}
 out=out.replace(/[\\/\x00-\x1f<>:"|?*]/g,'').trim();if(!out||['.','..'].includes(out)||out.endsWith('.')||out.length>220)throw Error('unsafe_rendered_filename');if(['con','prn','aux','nul','com1','com2','lpt1','lpt2'].includes(norm(out.split('.')[0])))throw Error('reserved_filename');return out;}
export function previewPlan(data){
 const {entries,selected,mode,format:fmt,replace,start=1,order='filename'}=data||{};
 if(!Array.isArray(entries)||!entries.length||entries.length>120||!Array.isArray(selected)||!selected.length)throw Error('선택 범위를 확인하세요.');
 if(new Set(entries.map(e=>e.file)).size!==entries.length||selected.some(f=>!entries.some(e=>e.file===f)))throw Error('선택 범위가 현재 앨범을 벗어났습니다.');
 const chosen=entries.filter(e=>selected.includes(e.file)),rows=[];let fatal=false;
 if(mode==='number'&&(!Number.isInteger(start)||start<1||start>99))throw Error('시작 번호는 1~99입니다.');
 if(mode==='from')parseFormat(fmt);if(mode==='to')parseFormat(fmt,false);
 const disc=e=>component(e.tags.discnumber)||+(e.file.match(/\/(?:CD|DISC|DISK)[\s._-]*(\d{1,2})\//i)?.[1]||0)||1;
 if(!['filename','display'].includes(order))throw Error('unsupported_track_order');
 const ordered=order==='display'?chosen:[...chosen].sort((a,b)=>base(a.file).localeCompare(base(b.file),'en',{numeric:true})),counts=new Map();
 for(const e of ordered){const row={file:e.file,changes:{},state:'NO_CHANGE'};try{
  if(mode==='from'){const r=extractFormat(e.file,fmt);Object.assign(row,r,{parsed_fields:r.fields});row.changes={};row.skipped={};if(r.state==='PARSED'){for(const [f,after]of Object.entries(r.fields)){const before=e.tags[f]||[];if(common.has(f)){row.skipped[f]='album_common_editor_only';continue;}if(same(before,after))continue;if(f==='artist'&&before.some(v=>v.includes('\\'))){row.skipped[f]='joint_artist_backslash_protected';continue;}if(before.length&&!replace){row.skipped[f]='existing_value_preserved';continue;}if(f==='tracknumber'&&before.length&&component(before)===+after[0]){row.skipped[f]='use_normalize_tracknumbers_for_existing_format';continue;}row.changes[f]={before,after};}row.state=Object.keys(row.changes).length?'PROPOSED':'NO_CHANGE';}}
  else if(mode==='to'){const name=base(e.file),ext=name.includes('.')?name.slice(name.lastIndexOf('.')):'',dest=renderFormat(fmt,e.tags)+ext;row.current_file_name=name;row.suggested_file_name=dest;row.state=name===dest?'NO_CHANGE':'RENAME_PROPOSED';}
  else if(mode==='normalize'){const before=e.tags.tracknumber||[],n=component(before);if(n==null)throw Error('missing_or_invalid_tracknumber');row.before=before;row.after=[track(n,before[0])];row.state=same(before,row.after)?'NO_CHANGE':'PROPOSED';}
  else if(mode==='number'){const d=disc(e),n=(counts.get(d)??(start-1))+1;counts.set(d,n);if(n>99)throw Error('more_than_99_tracks_in_disc');const before=e.tags.tracknumber||[],after=[track(n,before[0])];if(!same(before,after))row.changes.tracknumber={before,after};if(d!==1&&!same(e.tags.discnumber,[String(d)]))row.changes.discnumber={before:e.tags.discnumber||[],after:[String(d)]};row.state=Object.keys(row.changes).length?'PROPOSED':'NO_CHANGE';}
  else throw Error('지원되지 않는 미리보기');
 }catch(ex){row.state='HOLD';row.reason=ex.message;}rows.push(row);}
 if(mode==='to'){
  const targets=new Map();for(const row of rows){if(row.state==='HOLD'){fatal=true;continue;}const dest=norm(parent(row.file)+row.suggested_file_name);if(targets.has(dest)||entries.some(e=>e.file!==row.file&&norm(e.file)===dest)){row.reason='destination_currently_exists';fatal=true;}targets.set(dest,row.file);}if(fatal)for(const r of rows){r.state='HOLD';r.reason||='unsafe_filename_format';}
 }
 if(['number','normalize'].includes(mode)){
  const used=new Map();for(const e of entries){const row=rows.find(r=>r.file===e.file),d=+(row?.changes.discnumber?.after?.[0]||disc(e)),n=component(row?.changes.tracknumber?.after||row?.after||e.tags.tracknumber);if(n){const key=d+':'+n;if(used.has(key)){for(const r of rows)if([used.get(key),e.file].includes(r.file)){r.state='HOLD';r.reason='duplicate_track_number_on_disc';}}used.set(key,e.file);}}
 }
 return {rows,preview_only:true,apply_supported:false,db_writes:0,media_writes:0,rename_operations:0};
}
