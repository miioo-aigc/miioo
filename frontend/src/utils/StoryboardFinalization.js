/** 2026-11-24：图片与视频共享唯一的定稿状态；null 明确表示取消。 */
import { areStoryboardMediaSame } from './storyboardMediaDedup.js';

export function findFinalizedCandidate(items = []) {
  return items.find((item) => !item.pending && (item.is_finalized ?? item.isFinalized) === true) || null;
}

export function applyStoryboardFinalization(items = [], finalized = null) {
  let selectedIndex = -1;
  if (finalized) {
    selectedIndex = items.findIndex((item) => !item.pending && item.id && finalized.id && String(item.id) === String(finalized.id));
    if (selectedIndex < 0) selectedIndex = items.findIndex((item) => !item.pending && areStoryboardMediaSame(item, finalized));
  }
  return items.map((item, index) => ({
    ...item,
    is_finalized: index === selectedIndex,
    isFinalized: index === selectedIndex,
  }));
}
