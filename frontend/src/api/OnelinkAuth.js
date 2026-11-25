import { buildOnelinkAuthorizeUrl } from '../utils/OnelinkAuthorize';
import { getAuthSessionGeneration, setTokens, getToken } from './request';
const BASE = import.meta.env.VITE_API_BASE_URL || '';
const AUTHORIZE_ORIGIN = import.meta.env.VITE_ONELINK_AUTHORIZE_ORIGIN || 'https://scenic.wanlian.cloud';

export async function readOnelinkResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail;
    const message = typeof detail === 'string' ? detail : detail?.message;
    throw Object.assign(new Error(message || '账号登录暂时不可用，请稍后重试'), {
      status: response.status, code: detail?.code ?? body.code ?? body.error_code,
      traceId: detail?.traceId ?? body.traceId, body,
    });
  }
  return body;
}
// 与短信登录相同，登录前请求不能依赖本项目已有 token，也不自动重放一次性完成请求。
async function post(path, body, signal) {
  const token = getToken();
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(BASE + path, {
    method: 'POST', credentials: 'include', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  return readOnelinkResponse(response);
}
async function performOnelinkStart({ signal, isCurrent = () => true, intent = 'login' } = {}) {
  if (!['login', 'bind'].includes(intent)) throw new Error('无效的授权操作');
  const keyString = import.meta.env.VITE_DECRYPTION_KEY;
  if (!keyString || new TextEncoder().encode(keyString).length !== 32) throw new Error('账号授权配置有误，请联系管理员');
  const generation = getAuthSessionGeneration();
  const data = await post('/api/auth/onelink/start', { intent }, signal);
  const url = await buildOnelinkAuthorizeUrl({ ...data, allowedOrigin: AUTHORIZE_ORIGIN, keyString });
  if (signal?.aborted || !isCurrent() || generation !== getAuthSessionGeneration()) return;
  window.location.assign(url);
  return { redirecting: true };
}
// 页面内所有入口共用一次发起请求；跳转后保持锁，失败或取消后才释放。
let authorization;
export function startOnelinkLogin(options = {}) {
  if (authorization) return authorization;
  authorization = performOnelinkStart(options).then(result => {
    if (!result?.redirecting) authorization = undefined;
    return result;
  }, error => {
    authorization = undefined;
    throw error;
  });
  return authorization;
}
// 从浏览器往返缓存恢复时重新加载，避免沿用旧授权事务和禁用状态。
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', event => {
    if (event.persisted && authorization) window.location.reload();
  });
}
let completion;
export function completeOnelinkLogin(capture, choice) {
  // 首次探测保留 Promise 供严格模式复用；用户明确选择账号后才产生下一次请求。
  if (!choice && completion) return completion;
  const request = (async () => {
    if (capture?.error || capture?.status !== 'continue') throw new Error(capture?.error || '请重新发起登录');
    const generation = getAuthSessionGeneration();
    let data;
    try { data = await post('/api/auth/onelink/complete', choice || {}); }
    catch (error) {
      if (error.status === 409 && error.code === 'ONELINK_ACCOUNT_CHOICE_REQUIRED') return { next: 'choice' };
      throw error;
    }
    if (generation !== getAuthSessionGeneration()) throw new Error('登录状态已变化，请重新操作');
    if (data.status === 'bound') return { next: 'bound' };
    if (data.status !== 'authenticated' || typeof data.access_token !== 'string' || !data.access_token.trim()
      || typeof data.refresh_token !== 'string' || !data.refresh_token.trim()) throw new Error('登录服务返回凭证不完整，请重新登录');
    setTokens(data.access_token, data.refresh_token);
    return { next: data.phone_bound === false ? 'phone_bind' : 'home' };
  })();
  if (!choice) completion = request;
  return request;
}
