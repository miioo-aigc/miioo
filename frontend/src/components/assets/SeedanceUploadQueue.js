/** 素材下载、校验和上传共用三个处理名额；单项失败继续，离开文件夹后停止派发。 */
export async function runSeedanceUploadQueue(items, processItem, isCurrent = () => true) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (isCurrent() && next < items.length) {
      const index = next++;
      try {
        results[index] = await processItem(items[index], index);
      } catch (error) {
        results[index] = { error: error?.message || '素材处理失败' };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));
  return results;
}
