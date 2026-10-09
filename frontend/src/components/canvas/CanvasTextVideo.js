/** 文本到视频的素材连线；只保存来源身份，不把正文写入视频输入框。 */
import { setCanvasSelection } from './CanvasGroups.js';

export function isCanvasTextVideoConnection(nodes, connection) {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  return source?.type === 'text' && target?.type === 'video' && source.id !== target.id
    && (!connection.sourceHandle || connection.sourceHandle === 'text-output')
    && (!connection.targetHandle || connection.targetHandle === 'video-input');
}

export function connectCanvasTextVideo(nodes, connection) {
  if (!isCanvasTextVideoConnection(nodes, connection)) return nodes;
  return setCanvasSelection(nodes.map((node) => node.id === connection.target ? {
    ...node,
    data: { ...node.data, textSourceIds: [...new Set([...(node.data.textSourceIds || []), connection.source])], persistenceState: 'draft' },
  } : node), [connection.target], true);
}

export function disconnectCanvasTextVideo(nodes, target, source) {
  return nodes.map((node) => node.id === target ? {
    ...node,
    data: { ...node.data, textSourceIds: (node.data.textSourceIds || []).filter((id) => id !== source), persistenceState: 'draft' },
  } : node);
}

export function getCanvasTextVideoEdges(nodes) {
  return nodes.filter((target) => target.type === 'video').flatMap((target) => [...new Set(target.data.textSourceIds || [])]
    .map((sourceId) => nodes.find((source) => source.id === sourceId))
    .filter((source) => source?.type === 'text')
    .map((source) => ({
      id: `text-video:${source.id}:${target.id}`,
      source: source.id,
      target: target.id,
      sourceHandle: 'text-output',
      targetHandle: 'video-input',
      style: { stroke: 'var(--color-stroke-accent)' },
    })));
}
