/** 画布用户操作与异步系统回写的节点级保护。 */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function getCanvasNodeSourceIds(node) {
  const data = node?.data || {};
  return [...new Set([...(data.textSourceIds || []), ...(data.imageSourceIds || []),
    ...(data.videoSourceIds || []), ...(data.audioSourceIds || []), ...(data.referenceInputs || []).map((item) => item.sourceId)])];
}

function actualSourceIds(node) { return getCanvasNodeSourceIds(node); }

export function getCanvasOperationLocks(nodes) {
  const submissionLocked = new Set();
  const outputLocked = new Set();
  const upstreamProtected = new Set();
  const dependencyCount = new Map();
  for (const node of nodes) {
    if (node.data?.generating || node.data?.editing) outputLocked.add(node.id);
    if (!(node.data?.submissionLocked || (node.data?.generating && !node.data?.generationTaskIds?.length))) continue;
    submissionLocked.add(node.id);
    for (const sourceId of node.data.executionSourceIds || []) {
      upstreamProtected.add(sourceId);
      dependencyCount.set(sourceId, (dependencyCount.get(sourceId) || 0) + 1);
    }
  }
  return { submissionLocked, outputLocked, upstreamProtected, dependencyCount };
}

function protectedDataChange(before, after, locks) {
  const a = before.data || {}, b = after.data || {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (['selected', 'measured', 'dragging', 'dragRelease', 'dragScaleX', 'dragScaleY', 'generationProgress', 'generationMessage'].includes(key)) continue;
    if (!same(a[key], b[key])) {
      if (['content', 'asset', 'nodeResults'].includes(key)) return true;
      if (locks.outputLocked?.has(before.id) && ['content', 'asset', 'nodeResults'].includes(key)) return true;
      if (locks.submissionLocked.has(before.id)) return true;
    }
  }
  return false;
}

/** user 是默认来源；record:false 本身不授予系统写入权限。 */
export function guardCanvasNodeUpdate(beforeNodes, afterNodes, { origin = 'user', allowDeleteExecuting = true } = {}) {
  if (origin === 'load') return afterNodes;
  const locks = getCanvasOperationLocks(beforeNodes);
  const after = new Map(afterNodes.map((node) => [node.id, node]));
  const deletedIds = new Set(beforeNodes.filter((node) => !after.has(node.id)).map((node) => node.id));
  for (const node of beforeNodes) {
    const next = after.get(node.id);
    if (!next) {
      if (locks.upstreamProtected.has(node.id) || (!allowDeleteExecuting && locks.submissionLocked.has(node.id))) return beforeNodes;
      continue;
    }
    if (locks.submissionLocked.has(node.id) && (node.type !== next.type
      || node.parentId !== next.parentId || !same(node.position, next.position) || !same(node.style, next.style)
      || protectedDataChange(node, next, locks))) return beforeNodes;
    if (locks.outputLocked?.has(node.id) && protectedDataChange(node, next, locks)) return beforeNodes;
    if (locks.upstreamProtected.has(node.id) && (node.type !== next.type
      || protectedDataChange(node, next, locks))) return beforeNodes;
  }
  if (origin === 'system' && afterNodes.some((node) => !beforeNodes.some((old) => old.id === node.id))) return beforeNodes;
  const lockedOutgoing = new Set(locks.submissionLocked);
  const targets = new Set([...beforeNodes.map((node) => node.id), ...afterNodes.map((node) => node.id)]);
  for (const targetId of targets) {
    const oldNode = beforeNodes.find((node) => node.id === targetId);
    const newNode = after.get(targetId);
    if (!oldNode && newNode && actualSourceIds(newNode).some((sourceId) => lockedOutgoing.has(sourceId))) return beforeNodes;
    const oldSources = actualSourceIds(oldNode).filter((id) => !deletedIds.has(id));
    const newSources = actualSourceIds(newNode);
    const oldIds = oldSources.filter((id) => lockedOutgoing.has(id)).sort();
    const newIds = newSources.filter((id) => lockedOutgoing.has(id)).sort();
    if (!same(oldIds, newIds)) return beforeNodes;
  }
  return afterNodes;
}

export function guardCanvasNodeChanges(nodes, changes) {
  const locks = getCanvasOperationLocks(nodes);
  return changes.filter((change) => {
    const node = nodes.find((item) => item.id === change.id);
    if (!node) return false;
    if (change.type === 'remove') return !locks.upstreamProtected.has(node.id);
    if (!locks.submissionLocked.has(node.id) && !locks.upstreamProtected.has(node.id)) return true;
    if (locks.upstreamProtected.has(node.id) && ['position', 'dimensions', 'select'].includes(change.type)) return true;
    return ['select', 'dimensions'].includes(change.type);
  });
}

export function getCanvasDirectUpstreamIds(node) { return getCanvasNodeSourceIds(node); }

/** 系统回调只可改动仍存在的节点；用户显式删除后拒绝迟到复活。 */
export function guardCanvasSystemUpdate(beforeNodes, afterNodes) {
  const ids = new Set(beforeNodes.map((node) => node.id));
  if (afterNodes.length !== beforeNodes.length || afterNodes.some((node) => !ids.has(node.id))) return beforeNodes;
  return afterNodes;
}

export function mergeCanvasResolvedAssetViews(currentNode, resolvedNode) {
  const currentIds = new Set(currentNode.data.nodeResults?.batches?.flatMap((batch) => batch.results || [])
    .map((result) => result.assetId).filter(Boolean) || []);
  const resolved = resolvedNode.data.resultAssetViews || {};
  const resultAssetViews = { ...currentNode.data.resultAssetViews };
  for (const [assetId, view] of Object.entries(resolved)) if (currentIds.has(assetId)) resultAssetViews[assetId] = view;
  const currentAsset = currentNode.data.asset;
  return { ...currentNode, data: { ...currentNode.data, resultAssetViews,
    ...(currentAsset?.asset_id && resultAssetViews[currentAsset.asset_id]
      ? { asset: { ...currentAsset, ...resultAssetViews[currentAsset.asset_id] } } : {}) } };
}

export function guardCanvasUserChange(beforeNodes, changes) {
  const allowed = guardCanvasNodeChanges(beforeNodes, changes);
  return { changes: allowed, blocked: allowed.length !== changes.length };
}
