/** 仅比较仍连接的直接上游与最近生成输入快照，断开的来源不再提醒。 */
export function getCanvasUpstreamUpdates(nodes, edges) {
  const upstreamUpdatedIds = new Set();
  const upstreamUpdateKeys = new Map();
  for (const target of nodes) {
    const lastBatch = target.data.nodeResults?.batches?.filter((batch) => batch.snapshot?.inputs)
      .sort((left, right) => (right.completedAt ?? right.submittedAt ?? -1) - (left.completedAt ?? left.submittedAt ?? -1))[0];
    if (!lastBatch) continue;
    for (const input of lastBatch.snapshot.inputs) {
      if (!edges.some((edge) => edge.source === input.nodeId && edge.target === target.id)) continue;
      const source = nodes.find((node) => node.id === input.nodeId);
      if (!source) continue;
      const currentResultId = source.data.nodeResults?.currentResultId;
      const currentResult = currentResultId ? source.data.nodeResults?.batches?.flatMap((batch) => batch.results || [])
        .find((result) => result.id === currentResultId) : null;
      const currentAssetId = currentResult?.assetId || source.data.asset?.asset_id || null;
      const changed = input.resultId ? input.resultId !== currentResultId
        : input.assetId ? input.assetId !== currentAssetId
          : Object.hasOwn(input, 'content') && input.content !== (source.data.content || '');
      if (changed) {
        upstreamUpdatedIds.add(target.id);
        upstreamUpdateKeys.set(target.id, (upstreamUpdateKeys.get(target.id) || '') + JSON.stringify([input.nodeId, currentResultId, currentAssetId, source.data.content || '']));
      }
    }
  }
  return { upstreamUpdatedIds, upstreamUpdateKeys };
}
