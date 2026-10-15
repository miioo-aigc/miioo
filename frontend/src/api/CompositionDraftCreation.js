import { apiCreateComposition, apiGetCompositions } from './compositions';
import { prepareInitialStoryboardTimeline } from '../utils/InitialStoryboardTimeline';

export async function createStoryboardDraft(projectId, episodeId, draftCount = 0) {
  const { timeline, skipped } = await prepareInitialStoryboardTimeline(projectId, episodeId);
  const draft = await apiCreateComposition(projectId, {
    name: '草稿' + String(draftCount + 1).padStart(2, '0'),
    resolution: '1080p',
    aspectRatio: '16:9',
    ...(timeline.length ? { timeline } : {}),
  });
  if (!draft?.id) throw new Error('新建剪辑失败：未返回工程 ID');
  return { draft, skipped };
}

export async function prepareOnlineEditing(projectId, episodeId) {
  const drafts = await apiGetCompositions(projectId);
  if (drafts.length) return { draft: null, skipped: 0 };
  return createStoryboardDraft(projectId, episodeId);
}
