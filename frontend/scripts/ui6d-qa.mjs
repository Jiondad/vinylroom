// Production template/module reuse. Isolated fixtures: external fetch disabled.
import './ui6-qa.mjs';import {readFile,writeFile} from 'node:fs/promises';
const html=await readFile('out/ui6-qa.html','utf8'),fixture=await readFile('out/ui6-fixture.mjs','utf8');
const cases=[['jannabi',"JANNABI's Small Pieces I"],['single','One Last Time (Feat. Fedez) (Single)'],['red','Red Light'],['mixed','오래된 노래와 새로운 기억 — Anniversary Collection 한글 English Mixed Album Title']];
for(const [name,title] of cases)for(const role of ['admin','member','guest']){
 let code=fixture.replace("title:'Abbey Road'",'title:'+JSON.stringify(title)).replace('const repo={admin:false},isApprovedMember=()=>true','const repo={admin:'+String(role==='admin')+'},isApprovedMember=()=>'+String(role!=='guest'));
 code=code.replace("const actions=document.createElement('div');", "const actions=document.createElement('div');");
 if(role==='guest'){code=code.replace("share.prepend(actions);",'');code=code.replace("onPlaylist:()=>calls.push(['album-playlist'])","onPlaylist:null");}
 code=code.replace("const root=document.querySelector('.album-full-page');", "const root=document.querySelector('.album-full-page');");
 if(role!=='admin')code=code.replace('adminNav.hidden=false;','adminNav.hidden=true;').replace('canIndex:()=>true','canIndex:()=>false');
 // Local action handlers expose invocation counts only; no actual streams/downloads/writes.
 code += `\nconst proof=document.createElement('output');proof.id='ui6d-proof';proof.hidden=true;document.body.append(proof);const show=()=>proof.textContent=JSON.stringify(calls);for(const b of root.querySelectorAll('[data-album-action],[data-album-share],#edit-index,[data-detail-artist]'))b.addEventListener('click',()=>{calls.push([b.id||b.getAttribute('data-album-action')||b.hasAttribute('data-album-share')&&'share'||'artist']);show();});root.querySelector('.cover').addEventListener('click',()=>{calls.push(['cover']);show();});if(root.querySelector('#queue-panel'))root.querySelector('#queue-panel').hidden=true;document.querySelector('#queue-panel').hidden=true;\n`;
 await writeFile(`out/ui6d-${name}-${role}.mjs`,code);await writeFile(`out/ui6d-${name}-${role}.html`,html.replace('./ui6-fixture.mjs',`./ui6d-${name}-${role}.mjs`));
 for(const w of [360,390])await writeFile(`out/ui6d-${name}-${role}-${w}.html`,`<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}iframe{position:fixed;inset:0;width:${w}px;height:844px;border:0}</style></head><body><iframe src="ui6d-${name}-${role}.html" title="UI6D isolated ${role}"></iframe></body></html>`);
}

await writeFile('out/ui6d-pc-admin.html','<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}iframe{position:fixed;inset:0;width:1448px;height:1086px;border:0}</style></head><body><iframe src="ui6d-red-admin.html" title="1448x1086 PC regression"></iframe></body></html>');
