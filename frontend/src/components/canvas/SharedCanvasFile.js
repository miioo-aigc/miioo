/** 分享文档转为现有可导入文件；只读取作者保存状态及公开素材。 */
import { readCanvasDocument } from './CanvasDocument.js';
import { safeCanvasMediaUrl } from './CanvasShareDocument.js';
import { serializeCanvasFile } from './CanvasFile.js';

export async function serializeSharedCanvasFile(payload, origin) {
  const assets = new Map((payload.assets || []).map((asset) => [asset.asset_id, asset]));
  const mediaUrl = (value) => {
    const safe = safeCanvasMediaUrl(value);
    return safe ? new URL(safe, origin).href : undefined;
  };
  const nodes = readCanvasDocument(payload).nodes.map((node) => {
    const asset = assets.get(node.data.asset?.asset_id);
    if (!asset) return node;
    const ready = asset.availability === 'ready';
    return { ...node, data: { ...node.data, asset: {
      asset_id: asset.asset_id, asset_type: node.type, availability: asset.availability,
      ...(ready ? {
        name: asset.title, url: mediaUrl(asset.original_url) || mediaUrl(asset.preview_url),
        previewUrl: mediaUrl(asset.preview_url), posterUrl: mediaUrl(asset.poster_url),
        width: asset.width, height: asset.height, duration_ms: asset.duration_ms,
      } : {}),
    } } };
  });
  return serializeCanvasFile(nodes, payload.title || '分享画布');
}

export function downloadSharedCanvasFile(text, title) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = Array.from(title || "分享画布").map((char) => char.charCodeAt(0) < 32 || [60, 62, 58, 34, 47, 92, 124, 63, 42].includes(char.charCodeAt(0)) ? "_" : char).join("") + ".miioo.json";
  try {
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
