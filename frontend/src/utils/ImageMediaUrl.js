/** 仅供图片编辑读取像素；业务提交仍保留原始素材地址。 */
export function toImageMediaUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://www.chengxvblog.top'
      || parsed.username || parsed.password
      || !parsed.pathname.startsWith('/media/origin/')) return url;
    return `/__image-media${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
