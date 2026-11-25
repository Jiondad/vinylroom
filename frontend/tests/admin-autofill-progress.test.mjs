import assert from 'node:assert/strict';
import {renderAutofillProgress} from '../dist/ai-operation-status.js';
const sample={
  "autofill_progress": {
    "version": 1,
    "state": "ready",
    "snapshot": {
      "state": "ADMIN_AUTOFILL_PROGRESS_OBSERVED",
      "observed_at_kst": "2026-01-01T00:00:00+09:00",
      "boundary_unchanged": false,
      "totals": {
        "catalog_active": 100,
        "aligned_albums_with_slot": 73,
        "cooldown_deferred_albums": 2
      },
      "fields": {
        "type": {
          "effective_empty": 25
        },
        "label": {
          "effective_empty": 60
        },
        "year": {
          "effective_empty": 10
        },
        "genre": {
          "effective_empty": 5
        }
      },
      "ledger": {
        "last_24h": {
          "attempts": 20,
          "audit_matched_operations": 4,
          "states": {
            "held": 16
          }
        },
        "all": {
          "audit_matched_operations": 55
        }
      }
    }
  }
};
assert.match(renderAutofillProgress({}),/NAS 연동 필요/);
assert.match(renderAutofillProgress({autofill_progress:{version:1,state:'refreshing'}}),/집계 중/);
assert.match(renderAutofillProgress({autofill_progress:{version:1,state:'unavailable'}}),/집계 미확인/);
for(const s of ['75.0%','40.0%','90.0%','95.0%','73','55','20.0%','변동 감지'])assert.ok(renderAutofillProgress(sample).includes(s),s);
assert.match(renderAutofillProgress({autofill_progress:{...sample.autofill_progress,state:'stale'}}),/오래된 집계/);
assert.doesNotMatch(renderAutofillProgress({autofill_progress:{version:1,snapshot:{state:'ADMIN_AUTOFILL_PROGRESS_OBSERVED',totals:{catalog_active:0},fields:{type:{effective_empty:1}}}}}),/NaN/);
console.log('PASS admin autofill progress');
