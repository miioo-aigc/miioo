/** 左侧拖拽优先添加上游；不可连接时尝试当前节点作为素材输出。 */
export function resolveCanvasLeftConnection(currentNode, hoveredNode, isValidConnection) {
  if (!currentNode || !hoveredNode || currentNode.id === hoveredNode.id) return null;
  const makeConnection = (source, target) => ({
    source: source.id,
    sourceHandle: `${source.type}-output`,
    target: target.id,
    targetHandle: target.data?.ports?.input?.id || `${target.type}-input`,
  });
  const upstream = makeConnection(hoveredNode, currentNode);
  if (isValidConnection(upstream)) return upstream;
  const downstream = makeConnection(currentNode, hoveredNode);
  return isValidConnection(downstream) ? downstream : null;
}
