// Reuse v145 build; only the approved guest UI source changed. No NAS/DB calls.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
const build=spawnSync(process.execPath,['scripts/manual-cd-release.mjs'],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
const hash=createHash('sha256');
for(const name of ['app-index.js','playlists.js','style.css'])hash.update(await readFile('dist/'+name));
const release='detail-ui-'+hash.digest('hex').slice(0,12);
for(const root of ['out','output/next-player-release/dist']){
 let html=await readFile(root+'/index.html','utf8');
 const previous=html.match(/releases\/(manual-cd-[a-f0-9]+)\/entry\.js/)?.[1];
 if(!previous)throw Error('Unexpected release entry');
 await rename(root+'/releases/'+previous,root+'/releases/'+release);
 html=html.replaceAll(previous,release).replaceAll('guest-last-access-20261021',release);
 await writeFile(root+'/index.html',html);
}
console.log('Approved guest UI release prepared:',release);
