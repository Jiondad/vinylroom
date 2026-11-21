const frame=document.querySelector('#editorFrame'),channel='row-ux-demo-only',uid='11111111-1111-4111-8111-111111111111',uid2='22222222-2222-4222-8222-222222222222';
const entries=Array.from({length:28},(_,i)=>({file:`KPOP/Test/Album/CD${i<14?1:2}/${String(14-i%14).padStart(2,'0')} 매우 긴 파일명 Long filename ${i+1}.${i%2?'flac':'mp3'}`,tags:{title:[`제목 ${i+1}`],artist:['Test Artist'],album:['Test Album'],album_artist:['Test Artist'],date:['2026'],discnumber:[i<14?'1':'2'],tracknumber:[],featuring:[],genre:['Rock','Pop']}}));
const calls=[];
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin)return;const m=e.data;
 if(m.type==='vr-tag-ready'){frame.contentWindow.postMessage({type:'vr-tag-init',channel,preview:true},location.origin);return;}
 if(m.type!=='vr-tag-read')return;calls.push(m.url);const url=new URL(m.url,location.origin);let result;
 if(url.pathname==='/api/save-capabilities')result={state:'TAG_EDITOR_SAVE_CAPABILITIES',version:'tag-editor-save-v1',tags:false,cover:false,rename:false,tag_fields:[]};
 else if(url.pathname==='/api/folders'){const path=url.searchParams.get('path')||'';result={items:path===''?[{id:'KPOP',name:'KPOP'}]:path==='KPOP'?[{id:'KPOP/Test',name:'Test Artist'}]:[]};}
 else if(url.pathname==='/api/albums')result={items:[{id:uid,artist:'Test Artist',title:'2CD 합성 앨범',date:'2026',relative_path:'KPOP/Test/Album'},{id:uid2,artist:'Test Artist',title:'다른 합성 앨범',date:'2026',relative_path:'KPOP/Test/Other'}]};
 else if(url.pathname==='/api/tracks'){const id=url.searchParams.get('album');result={album:{id,artist:'Test Artist',title:'2CD 합성 앨범',date:'2026',path:'KPOP/Test/Album',entries:structuredClone(id===uid?entries:entries.slice(0,1)),count:id===uid?28:1}};}
 else if(url.pathname.startsWith('/api/cover/'))result={state:'HOLD',reason:'DEMO_NO_NAS'};
 else throw Error('Unexpected route '+m.url);
 frame.contentWindow.postMessage({type:'vr-tag-result',channel,id:m.id,result,metrics:{nas_requests:0,nas_wait_ms:0}},location.origin);
});
const pause=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
async function wait(test){for(let i=0;i<120;i++){if(test())return;await new Promise(r=>setTimeout(r,15));}throw Error('DOM wait timed out');}
const d=()=>frame.contentDocument,q=s=>d().querySelector(s),rows=()=>[...d().querySelectorAll('#tracks [data-track]')],selected=()=>rows().filter(r=>r.getAttribute('aria-selected')==='true');
const click=(el,mods={})=>{if(!el)throw Error('missing element');el.dispatchEvent(new frame.contentWindow.MouseEvent('click',{bubbles:true,cancelable:true,...mods}));};
const key=(el,k,mods={})=>el.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true,...mods}));
const change=(el,value)=>{el.value=value;el.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));};
const report=document.querySelector('#results');let results=[];
function check(name,pass,detail){if(!pass)throw Error(name+' '+JSON.stringify(detail));results.push({name,status:'PASS',...(detail?{detail}:{} )});}
async function load(){await wait(()=>q('[data-folder="KPOP"]'));click(q('[data-folder="KPOP"]'));await wait(()=>q('[data-folder="KPOP/Test"]'));click(q('[data-folder="KPOP/Test"]'));await wait(()=>q(`[data-album="${uid}"]`));click(q(`[data-album="${uid}"]`));await wait(()=>rows().length===28);}
function cell(i,f){return rows()[i].querySelector(`[data-field="${f}"]`);}
async function measure(width){frame.style.width=width+'px';await pause();const doc=d().documentElement;return {width,scrollWidth:doc.scrollWidth,clientWidth:doc.clientWidth,row:rows()[0].getBoundingClientRect().height,coverTop:q('#albumHeader').getBoundingClientRect().top,innerScrollContainers:[...d().querySelectorAll('.browser,#navigation,.table-scroll')].filter(e=>['auto','scroll'].includes(frame.contentWindow.getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight).length};}
async function run(){results=[];try{
 if(rows().length!==28)await load();
 check('New album starts with no selected rows',selected().length===0);
 const initial=await measure(1366);check('PC unmodified row 32–36 px',initial.row>=32&&initial.row<=36,initial);
 check('No repeated format subtitle',!q('#tracks').textContent.includes('실제 파일')&&!q('.file-meta'));
 click(rows()[0].querySelector('.filename'));check('Plain row click selects one',selected().length===1&&selected()[0]===rows()[0]);
 click(cell(13,'title'),{shiftKey:true});check('Shift range follows visible rows',selected().length===14);
 click(q('[data-tool="number"]'));change(q('#bulkPolicy'),'replace');q('#numberDisc').checked=true;q('#discValue').value='1';click(q('#bulkApply'));
 check('CD1 numbered in screen order, not filename sort',rows().slice(0,14).every((r,i)=>r.querySelector('[data-field="tracknumber"]').value===String(i+1).padStart(2,'0')));
 check('Unselected CD2 unchanged',rows().slice(14).every(r=>r.querySelector('[data-field="tracknumber"]').value===''));
 click(rows()[14].querySelector('.filename'));check('Next disc plain click clears previous selection',selected().length===1&&selected()[0]===rows()[14]);
 click(rows()[27].querySelector('.filename'),{shiftKey:true});q('#discValue').value='2';click(q('#bulkApply'));
 check('CD2 gets independent 01–14; CD1 draft retained',rows().every((r,i)=>r.querySelector('[data-field="tracknumber"]').value===String(i%14+1).padStart(2,'0')));
 click(rows()[0].querySelector('.filename'),{ctrlKey:true});check('Ctrl adds row',selected().length===15);click(rows()[0].querySelector('.filename'),{ctrlKey:true});check('Ctrl removes row',selected().length===14);
 click(rows()[0].querySelector('.filename'),{metaKey:true});check('Command adds row',selected().length===15);
 key(rows()[0],'a',{ctrlKey:true});check('Ctrl+A selects album',selected().length===28);
 click(rows()[3].querySelector('.filename'));key(rows()[3],'a',{metaKey:true});check('Command+A selects album',selected().length===28);
 click(rows()[0].querySelector('.path-open'));check('Path popup does not alter selection',q('#pathDialog').open&&selected().length===28);click(q('#closePath'));
 click(rows()[2].querySelector('.filename'));click(cell(2,'title'));check('Selected cell enters edit without resetting selection',!cell(2,'title').readOnly&&selected().length===1);
 key(cell(2,'title'),'a',{ctrlKey:true});check('Ctrl+A in editable field stays local',selected().length===1);change(cell(2,'title'),'수정 제목');check('Inline edit draft visible',cell(2,'title').value==='수정 제목');
 click(q('[data-tool="tags"]'));click(rows()[4].querySelector('.filename'));q('#discValue').value='3';change(q('#bulkPolicy'),'replace');click(q('#discApply'));
 check('Dedicated DISCNUMBER applies only selected row',rows()[4].textContent.includes('DISCNUMBER: 1 → 3')&&!rows()[3].textContent.includes('DISCNUMBER: 1 → 3'));
 click(q('[data-tool="number"]'));check('Changing tools retains previous numbered draft',rows().every((r,i)=>r.querySelector('[data-field="tracknumber"]').value===String(i%14+1).padStart(2,'0'))&&cell(2,'title').value==='수정 제목');
 q('#missingOnly').checked=true;q('#missingOnly').dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));check('Filter clears selection but retains draft',selected().length===0&&cell(2,'title').value==='수정 제목');
 click(q(`[data-album="${uid2}"]`));await wait(()=>rows().length===1);check('Album switch clears selection',selected().length===0);click(q(`[data-album="${uid}"]`));await wait(()=>rows().length===28);check('Returning to album restores draft without selection',selected().length===0&&cell(2,'title').value==='수정 제목');
 click(rows()[0].querySelector('.filename'));const before=rows()[0].textContent;q('#discValue').value='0';click(q('#discApply'));check('Invalid DISCNUMBER leaves draft unchanged',rows()[0].textContent===before);
 for(const width of [1920,1366,390]){const m=await measure(width);check('Responsive layout '+width+'px',m.scrollWidth<=m.clientWidth+1&&m.innerScrollContainers===0,m);}
 click(rows()[0].querySelector('.filename'));check('Mobile row tap selects one',selected().length===1);check('Five tools and cover popup remain available',d().querySelectorAll('[data-tool]').length===5);click(q('[data-tool="cover"]'));check('Cover popup opens without a save call',q('#tagCoverDialog').open);q('#tagCoverDialog').close();check('Save capability stays OFF in DEMO',q('#saveTags').disabled&&calls.every(u=>!u.includes('/apply')));
 report.textContent=JSON.stringify({status:'PASS',pass:results.length,results,actual_nas_calls:0,operating_writes:0,save_calls:0},null,2);window.rowUxResult={status:'PASS',results};
 }catch(e){report.textContent=JSON.stringify({status:'FAIL',error:e.message,results},null,2);window.rowUxResult={status:'FAIL',error:e.message,results};}}
document.querySelector('#run').onclick=run;document.querySelector('#pc').onclick=()=>frame.style.width='1366px';document.querySelector('#mobile').onclick=()=>frame.style.width='390px';

frame.addEventListener('load',()=>{const shell=frame.contentDocument.querySelector('.shell');if(shell){new ResizeObserver(()=>{frame.style.height=Math.ceil(shell.getBoundingClientRect().height)+2+'px';}).observe(shell);}});

frame.addEventListener('load',()=>frame.contentDocument.addEventListener('click',e=>{if(e.target.closest('[data-track]'))document.querySelector('#eventLog').textContent=JSON.stringify({shift:e.shiftKey,ctrl:e.ctrlKey,meta:e.metaKey,selected:frame.contentDocument.querySelectorAll('[data-track][aria-selected="true"]').length});}));
frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'vr-tag-init',channel,preview:true},location.origin));
if(frame.contentDocument?.readyState==='complete')frame.contentWindow.postMessage({type:'vr-tag-init',channel,preview:true},location.origin);
