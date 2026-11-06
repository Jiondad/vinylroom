import {readdir,readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const tests=['member-flow','member-images-cache','top100-flow','top100-lyrics-cache','top100-observer','member-management-flow','unified-account','mobile-player','account-password','admin-create-security','guest-browse','top100-performance','catalog-requests','session-storage','unified-account','auth-bootstrap','approval-repeat-no-rerender','player-artwork-state'];
for(const name of await readdir('dist'))if(name.endsWith('.js')){
const check=spawnSync(process.execPath,['--check',path.join('dist',name)],{stdio:'inherit'});if(check.status!==0)process.exit(1);
}
const backendCheck=spawnSync('python3',['-m','unittest','discover','-s','tests','-p','test_public_browse.py'],{stdio:'inherit'});if(backendCheck.status!==0)process.exit(1);
const check=spawnSync(process.execPath,['--test',...tests.map(n=>'tests/'+n+'.test.mjs')],{stdio:'inherit'});if(check.status!==0)process.exit(1);
const sha=process.env.GITHUB_SHA||spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
if(!/^[a-f0-9]{40}$/.test(sha))throw Error('A full source commit SHA is required');
const release='github-'+sha.slice(0,12),target='output/frontend/dist';
await mkdir(target+'/releases/'+release,{recursive:true});
for(const name of await readdir('dist',{withFileTypes:true}))if(name.isFile()){
 await copyFile('dist/'+name.name,target+'/'+name.name);
 if(name.name.endsWith('.js'))await copyFile('dist/'+name.name,target+'/releases/'+release+'/'+name.name);
}
let html=await readFile('dist/index.html','utf8');
html=html.replace(/(?:releases\/[^"']+\/)?entry\.js(?:\?[^"']*)?/g,'releases/'+release+'/entry.js').replace(/(style|theme|mobile-player)\.css(?:\?[^"']*)?/g,'$1.css?v='+release);
await writeFile(target+'/index.html',html);
await mkdir('output/frontend/.openai',{recursive:true});
await copyFile('deploy/site.json','output/frontend/.openai/hosting.json');
await writeFile('output/frontend/source.json',JSON.stringify({github_commit:sha,branch:'feature/member-approval',release},null,2));
const pack=spawnSync('tar',['-cf','output/vinylroom-frontend.tar','-C','output/frontend','.openai','dist','source.json'],{stdio:'inherit'});if(pack.status!==0)process.exit(1);
console.log('Verified frontend package: output/vinylroom-frontend.tar');
