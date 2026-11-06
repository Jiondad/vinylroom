// QA only: isolated, no external API requests, exact production modules.
import './ui6-qa.mjs';
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base='e61c936185769872d8669cf267813bd163de88d2';
let html=await readFile('out/ui6-qa.html','utf8'),fixture=await readFile('out/ui6-fixture.mjs','utf8');
const rel=(await readFile('out/index.html','utf8')).match(/releases\/([^/]+)\//)[1];
await cp('out/releases/'+rel,'out/ui6b-baseline',{recursive:true});
for(const file of ['reference-ui.js','reference-ui.css'])await writeFile('out/ui6b-baseline/'+file,execFileSync('git',['show',base+':dist/'+file]));
html=html.replace('<button type="button">← 앨범 목록','<button type="button" id="album-page-back">← 앨범 목록');
fixture += `
const proof=document.createElement('output');proof.id='ui6b-proof';proof.hidden=true;document.body.append(proof);
const controls=document.createElement('div');controls.id='ui6b-test-controls';controls.style='position:fixed;top:550px;left:8px;width:190px;z-index:1000;background:#fff';
for(const count of [1,10,100]){const b=document.createElement('button');b.textContent=count+'곡 시험';b.onclick=()=>{player.items=Array.from({length:count},(_,i)=>({album_id:a.id,index:i,title:i===0?'Come Together':'아주 긴 한글 곡명 Long English Title '.repeat(8)+i,artist:'긴 아티스트 이름 Long Artist '.repeat(8),duration:180}));player.index=0;player.loadedItem=player.items[0];update();};controls.append(b);}const toggle=document.createElement('button');toggle.textContent='대기열 열기/닫기 시험';toggle.onclick=()=>host.querySelector('#show-queue').click();controls.append(toggle);const scroll=document.createElement('button');scroll.textContent='페이지 스크롤 시험';scroll.onclick=()=>window.scrollTo(0,100);controls.append(scroll);document.body.append(controls);
const oldUpdate=player.onChange;const record=()=>{proof.textContent=JSON.stringify({index:player.index,current:player.items[player.index]?.title,loaded:player.loadedItem?.title,paused:audio.paused,src:audio.getAttribute('src'),count:player.items.length,calls});};
new MutationObserver(record).observe(host,{childList:true,subtree:true});record();
root.querySelector('#album-page-back').onclick=()=>{calls.push(['back']);record();};
`;
// root back button lives above fixture album body.
fixture=fixture.replace("root.querySelector('#album-page-back').onclick", "document.querySelector('#album-page-back').onclick");
await writeFile('out/ui6-qa.html',html);await writeFile('out/ui6-fixture.mjs',fixture);
await writeFile('out/ui6b-baseline.html',html.replace('./ui6-fixture.mjs','./ui6b-baseline-fixture.mjs'));
await writeFile('out/ui6b-baseline-fixture.mjs',fixture.replaceAll('./releases/'+rel,'./ui6b-baseline'));
for(const [name,w,h,src] of [['ui6b-pc',1448,1086,'ui6-qa.html'],['ui6b-before',1448,1086,'ui6b-baseline.html'],['ui6b-short',1448,500,'ui6-qa.html']])await writeFile('out/'+name+'.html',`<!doctype html><html><head><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}iframe{width:${w}px;height:${h}px;border:0;display:block}</style></head><body><iframe src="${src}" title="Isolated UI6B fixture"></iframe></body></html>`);

await writeFile('out/ui6-fixture.mjs',fixture+`
if(new URLSearchParams(location.search).get('queue')==='closed')host.querySelector('#queue-panel').hidden=true;
if(new URLSearchParams(location.search).has('capture'))controls.hidden=true;
`);
for(const state of ['closed','open'])for(const [tile,x,y] of [['tl',0,0],['tr',-100,0],['bl',0,-200],['br',-100,-200]])await writeFile('out/ui6b-'+state+'-'+tile+'.html',`<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}iframe{position:fixed;left:${x}px;top:${y}px;width:1448px;height:1086px;border:0}</style></head><body><iframe src="ui6-qa.html?queue=${state}&capture=1" title="UI6B 1448x1086 capture fixture"></iframe></body></html>`);
