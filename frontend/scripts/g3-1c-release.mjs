// Reuse the existing release builder; fresh namespace prevents cached v172 selection code.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
const build=spawnSync(process.execPath,['scripts/admin-integration-release.mjs'],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
for(const root of ['out','output/next-player-release/dist']){
 const html=await readFile(root+'/index.html','utf8');
 const previous=html.match(/releases\/([^/"']+)\/entry\.js/)?.[1];
 if(!previous)throw Error('Release entry missing');
 const hash=createHash('sha256').update(previous);
 for(const name of ['ai-proposal-review.js','ai-field-selection.js'])hash.update(await readFile(root+'/releases/'+previous+'/'+name));
 const release='g31c-'+hash.digest('hex').slice(0,12);
 await rename(root+'/releases/'+previous,root+'/releases/'+release);
 await writeFile(root+'/index.html',html.replaceAll(previous,release));
 console.log('G3-1C save-only candidate:',release);
}
