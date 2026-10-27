import { authFetch } from './request.js';
import { normalizeImageUrl } from '../utils/imageUrl.js';
import { waitForCreationVideoImages } from './CreationVideoReferences.js';
import { assertVideoReferencePixels } from '../utils/VideoReferencePixels.js';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

/** 只重试读取操作；超时覆盖响应体读取，取消时不发送生成请求。 */
async function readOriginalResource(url, kind, signal, timeoutMs) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    let rejectAbort;
    const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
    const abort = () => {
      controller.abort();
      rejectAbort(new DOMException('请求已停止', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    let timer;
    try {
      const expired = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('原图信息读取超时'));
        }, timeoutMs);
      });
      return await Promise.race([expired, cancelled, (async () => {
        const response = await authFetch(url, { signal: controller.signal });
        if (!response.ok) {
          const error = new Error('原图信息读取失败');
          error.status = response.status;
          throw error;
        }
        return kind === 'blob' ? response.blob() : response.json();
      })()]);
    } catch (error) {
      signal?.throwIfAborted();
      const transient = !error.status || error.status >= 500 || [408, 429].includes(error.status);
      if (attempt >= 1 || !transient) throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
}

function readList(payload) {
  const list = Array.isArray(payload) ? payload : payload?.list ?? payload?.items ?? payload?.data;
  if (!Array.isArray(list)) throw new Error('素材列表读取失败');
  return list;
}

function liveImageReference(asset, name) {
  if (['video', 'audio'].includes(asset?.asset_type)) return null;
  if (asset?.asset_type !== 'image') throw new Error('无法确认认证素材类型');
  return { url: asset.source_url, version: asset.updated_at || '', name };
}

/** 仅本站或配置的接口域可携带认证信息，外部 CDN 始终直接读取图片。 */
function controlledOriginal(url) {
  const origin = globalThis.location?.origin || 'https://localhost';
  const parsed = new URL(url, origin);
  if (!parsed.pathname.startsWith('/api/media/downloads/')) return null;
  const api = new URL(BASE || origin, origin);
  if (![origin, api.origin].includes(parsed.origin)) throw new Error('原图下载地址不受信任');
  return url.startsWith('/') ? BASE + url : url;
}

export function collectVideoRequestImages(data = {}) {
  const refs = (data.attachments || []).filter((item) => item?.asset_type === 'image')
    .map((item) => ({ url: item.url, assetId: item.asset_id }));
  for (const item of data.reference_images || []) {
    const ref = typeof item === 'string' ? { url: item } : { url: item?.url, assetId: item?.asset_id };
    if (!refs.some((existing) => ref.assetId
      ? existing.assetId === ref.assetId && existing.url === ref.url
      : ref.url && existing.url === ref.url)) refs.push(ref);
  }
  for (const assetId of data.reference_image_asset_ids || []) {
    if (!refs.some((ref) => ref.assetId === assetId)) refs.push({ assetId });
  }
  for (const [key, name] of [['first_frame', '首帧图片'], ['last_frame', '尾帧图片']]) {
    if (data[key + '_url'] || data[key + '_asset_id']) refs.push({ url: data[key + '_url'], assetId: data[key + '_asset_id'], name });
  }
  for (const subject of data.subjects || []) {
    for (const url of subject.images || []) refs.push({ url, name: (subject.name || '主体') + '参考图片' });
  }
  for (const segment of data.multiframe_segments || []) refs.push({ url: segment.key_image, name: '多帧参考图片' });
  return refs;
}

/** 资产编号优先，与后端取图一致；不缓存详情，防止同一资产替换文件后沿用旧地址。 */
export async function validateVideoRequestImages(data = {}, { signal, timeoutMs = 20000, ImageClass = globalThis.Image } = {}) {
  const assets = new Map();
  const refs = collectVideoRequestImages(data);
  const read = (path) => {
    if (!assets.has(path)) assets.set(path, readOriginalResource(BASE + path, 'json', signal, timeoutMs));
    return assets.get(path);
  };
  const groupAssets = async (groupId) => readList(await read('/api/live-materials/groups/' + encodeURIComponent(groupId) + '/assets'));
  const certifiedAssets = new Map();
  const findCertified = async (url) => {
    if (certifiedAssets.has(url)) return certifiedAssets.get(url);
    const groups = readList(await read('/api/live-materials/groups'));
    let partialError;
    // 找到目标即停止；无关组失败不能误拦截其他组的正常素材。
    for (const group of groups) {
      try {
        for (const asset of await groupAssets(group.id)) certifiedAssets.set(asset.asset_ref_url, asset);
      } catch (error) {
        signal?.throwIfAborted();
        partialError = error;
      }
      if (certifiedAssets.has(url)) return certifiedAssets.get(url);
    }
    throw partialError || new Error('找不到认证素材原图');
  };
  const certifiedImage = async (asset, name) => {
    if (asset?.asset_type === 'image' && !asset.source_url && asset.id) {
      asset = await read('/api/live-materials/assets/' + encodeURIComponent(asset.id));
    }
    return liveImageReference(asset, name);
  };
  try {
    const live = data.provider_params?.live_material;
    if (live) {
      const list = await groupAssets(live.group_id);
      for (const id of live.asset_ids || []) {
        const asset = list.find((item) => item.id === id || item.upstream_asset_id === id);
        if (!asset) throw new Error('找不到认证素材原图');
        const ref = await certifiedImage(asset, '认证参考图片');
        if (ref) refs.push(ref);
      }
    }
    for (const [index, ref] of refs.entries()) {
      signal?.throwIfAborted();
      ref.name ||= '参考图片 ' + (index + 1);
      if (ref.assetId) {
        const asset = await read('/api/assets/' + encodeURIComponent(ref.assetId));
        ref.url = asset.original_url || asset.originalUrl || asset.file_url || asset.fileUrl || '';
        ref.version = asset.content_hash || asset.updated_at || '';
      }
      if (String(ref.url || '').startsWith('asset://')) {
        const original = await certifiedImage(await findCertified(ref.url), ref.name);
        if (!original) throw new Error(ref.name + '不是图片素材');
        Object.assign(ref, original);
      }
      ref.url = normalizeImageUrl(ref.url) || '';
      const download = controlledOriginal(ref.url);
      if (download) {
        const blob = await readOriginalResource(download, 'blob', signal, timeoutMs);
        await assertVideoReferencePixels(blob, ref.name, { signal, timeoutMs, ImageClass });
      } else {
        await waitForCreationVideoImages([ref], { signal, timeoutMs, ImageClass });
      }
    }
  } catch (error) {
    if (error.name === 'AbortError' || error.message.includes('已停止生成')) throw error;
    throw new Error('参考图片原图校验失败（' + error.message + '），已停止生成，请重试或重新添加图片', { cause: error });
  }
  signal?.throwIfAborted();
}
