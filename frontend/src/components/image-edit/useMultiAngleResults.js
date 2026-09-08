import { useMultiAngleStore } from '../../stores/multiAngleStore';
import { apiGenerateCreation } from '../../api/creation';
import { showGlobalToast } from '../../stores/toastStore';

// 来源卡片持有派生结果，弹窗关闭不影响任务和原图。
const EMPTY_RESULTS = [];

export function useMultiAngleResults(source, context = {}) {
  const results = useMultiAngleStore((state) => state.resultsBySource[source] || EMPTY_RESULTS);
  const setResults = (transform) => useMultiAngleStore.getState().update(source, transform);
  const generate = (params) => new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const entry = { ...params, id, status: 'loading', createdAt: new Date().toISOString() };
    setResults((current) => [...current, entry]);
    let submitted = false;
    apiGenerateCreation({ ...params, ...context }, { onTaskCreated: () => { submitted = true; resolve(); } })
      .then((result) => {
        if (!result.images?.length) throw new Error('未返回生成图片');
        setResults((current) => current.flatMap((item) => item.id !== id ? [item] : result.images.map((imageUrl, index) => ({ ...entry, id: result.cardIds?.[index] || `${id}-${index}`, status: 'done', imageUrl, originalUrl: result.imageOriginalUrls?.[index] || imageUrl }))));
      })
      .catch((error) => {
        setResults((current) => current.map((item) => item.id === id ? { ...item, status: 'failed' } : item));
        if (!submitted) reject(error);
        else showGlobalToast('图片生成失败，请重新创作', 'error');
      });
  });
  return { results, generate, remove: (id) => setResults((current) => current.filter((item) => item.id !== id)) };
}
