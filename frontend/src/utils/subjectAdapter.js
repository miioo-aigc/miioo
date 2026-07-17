/**
 * @file subjectAdapter.js
 * @structure-index
 *
 * 统一主体接口字段和前端字段的纯转换；不读取页面状态、不调用 API。
 */

import { normalizeImageUrl } from './imageUrl';

export function normalizeSubjects(items = []) {
  const list = (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    desc: item.description ?? item.desc ?? '',
    imageUrl: normalizeImageUrl(item.primary_image_url ?? item.image_url ?? item.imageUrl ?? item.reference_image_url),
  }));

  list.sort((a, b) => {
    const timeA = a.created_at || a.createdAt || a.create_time || '';
    const timeB = b.created_at || b.createdAt || b.create_time || '';
    if (timeA && timeB) return timeA.localeCompare(timeB);
    return (a.name || '').localeCompare(b.name || '');
  });

  return list;
}
