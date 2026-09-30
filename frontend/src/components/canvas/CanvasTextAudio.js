/** 文本/音频到音频的素材连线；文本首次连接时单次导入，不持续覆盖用户编辑。 */
import { setCanvasSelection } from './CanvasGroups.js';

export function isTextAudioConnection(nodes, connection) {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  return ['text', 'audio'].includes(source?.type) && target?.type === 'audio' && source.id !== target.id
    && (source.type !== 'text' || Boolean(source.data.content?.trim()))
    && (!connection.sourceHandle || connection.sourceHandle === `${source.type}-output`)
    && (!connection.targetHandle || connection.targetHandle === 'audio-input');
}

export function connectTextToAudio(nodes, connection) {
  if (!isTextAudioConnection(nodes, connection)) return nodes;
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  const sourceIds = [...new Set([...(target.data.audioSourceIds || []), source.id])];
  if (target.data.audioSourceIds?.includes(source.id)) return nodes;
  const imported = nodes.map((node) => node.id === target.id ? { ...node, data: {
    ...node.data,
    audioSourceIds: sourceIds,
    ...(source.type === 'text' ? {
      prompt: source.data.content,
      textSourceId: source.id,
      promptImportVersion: (node.data.promptImportVersion || 0) + 1,
    } : {}),
    persistenceState: 'draft',
  } } : node);
  return setCanvasSelection(imported, [target.id], true);
}

export function disconnectTextAudio(nodes, targetId, sourceId) {
  return nodes.map((node) => node.id === targetId
    ? { ...node, data: {
      ...node.data,
      audioSourceIds: sourceId == null ? [] : (node.data.audioSourceIds || []).filter((id) => id !== sourceId),
      textSourceId: sourceId == null || node.data.textSourceId === sourceId ? null : node.data.textSourceId,
    } } : node);
}

export function getTextAudioEdges(nodes) {
  return nodes.filter((node) => node.type === 'audio').flatMap((target) => {
    const legacyIds = target.data.textSourceId ? [target.data.textSourceId] : [];
    return [...new Set([...(target.data.audioSourceIds || []), ...legacyIds])].flatMap((sourceId) => {
      const source = nodes.find((node) => node.id === sourceId);
      if (!['text', 'audio'].includes(source?.type)) return [];
      return [{ id: `audio-material:${source.id}:${target.id}`, source: source.id,
        target: target.id, sourceHandle: `${source.type}-output`, targetHandle: 'audio-input',
        style: { stroke: 'var(--color-stroke-accent)' } }];
    });
  });
}
