/**
 * @file assetsBatchAdapter.js
 * @structure-index
 *
 * ─── 常量 ───────────────────────────────────────────────────────────
 *   SUBJECT_CARD_CATEGORIES / SUBJECT_TYPE_MAP
 *
 * ─── 纯适配 ─────────────────────────────────────────────────────────
 *   getAssetPageKey                  生成项目资产分页键
 *   getAssetSubjectType              映射主体资产类别
 *   getProjectBatchDeleteRequest     将选中主体转换为图片删除 ID
 *   getProjectDownloadItems          将选中卡片转换为下载队列
 *   getCreativeBatchDeleteRequest    将创作资产批量删除转换为 API 请求描述
 *
 * ─── 数据边界 ───────────────────────────────────────────────────────
 *   只读取参数并返回新对象，不调用 API、不修改 React 状态、不触碰 Store。
 */

export const SUBJECT_CARD_CATEGORIES = new Set([
  'chars',
  'scenes',
  'props',
  'storyboard',
]);

export const SUBJECT_TYPE_MAP = Object.freeze({
  chars: 'character',
  scenes: 'scene',
  props: 'prop',
});

export function getAssetPageKey(projectId, category) {
  return `${projectId}__${category}`;
}

export function getAssetSubjectType(category) {
  return SUBJECT_TYPE_MAP[category];
}

export function getProjectBatchDeleteRequest({ selectedIds = [], category, assets = [] }) {
  const normalizedSelectedIds = [...selectedIds];
  const records = SUBJECT_CARD_CATEGORIES.has(category)
    ? normalizedSelectedIds.flatMap((cardId) => {
        const card = assets.find((asset) => asset.id === cardId);
        return card?.images?.length ? card.images : card ? [card] : [{ id: cardId }];
      })
    : normalizedSelectedIds.map((id) => assets.find((asset) => asset.id === id) || { id });

  return {
    ids: records.map((asset) => asset.id),
    records,
    selectedIds: normalizedSelectedIds,
    subjectType: getAssetSubjectType(category),
  };
}

export function getProjectDownloadItems({ selectedIds = [], assets = [] }) {
  const items = [];

  [...selectedIds].forEach((cardId) => {
    const card = assets.find((asset) => asset.id === cardId);
    if (!card) return;

    if (Array.isArray(card.images) && card.images.length > 0) {
      card.images.forEach((image, index) => {
        items.push({
          id: image.id,
          name: card.images.length > 1
            ? `${card.name || 'asset'}-${index + 1}`
            : (card.name || 'asset'),
        });
      });
      return;
    }

    items.push({ id: card.id, name: card.name || 'asset' });
  });

  return items;
}

export function getCreativeBatchDeleteRequest({ activeType, selectedIds = [], cards = [] }) {
  const selectedCards = [...selectedIds]
    .map((id) => cards.find((card) => card.id === id))
    .filter(Boolean);

  return {
    kind: activeType === 'image' || activeType === 'video' ? activeType : null,
    // id 是页面展示/选中用的复合键，backendId 才是接口要求的真实创作记录 ID。
    ids: selectedCards.map((card) => card.backendId).filter(Boolean),
    selectedIds: [...selectedIds],
  };
}
