/** 激活节点上游连线高亮：只点亮直接连入激活节点的连线，1 跳，不向上游祖先扩散。 */

/** 与卡片白色描边（选中或编辑中）保持一致，作为「激活节点」判定。 */
export function isCanvasNodeActive(node) {
  return Boolean(node?.selected || node?.data?.editing);
}

export function getActiveUpstreamEdgeIds(nodes, edges) {
  const activeNodeIds = new Set((nodes || []).filter(isCanvasNodeActive).map((node) => node.id));
  if (!activeNodeIds.size) return new Set();
  return new Set((edges || []).filter((edge) => activeNodeIds.has(edge.target)).map((edge) => edge.id));
}
