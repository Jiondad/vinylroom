// Reuse existing full-app auth/API fixture; no operational network requests.
import '../tests/header-actions/build-qa.mjs';
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
const before=process.argv[2];if(!before)throw Error('Pass the retained baseline runtime directory as the sole argument');
await cp(before,'out/v201-before',{recursive:true});
let page=await readFile('out/header-qa.html','utf8');
const old=await readFile('tests/header-actions/browser-checks.js','utf8');page=page.replace(old,"await import('./album-ui-browser-checks.js');");
page=page.replace("let requests=window.__headerQa.requests;",`let requests=window.__headerQa.requests;`);
const point="let requests=window.__headerQa.requests;";
// Original bootstrap keeps this statement on the requests/stamp line.
const choices=`
const names={abbey:['The Beatles','Abbey Road'],ost:['남지현, 전지윤 (4minute)','러브포텐 - 순정의 시대 OST Part.1'],longko:['합성 아티스트','오래도록 기억하고 싶은 우리들의 아주 긴 앨범 이야기와 다시 만나는 계절의 노래'],longen:['Synthetic Artist','A Very Long Album Title About The Songs We Remember Through Every Changing Season (Deluxe Edition)']};
window.__headerQa.albumCase=params.get('case')||'abbey';const selected=names[window.__headerQa.albumCase];album.artist=selected[0];album.title=selected[1];album.edition='Original edition';album.country='KR';album.label='Fixture label';
`;
if(!page.includes(point))throw Error('Existing fixture boundary changed');page=page.replace(point,point+choices);
await writeFile('out/album-ui-qa.html',page);
await cp('tests/album-ui-browser-checks.js','out/album-ui-browser-checks.js');
const oldEntry=(await readFile(before+'/index.html','utf8')).match(/<script type="module" src="([^"]+)"/)[1];const newEntry=(await readFile('out/index.html','utf8')).match(/<script type="module" src="([^"]+)"/)[1];
await writeFile('out/v201-before/album-ui-qa.html',page.replace('./'+newEntry,'./'+oldEntry));await cp('tests/album-ui-browser-checks.js','out/v201-before/album-ui-browser-checks.js');
await writeFile('out/album-ui-frame.html',`<!doctype html><meta charset="utf-8"><title>Vinyl Room album regression QA</title><style>body{margin:0;background:#ddd;font:12px sans-serif}nav{height:44px;display:flex;align-items:center;gap:10px}iframe{display:block;border:0;background:white}</style><nav>실제 앱 · 합성 API · 운영 연결 없음 <select id="version" aria-label="비교 버전"><option value="after">후보</option><option value="before">기준 v202</option></select><select id="album" aria-label="검증 앨범"><option value="abbey">Abbey Road</option><option value="ost">러브포텐 OST</option><option value="longko">긴 한글 제목</option><option value="longen">긴 영문 제목</option></select><select id="role" aria-label="검증 권한"><option>admin</option><option>member</option><option>guest</option></select><select id="size" aria-label="검증 크기"><option>1440x900</option><option>768x1024</option><option>390x844</option><option>360x800</option></select><button id="measure">계측</button></nav><iframe id="screen" title="격리된 실제 앱" width="1440" height="900"></iframe><script>const f=document.querySelector('iframe');function show(){f.src=(version.value==='before'?'v201-before/':'')+'album-ui-qa.html?mode='+role.value+'&case='+album.value;}version.onchange=show;album.onchange=show;role.onchange=show;size.onchange=()=>{const[w,h]=size.value.split('x');f.width=w;f.height=h;};measure.onclick=()=>f.contentWindow.postMessage({albumMeasure:true},location.origin);show();</script>`);
console.log('Focused full-app album QA prepared; no publication');
