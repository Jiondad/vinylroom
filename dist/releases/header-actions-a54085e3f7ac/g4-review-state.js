// G4-A: isolated, in-memory review state. No network, database or persistence.
export const FIELDS = Object.freeze([
 ['artist','아티스트'],['title','앨범명'],['original_date','원발매일'],
 ['edition_date','소장 판본 날짜'],['genre','장르'],['album_type','앨범 유형'],
 ['recording','녹음 유형']
]);
export const STATES = Object.freeze({pending:'검토 대기',approved:'승인',held:'보류',rejected:'반려'});
export const ACTIONS = Object.freeze({approve:'approved',hold:'held',reject:'rejected'});
const copy = value => structuredClone(value);

export function validateCases(rows){
 if(!Array.isArray(rows))throw Error('invalid_cases');
 const ids=new Set();
 for(const row of rows){
  if(!row||typeof row.proposalId!=='string'||!row.proposalId||ids.has(row.proposalId))throw Error('duplicate_or_missing_proposal_id');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(row.albumId||''))throw Error('invalid_album_id');
  if(!Number.isSafeInteger(row.revision)||row.revision<1||!row.fingerprint||!row.currentFingerprint)throw Error('invalid_revision');
  if(!Object.hasOwn(STATES,row.status)||!row.current||!row.proposal||!Array.isArray(row.protectedFields))throw Error('invalid_case');
  ids.add(row.proposalId);
 }
 return rows;
}

export function reviewConflict(row){
 if(row.fingerprint!==row.currentFingerprint)return '원본 변경 · 오래된 제안';
 if(row.protectedFields.some(field=>row.proposal[field]!=null&&row.proposal[field]!==row.current[field]))return '관리자 보호 필드 충돌';
 return '';
}

export function createMockReviewAdapter(fixtures){
 const rows=copy(validateCases(fixtures));
 const history=[];
 return Object.freeze({
  kind:'simulation',
  list(){return copy(rows);},
  history(){return copy(history);},
  decide({proposalId,action,expectedRevision,expectedFingerprint,actor,reason=''}){
   if(!Object.hasOwn(ACTIONS,action))throw Error('invalid_action');
   if(actor!=='approved_admin')throw Error('admin_required');
   if(typeof reason!=='string'||reason.length>300||(action!=='approve'&&!reason.trim()))throw Error('reason_required');
   const row=rows.find(item=>item.proposalId===proposalId);
   if(!row)throw Error('proposal_missing');
   if(row.revision!==expectedRevision||row.currentFingerprint!==expectedFingerprint)throw Error('revision_conflict');
   if(action==='approve'&&reviewConflict(row))throw Error('approval_blocked');
   if(row.status===ACTIONS[action])throw Error('duplicate_decision');
   const before=row.status;
   row.status=ACTIONS[action];row.revision++;
   history.push({proposalId,albumId:row.albumId,from:before,to:row.status,revision:row.revision,actor,reason:reason.trim()});
   return copy(row);
  },
  // Test-only mutation simulates a concurrent catalog edit; never persists.
  simulateCatalogRevision(proposalId,newFingerprint){
   const row=rows.find(item=>item.proposalId===proposalId);
   if(!row)throw Error('proposal_missing');
   row.currentFingerprint=newFingerprint;row.revision++;
  }
 });
}
