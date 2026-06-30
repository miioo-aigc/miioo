import { authFetch } from './request';

const BASE = import.meta.env.VITE_API_BASE_URL;

// 水印开关存于 ProviderResponse.default_image_watermark / default_video_watermark
// 读取时取第一个 provider 的值；更新时对所有 provider 批量 PATCH

export async function apiGetWatermarkSettings() {
  const res = await authFetch(`${BASE}/api/providers`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const providers = await res.json();
  const list = Array.isArray(providers) ? providers : (providers.items ?? []);
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
  const providers = await res.json();
  const list = Array.isArray(providers) ? providers : (providers.items ?? []);
  await Promise.all(
    list.map((p) =>
      authFetch(`${BASE}/api/providers/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_image_watermark: imageWatermark,
          default_video_watermark: videoWatermark,
        }),
      })
    )
  );
}
