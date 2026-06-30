const BASE = import.meta.env.VITE_API_BASE_URL;

import { setTokens, clearTokens as _clearTokens, authHeaders, authFetch } from './request.js';
export { clearTokens } from './request.js';

export async function apiSendCode(phone) {
  const res = await fetch(`${BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch {}
    const err = new Error(`发送验证码失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function apiLogin({ phone, password }) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function apiVerifyCodeLogin({ phone, code }) {
  const res = await fetch(`${BASE}/api/auth/verify-code-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await res.json();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function apiRegister({ phone, password, nickname }) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password, nickname }),
  });
  const data = await res.json();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function apiLogout() {
  try {
    await authFetch(`${BASE}/api/auth/logout`, { method: 'POST' });
  } catch {}
  _clearTokens(); // clearTokens 内部已清空业务缓存
}

export async function apiGetCurrentUser() {
  const res = await authFetch(`${BASE}/api/auth/me`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

// ── legacy aliases kept for existing callers ──────────────────────────────────

export async function sendVerificationCode(phone) {
  return apiSendCode(phone);
}

export async function loginWithPhone(phone, code) {
  return apiVerifyCodeLogin({ phone, code });
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
  const res = await fetch(`${BASE}/api/auth/wechat/qrcode`);
  const data = await res.json();
  // 字段映射：后端返回的字段 → 前端使用的字段
  return {
    qrcode_id: data.qrcode_id || data.session_id,
    raw_qr_code_value: data.raw_qr_code_value || data.qr_code_value,
    expire_seconds: data.expire_seconds || data.expires_in,
  };
}

// 2. 轮询二维码状态
// 响应 status: 'pending' | 'scanned' | 'confirmed' | 'need_bind_mobile' | 'expired' | 'error'
export async function apiPollWechatQrCodeStatus(qrcodeId) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { status: 'pending' };
  }
  const res = await fetch(`${BASE}/api/auth/wechat/poll/${encodeURIComponent(qrcodeId)}`);
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch {}
    const err = new Error(`轮询状态接口请求失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

// 3. 完成微信回调（根路径 ?code=&state= 回调）
export async function apiCompleteWechatCallback({ code, state }) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return {
      status: 'confirmed',
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
    };
  }
  const res = await fetch(`${BASE}/api/auth/wechat/callback/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || detail;
    } catch {}
    const err = new Error(`微信回调接口请求失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

// 4. 继续绑定手机号（微信登录 need_bind_mobile 分支）
export async function apiConfirmWechatLogin({ session_id, phone, sms_code }) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { access_token: 'mock-token', refresh_token: 'mock-refresh' };
  }
  const res = await fetch(`${BASE}/api/auth/wechat/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, phone, sms_code }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch {}
    const err = new Error(`绑定手机号失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (data.access_token) setTokens(data.access_token, data.refresh_token);
  return data;
}

// ── Legacy alias（旧的绑定接口，保留向后兼容）─────────────────
export async function apiBindMobileWithBindToken({ bind_token, mobile, sms_code }) {
  return apiConfirmWechatLogin({ session_id: bind_token, phone: mobile, sms_code });
}
