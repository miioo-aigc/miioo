export const ONELINK_CALLBACK_PATH = '/onelink/callback';
export const CALLBACK_MESSAGES = {
  unauthorized: '你已取消账号授权，可以重新发起。',
  state_missing: '授权记录缺失，请允许浏览器保存登录会话后重试。',
  state_mismatch: '授权与本次操作不匹配，请重新登录。',
  state_invalid: '授权状态无效，请重新登录。',
  state_replayed: '此授权已被使用，请重新登录。',
  state_expired: '授权已过期，请重新登录。',
  invalid_response: '未收到完整授权结果，请重新登录。',
  verification_unavailable: '账号身份暂时无法验证，请联系管理员检查配置。',
  verification_failed: '账号身份验证失败，请重新登录。',
  identity_mismatch: '账号身份与当前环境不匹配，请联系管理员。',
};
export function validateOnelinkAuthorizeUrl(value, allowedOrigin) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== new URL(allowedOrigin).origin
    || url.username || url.password || url.hash) throw new Error('授权地址配置有误，请稍后重试');
  return url.href;
}
// 后端持有第三方凭证与授权事务，前端只接收状态。
export function captureOnelinkCallback(browser) {
  const path = browser.location.pathname.replace(/\/+$/, '');
  if (![ONELINK_CALLBACK_PATH, '/auth/onelink/callback'].includes(path)) return null;
  const params = new URL(browser.location.href).searchParams;
  browser.history.replaceState(null, '', ONELINK_CALLBACK_PATH);
  if (path !== ONELINK_CALLBACK_PATH || params.getAll('status').length !== 1
    || ['access_token', 'refresh_token'].some(key => params.has(key))) {
    return { error: '授权回调无效，请重新登录。' };
  }
  const status = params.get('status');
  return status === 'continue' ? { status } : { error: CALLBACK_MESSAGES[status] || '授权返回状态无效，请重新登录。' };
}
