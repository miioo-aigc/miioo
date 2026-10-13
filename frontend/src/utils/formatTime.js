const eastEightFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Etc/GMT-8',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function formatEastEightDateTime(value) {
  if (typeof value !== 'string' || !value.trim()) return '未知';
  let timestamp = value.trim().replace(' ', 'T');
  // 接口的无时区日期时间已是东八区，不能使用浏览器本地时区解析。
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(timestamp)) {
    timestamp += '+08:00';
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) return '未知';
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '未知';
  const parts = Object.fromEntries(eastEightFormatter.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * 将 ISO 时间戳格式化为友好的相对时间
 * @param {string} isoString - ISO 格式时间字符串
 * @returns {string} 格式化后的时间文本
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '未知';

  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // 刚刚（1分钟内）
  if (diffMin < 1) return '刚刚';

  // X分钟前（1-59分钟）
  if (diffMin < 60) return `${diffMin}分钟前`;

  // X小时前（1-23小时）
  if (diffHour < 24) return `${diffHour}小时前`;

  // 昨天
  if (diffDay === 1) return '昨天';

  // X天前（2-6天）
  if (diffDay < 7) return `${diffDay}天前`;

  // 具体日期（7天以上）
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // 今年的日期不显示年份
  if (year === now.getFullYear()) {
    return `${month}-${day}`;
  }

  // 往年的日期显示年份
  return `${year}-${month}-${day}`;
}
