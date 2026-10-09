/** 文本/音频素材连线；未独立编辑的音频台词跟随文本来源，断线保留正文。 */
import { setCanvasSelection } from './CanvasGroups.js';

const joinText = (parts) => parts.filter((text) => text?.trim()).join('\n');

export function syncCanvasAudioText(nodes) {
  const sources = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => {
    const sync = node.data.textSync;
    if (node.type !== 'audio' || !sync || sync.edited) return node;
    if ((node.data.prompt || '') !== sync.prompt) {
      return { ...node, data: { ...node.data, textSync: { ...sync, edited: true } } };
    }
    const parts = sync.parts.map((part) => {
      const source = sources.get(part.sourceId);
      if (!source || source.type !== 'text' || !node.data.audioSourceIds?.includes(part.sourceId)) {
        return { ...part, sourceId: null };
      }
      return { ...part, text: source.data.content || '' };
    });
    const prompt = joinText([sync.base, ...parts.map((part) => part.text)]);
    if (JSON.stringify(parts) === JSON.stringify(sync.parts)) return node;
    return { ...node, data: { ...node.data, textSync: { ...sync, parts, prompt },
      ...(prompt !== sync.prompt ? { prompt, promptSnapshot: undefined,
        promptImportVersion: (node.data.promptImportVersion || 0) + 1 } : {}),
    } };
  });
}

export function isTextAudioConnection(nodes, connection) {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  return ['text', 'audio'].includes(source?.type) && target?.type === 'audio' && source.id !== target.id
    && (!connection.sourceHandle || connection.sourceHandle === `${source.type}-output`)
    && (!connection.targetHandle || connection.targetHandle === 'audio-input');
}

export function connectTextToAudio(nodes, connection) {
  if (!isTextAudioConnection(nodes, connection)) return nodes;
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  const sourceIds = [...new Set([...(target.data.audioSourceIds || []), source.id])];
  if (target.data.audioSourceIds?.includes(source.id)) return nodes;
  const prompt = joinText([target.data.prompt, source.data.content]);
  const previousSync = target.data.textSync;
  const textSync = previousSync && !previousSync.edited && previousSync.prompt === (target.data.prompt || '')
    ? { ...previousSync, prompt, parts: [...previousSync.parts, { sourceId: source.id, text: source.data.content || '' }] }
    : { base: target.data.prompt || '', prompt, parts: [{ sourceId: source.id, text: source.data.content || '' }], edited: Boolean(previousSync) };
  const imported = nodes.map((node) => node.id === target.id ? { ...node, data: {
    ...node.data,
    audioSourceIds: sourceIds,
    ...(source.type === 'text' ? {
      prompt,
      textSync,
      promptSnapshot: undefined,
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
      ...(node.data.textSync ? { textSync: { ...node.data.textSync,
        parts: node.data.textSync.parts.map((part) => sourceId == null || part.sourceId === sourceId ? { ...part, sourceId: null } : part),
      } } : {}),
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
