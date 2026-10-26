const BASE = import.meta.env.VITE_API_BASE_URL;

export { apiGetUserAnnouncements, apiGetLatestAnnouncementPopup, apiMarkAnnouncementRead } from './Announcements.js';

import { authFetch } from './request.js';

export async function apiUpdateProfile({ nickname, avatar_url }) {
  const res = await authFetch(`${BASE}/api/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, avatar_url }),
  });
  const data = await requirePhoneSuccess(res);
  if (!data?.id || typeof data.nickname !== 'string') throw new Error('资料保存结果未确认，请重新打开资料核对');
  if (avatar_url !== undefined && (typeof data.avatar_url !== 'string' || !data.avatar_url || data.avatar_url.startsWith('blob:'))) throw new Error('头像保存结果未确认');
  return data;
}

export async function apiDeleteAccount() {
  const res = await authFetch(`${BASE}/api/users/me`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await requirePhoneSuccess(res);
  if (typeof data?.message !== 'string') throw new Error('注销结果未确认，请重新登录核对账号状态');
}

export async function apiGetCurrentUser() {
  const res = await authFetch(`${BASE}/api/auth/me`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const error = new Error(res.status >= 500
      ? `登录服务暂时不可用（${res.status}），请稍后重试`
      : `认证请求失败（${res.status}）`);
    error.status = res.status;
    error.isNetworkError = res.status >= 500;
    throw error;
  }
  return res.json();
}

export async function apiGetStorageUsage() {
  const res = await authFetch(`${BASE}/api/users/me/storage-usage`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
    } catch { /* 忽略非 JSON 错误响应 */ }
    const error = new Error(detail || `获取存储用量失败（${res.status}）`);
    error.status = res.status;
    throw error;
  }
  const data = await res.json();
  return {
    ...data,
    quotaBytes: data?.quota_bytes ?? data?.quotaBytes ?? 0,
    usedBytes: data?.used_bytes ?? data?.usedBytes ?? 0,
    availableBytes: data?.available_bytes ?? data?.availableBytes ?? 0,
    usageRatio: data?.usage_ratio ?? data?.usageRatio ?? 0,
    usagePercent: data?.usage_percent ?? data?.usagePercent ?? 0,
    reminderVersion: data?.reminder_version ?? data?.reminderVersion ?? 0,
    thresholdReminderPending: data?.threshold_reminder_pending ?? data?.thresholdReminderPending ?? false,
    writeBlocked: data?.write_blocked ?? data?.writeBlocked ?? false,
  };
}

export async function apiAcknowledgeStorageReminder(reminderVersion) {
  await authFetch(`${BASE}/api/users/me/storage-usage/reminders/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reminder_version: reminderVersion }),
  });
}

export async function apiGetNotifications({ is_read, type, page, pageSize = 10, signal } = {}) {
  const params = new URLSearchParams();
  if (is_read !== undefined) params.append('is_read', is_read);
  if (type) params.append('type', type);
  if (page !== undefined) {
    params.set('page', page);
    params.set('page_size', pageSize);
  }
  const query = params.toString();
  const url = query ? `${BASE}/api/notifications?${query}` : `${BASE}/api/notifications`;
  const res = await authFetch(url, {
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('加载消息失败，请重试');
  const data = await res.json();
  if (page !== undefined) {
    const list = Array.isArray(data) ? data : (data.list || data.items || []);
    return {
      list: list.map((item) => ({ ...item, unread: item.unread ?? !item.is_read })),
      hasMore: data.has_more ?? data.hasMore ?? (typeof data.total === 'number' ? page * pageSize < data.total : list.length === pageSize),
    };
  }
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
  const response = await authFetch(`${BASE}/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('标记消息已读失败，请重试');
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

export async function apiUploadAvatar(file) {
  // 保留通用上传：专用头像接口已存在，但正式合同尚未规定返回地址字段。
  // 上传不等于资料保存，调用方还需 PATCH avatar_url。
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(`${BASE}/api/images/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await requirePhoneSuccess(res);
  if (typeof data?.url !== 'string' || !data.url || data.url.startsWith('blob:')) throw new Error('头像上传结果未确认，请核对后重试');
  return { avatarUrl: data.url };
}

export async function apiGetWechatQrCode() {
  const res = await authFetch(`${BASE}/api/users/me/wechat/qrcode`);
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch { /* 忽略非 JSON 错误响应 */ }
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
    try { const body = await res.json(); detail = body?.detail || body?.message || detail; } catch { /* 忽略非 JSON 错误响应 */ }
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
  const res = await authFetch(`${BASE}/api/users/me/wechat`, {
    method: 'DELETE',
  });
  const data = await requirePhoneSuccess(res);
  if (!data?.id || data.wechat_bound !== false) throw new Error('解绑结果未确认，请重新打开个人资料核对');
  return data;
}

export async function apiSendPhoneCode(phone) {
  const res = await authFetch(`${BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await requirePhoneSuccess(res);
  if (data?.success !== true) throw new Error('验证码发送结果未确认，请稍后重试');
}

async function requirePhoneSuccess(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    const message = res.status >= 500 ? '服务暂时不可用，操作结果未确认，请稍后核对'
      : (typeof data?.detail === 'string' ? data.detail : '操作未通过，请检查输入或稍后重试');
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function apiVerifyPhoneCode(phone, code) {
  const res = await authFetch(`${BASE}/api/auth/verify-code-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await requirePhoneSuccess(res);
  if (typeof data?.access_token !== 'string' || !data.access_token) throw new Error('验证结果未确认，请重试');
  return { valid: true };
}

export async function apiRebindPhone(newPhone, code) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { success: true };
  }
  const res = await authFetch(`${BASE}/api/users/me/phone/rebind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: newPhone, code }),
  });
  const data = await requirePhoneSuccess(res);
  if (!data || data.phone !== newPhone) throw new Error('换绑结果未确认，请重新读取个人资料');
  return data;
}

export async function apiSendPhoneUnbindCode() {
  const res = await authFetch(`${BASE}/api/users/me/phone/unbind/send-code`, {
    method: 'POST',
  });
  await requirePhoneSuccess(res);
}

export async function apiUnbindPhone(code) {
  const res = await authFetch(`${BASE}/api/users/me/phone/unbind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  await requirePhoneSuccess(res);
}
