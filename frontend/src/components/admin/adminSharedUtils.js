export const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
export const FONT_REGULAR = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export function formatTime(value) {
  if (!value) return '未更新';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未更新';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(value, fallback = '未记录') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}


export function mapAccountFilterValue(filterValue, matchValue) {
  if (filterValue === 'all') return undefined;
  if (matchValue === 'active') return filterValue === 'active';
  if (matchValue === 'admin') return filterValue === 'admin';
  return undefined;
}

