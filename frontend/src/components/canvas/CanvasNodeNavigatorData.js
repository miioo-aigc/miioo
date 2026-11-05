import { canvasSearchName } from './CanvasSearch.js';

function createNodeMatcher(query, type) {
  const keyword = query.trim().toLowerCase();
  return (node) => (type === 'all' || node.type === type)
    && canvasSearchName(node).toLowerCase().includes(keyword);
}

/**
 * 将真实 parentId 关系整理成侧拉窗需要的分组树。
 * 普通节点按父组归档；父节点缺失或不是分组的节点进入未分组区域。
 */
export function getCanvasNodeNavigator(nodes, query = '', type = 'all') {
  const matches = createNodeMatcher(query, type);
  const groupIds = new Set(nodes.filter((node) => node.type === 'canvasGroup').map((node) => node.id));
  const childrenByParent = new Map();

  nodes.forEach((node) => {
    if (!groupIds.has(node.parentId)) return;
    const children = childrenByParent.get(node.parentId) || [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  });

  const count = nodes.filter(matches).length;
  const buildGroup = (group, ancestors = new Set()) => {
    if (ancestors.has(group.id)) return null;
    const nextAncestors = new Set(ancestors).add(group.id);
    const directChildren = childrenByParent.get(group.id) || [];
    const childNodes = directChildren
      .filter((node) => node.type !== 'canvasGroup' && matches(node))
      .map((node) => ({ node, matching: true }));
    const childGroups = directChildren
      .filter((node) => node.type === 'canvasGroup')
      .map((node) => buildGroup(node, nextAncestors))
      .filter(Boolean);
    const matching = matches(group);

    if (!matching && !childNodes.length && !childGroups.length) return null;
    return {
      id: group.id,
      node: group,
      matching,
      childNodes,
      childGroups,
    };
  };

  const groups = nodes
    .filter((node) => node.type === 'canvasGroup' && !groupIds.has(node.parentId))
    .map((group) => buildGroup(group))
    .filter(Boolean);
  const ungrouped = nodes
    .filter((node) => node.type !== 'canvasGroup' && !(node.parentId && groupIds.has(node.parentId)) && matches(node))
    .map((node) => ({ node, matching: true }));

  return {
    groups,
    ungrouped,
    count,
    total: nodes.length,
  };
}
