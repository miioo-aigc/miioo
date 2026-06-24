import { normalizeImageUrl } from './imageUrl';

export default function normalizeSubjects(items) {
  const list = (items || []).map(item => ({
    ...item,
    desc: item.description ?? item.desc ?? '',
    imageUrl: normalizeImageUrl(item.primary_image_url ?? item.image_url ?? item.imageUrl),
  }));
  list.sort((a, b) => {
    const timeA = a.created_at || a.createdAt || a.create_time || '';
    const timeB = b.created_at || b.createdAt || b.create_time || '';
    if (timeA && timeB) return timeA.localeCompare(timeB);
    return (a.name || '').localeCompare(b.name || '');
  });
  return list;
}
