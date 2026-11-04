/** 将已添加及手动连线的素材适配为创作编辑器候选，身份始终使用源节点 ID。 */
export function getCanvasPromptReferences(nodes, targetId) {
  const target = nodes.find((node) => node.id === targetId);
  const inputs = [...(target?.data.referenceInputs || [])];
  const appendSource = (sourceId) => {
    if (inputs.some((input) => input.sourceId === sourceId)) return;
    const slot = inputs.filter((input) => nodes.find((node) => node.id === input.sourceId)?.type !== 'text').length;
    inputs.push({ sourceId, slot });
  };
  for (const sourceId of target?.data.imageSourceIds || []) {
    appendSource(sourceId);
  }
  for (const sourceId of target?.data.videoSourceIds || []) {
    appendSource(sourceId);
  }
  for (const sourceId of target?.data.textSourceIds || []) {
    appendSource(sourceId);
  }
  if (['image', 'video'].includes(target?.type) && target.data.asset?.url && !inputs.some((input) => input.sourceId === target.id)) {
    appendSource(target.id);
  }
  return inputs.flatMap(({ sourceId, slot }) => {
    const source = nodes.find((node) => node.id === sourceId);
    if (['text', 'image', 'video'].includes(target?.type) && sourceId !== targetId && source?.type === 'text' && source.data.content?.trim()) {
      return [{ id: sourceId, type: 'text', label: source.data.label, content: source.data.content }];
    }
    return ['image', 'video', 'audio'].includes(source?.type) && source.data.asset?.url
      ? [{ id: sourceId, slot, label: source.data.label, asset: source.data.asset, isCurrentNode: sourceId === targetId }] : [];
  });
}

export function getCanvasPromptFiles(references, nodeType, mode) {
  return references.filter(({ asset, slot }) => asset?.url
    && (nodeType !== 'image' || asset.asset_type === 'image')
    && (!['frame', 'start_end', 'first_frame'].includes(mode) || (slot < (mode === 'first_frame' ? 1 : 2) && asset.asset_type === 'image')))
    .map(({ id, label, asset }) => ({
      ...asset, _uid: id, name: label || asset.name || '参考素材',
      previewUrl: asset.asset_type === 'image' ? asset.url : asset.posterUrl,
    }));
}
