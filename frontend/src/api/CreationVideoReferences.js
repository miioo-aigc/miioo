/** 视频提交前检查原图；预览加载与上游可访问性不同，客户端检查只作为第一道门禁。 */
export async function waitForCreationVideoImages(references, { signal, ImageClass = globalThis.Image, timeoutMs = 20000 } = {}) {
  for (const reference of references) {
    if (!reference) continue;
    const url = String(reference.url || '').trim();
    const label = reference.name || '参考图片';
    if (signal?.aborted) throw new DOMException('请求已停止', 'AbortError');
    // 仅有资产编号时由后端解析原文件；服务商素材身份也不交给浏览器加载。
    if (!url && reference.assetId) continue;
    if (url.toLowerCase().startsWith('asset://')) continue;
    let parsed;
    try { parsed = new URL(url, 'https://localhost'); } catch { /* 下方统一报错 */ }
    if (!parsed || !/^https?:$/.test(parsed.protocol)
      || parsed.pathname.toLowerCase().endsWith('.avif')
      || parsed.pathname.includes('/derived/assets/')
      || parsed.pathname.startsWith('/api/media/downloads/')
      || !url) {
      throw new Error(`${label}缺少可用原图，请移除后重新添加`);
    }
    await new Promise((resolve, reject) => {
      const image = new ImageClass();
      let timer;
      const finish = (error) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        image.onload = null;
        image.onerror = null;
        if (error) { image.src = ''; reject(error); } else resolve();
      };
      const abort = () => finish(new DOMException('请求已停止', 'AbortError'));
      image.onload = () => finish(image.naturalWidth > 0 ? null : new Error(`${label}无法读取，请重新添加`));
      image.onerror = () => finish(new Error(`${label}加载失败，请检查网络或重新添加图片`));
      timer = setTimeout(() => finish(new Error(`${label}加载超时，请稍后重试`)), timeoutMs);
      signal?.addEventListener('abort', abort, { once: true });
      image.src = url;
    });
  }
}
