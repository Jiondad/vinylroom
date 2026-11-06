import './queue-type-contract.mjs';
import './album-ui-contract.mjs';
// Generate an isolated comparison build. Never edits dist/index.html or publishes.
import {readFile,writeFile,copyFile,readdir,mkdir,cp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const production=process.argv.includes('--production');
if(process.argv.slice(2).some(arg=>arg!=='--production'))throw Error('Unknown build option');
const commit=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Source commit missing');
const release='next-player-'+commit.slice(0,12);
const root=production?'output/next-player-release':'output/next-player',target=root+'/dist';
await rm(root,{recursive:true,force:true});
await mkdir(target,{recursive:true});
for(const file of await readdir('dist',{withFileTypes:true}))if(file.isFile())await copyFile('dist/'+file.name,target+'/'+file.name);
await cp('dist/next-player',target+'/next-player',{recursive:true});
let player=await readFile('dist/player.js','utf8');
const begin=player.indexOf('export class QueuePlayer {'),end=player.indexOf('\nlet instance;',begin);
if(begin<0||end<0)throw Error('Legacy boundary changed: inspect adapter before building');
player="import {NextQueuePlayer as QueuePlayer} from './next-player/engine.js';\nimport {bindNextMediaSession} from './next-player/media-session.js';\n"+player.slice(0,begin)+'export {QueuePlayer};\n'+player.slice(end);
const sessionStart=player.indexOf(' function syncMediaSession(){'),sessionEnd=player.indexOf(' let coverId=null;',sessionStart);
if(sessionStart<0||sessionEnd<0)throw Error('MediaSession boundary changed');
player=player.slice(0,sessionStart)+" playbackDiagnostics.initialize(audio,()=>({trackId:trackIdentity(player.items[player.index]),queueIndex:player.index>=0?player.index:null,playbackState:globalThis.navigator?.mediaSession?.playbackState||null}));\n function syncMediaSession(){bindNextMediaSession(player).sync();}\n"+player.slice(sessionEnd);
player=player.replace('response=await fetch(url,typeof options===\'function\'?await options():options);',"const requestOptions=typeof options==='function'?await options():options;const signal=trace.signal?AbortSignal.any([trace.signal,requestOptions.signal].filter(Boolean)):requestOptions.signal;response=await fetch(url,{...requestOptions,signal});");
if(!player.includes('AbortSignal.any'))throw Error('Resolver cancellation adapter missing');
player=player.replace('await p.audio.play();','await p.resume();').replace('p.audio.pause();','p.pause();');
await writeFile(target+'/player.js',player);
let access=await readFile('dist/access-state.js','utf8');
if(!access.includes("document.querySelectorAll('audio').forEach(audio=>{"))throw Error('Access cleanup boundary changed');
access="import {revokeOwnedAudio} from './next-player/engine.js';\n"+access.replace("document.querySelectorAll('audio').forEach(audio=>{","document.querySelectorAll('audio').forEach(audio=>{if(revokeOwnedAudio(audio))return;");
await writeFile(target+'/access-state.js',access);
for(const name of ['mobile-player.js','desktop-player.js']){
 let ui=await readFile('dist/'+name,'utf8');
 ui=ui.replaceAll('await audio.play();','await player.resume();').replaceAll('audio.pause();','player.pause();');
 if(name==='mobile-player.js')ui=ui.replace("if(duration&&player.audio.getAttribute('src'))player.audio.currentTime=(Number(player.start)||0)+Math.max(0,Math.min(duration,Number(position)||0));","if(duration&&player.audio.getAttribute('src'))player.seek(Number(position)||0);");
 await writeFile(target+'/'+name,ui);
}
let html=await readFile('dist/index.html','utf8');
html=html.replace(/releases\/[^/"']+\/entry\.js/g,production?'releases/'+release+'/entry.js':'entry.js').replaceAll('dev-audio-owner',production?release:'next-engine-dev');
await writeFile(target+'/index.html',html);
if(production){
 const releaseDir=target+'/releases/'+release;await mkdir(releaseDir,{recursive:true});
 for(const name of await readdir(target,{withFileTypes:true}))if(name.isFile()&&/\.(?:js|css)$/.test(name.name))await copyFile(target+'/'+name.name,releaseDir+'/'+name.name);
 await cp(target+'/next-player',releaseDir+'/next-player',{recursive:true});
}
await mkdir(root+'/.openai',{recursive:true});await copyFile('.openai/hosting.json',root+'/.openai/hosting.json');
const archiveHosting=JSON.parse(await readFile(root+'/.openai/hosting.json','utf8'));archiveHosting.static.directory='dist';await writeFile(root+'/.openai/hosting.json',JSON.stringify(archiveHosting));
if(production){await rm('out',{recursive:true,force:true});await cp(target,'out',{recursive:true});}
await writeFile(root+'/source.json',JSON.stringify(production?{commit,engine:'next-player',release}:{commit,engine:'next-player',development_only:true,operating_engine_unchanged:true},null,2));
const archive=production?'output/next-player-frontend-candidate.tar.gz':'output/next-player-development.tar.gz';
const pack=spawnSync('tar',['-czf',archive,'-C',root,'.openai','dist','source.json'],{stdio:'inherit'});if(pack.status!==0)throw Error('Packaging failed');
console.log((production?'Production-format candidate: ':'Isolated next-engine build: ')+root+'; no publication performed');
