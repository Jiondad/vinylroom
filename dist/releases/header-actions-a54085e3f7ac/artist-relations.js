import {catalogArtistTarget} from './artist-metadata.js';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export const MEMBER='5be4c609-9afa-4ea0-910b-12ffb71e3821',COLLAB='75c09861-6857-4ec0-9729-84eefde7fc86';
const mbid=p=>p.externalIdsVerified===true&&uuid.test(p.externalIds?.musicbrainz||'')?p.externalIds.musicbrainz:null;
export function importMusicBrainz(registry,artistId,payload,fetchedAt=new Date().toISOString()){
 const owners=new Map();for(const p of registry.artists){const id=mbid(p);if(id){if(owners.has(id))throw Error('중복 MusicBrainz 매핑');owners.set(id,p);}}
 const current=registry.artists.find(p=>p.id===artistId),source=mbid(current||{});if(!source||payload?.id!==source||!Array.isArray(payload.relations))throw Error('MusicBrainz identity 불일치');
 const edges=[],pending=[];
 for(const r of payload.relations){if(![MEMBER,COLLAB].includes(r['type-id'])||r['target-type']!=='artist'||!['forward','backward'].includes(r.direction)||!uuid.test(r.artist?.id||''))continue;
 const other=owners.get(r.artist.id);if(!other){pending.push({mbid:r.artist.id,reason:'UNMAPPED_EXTERNAL_ID'});continue;}
 const a=r.direction==='forward'?current:other,b=r.direction==='forward'?other:current;
 if(a.id===b.id||b.kind!=='group'||(r['type-id']===MEMBER&&a.kind!=='person')){pending.push({mbid:r.artist.id,reason:'RELATION_KIND_CONFLICT'});continue;}
 const edge={from:a.id,to:b.id,type:r['type-id']===MEMBER?'membership':'collaboration',begin:r.begin||'',end:r.end||'',ended:r.ended===true,attributes:Array.isArray(r.attributes)?r.attributes.filter(x=>typeof x==='string'):[],source:{provider:'MusicBrainz',typeId:r['type-id'],artistMbid:source,targetMbid:r.artist.id,url:'https://musicbrainz.org/artist/'+source+'/relationships',fetchedAt},verified:true};
 edge.key=[edge.from,edge.to,edge.type,edge.begin,edge.end].join('|');if(!edges.some(e=>e.key===edge.key))edges.push(edge);
 }
 return {edges,pending};
}
export function relatedArtists(registry,artistId){
 const grouped=new Map();for(const e of registry.relationships||[]){if(e.verified!==true||e.hidden||!['membership','collaboration','related'].includes(e.type)||![e.from,e.to].includes(artistId))continue;
 const targetId=e.from===artistId?e.to:e.from,p=registry.artists.find(x=>x.id===targetId);if(!p||targetId===artistId)continue;
 const catalogName=catalogArtistTarget(registry,targetId);
 const label=e.type==='membership'?(e.from===artistId?'소속 그룹':'멤버'):e.type==='collaboration'?'협업':'관련 활동';
 if(!grouped.has(targetId))grouped.set(targetId,{artist:p,owned:!!catalogName&&p.holdings?.verified===true&&Number.isSafeInteger(p.holdings.albums)&&p.holdings.albums>0,catalogName,labels:[],evidence:[]});const row=grouped.get(targetId);const text=label+(e.ended?' · 과거':'');if(!row.labels.includes(text))row.labels.push(text);row.evidence.push(e);
 }
 return [...grouped.values()].sort((a,b)=>Number(b.owned)-Number(a.owned)||a.artist.name.localeCompare(b.artist.name));
}
export function editRelationship(registry,revision,event,authorized){
 if(!authorized)throw Error('관리자 권한 필요');if(!event.reviewer)throw Error('검토자 필요');if((registry.relationshipRevision||0)!==revision)throw Error('관계 revision 충돌');
 const next=structuredClone(registry);next.relationships||=[];const at=next.relationships.findIndex(x=>x.key===event.key);
 if(event.action==='hide'){if(at<0)throw Error('관계 없음');next.relationships[at].hidden=true;next.relationships[at].reviewOverride=true;}
 else if(event.action==='upsert'){const e=event.edge;if(!e||!['membership','collaboration','related'].includes(e.type)||!next.artists.some(x=>x.id===e.from)||!next.artists.some(x=>x.id===e.to)||e.from===e.to||!e.source?.url||e.verified!==true||!event.reviewer)throw Error('검토 근거 필요');if(at<0)next.relationships.push({...e,key:event.key,reviewOverride:true});else next.relationships[at]={...e,key:event.key,reviewOverride:true};}
 else throw Error('지원하지 않는 관계 작업');next.relationshipRevision=revision+1;next.relationshipEvents=[...(next.relationshipEvents||[]),{...event,revision:revision+1,at:new Date().toISOString()}];return next;
}
export function musicBrainzLoader({fetcher=fetch,now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let queue=Promise.resolve(),last=-Infinity;const cache=new Map();
 return id=>{if(!uuid.test(id))return Promise.reject(Error('유효한 MBID 필요'));if(cache.has(id))return cache.get(id);
 const job=queue.then(async()=>{await sleep(Math.max(0,1100-(now()-last)));last=now();const r=await fetcher('https://musicbrainz.org/ws/2/artist/'+id+'?inc=artist-rels&fmt=json',{headers:{Accept:'application/json','User-Agent':'VinylRoom-ArtistRelations/0.2 (https://vinylroom.shinekjh.chatgpt.site)'},signal:AbortSignal.timeout(8000),redirect:'error'});if(!r.ok)throw Error('MusicBrainz 조회 실패 '+r.status);const body=await r.text();if(body.length>1_000_000)throw Error('응답 크기 제한');const data=JSON.parse(body);if(data.id!==id)throw Error('MBID 응답 불일치');return data;});cache.set(id,job);queue=job.catch(()=>{});return job;};
}

export function mergeRelationships(existing=[],incoming=[]){const family=e=>[e.from,e.to,e.type].join('|'),hidden=new Set(existing.filter(e=>e.hidden).map(family)),manual=new Map(existing.filter(e=>e.reviewOverride).map(e=>[family(e),e]));const result=new Map();for(const e of [...existing,...incoming]){const value=manual.get(family(e))||{...e,...(hidden.has(family(e))?{hidden:true}:{})};result.set(value.key,value);}return [...result.values()];}
