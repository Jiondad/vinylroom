// Reuse the existing v148 builder and playback adapter without modification.
import {spawnSync} from 'node:child_process';
import {readFile,copyFile} from 'node:fs/promises';
const build=spawnSync(process.execPath,['scripts/guest-ui-release.mjs'],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
for(const root of ['out','output/next-player-release/dist']){
 const html=await readFile(root+'/index.html','utf8');
 const release=html.match(/releases\/([^/"']+)\/entry\.js/)?.[1];
 if(!release)throw Error('Release entry missing');
 await copyFile('dist/admin-center.css',root+'/releases/'+release+'/admin-center.css');
}
console.log('Admin integration prepared; legacy indexing and authentication preserved.');
