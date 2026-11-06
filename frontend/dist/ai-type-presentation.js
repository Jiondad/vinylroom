// Display projection only. Proposal values and saved choices remain unchanged.
const categories={Studio:'Studio',Live:'Live',Compilation:'Compilations',Bootleg:'Bootlegs',Single:'Singles & EPs',EP:'Singles & EPs','Mini Album':'Singles & EPs',Demo:'ETC',Soundtrack:'ETC',Remix:'ETC',Other:'ETC'};
export function siteType(value){return typeof value==='string'?categories[value]||null:null;}
export function typeNote(path,value){return path==='work.album_type'&&value==='Demo'?'사이트 대응 유형: ETC · 원본 Demo 보존 · Catalog 반영 없음':'';}
