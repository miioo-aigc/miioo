import { authFetch } from './request';

const BASE = import.meta.env.VITE_API_BASE_URL;

async function readProviders(res) {
  if (!res.ok) throw new Error('读取水印设置失败，请关闭后重试');
  const data = await res.json();
  const list = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(list)) throw new Error('水印设置响应格式异常');
  return list;
}

// 水印开关存于 ProviderResponse.default_image_watermark / default_video_watermark
// 读取时取第一个 provider 的值；更新时对所有 provider 批量 PATCH

export async function apiGetWatermarkSettings() {
  const res = await authFetch(`${BASE}/api/providers`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const list = await readProviders(res);
  if (list.length === 0) return { imageWatermark: false, videoWatermark: false };
  const first = list[0];
  return {
    imageWatermark: first.default_image_watermark ?? false,
    videoWatermark: first.default_video_watermark ?? false,
  };
}

export async function apiUpdateWatermarkSettings({ imageWatermark, videoWatermark }) {
  const res = await authFetch(`${BASE}/api/providers`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const list = await readProviders(res);
  if (!list.length) throw new Error('暂无服务商，无法保存水印设置');
  const results = await Promise.allSettled(
    list.map(async (p) => {
      const response = await authFetch(`${BASE}/api/providers/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_image_watermark: imageWatermark,
          default_video_watermark: videoWatermark,
        }),
      });
      if (!response.ok) throw new Error('保存失败');
    })
  );
  const failed = list.filter((_, index) => results[index].status === 'rejected');
  if (failed.length) {
    throw new Error(`已保存 ${list.length - failed.length}/${list.length} 个服务商；失败：${failed.map((p) => p.name || p.id).join('、')}，请重试`);
  }
}
