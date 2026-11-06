/** v5.3 NON-DEPLOYED admin-only review UI adapter.
 * The caller MUST enforce administrator UI visibility and supply an existing
 * short-lived access token from the current authenticated session.
 * Authorization is ultimately enforced by the server, not by this module.
 */
export const REVIEW_ENDPOINT = '/v2/ai-classification/review-report';

export async function loadAdminReview({ getAccessToken, fetcher = globalThis.fetch, signal } = {}) {
  if (typeof getAccessToken !== 'function' || typeof fetcher !== 'function') throw new Error('HOLD: missing session/fetch dependency');
  const token = await getAccessToken();
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) throw new Error('HOLD: no valid session token');
  const result = await fetcher(REVIEW_ENDPOINT, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/html' },
    credentials: 'omit', cache: 'no-store', redirect: 'error', signal,
  });
  if (!result || result.status !== 200) throw new Error(`REPORT_UNAVAILABLE: HTTP ${result?.status ?? 'unknown'}`);
  const type = (result.headers?.get?.('content-type') || '').toLowerCase();
  if (!type.startsWith('text/html')) throw new Error('HOLD: unexpected report content-type');
  const html = await result.text();
  if (html.length > 5 * 1024 * 1024 || !/^\s*<!doctype html>/i.test(html)) throw new Error('HOLD: invalid report payload');
  return html;
}

/** Mount inside the EXISTING admin-only UI element; never in public routes.
 * The iframe has a unique opaque origin: scripts work, same-origin access doesn't.
 */
export function mountAdminReview({ container, getAccessToken, fetcher = globalThis.fetch } = {}) {
  if (!container || typeof container.replaceChildren !== 'function') throw new Error('HOLD: missing admin container');
  const doc = container.ownerDocument;
  const button = doc.createElement('button'); button.type = 'button';
  button.textContent = 'AI 검토 목록 보기';
  const status = doc.createElement('span'); status.setAttribute('role', 'status');
  const frame = doc.createElement('iframe');
  frame.setAttribute('title', 'Vinyl Room 관리자 AI 검토 목록');
  frame.setAttribute('sandbox', 'allow-scripts'); // NEVER allow-same-origin
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.style.cssText = 'width:100%;min-height:75vh;border:0;display:none';
  container.replaceChildren(button, status, frame);
  const controller = new AbortController();
  button.addEventListener('click', async () => {
    button.disabled = true; status.textContent = '검토 목록 불러오는 중';
    try {
      const html = await loadAdminReview({ getAccessToken, fetcher, signal: controller.signal });
      if(controller.signal.aborted)return;
      frame.srcdoc = prepareReviewDocument(html, {weight: doc.documentElement.style.getPropertyValue('--vr-user-font-weight') || '320'});
      frame.style.display = 'block';
      status.textContent = '읽기 전용 검토 목록';
    } catch (error) {
      if(controller.signal.aborted)return;
      frame.removeAttribute('srcdoc'); frame.style.display = 'none';
      const code=/HTTP (\d{3})/.exec(error.message)?.[1];
      status.textContent = code==='404'?'검토 보고서 API가 연결되지 않았습니다. 운영 NAS 설치는 별도 승인이 필요합니다.':code==='401'||code==='403'?'관리자 인증에 실패했습니다. 검토 보고서를 표시하지 않습니다.':'검토 목록을 표시할 수 없습니다. 관리자 로그인 및 서버 연결을 확인하세요.';
    } finally { button.disabled = false; }
  });
  return () => { controller.abort(); frame.removeAttribute('srcdoc'); container.replaceChildren(); };
}

// srcdoc does not inherit HTTP CSP or the parent font; keep both boundaries explicit.
export function prepareReviewDocument(html,{weight='320'}={}){
 if(!['320','350','300'].includes(String(weight)))throw Error('HOLD: invalid font weight');
 const head=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">`;
 const style=`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300..500&display=swap"><style>body,h1,h2,h3,h4,h5,h6,p,div,span,small,strong,b,a,label,button,input,select,option,textarea,li,dt,dd,td,th,summary,pre{font-family:'Noto Sans KR',sans-serif!important;font-weight:${weight}!important;letter-spacing:-.025em!important;font-synthesis:none!important}body{line-height:1.45}</style>`;
 if(!/<head(?:\s[^>]*)?>/i.test(html)||!/<\/head>/i.test(html))throw Error('HOLD: report document head missing');
 return html.replace(/<head(?:\s[^>]*)?>/i,m=>m+head).replace(/<\/head>/i,style+'</head>');
}
