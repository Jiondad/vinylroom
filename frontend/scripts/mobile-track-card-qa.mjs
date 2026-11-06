// Reuse existing full-app isolated API fixture; never included in production output.
import '../tests/header-actions/build-qa.mjs';
import {readFile,writeFile} from 'node:fs/promises';
let s=(await readFile('out/header-qa.html','utf8')).replace(await readFile('tests/header-actions/browser-checks.js','utf8'),'');
s=s.replace("let requests=window.__headerQa.requests;",`let requests=window.__headerQa.requests;
if(params.get('long')==='1')album.title='아주 긴 한글 앨범 제목과 A Very Long English Album Title With Multiple Words';
album.tracks=Array.from({length:12},(_,i)=>({...album.tracks[i%2],number:i+1,disc:i<6?1:2,title:'Synthetic track '+(i+1)}));
album.tracks[1].title='아주 긴 한글 곡명과 English Title That Wraps Naturally Across Two Lines';
const cards=Array.from({length:4},(_,i)=>({...album,id:i?String(i):album.id,title:i?'긴 앨범명과 A Very Long English Album Title '+i:album.title,artist:i?'아주 긴 아티스트 이름과 Artist Name':album.artist}));`);
s=s.replace(':[album];',':cards;');
s=s.replace('</body>',`<script>document.fonts.ready.then(()=>{const p=document.createElement('pre');p.id='qa-font-proof';p.hidden=true;p.textContent=JSON.stringify([...document.fonts].filter(x=>x.family.includes('Pretendard')).map(x=>({family:x.family,weight:x.weight,status:x.status})));document.body.append(p);});</script></body>`);
await writeFile('out/track-menu-qa.html',s);
await writeFile('out/track-menu-frame.html',`<!doctype html><meta charset="utf-8"><title>Vinyl Room focused QA</title><style>body{margin:0}iframe{border:0;display:block}</style><label>폭<select id="size"><option>390</option><option>360</option><option>768</option><option>820</option><option>1440</option></select></label><label>권한<select id="role"><option>member</option><option>guest</option><option>admin</option></select></label><label>제목<select id="titlecase"><option value="short">짧은 제목</option><option value="long">긴 제목</option></select></label><iframe id="screen" width="390" height="844" src="track-menu-qa.html?mode=member"></iframe><script>const f=document.querySelector('iframe');size.onchange=()=>f.width=size.value;role.onchange=titlecase.onchange=()=>f.src='track-menu-qa.html?mode='+role.value+'&long='+(titlecase.value==='long'?'1':'0');</script>`);
