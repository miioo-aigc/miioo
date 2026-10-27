/** 把浏览器底层异常转换成可读原因，不推断未知原因。 */
export function getCanvasFailureReason(error) {
  const message = String(error?.message || '').trim();
  if (/[\u3400-\u9fff]/u.test(message)) return message;
  if (/fetch|network|load failed|offline/i.test(message)) return '网络连接异常或素材地址已失效，请检查网络后重试';
  if (/abort/i.test(message) || error?.name === 'AbortError') return '操作已中断，请重试';
  if (/quota|memory|allocation|invalid string length/i.test(message)) return '浏览器可用空间或内存不足，请减少素材后重试';
  if (/circular|serialize/i.test(message)) return '画布数据无法转换为文件';
  return '发生未知错误，请重试';
}
