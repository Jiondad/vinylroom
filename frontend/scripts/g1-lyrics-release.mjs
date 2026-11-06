// Local G1 candidate only. Never saves or deploys a Site version.
import {spawnSync} from 'node:child_process';
import {readFile,copyFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const build=spawnSync(process.execPath,['scripts/album-share-release.mjs'],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
for(const root of ['out','output/next-player-release/dist']){
 const html=await readFile(root+'/index.html','utf8'),release=html.match(/releases\/([^/"']+)\/entry\.js/)?.[1];
 if(!release)throw Error('Release missing');
 await copyFile('dist/lyrics-dialog.css',root+'/releases/'+release+'/lyrics-dialog.css');
 const hash=createHash('sha256').update(release);
 for(const name of ['media.js','lyrics-dialog.js','lyrics-parser.js','lyrics-dialog.css'])hash.update(await readFile(root+'/releases/'+release+'/'+name));
 const next='g1-lyrics-'+hash.digest('hex').slice(0,12);
 await rename(root+'/releases/'+release,root+'/releases/'+next);
 await writeFile(root+'/index.html',html.replaceAll(release,next));
 console.log('G1 cache-isolated release:',next);
}
console.log('G1 isolated candidate ready; NOT PUBLISHED');
