// Reuse full-app mock page; only baseline Artist-owned files differ.
import {readFile,writeFile,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const page=await readFile('out/top100-mobile-qa.html','utf8'),release=(await readFile('out/index.html','utf8')).match(/releases\/([^/]+)\/entry.js/)[1];
await cp('out/releases/'+release,'out/artist-before',{recursive:true});for(const n of ['ui-polish.css','design-v2.css','app-index.js'])await writeFile('out/artist-before/'+n,execFileSync('git',['show','c7be865e7e5234870dfd940acb2fffc90b756e13:dist/'+n]));
await writeFile('out/artist-before.html',page.replaceAll('releases/'+release,'artist-before'));
await writeFile('out/artist-frame.html',(await readFile('out/top100-frame.html','utf8')).replace('Top100 isolated mobile QA','Artist strip isolated QA').replace('합성 20곡·실제 앱','합성 API·실제 Artist').replace('Top100 수정 전(A2 동일)','Artist 수정 전(A2 동일)').replace("'top100-mobile-'+(ver.value==='before'?'before':'qa')+'.html?mode='", "(ver.value==='before'?'artist-before.html':'top100-mobile-qa.html')+'?mode='"));
console.log('Artist strip QA ready');
