const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch } from './request.js';

export async function apiUpdateProfile({ nickname, avatar_url }) {
  const res = await authFetch(`${BASE}/api/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, avatar_url }),
  });
  return res.json();
}

export async function apiDeleteAccount() {
  await authFetch(`${BASE}/api/users/me`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiGetCurrentUser() {
  const res = await authFetch(`${BASE}/api/auth/me`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiGetNotifications({ is_read, type } = {}) {
  const params = new URLSearchParams();
  if (is_read !== undefined) params.append('is_read', is_read);
  if (type) params.append('type', type);
  const query = params.toString();
  const url = query ? `${BASE}/api/notifications?${query}` : `${BASE}/api/notifications`;
  const res = await authFetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

export async function apiGetUnreadCount() {
  const res = await authFetch(`${BASE}/api/notifications/unread-count`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiMarkNotificationRead(notificationId) {
  await authFetch(`${BASE}/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiMarkAllNotificationsRead() {
  await authFetch(`${BASE}/api/notifications/read-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiDeleteNotification(notificationId) {
  await authFetch(`${BASE}/api/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiClearAllNotifications() {
  // 后端无 clear-all 接口，改用 read-all（全部标为已读）
  await authFetch(`${BASE}/api/notifications/read-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiUpdateUser(data) {
  return apiUpdateProfile(data);
}

// ── 后端无对应接口的功能（暂保留 mock，待后端确认是否规划）─────────────────
// 以下接口后端均未提供：手机换绑（使用新接口 /api/users/me/phone/unbind/*）

export async function apiUploadAvatar(file) {
  // 后端仅有 /api/images/upload（通用图片上传），无专属头像接口
  // 此处调用通用上传后，需配合 apiUpdateProfile({ avatar_url }) 更新
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(`${BASE}/api/images/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  return { avatarUrl: data.url || data.file_url };
}

export async function apiGetWechatQrCode() {
  const res = await authFetch(`${BASE}/api/users/me/wechat/qrcode`);
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch {}
    throw new Error(`获取微信绑定二维码失败（${res.status}）：${detail}`);
  }
  const data = await res.json();
  return {
    ticket: data.ticket,
    qrCodeValue: data.qr_code_value,
    expiresIn: data.expires_in,
  };
}

export async function apiPollWechatBind(ticket) {
  const res = await authFetch(`${BASE}/api/users/me/wechat/poll/${encodeURIComponent(ticket)}`);
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch {}
    const err = new Error(`轮询微信绑定状态失败（${res.status}）：${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function apiBindWechat({ wechat_id, wechat_nickname, wechat_avatar_url }) {
  const res = await authFetch(`${BASE}/api/users/me/wechat/bind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wechat_id, wechat_nickname, wechat_avatar_url }),
  });
  return res.json();
}

export async function apiUnbindWechat() {
  await authFetch(`${BASE}/api/users/me/wechat`, {
    method: 'DELETE',
  });
}

export async function apiSendPhoneCode(phone) {
  await authFetch(`${BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
}

export async function apiVerifyPhoneCode(phone, code) {
  try {
    await authFetch(`${BASE}/api/auth/verify-code-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    return { valid: true };
  } catch {
    return { valid: false };
  }
}

// TODO: 后端换绑手机接口待落地，暂时 mock
export async function apiRebindPhone(newPhone, code) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { success: true };
  }
  return authFetch(`${BASE}/api/users/me/phone/rebind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: newPhone, code }),
  });
}

export async function apiSendPhoneUnbindCode() {
  await authFetch(`${BASE}/api/users/me/phone/unbind/send-code`, {
    method: 'POST',
  });
}

export async function apiUnbindPhone(code) {
  await authFetch(`${BASE}/api/users/me/phone/unbind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}
