/** 原图尺寸缓存与并发合并；失败不缓存，展示尺寸不能作为校验依据。 */
export const MAX_VIDEO_REFERENCE_PIXELS = 36_000_000;
const caches = new WeakMap();
const files = new WeakMap();

function observe(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('请求已停止', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('请求已停止', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function probe(url, ImageClass, timeoutMs) {
  return new Promise((resolve, reject) => {
    const image = new ImageClass();
    const finish = (error) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) { image.src = ''; reject(error); }
      else resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    const timer = setTimeout(() => finish(new Error('读取超时')), timeoutMs);
    // naturalWidth/Height 不需要跨域画布权限，避免 crossOrigin 误拦截 CDN 原图。
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : new Error('尺寸无效'));
    image.onerror = () => finish(new Error('加载失败'));
    image.src = url;
  });
}

export async function readVideoReferenceSize(source, { signal, ImageClass = globalThis.Image, timeoutMs = 20000, retries = 1, version = '' } = {}) {
  signal?.throwIfAborted();
  if (!ImageClass) throw new Error('无法读取图片尺寸');
  const file = typeof Blob !== 'undefined' && source instanceof Blob;
  let cache = caches.get(ImageClass);
  if (!cache) { cache = new Map(); caches.set(ImageClass, cache); }
  const key = JSON.stringify([source, version]);
  const entry = file ? files.get(source) : cache.get(key);
  if (entry && (file || entry.expires > Date.now())) return observe(entry.promise, signal);
  const url = file ? URL.createObjectURL(source) : source;
  const promise = (async () => {
    try {
      for (let attempt = 0; ; attempt++) {
        try { return await probe(url, ImageClass, timeoutMs); }
        catch (error) { if (attempt >= retries) throw error; }
      }
    } finally { if (file) URL.revokeObjectURL(url); }
  })();
  const next = { promise, expires: Date.now() + 300000 };
  if (file) files.set(source, next);
  else {
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(key, next);
  }
  promise.catch(() => {
    if (file) files.delete(source);
    else if (cache.get(key) === next) cache.delete(key);
  });
  return observe(promise, signal);
}

export async function assertVideoReferencePixels(source, label = '参考图片', options = {}) {
  let size;
  try { size = await readVideoReferenceSize(source, options); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(label + '暂时无法读取原图尺寸（' + error.message + '），已停止生成，请重试或重新添加图片', { cause: error });
  }
  if (size.width * size.height > MAX_VIDEO_REFERENCE_PIXELS) {
    throw new Error(label + '尺寸为 ' + size.width + ' × ' + size.height + '，超过 3600 万像素，已停止生成，请缩小图片后重新添加');
  }
  return size;
}
