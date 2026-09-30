/** 将已添加及手动连线的素材适配为创作编辑器候选，身份始终使用源节点 ID。 */
export function getCanvasPromptReferences(nodes, targetId) {
  const target = nodes.find((node) => node.id === targetId);
  const inputs = [...(target?.data.referenceInputs || [])];
  for (const sourceId of target?.data.imageSourceIds || []) {
    if (!inputs.some((input) => input.sourceId === sourceId)) inputs.push({ sourceId, slot: inputs.length });
  }
  if (target?.type === 'image' && target.data.asset?.url && !inputs.some((input) => input.sourceId === target.id)) {
    inputs.push({ sourceId: target.id, slot: inputs.length });
  }
  return inputs.flatMap(({ sourceId, slot }) => {
    const source = nodes.find((node) => node.id === sourceId);
    return ['image', 'video', 'audio'].includes(source?.type) && source.data.asset?.url
      ? [{ id: sourceId, slot, label: source.data.label, asset: source.data.asset, isCurrentNode: sourceId === targetId }] : [];
  });
}

export function getCanvasPromptFiles(references, nodeType, mode) {
  return references.filter(({ asset, slot }) => asset?.url
    && (nodeType !== 'image' || asset.asset_type === 'image')
    && (mode !== 'frame' || (slot < 2 && asset.asset_type === 'image')))
    .map(({ id, label, asset }) => ({
      ...asset, _uid: id, name: label || asset.name || '参考素材',
      previewUrl: asset.asset_type === 'image' ? asset.url : asset.posterUrl,
    }));
}
