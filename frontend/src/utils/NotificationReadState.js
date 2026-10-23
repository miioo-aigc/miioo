export const notificationKey = (item) => `${item.kind || 'notification'}:${item.id}`;

export function mergeConfirmedReads(items, confirmed) {
  return items.map((item) => confirmed.has(notificationKey(item))
    ? { ...item, unread: false, is_read: true, isRead: true } : item);
}
