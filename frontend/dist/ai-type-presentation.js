// Display projection only. Proposal values and saved choices remain unchanged.
const categories={Studio:'Studio',Live:'Live',Compilation:'Compilations',Bootleg:'Bootlegs',Single:'Singles & EPs',EP:'Singles & EPs','Mini Album':'Singles & EPs',Demo:'ETC',Soundtrack:'OST',Remix:'ETC',Other:'ETC'};
export function siteType(value){return typeof value==='string'?categories[value]||null:null;}
export function typeNote(path,value){return path==='work.album_type'&&value==='Demo'?'사이트 대응 유형: ETC · 원본 Demo 보존 · Catalog 반영 없음':'';}

// Catalog display aliases only; preserve unknown nonempty native values.
const catalogAliases=new Map([['정규','Studio'],['Compilation','Compilations'],['Bootleg','Bootlegs'],['미니/싱글','Singles & EPs']]);
export function catalogTypeLabel(value){const v=typeof value==='string'?value.trim():'';return v?catalogAliases.get(v)||v:'미확인';}
