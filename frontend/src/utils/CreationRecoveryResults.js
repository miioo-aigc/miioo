/** 只有全部子任务得到明确结果，才允许消费整组恢复快照。 */
export function mergeCreationRecoveryResults(results) {
  if (results.every(result => result.failed)) {
    throw Object.assign(new Error('原任务已明确失败'), { taskFailed: true });
  }
  if (results.some(result => !result.failed
    && !['images', 'videos', 'audios'].some(field => result[field]?.some(Boolean)))) {
    throw new Error('原任务结果尚不完整');
  }
  const merged = { ...results.find(result => !result.failed) };
  for (const field of ['images', 'imageOriginalUrls', 'imageDownloadUrls', 'videos', 'audios', 'cardIds', 'audioIds']) {
    merged[field] = results.flatMap(result => result[field] || []);
  }
  return merged;
}
