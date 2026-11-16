/** 激活节点相邻连线高亮：点亮直接连入和流出激活节点的边，不向相邻节点继续扩散。 */

/** 与卡片白色描边（选中或编辑中）保持一致，作为「激活节点」判定。 */
export function isCanvasNodeActive(node) {
  return Boolean(node?.selected || node?.data?.editing);
}

export function getActiveAdjacentEdgeIds(nodes, edges) {
  const activeNodeIds = new Set((nodes || []).filter(isCanvasNodeActive).map((node) => node.id));
  if (!activeNodeIds.size) return new Set();
  return new Set((edges || []).filter((edge) => activeNodeIds.has(edge.source) || activeNodeIds.has(edge.target)).map((edge) => edge.id));
}
