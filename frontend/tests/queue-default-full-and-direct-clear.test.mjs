import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindDesktopQueueInline} from '../dist/queue-controls.js';

const source=path=>readFileSync(new URL('../dist/'+path,import.meta.url),'utf8');
test('queue defaults to full list and retains optional next-only toggle',()=>{
 const code=source('reference-ui.js');
 assert.match(code,/let showAll=true;/);
 assert.match(code,/all\.onclick=\(\)=>\{showAll=!showAll;update\(\);\}/);
 assert.match(code,/row\.hidden=!showAll&&state\.loaded&&index<=player\.index/);
});
test('desktop clear triggers existing clear immediately, with no confirmation UI',()=>{
 let cleared=0;
 const clear={onclick:()=>{cleared++;}};
 const panel={ownerDocument:{defaultView:{}},querySelector:()=>null};
 bindDesktopQueueInline(panel,null,clear,()=>[]);
 clear.onclick();
 assert.equal(cleared,1);
 assert.doesNotMatch(source('queue-controls.js'),/재생 대기열을 비울까요\?/);
});
test('mobile clear also invokes the existing player.clear immediately',()=>{
 const code=source('mobile-player.js');
 assert.match(code,/queue\.querySelector\('\[data-clear\]'\)\.onclick=\(\)=>\{queue\.querySelector\('\.queue-inline-form'\)\?\.remove\(\);player\.clear\(\);\}/);
 assert.doesNotMatch(code,/재생 대기열을 비울까요\?/);
});
