import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTimedLyrics,activeCueIndex,matchesLyricTrack} from '../dist/lyrics-parser.js';

const top=readFileSync(new URL('../dist/top100-ui.js',import.meta.url),'utf8');
const start=top.indexOf('function showLyrics(folder,rank,title,artist){');
const end=top.indexOf('\nfunction showLoadError(',start);
assert.ok(start>=0&&end>start,'Top100 shared lyric viewer not wired');
const fn=new Function('showLyricDialog','getPlayer','request',
  top.slice(start,end)+'\nreturn showLyrics');
const player={items:[{top100_folder:'20261122 TOP100',top100_rank:10,index:9}],index:0};
let captured=null;
const calls=[];
const open=fn(arg=>{captured=arg;return {open:true}},()=>player,async(url,options)=>{
 calls.push({url,signal:options?.signal});
 return {json:async()=>({lyrics:'[00:00.10]Neon and beyond\\n[00:03.60]Next line'})};
});

test('Top100 opens the existing synchronized lyrics dialog, no legacy raw text popup',()=>{
 const dlg=open('20261122 TOP100',10,'NEON','A20, A20 LITE');
 assert.equal(dlg.open,true);
 assert.equal(captured.player,player);
 assert.deepEqual(captured.target,{top100_folder:'20261122 TOP100',top100_rank:10});
 assert.equal(captured.title,'NEON');
 assert.doesNotMatch(top,/top100-lyrics-dialog|top100-lyrics-content/);
 assert.match(top,/import \{showLyricDialog\} from '\.\/lyrics-dialog\.js'/);
});
test('Timed LRC cues are parsed and match the playing Top100 track',()=>{
 const lyrics='[00:00.10]Neon and beyond\n[00:03.60]Next line';
 const result=parseTimedLyrics(lyrics);
 assert.equal(result.timed,true);
 assert.equal(result.cues.length,2);
 assert.equal(result.cues[0].time,.1);
 assert.equal(result.cues[1].time,3.6);
 assert.equal(activeCueIndex(result.cues,4),1);
 assert.equal(matchesLyricTrack(player.items[0],captured.target),true);
 assert.equal(matchesLyricTrack({...player.items[0],top100_rank:11},captured.target),false);
});
test('Current and subsequent queue items load through existing authorized Top100 API',async()=>{
 const aborter=new AbortController();
 const raw=await captured.load({signal:aborter.signal,target:captured.target});
 assert.match(raw,/Neon and beyond/);
 const second=await captured.load({signal:aborter.signal,target:{top100_folder:'20261122 TOP100',top100_rank:11}});
 assert.match(second,/Next line/);
 assert.deepEqual(calls.map(x=>x.url),[
  '/v2/top100-lyrics?folder=20261122%20TOP100&rank=10',
  '/v2/top100-lyrics?folder=20261122%20TOP100&rank=11'
 ]);
 assert.equal(calls[0].signal,aborter.signal);
 assert.equal(calls[1].signal,aborter.signal);
});
test('Incorrect rank is rejected before NAS query',async()=>{
 const count=calls.length;
 await assert.rejects(captured.load({target:{top100_folder:'A',top100_rank:0}}),/가사 대상 확인 실패/);
 assert.equal(calls.length,count);
});
