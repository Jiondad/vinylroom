// Network-free QA only. Reuse real album/player/queue views and drag handlers.
import './ui6-qa.mjs';
import {readFile,writeFile,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base='818d4b3c9a31d4f7c2f058b518d027ad526d0815';
const html=await readFile('out/ui6-qa.html','utf8');let fixture=await readFile('out/ui6-fixture.mjs','utf8');
fixture+=`\nconst qaTools=document.createElement('div');qaTools.id='layout-qa-tools';qaTools.style='position:fixed;top:0;left:0;z-index:20000;background:#fff';
for(const [name,action] of [['닫힘',()=>{host.querySelector('#queue-panel').hidden=true;}],['열림',()=>{host.querySelector('#queue-panel').hidden=false;}],['100곡',()=>{player.items=Array.from({length:100},(_,i)=>({...player.items[0],title:'긴 곡명 Long song title '.repeat(12)+i,artist:'아티스트 Long artist '.repeat(10),index:i}));player.loadedItem=player.items[player.index];update();}],['스크롤',()=>window.scrollTo(0,180)],['미재생',()=>{host.hidden=true;}],['재생바',()=>{host.hidden=false;}],['캡처',()=>qaTools.hidden=true]]){const b=document.createElement('button');b.textContent='QA '+name;b.onclick=action;qaTools.append(b);}document.body.append(qaTools);host.querySelector('#queue-panel').hidden=true;\n`;
await writeFile('out/layout-fixture.mjs',fixture);
await writeFile('out/layout.html',html.replace('./ui6-fixture.mjs','./layout-fixture.mjs'));
const rel=fixture.match(/releases\/([^/]+)\//)[1];await cp('out/releases/'+rel,'out/layout-baseline',{recursive:true});
for(const name of ['style.css','reference-ui.css','reference-ui.js'])await writeFile('out/layout-baseline/'+name,execFileSync('git',['show',base+':dist/'+name]));
await writeFile('out/layout-before.html',html.replaceAll('releases/'+rel,'layout-baseline').replace('href="style.css?', 'href="layout-baseline/style.css?').replace('./ui6-fixture.mjs','./layout-before.mjs'));
await writeFile('out/layout-before.mjs',fixture.replaceAll('./releases/'+rel,'./layout-baseline'));
for(const [w,h] of [[1448,1086],[1280,900],[1100,844],[768,844],[390,844],[360,844],[1448,600]])for(const before of [false,true]){
 const scale=w>=1100?.78:1;
 await writeFile('out/layout-'+w+'-'+h+(before?'-before':'')+'.html',`<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}iframe{width:${w}px;height:${h}px;border:0;transform:scale(${scale});transform-origin:top left}</style></head><body><iframe src="layout${before?'-before':''}.html" title="Synthetic layout fixture"></iframe></body></html>`);
}
console.log('Layout fixture generated; no live API or audio stream');
