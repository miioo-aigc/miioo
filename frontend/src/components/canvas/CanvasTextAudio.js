/** 文本到音频的单次导入；连线只保留来源，不持续覆盖用户编辑。 */
import { setCanvasSelection } from './CanvasGroups.js';

export function isTextAudioConnection(nodes, connection) {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  return source?.type === 'text' && target?.type === 'audio'
    && Boolean(source.data.content?.trim())
    && (!connection.sourceHandle || connection.sourceHandle === 'text-output')
    && (!connection.targetHandle || connection.targetHandle === 'audio-input');
}

export function connectTextToAudio(nodes, connection) {
  if (!isTextAudioConnection(nodes, connection)) return nodes;
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (target.data.textSourceId === source.id) return nodes;
  const imported = nodes.map((node) => node.id === target.id ? { ...node, data: {
    ...node.data, prompt: source.data.content, textSourceId: source.id,
    promptImportVersion: (node.data.promptImportVersion || 0) + 1,
    persistenceState: 'draft',
  } } : node);
  return setCanvasSelection(imported, [target.id], true);
}

export function disconnectTextAudio(nodes, targetId) {
  return nodes.map((node) => node.id === targetId
    ? { ...node, data: { ...node.data, textSourceId: null } } : node);
}

export function getTextAudioEdges(nodes) {
  return nodes.filter((node) => node.type === 'audio' && nodes.some((source) => source.id === node.data.textSourceId && source.type === 'text'))
    .map((node) => ({ id: `text-audio:${node.data.textSourceId}:${node.id}`, source: node.data.textSourceId,
      target: node.id, sourceHandle: 'text-output', targetHandle: 'audio-input',
      style: { stroke: 'var(--color-stroke-accent)' } }));
}
