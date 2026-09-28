/** 组合几何与选中状态；坐标始终使用画布单位。 */
const PADDING = 8;

export function getCanvasAbsolutePosition(nodes, node) {
  const position = { ...node.position };
  const visited = new Set([node.id]);
  let parent = nodes.find((item) => item.id === node.parentId);
  while (parent && !visited.has(parent.id)) {
    visited.add(parent.id);
    position.x += parent.position.x;
    position.y += parent.position.y;
    parent = nodes.find((item) => item.id === parent.parentId);
  }
  return position;
}

function bounds(nodes) {
  const x = Math.min(...nodes.map((node) => node.position.x)) - PADDING;
  const y = Math.min(...nodes.map((node) => node.position.y)) - PADDING;
  const right = Math.max(...nodes.map((node) => node.position.x + (node.type === 'canvasGroup' ? node.style.width : node.measured?.width ?? 240)));
  const bottom = Math.max(...nodes.map((node) => node.position.y + (node.type === 'canvasGroup' ? node.style.height : node.measured?.height ?? 264)));
  return { x, y, width: right - x + PADDING, height: bottom - y + PADDING };
}

export function setCanvasSelection(nodes, ids, openPanel = false) {
  const selected = new Set(ids);
  return nodes.map((node) => ({
    ...node, selected: selected.has(node.id),
    data: { ...node.data, creationPanelOpen: openPanel && ids.length === 1 && selected.has(node.id) && node.type !== 'canvasGroup' },
  }));
}

function removeGroup(nodes, group) {
  return nodes.filter((node) => node.id !== group.id).map((node) => node.parentId === group.id ? {
    ...node, parentId: group.parentId,
    position: { x: node.position.x + group.position.x, y: node.position.y + group.position.y },
  } : node);
}

function cleanSmallGroups(nodes, candidates) {
  let next = nodes;
  let group;
  while ((group = next.find((node) => node.type === 'canvasGroup' && candidates.has(node.id) && next.filter((child) => child.parentId === node.id).length <= 1))) {
    if (group.parentId) candidates.add(group.parentId);
    next = removeGroup(next, group);
  }
  return next;
}

function orderParentsFirst(nodes) {
  const ordered = [];
  const visited = new Set();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visit = (node) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    if (byId.has(node.parentId)) visit(byId.get(node.parentId));
    ordered.push(node);
  };
  nodes.forEach(visit);
  return ordered;
}

export function ungroupCanvasNodes(nodes) {
  const selected = nodes.filter((node) => node.selected && node.type === 'canvasGroup');
  if (!selected.length) return nodes;
  const ids = new Set(selected.map((node) => node.id));
  const members = nodes.filter((node) => ids.has(node.parentId) && !ids.has(node.id)).map((node) => node.id);
  let next = nodes;
  for (const group of selected) next = removeGroup(next, next.find((node) => node.id === group.id));
  return setCanvasSelection(fitCanvasGroups(orderParentsFirst(next)), members);
}

export function groupCanvasNodes(nodes, id) {
  const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
  const members = nodes.filter((node) => {
    if (!selectedIds.has(node.id)) return false;
    let parent = nodes.find((item) => item.id === node.parentId);
    while (parent) {
      if (selectedIds.has(parent.id)) return false;
      parent = nodes.find((item) => item.id === parent.parentId);
    }
    return true;
  });
  if (members.length < 2) return nodes;
  const parentId = members.every((node) => node.parentId === members[0].parentId) ? members[0].parentId : undefined;
  const parent = nodes.find((node) => node.id === parentId);
  const origin = parent ? getCanvasAbsolutePosition(nodes, parent) : { x: 0, y: 0 };
  const positioned = members.map((node) => {
    const position = getCanvasAbsolutePosition(nodes, node);
    return { ...node, position: { x: position.x - origin.x, y: position.y - origin.y } };
  });
  const box = bounds(positioned);
  const sequence = Math.max(0, ...nodes.filter((node) => node.type === 'canvasGroup').map((node) => node.data.sequence || 0)) + 1;
  const group = {
    id, type: 'canvasGroup', position: { x: box.x, y: box.y },
    ...(parentId ? { parentId } : {}),
    style: { width: box.width, height: box.height },
    data: { label: `组合${sequence}`, sequence, persistenceState: 'draft' },
  };
  const memberIds = new Set(members.map((node) => node.id));
  const positions = new Map(positioned.map((node) => [node.id, node.position]));
  const next = nodes.map((node) => memberIds.has(node.id) ? {
    ...node, parentId: id, position: { x: positions.get(node.id).x - box.x, y: positions.get(node.id).y - box.y },
  } : node);
  next.splice(next.findIndex((node) => memberIds.has(node.id)), 0, group);
  const cleaned = cleanSmallGroups(next, new Set(members.map((node) => node.parentId).filter(Boolean)));
  return setCanvasSelection(fitCanvasGroups(orderParentsFirst(cleaned)), [id]);
}

export function fitCanvasGroups(nodes) {
  let next = nodes;
  for (const group of nodes.filter((node) => node.type === 'canvasGroup').reverse()) {
    const members = next.filter((node) => node.parentId === group.id);
    if (!members.length || members.some((node) => node.dragging)) continue;
    const box = bounds(members);
    next = next.map((node) => {
      if (node.id === group.id) return {
        ...node, position: { x: node.position.x + box.x, y: node.position.y + box.y },
        style: { ...node.style, width: box.width, height: box.height },
      };
      return node.parentId === group.id ? { ...node, position: { x: node.position.x - box.x, y: node.position.y - box.y } } : node;
    });
  }
  return next;
}
