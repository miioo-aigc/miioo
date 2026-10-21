function mediaUrl(value, normalizeMediaUrl) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const candidate = value.trim();
  try {
    const parsed = new URL(candidate, 'https://canvas.invalid/');
    if (!['http:', 'https:'].includes(parsed.protocol) || candidate.startsWith('//') || candidate.includes('\\')) return undefined;
    // 相对路径从服务根目录恢复，不能跟随当前画布路由。
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(candidate);
    return normalizeMediaUrl(absolute ? candidate : `${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return undefined;
  }
}

/** 媒体地址只在加载后注入运行态，保存时由文档适配器剥离。 */
export async function resolveCanvasDocumentAssets(canvasId, nodes, resolve, { signal, normalizeMediaUrl = (value) => value } = {}) {
  const ids = [...new Set(nodes.map((node) => node.data?.asset?.asset_id).filter(Boolean))];
  const views = new Map();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    const response = await resolve(canvasId, batch, { signal });
    if (!Array.isArray(response?.items)) throw new Error('素材解析响应缺少约定的素材列表');
    for (const id of batch) {
      const view = response.items.find((item) => item.asset_id === id);
      if (!view || !['ready', 'trashed', 'forbidden', 'missing'].includes(view.availability)) throw new Error('素材解析响应缺少完整的可用状态');
      const visible = ['ready', 'trashed'].includes(view.availability);
      const url = visible ? [view.original_url, view.preview_url, view.download_url].map((value) => mediaUrl(value, normalizeMediaUrl)).find(Boolean) : undefined;
      if (visible && !url) throw new Error('画布素材恢复失败：可用素材缺少有效媒体地址，已停止加载以保护原内容');
      views.set(id, { asset_id: id, asset_type: view.media_type, availability: view.availability,
        ...(visible ? { name: view.title, url, previewUrl: mediaUrl(view.preview_url, normalizeMediaUrl), posterUrl: mediaUrl(view.poster_url, normalizeMediaUrl),
          width: view.width, height: view.height, duration_ms: view.duration_ms } : {}) });
    }
  }
  return nodes.map((node) => {
    const view = views.get(node.data?.asset?.asset_id);
    return view ? { ...node, data: { ...node.data, asset: { ...view,
      asset_type: view.asset_type || node.data.asset.asset_type, source: node.data.asset.source } } } : node;
  });
}
