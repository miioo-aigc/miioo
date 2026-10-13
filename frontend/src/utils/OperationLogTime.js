export function formatOperationLogTime(value) {
  if (!value) return '';
  const normalized = String(value).replace('T', ' ');
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
}
