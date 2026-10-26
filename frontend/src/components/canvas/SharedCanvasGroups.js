import { getCanvasStackPresentation } from './CanvasNodeActions.js';
import { safeCanvasMediaUrl } from './CanvasShareDocument.js';

/** 临时切换折叠不修改公开文档；折叠预览只使用公开接口提供的安全素材。 */
export function getSharedCanvasPresentation(graph, toggledIds = []) {
  const toggled = new Set(toggledIds);
  const nodes = graph.nodes.map((node) => node.type === 'canvasGroup' && toggled.has(node.id)
    ? { ...node, data: { ...node.data, stacked: !node.data.stacked } } : node);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const presentation = getCanvasStackPresentation(nodes, graph.edges);
  return { ...presentation, nodes: presentation.nodes.map((node) => node.type !== 'canvasGroup' ? {
    ...node, style: { ...node.style, pointerEvents: 'all' },
  } : {
    ...node, style: { ...node.style, pointerEvents: 'all' }, data: { ...node.data, stackMembers: node.data.stackMembers.map((member) => {
      const source = byId.get(member.id);
      const asset = source.data.asset;
      const type = source.data.nodeType || source.data.mediaType;
      const url = asset?.availability === 'ready' ? (type === 'image'
        ? safeCanvasMediaUrl(asset.thumbnail_url) || safeCanvasMediaUrl(asset.preview_url) || safeCanvasMediaUrl(asset.original_url)
        : safeCanvasMediaUrl(asset.preview_url)) : undefined;
      return { ...member, type, readOnly: true, asset: url ? { url, thumbnail_url: safeCanvasMediaUrl(asset.thumbnail_url), poster_url: safeCanvasMediaUrl(asset.poster_url), name: asset.title } : null,
        width: source.data.mediaSize?.width || member.width,
        height: ['image', 'video'].includes(type) ? source.data.mediaSize?.height || member.height : member.height };
    }) },
  }) };
}
