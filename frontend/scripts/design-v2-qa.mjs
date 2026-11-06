// DESIGN_LOCK: VINYL_ROOM_V2_0_20261030. QA-only, actual source templates/components.
import './ui6-qa.mjs';
import {readFile,writeFile,copyFile,cp} from 'node:fs/promises';
const app=await readFile('dist/app-index.js','utf8');
const release=(await readFile('out/index.html','utf8')).match(/releases\/([^/]+)\/entry.js/)[1];
const grid=app.split('\n').find(s=>s.includes('html+=`<div class="grid">')).trim().slice('html+='.length,-1);
const random=app.split('\n').find(s=>s.includes('html+=`<div class="random-grid">')).trim().slice('html+='.length,-1);
const append=`
import {installButtonSystem} from './releases/${release}/button-system.js';
import './releases/${release}/admin-ai-confidence-v2.js';
const qaView=new URLSearchParams(location.search).get('view')||'album';
if(qaView!=='album'){
 document.body.classList.remove('album-page-open');root.hidden=true;root.style.display='none';host.querySelector('#queue-panel').hidden=true;
 const main=document.querySelector('main');main.style.display='block';
 const intro=document.createElement('section');intro.className='intro';intro.innerHTML='<h1 id="page-title"></h1>';main.append(intro);
 intro.querySelector('h1').textContent={grid:"Today's Albums",random:'Random100',admin:'관리자 v2 · 합성 구성요소'}[qaView]||qaView;
 const content=document.createElement('section');content.id='content';main.append(content);
 const result={items:Array.from({length:20},(_,i)=>({...a,title:i%2?'긴 앨범 제목 한글과 English Album Name '+i:a.title,title2:a.title,album_id:a.id,album_title:a.title,track_index:i}))};
 if(qaView==='grid'){document.body.classList.add('home-view');content.innerHTML=${grid};}
 if(qaView==='random'){document.body.classList.add('random-view');result.items=result.items.map((x,i)=>({...x,title:titles[i%titles.length]}));content.innerHTML=${random};}
 if(qaView==='admin'){
  const link=document.createElement('link');link.rel='stylesheet';link.href='./releases/${release}/admin-ai-confidence-v2.css';document.head.append(link);
  const view=window.VinylRoomConfidenceV2.mount(content,{isAdmin:()=>true});
  view.setRows([{album_id:a.id,artist:a.artist,title:a.title,field:'genre',before:'',candidate:'Rock',status:'BLOCK',evidence:[],blockers:['합성 QA 자료 · 운영 제안 아님']}],'local');
 }
}
${app.split("\n").find(s=>s.startsWith("for(const [selector,label]"))}
installButtonSystem();
`;
let fixture=(await readFile('out/ui6-fixture.mjs','utf8')).replace('items:[0,1,2,3,4].map(i=>','items:Array.from({length:20},(_,i)=>').replace('title:titles[i],artist:a.artist,duration:seconds[i]','title:titles[i%titles.length],artist:a.artist,duration:seconds[i%seconds.length]');
fixture+=append+`
import {mountInlinePlaylist} from './releases/${release}/playlist-inline.js';
let fixtureLists=[];
window.addEventListener('save-playlist-tracks',e=>{
 if(e.detail?.inlineHost) void mountInlinePlaylist({host:e.detail.inlineHost,tracks:e.detail.tracks,canSave:()=>true,load:async()=>{},save:async next=>{fixtureLists=next;calls.push(['inline-save',next.length]);document.body.dataset.qaInlineSaved=String(next.length)},getItems:()=>fixtureLists});
});
`;
fixture+=`\nimport './probe.js';\n`;
await writeFile('out/ui6-fixture.mjs',fixture);
await copyFile('qa/ui-v2/probe.js','out/probe.js');
let qaHTML=await readFile('out/ui6-qa.html','utf8');
qaHTML=qaHTML.replace('<head>',`<head><script>if(!crypto.randomUUID)crypto.randomUUID=()=> '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));</script>`);
await writeFile('out/ui6-qa.html',qaHTML);
// Immutable v200 reference assets captured before editing.
await cp('qa/ui-v2/before','out/qa-before',{recursive:true});
await copyFile('qa/ui-v2/probe.js','out/qa-before/probe.js');
let baseline=await readFile('qa/ui-v2/before/ui6-fixture.mjs','utf8');
baseline=baseline.slice(0,baseline.lastIndexOf("\nimport {installButtonSystem}"))+append.replaceAll('./releases/'+release,'./releases/'+release)+"\nimport './probe.js';\n";
await writeFile('out/qa-before/ui6-fixture.mjs',baseline);
const frame=`<!doctype html><meta charset="utf-8"><title>Vinyl Room isolated source QA</title><style>body{margin:0;font:12px sans-serif;background:#ddd}nav{height:44px;display:flex;gap:8px;align-items:center}iframe{display:block;border:0;background:white}</style><nav>실제 소스 구성요소 · 합성 자료 · 운영 인증/음원 없음 <select id="version" aria-label="비교 버전"><option value="after">후보</option><option value="before">v200 기준</option></select><select id="view" aria-label="검증 화면"><option value="album">앨범 상세</option><option value="grid">Today's Albums</option><option value="random">Random100</option><option value="admin">관리자 v2 합성</option></select><select id="size" aria-label="검증 화면 크기">${['1440x900','1024x768','768x1024','600x900','390x844','360x800','320x720'].map(x=>'<option>'+x+'</option>').join('')}</select><button id="measure">계측</button></nav><iframe id="screen" title="실제 소스 격리 구성요소" width="1440" height="900" src="ui6-qa.html"></iframe><script>const f=document.getElementById('screen');size.onchange=()=>{const [w,h]=size.value.split('x');f.width=w;f.height=h;};function show(){f.src=(version.value==='before'?'qa-before/':'')+'ui6-qa.html?view='+view.value;}version.onchange=show;view.onchange=show;measure.onclick=()=>f.contentWindow.postMessage({vrV2Measure:true},location.origin);</script>`;
await writeFile('out/qa-frame.html',frame);
console.log('UI v2 isolated source QA prepared');
