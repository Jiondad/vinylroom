// Offline candidate only. Does not publish or call the NAS.
import {spawnSync} from 'node:child_process';
import {readFile,copyFile} from 'node:fs/promises';
const build=spawnSync(process.execPath,['scripts/admin-integration-release.mjs'],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
for(const root of ['out','output/next-player-release/dist']){
 const html=await readFile(root+'/index.html','utf8'),release=html.match(/releases\/([^/"']+)\/entry\.js/)?.[1];
 if(!release)throw Error('Release entry missing');
 await copyFile('dist/album-share.css',root+'/releases/'+release+'/album-share.css');
}
console.log('S1 share candidate prepared OFFLINE; no publication.');
