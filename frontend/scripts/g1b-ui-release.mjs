// Presentation-only build; does not publish.
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,copyFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const build=spawnSync(process.execPath,['scripts/g1-lyrics-release.mjs'],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
for(const root of ['out','output/next-player-release/dist']){
 const html=await readFile(root+'/index.html','utf8'),previous=html.match(/releases\/([^/"']+)\/entry\.js/)?.[1];
 if(!previous)throw Error('Release missing');
 await copyFile('dist/ui-polish.css',root+'/releases/'+previous+'/ui-polish.css');
 const hash=createHash('sha256').update(previous);
 for(const name of ['ui-polish.js','ui-polish.css','admin-center.css'])hash.update(await readFile(root+'/releases/'+previous+'/'+name));
 const release='g1b-ui-'+hash.digest('hex').slice(0,12);
 await rename(root+'/releases/'+previous,root+'/releases/'+release);
 await writeFile(root+'/index.html',html.replaceAll(previous,release));
 console.log('G1-B candidate:',release);
}
