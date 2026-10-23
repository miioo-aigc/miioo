import { authFetch } from './request.js';
import { getDisplayErrorMessage } from './error.js';
import { invalidate } from '../utils/cache.js';
import { K } from '../utils/cacheKeys.js';

const BASE = import.meta.env.VITE_API_BASE_URL;

export async function readAnnouncementResponse(response, fallback) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const error = new Error(getDisplayErrorMessage(payload, fallback));
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function normalizeAnnouncement(item) {
  if (!item?.id) return null;
  return {
    id: String(item.id), title: item.title || '', content: item.content || '',
    announcementType: item.announcement_type || 'all',
    popupEnabled: item.popup_enabled !== false, isActive: item.is_active !== false,
    publishedAt: item.published_at || null, createdAt: item.created_at || null,
    updatedAt: item.updated_at || null, isRead: Boolean(item.is_read),
    kind: 'announcement', unread: !item.is_read, created_at: item.published_at || '',
  };
}

export function announcementBody(payload, creating = false) {
  const body = creating ? {
    title: '', content: '', announcement_type: 'all', popup_enabled: true,
    is_active: true, publish: false,
  } : {};
  for (const [key, field, type] of [
    ['title', 'title', 'string'], ['content', 'content', 'string'],
    ['announcementType', 'announcement_type', 'string'],
    ['popupEnabled', 'popup_enabled', 'boolean'], ['isActive', 'is_active', 'boolean'],
    ['publish', 'publish', 'boolean'],
  ]) {
    if (typeof payload[key] === type) body[field] = payload[key];
  }
  return body;
}

async function listAnnouncements(path, { page = 1, pageSize = 20, page_size, keyword = '', signal } = {}) {
  page = Math.max(1, Math.floor(Number(page) || 1));
  pageSize = Math.min(100, Math.max(1, Math.floor(Number(page_size ?? pageSize) || 20)));
  const query = new URLSearchParams({ page, page_size: pageSize });
  if (keyword.trim()) query.set('keyword', keyword.trim());
  // 已读和权限属于当前账号；不使用持久化缓存，也不去重跨账号请求。
  const response = await authFetch(`${BASE}${path}?${query}`, { signal });
  const data = await readAnnouncementResponse(response, '获取公告列表失败');
  return {
    list: (Array.isArray(data.list) ? data.list : []).map(normalizeAnnouncement).filter(Boolean),
    total: Number(data.total) || 0, page: Number(data.page) || page,
    pageSize: Number(data.page_size) || pageSize,
  };
}

export const apiGetAdminAnnouncements = (params) => listAnnouncements('/api/admin/announcements', params);
export const apiGetUserAnnouncements = (params) => listAnnouncements('/api/announcements', params);

async function writeAnnouncement(path, method, body, fallback) {
  const response = await authFetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await readAnnouncementResponse(response, fallback);
  invalidate(K.adminAnnouncementsPrefix());
  invalidate(K.announcementPopupPrefix());
  return data;
}

export async function apiCreateAdminAnnouncement(payload = {}) {
  return normalizeAnnouncement(await writeAnnouncement('/api/admin/announcements', 'POST', announcementBody(payload, true), '创建公告失败'));
}

export async function apiUpdateAdminAnnouncement(id, payload = {}) {
  return normalizeAnnouncement(await writeAnnouncement(`/api/admin/announcements/${encodeURIComponent(id)}`, 'PATCH', announcementBody(payload), '更新公告失败'));
}

export async function apiPublishAdminAnnouncement(id) {
  return normalizeAnnouncement(await writeAnnouncement(`/api/admin/announcements/${encodeURIComponent(id)}/publish`, 'POST', null, '发布公告失败'));
}

export function apiDeleteAdminAnnouncement(id) {
  return writeAnnouncement(`/api/admin/announcements/${encodeURIComponent(id)}`, 'DELETE', null, '删除公告失败');
}

export async function apiGetLatestAnnouncementPopup({ force = false, signal } = {}) {
  const response = await authFetch(`${BASE}/api/announcements/latest-popup?force=${Boolean(force)}`, { signal });
  const data = await readAnnouncementResponse(response, '获取系统公告失败');
  return normalizeAnnouncement(data.announcement);
}

export function apiMarkAnnouncementRead(id) {
  return writeAnnouncement(`/api/announcements/${encodeURIComponent(id)}/read`, 'POST', null, '标记公告已读失败');
}
