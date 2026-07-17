/**
 * @file subjectPendingGenerationAdapter.js
 * @structure-index
 *
 * 从主体详情中恢复尚未记录的生图结果；不读取 React 状态、不执行写回。
 */

import { normalizeImageUrl } from './imageUrl';
import { extractSubjectImageResult } from '../components/subject/SubjectGenerationResult';

export function findPendingSubjectImage(detail, pendingInfo) {
  const candidateImages = Array.isArray(detail?.candidate_images) ? detail.candidate_images : [];
  const primaryImages = detail?.primary_image ? [detail.primary_image] : [];
  const knownIds = new Set((pendingInfo?.knownImageIds || []).filter(Boolean));
  const knownUrls = new Set(
    (pendingInfo?.knownImageUrls || [])
      .filter(Boolean)
      .flatMap((url) => [url, normalizeImageUrl(url)])
  );

  return [...candidateImages, ...primaryImages].find((image) => {
    const { rawUrl } = extractSubjectImageResult(image);
    const normalizedUrl = rawUrl ? normalizeImageUrl(rawUrl) : null;
    if (image?.id && !knownIds.has(image.id)) return true;
    if (rawUrl && !knownUrls.has(rawUrl) && !knownUrls.has(normalizedUrl)) return true;
    return false;
  }) || null;
}


export function getPendingGenTabSetter(tab, { setChars, setScenes, setProps }) {
  if (tab === 'char') return setChars;
  if (tab === 'scene') return setScenes;
  return setProps;
}

export function defaultPromptForTab(tab) {
  const defaults = {
    '角色': '一只雄性成年角色，站姿平稳，角色设定图。',
    '场景': '一个场景环境，宽阔视野，场景设定图。',
    '道具': '一个道具，细节清晰，道具设定图。',
  };
  return defaults[tab] || '高质量设定图，细节清晰。';
}
