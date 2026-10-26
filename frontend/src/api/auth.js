const BASE = import.meta.env.VITE_API_BASE_URL;

import { setTokens, getAuthSessionGeneration, clearTokens as _clearTokens, authFetch } from './request.js';
export { clearTokens } from './request.js';

async function readAuthResponse(res) {
  if (!res.ok) {
    const error = new Error(res.status >= 500
      ? `登录服务暂时不可用（${res.status}），请稍后重试`
      : `认证请求失败（${res.status}）`);
    error.status = res.status;
    try {
      const data = await res.json();
      if (res.status < 500 && typeof data.detail === 'string') error.message = data.detail;
    } catch { /* 网关可能返回 HTML，仍保留真实状态码。 */ }
    throw error;
  }
  return res.json();
}

export async function apiSendCode(phone) {
  const res = await fetch(`${BASE}/api/auth/send-code`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(`发送验证码失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function apiLogin({ phone, password }, { isCurrent = () => true } = {}) {
  const generation = getAuthSessionGeneration();
  const check = () => {
    if (!isCurrent() || generation !== getAuthSessionGeneration()) throw new DOMException("登录流程已失效", "AbortError");
  };
  check();
  const res = await fetch(`${BASE}/api/auth/login`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await readAuthResponse(res);
  check();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function apiVerifyCodeLogin({ phone, code }, { isCurrent = () => true } = {}) {
  const generation = getAuthSessionGeneration();
  const check = () => {
    if (!isCurrent() || generation !== getAuthSessionGeneration()) throw new DOMException('登录流程已失效', 'AbortError');
  };
  check();
  const res = await fetch(`${BASE}/api/auth/verify-code-login`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await readAuthResponse(res);
  check();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function apiRegister({ phone, password, nickname }, { isCurrent = () => true } = {}) {
  const generation = getAuthSessionGeneration();
  const check = () => {
    if (!isCurrent() || generation !== getAuthSessionGeneration()) throw new DOMException("登录流程已失效", "AbortError");
  };
  check();
  const res = await fetch(`${BASE}/api/auth/register`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password, nickname }),
  });
  const data = await readAuthResponse(res);
  check();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function apiLogout() {
  try {
    await authFetch(`${BASE}/api/auth/logout`, { method: 'POST' });
  } catch { /* 登出接口失败时仍清理本地令牌 */ }
  _clearTokens(); // clearTokens 内部已清空业务缓存
}

export async function apiGetCurrentUser() {
  const res = await authFetch(`${BASE}/api/auth/me`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return readAuthResponse(res);
}

// ── legacy aliases kept for existing callers ──────────────────────────────────

export async function sendVerificationCode(phone) {
  return apiSendCode(phone);
}

export async function loginWithPhone(phone, code, options) {
  return apiVerifyCodeLogin({ phone, code }, options);
}

// ── 微信扫码登录（新版，完整闭环实现）────────────────────────────────────
// 1. 生成二维码会话 → 返回真实微信授权链接
export async function apiGetWechatQrCode() {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return {
      qrcode_id: 'mock-qr-001',
      raw_qr_code_value: 'https://open.weixin.qq.com/connect/qrconnect?appid=wx2a38a6d71c1b6b72&redirect_uri=https%3A%2F%2Fmiiooai.com%2F&response_type=code&scope=snsapi_login&state=mock-state-001&#wechat_redirect',
      expire_seconds: 120,
    };
  }
  const res = await fetch(`${BASE}/api/auth/wechat/qrcode`, { credentials: 'include' });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(`获取微信二维码失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  // 字段映射：后端返回的字段 → 前端使用的字段
  const result = {
    qrcode_id: data.qrcode_id || data.session_id,
    raw_qr_code_value: data.raw_qr_code_value || data.qr_code_value,
    expire_seconds: data.expire_seconds || data.expires_in,
  };
  if (!result.qrcode_id || !result.raw_qr_code_value) {
    throw new Error('获取微信二维码失败：接口返回数据不完整');
  }
  return result;
}

// 2. 轮询二维码状态
// 响应 status: 'pending' | 'scanned' | 'confirmed' | 'need_bind_mobile' | 'expired' | 'error'
export async function apiPollWechatQrCodeStatus(qrcodeId, { isCurrent = () => true } = {}) {
  const generation = getAuthSessionGeneration();
  const current = () => isCurrent() && generation === getAuthSessionGeneration();
  const check = () => { if (!current()) throw new DOMException('登录流程已失效', 'AbortError'); };
  check();
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { status: 'pending' };
  }
  const res = await fetch(`${BASE}/api/auth/wechat/poll/${encodeURIComponent(qrcodeId)}`, { credentials: 'include' });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(`轮询状态接口请求失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  check();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

// 3. 完成微信回调（根路径 ?code=&state= 回调）
export async function apiCompleteWechatCallback({ code, state }, { isCurrent = () => true, commitTokens = true } = {}) {
  const generation = getAuthSessionGeneration();
  const check = () => { if (!isCurrent() || generation !== getAuthSessionGeneration()) throw new DOMException('登录流程已失效', 'AbortError'); };
  check();
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return {
      status: 'confirmed',
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
    };
  }
  const res = await fetch(`${BASE}/api/auth/wechat/callback/complete`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || detail;
    } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(`微信回调接口请求失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  check();
  if (commitTokens && data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

// 4. 继续绑定手机号（微信登录 need_bind_mobile 分支）
export async function apiConfirmWechatLogin({ session_id, phone, sms_code }, { isCurrent = () => true } = {}) {
  const generation = getAuthSessionGeneration();
  const current = () => isCurrent() && generation === getAuthSessionGeneration();
  const check = () => { if (!current()) throw new DOMException('登录流程已失效', 'AbortError'); };
  check();
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { access_token: 'mock-token', refresh_token: 'mock-refresh' };
  }
  const res = await fetch(`${BASE}/api/auth/wechat/confirm`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, phone, sms_code }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(`绑定手机号失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  check();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

// ── Legacy alias（旧的绑定接口，保留向后兼容）─────────────────
export async function apiBindMobileWithBindToken({ bind_token, mobile, sms_code }) {
  return apiConfirmWechatLogin({ session_id: bind_token, phone: mobile, sms_code });
}
