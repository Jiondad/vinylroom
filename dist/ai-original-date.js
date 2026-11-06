/** Presentation-only grouping. Raw fields, snapshots and API choices are never renamed. */
const PATHS=new Set(['work.original_year','work.original_date']);
const blank=v=>v==null||v===''||['unknown','미확인'].includes(String(v).toLowerCase());
export function parseOriginalDate(value){
 if(blank(value))return null;
 const match=String(value).trim().match(/^(\d{4})(?:([-./])(\d{2})(?:\2(\d{2}))?)?$/);
 if(!match)return null;
 const year=Number(match[1]),month=match[3]&&Number(match[3]),day=match[4]&&Number(match[4]);
 if(year<1||month!==undefined&&(month<1||month>12))return null;
 const days=month&&[31,(year%4===0&&(year%100!==0||year%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
 if(day!==undefined&&(day<1||day>days))return null;
 const text=[match[1],match[3],match[4]].filter(x=>x!==undefined).join('-');return {text,precision:day!==undefined?3:month!==undefined?2:1};
}
const related=(a,b)=>a===b||a.startsWith(b+'-')||b.startsWith(a+'-');
function side(members,key){
 const values=members.map(r=>r[key]).filter(v=>!blank(v)),dates=values.map(parseOriginalDate);
 const conflict=dates.some(d=>!d)||dates.some(a=>dates.some(b=>a&&b&&!related(a.text,b.text)));
 const best=dates.filter(Boolean).sort((a,b)=>b.precision-a.precision)[0];
 return {text:conflict?values.map(String).join(' / '):best?.text??null,precision:best?.precision||0,conflict};
}
export function originalDateRows(rows){
 const members=rows.filter(r=>PATHS.has(r.path));if(!members.length)return rows;
 const before=side(members,'before'),after=side(members,'after'),conflict=before.conflict||after.conflict;
 const dateField=members.find(r=>r.path==='work.original_date');
 const explicitDateProposal=!!dateField&&!blank(dateField.after);
 const newDateProposal=explicitDateProposal&&blank(dateField.before);
 const dateMatches=!conflict&&before.text===after.text;
 const changed=conflict||!dateMatches||newDateProposal;
 const semanticLoss=!!before.text&&(!after.text||after.precision<before.precision);
 const blocked=members.some(r=>r.loss||r.protected||r.confidence?.status==='BLOCK')||conflict;
 const precision=dateMatches?(newDateProposal?'날짜 일치 · 원발매일 필드 신규 제안 · 검토 필요':'날짜 일치'):conflict?'연도·날짜 내부 불일치':(semanticLoss?'기존 날짜가 더 상세함 · 기존 유지':before.text&&after.text&&related(before.text,after.text)&&after.precision>before.precision?'날짜 정밀도 향상 후보 · 추가 근거 확인':changed?'실제 원발매일 차이 · 검토 필요':'동일한 날짜 · 변경 불필요');
 const group={path:'display.original_date',field:'original_date',label:'원발매일',before:before.text,after:after.text,changed,explicitDateProposal,newDateProposal,dateMatches,supported:members.every(r=>r.supported),protected:members.some(r=>r.protected),loss:semanticLoss||changed&&members.some(r=>r.loss),adoptionBlocked:blocked,conflict,precision:conflict?'연도·날짜 원본의 내부 불일치 · 수동 확인 필요':precision,members,defaultChoice:changed?'defer':'keep'};
 let inserted=false;return rows.flatMap(r=>{if(!PATHS.has(r.path))return [r];if(inserted)return [];inserted=true;return [group];});
}
export function dateChoice(row,choices){
 if(!row.members)return choices[row.path];if(!row.changed)return 'keep';
 const active=row.members.filter(r=>r.changed&&!r.protected),values=active.map(r=>choices[r.path]);
 if(!values.length)return 'keep';return values.every(c=>c===values[0])?values[0]:'mixed';
}
export function dateChoicePatch(row,choice){
 if(!['keep','adopt','defer'].includes(choice))throw Error('유효하지 않은 검토 선택');
 const members=row.members||[row];
 if(choice==='adopt'&&(row.loss||row.protected||row.conflict||members.some(r=>r.loss||r.protected||r.confidence?.status==='BLOCK')))throw Error('날짜 손실·보호·충돌 필드는 채택할 수 없습니다.');
 return Object.fromEntries(members.map(r=>[r.path,!row.changed||!r.changed||r.protected?'keep':choice]));
}
/** Contract projection only; no network or persistence. Mixed decisions fail closed. */
export function projectOriginalDateChoices(rows,choices){
 const result={...choices};
 for(const row of originalDateRows(rows))if(row.members){const choice=dateChoice(row,choices);if(choice==='mixed')throw Error('원발매일 필드별 선택이 서로 다릅니다.');Object.assign(result,dateChoicePatch(row,choice));}
 delete result['display.original_date'];return result;
}
