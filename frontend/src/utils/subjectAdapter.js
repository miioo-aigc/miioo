/**
 * @file subjectAdapter.js
 * @structure-index
 *
 * 统一主体接口字段和前端字段的纯转换；不读取页面状态、不调用 API。
 */

import { normalizeImageUrl } from './imageUrl';

function getReferenceUrls(subject) {
  const values = [
    subject?.reference_image_url,
    subject?.referenceImageUrl,
    ...(Array.isArray(subject?.reference_image_urls) ? subject.reference_image_urls : []),
    ...(Array.isArray(subject?.referenceImageUrls) ? subject.referenceImageUrls : []),
    ...(Array.isArray(subject?.reference_images) ? subject.reference_images : []),
    ...(Array.isArray(subject?.referenceImages) ? subject.referenceImages : []),
  ];
  return values.map((value) => {
    if (typeof value === 'string') return normalizeImageUrl(value) || value;
    return normalizeImageUrl(value?.url || value?.file_url || value?.fileUrl || value?.image_url || value?.imageUrl);
  }).filter(Boolean);
}

export function normalizeSubjects(items = []) {
  const list = (Array.isArray(items) ? items : []).map((item) => {
    // 主体卡片封面只能来自主体候选图的定稿字段。
    // reference_image_url 是生成输入参考图，不能作为封面兜底；否则参考图会被误显示成主体封面。
    const coverUrl = normalizeImageUrl(item.primary_image_url ?? item.image_url ?? item.imageUrl);
    const referenceUrls = new Set(getReferenceUrls(item));
    const imageUrl = coverUrl && !referenceUrls.has(coverUrl) ? coverUrl : null;
    return {
      ...item,
      desc: item.description ?? item.desc ?? '',
      imageUrl,
    };
  });

  list.sort((a, b) => {
    const timeA = a.created_at || a.createdAt || a.create_time || '';
    const timeB = b.created_at || b.createdAt || b.create_time || '';
    if (timeA && timeB) return timeA.localeCompare(timeB);
    return (a.name || '').localeCompare(b.name || '');
  });

  return list;
}
