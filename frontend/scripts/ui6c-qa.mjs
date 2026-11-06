// Typography QA: production template/modules, synthetic text variants, no network.
import './ui6-qa.mjs';import {readFile,writeFile} from 'node:fs/promises';
const html=await readFile('out/ui6-qa.html','utf8'),fixture=await readFile('out/ui6-fixture.mjs','utf8');
for(const [name,title,artist] of [['korean','아주 긴 앨범 제목과 음악의 기억을 담은 이야기 그리고 또 다른 계절의 노래','아이유'],['mixed','Magnetic (Remixes) — 아주 긴 앨범 제목 Limited Anniversary Edition','ILLIT (아일릿)']]){
 await writeFile('out/ui6c-'+name+'.mjs',fixture.replace("title:'Abbey Road'",'title:'+JSON.stringify(title)).replace("artist:'The Beatles'",'artist:'+JSON.stringify(artist)));
 await writeFile('out/ui6c-'+name+'.html',html.replace('./ui6-fixture.mjs','./ui6c-'+name+'.mjs'));
 await writeFile('out/ui6c-'+name+'-mobile.html',`<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}iframe{position:fixed;inset:0;width:390px;height:844px;border:0}</style></head><body><iframe src="ui6c-${name}.html"></iframe></body></html>`);
}
