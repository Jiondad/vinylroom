import { mountAdminReview } from './admin-ai-review-report.js';
/** Invoke ONLY after the existing application has authorized the admin UI.
 * getAccessToken must retrieve the existing session; do not persist tokens here.
 * Non-admin/unknown session: don't call this module at all.
 */
export function attachReviewToAdminPanel({ adminRoot, getAccessToken, fetcher, isAdminVerified }) {
  if (isAdminVerified !== true) throw new Error('HOLD: admin UI authorization unverified');
  if (!adminRoot || typeof adminRoot.querySelector !== 'function') throw new Error('HOLD: adminRoot missing');
  if (typeof getAccessToken !== 'function') throw new Error('HOLD: session token provider missing');
  const doc = adminRoot.ownerDocument;
  if(!doc.querySelector('link[data-ai-pilot-review-style]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./admin-ai-review-panel.css',import.meta.url).href;link.dataset.aiPilotReviewStyle='';doc.head.append(link);}
  const host = doc.createElement('section');
  host.setAttribute('data-vinyl-ai-review', '');
  host.setAttribute('aria-label', 'AI 앨범 검토 목록');
  const heading = doc.createElement('h3');
  heading.textContent = 'AI 검토 목록';
  const note = doc.createElement('p');
  note.textContent = '읽기 전용 Pilot 검토 보고서 · 운영 API 설치와 관리자 인증 확인이 필요합니다.';
  const content = doc.createElement('div');
  host.append(heading, note, content);
  adminRoot.append(host);
  let dispose;
  try { dispose = mountAdminReview({ container: content, getAccessToken, fetcher }); }
  catch (e) { host.remove(); throw e; }
  return () => { dispose(); host.remove(); };
}
