import {spawnSync} from 'node:child_process';
import {readFile,writeFile,readdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const result=spawnSync(process.execPath,['scripts/next-player-release.mjs','--production'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const changed=['app-index.js','indexing-ui.js','catalog-requests.js','disc-tracks.js','media.js'];
const hash=createHash('sha256');for(const name of changed)hash.update(await readFile('dist/'+name));
const release='manual-cd-'+hash.digest('hex').slice(0,12);
const metadata=JSON.parse(await readFile('output/next-player-release/source.json','utf8'));
for(const root of ['out','output/next-player-release/dist']){
 await rename(root+'/releases/'+metadata.release,root+'/releases/'+release);
 let html=await readFile(root+'/index.html','utf8');html=html.replaceAll(metadata.release,release);
 await writeFile(root+'/index.html',html);
}
console.log('Manual indexing/CD release:',release);
