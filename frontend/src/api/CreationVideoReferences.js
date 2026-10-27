import { assertVideoReferencePixels } from '../utils/VideoReferencePixels.js';
/** 视频提交前检查原图；预览加载与上游可访问性不同，客户端检查只作为第一道门禁。 */
export async function waitForCreationVideoImages(references, { signal, ImageClass = globalThis.Image, timeoutMs = 20000, retries = 1 } = {}) {
  for (const reference of references) {
    if (!reference) continue;
    const url = String(reference.url || '').trim();
    const label = reference.name || '参考图片';
    if (signal?.aborted) throw new DOMException('请求已停止', 'AbortError');

    let parsed;
    try { parsed = new URL(url, 'https://localhost'); } catch { /* 下方统一报错 */ }
    if (!parsed || !/^https?:$/.test(parsed.protocol)
      || parsed.pathname.toLowerCase().endsWith('.avif')
      || parsed.pathname.includes('/derived/assets/')
      || parsed.pathname.startsWith('/api/media/downloads/')
      || !url) {
      throw new Error(`${label}缺少可用原图，请移除后重新添加`);
    }
    await assertVideoReferencePixels(url, label, { signal, ImageClass, timeoutMs, retries, version: reference.version });
  }
}
