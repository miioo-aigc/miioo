/** 本地抽帧使用同源代理；业务提交和生产环境仍使用原始媒体地址。 */
export function toVideoMediaUrl(url, isDevelopment = import.meta.env?.DEV === true) {
  if (!isDevelopment || !url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://www.chengxvblog.top'
      || parsed.username || parsed.password
      || !parsed.pathname.startsWith('/media/origin/')) return url;
    return `/__dev-media${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
