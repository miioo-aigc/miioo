import { useCallback, useRef } from 'react';
import { apiCreateStoryboard, apiUpdateStoryboard, apiDeleteStoryboard, apiReorderStoryboards } from '../../../api/storyboard';
import { getEpisodeId } from '../../../utils/episodeUtils';
import { makeShot } from '../../../utils/storyboardUtils';
import { toBackendStoryboard, normalizeStoryboard, enrichMainRefs } from '../../../utils/storyboardHelpers';

export function useShotOperations({ projectId, episode, shots, setShots, chars, hasManuallyInteracted, dragId, setDragId, setOverId }) {
  // ref 持有最新的 shots，供需要拷贝数据的异步操作使用
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  const updateShot = useCallback((id, next) => {
    setShots((prev) => prev.map((s) => (s.id === id ? next : s)));
    apiUpdateStoryboard(projectId, id, toBackendStoryboard(next)).catch((err) => {
      console.error('[StoryboardPage] 更新分镜失败:', err);
    });
  }, [projectId, setShots]);

  const addShotAfter = useCallback((id) => {
    apiCreateStoryboard(projectId, { ...toBackendStoryboard(makeShot(0)), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), chars);
        setShots((prev) => {
          // 在功能更新器内基于最新 state 查找插入位置，避免陈旧闭包
          const idx = prev.findIndex((s) => s.id === id);
          const next = idx === -1
            ? [...prev, shotWithRealId]
            : [...prev.slice(0, idx + 1), shotWithRealId, ...prev.slice(idx + 1)];
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          apiReorderStoryboards(projectId, reordered.map(s => s.id)).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }, [projectId, episode, setShots, chars]);

  const copyShot = useCallback((id) => {
    // 通过 ref 取最新 shots 获得待拷贝的数据（不需要最新 state，只需要原始字段内容）
    const original = shotsRef.current.find((s) => s.id === id);
    if (!original) return;
    const copy = { ...original, id: undefined };

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(copy), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = { ...copy, ...enrichMainRefs(normalizeStoryboard(created), chars) };
        setShots((prev) => {
          // 在功能更新器内基于最新 state 查找插入位置
          const idx = prev.findIndex((s) => s.id === id);
          const next = idx === -1
            ? [...prev, shotWithRealId]
            : [...prev.slice(0, idx + 1), shotWithRealId, ...prev.slice(idx + 1)];
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          apiReorderStoryboards(projectId, reordered.map(s => s.id)).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 复制分镜失败:', err);
      });
  }, [projectId, episode, setShots, chars]);

  const deleteShot = useCallback((id) => {
    apiDeleteStoryboard(projectId, id)
      .then(() => {
        setShots((prev) => {
          const next = prev.filter((s) => s.id !== id);
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          apiReorderStoryboards(projectId, reordered.map(s => s.id)).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 删除分镜失败:', err);
      });
  }, [projectId, setShots]);

  const addNewShot = useCallback(() => {
    apiCreateStoryboard(projectId, { ...toBackendStoryboard(makeShot(0)), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), chars);
        hasManuallyInteracted.current = true;
        setShots((prev) => {
          // 基于最新 state 计算编号 + 重编号 + 发 reorder（消除陈旧闭包与重复编号隐患）
          const reordered = [...prev, shotWithRealId].map((s, i) => ({ ...s, number: i + 1 }));
          apiReorderStoryboards(projectId, reordered.map(s => s.id)).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }, [projectId, episode, setShots, chars, hasManuallyInteracted]);

  const handleDrop = useCallback((targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setShots((prev) => {
      const dragIdx = prev.findIndex((s) => s.id === dragId);
      if (dragIdx === -1) return prev;
      const next = [...prev];
      const [dragged] = next.splice(dragIdx, 1);
      if (targetId === '__before_first') {
        next.unshift(dragged);
      } else if (targetId === '__after_last') {
        next.push(dragged);
      } else {
        const targetIdx = next.findIndex((s) => s.id === targetId);
        if (targetIdx === -1) return prev;
        next.splice(targetIdx, 0, dragged);
      }
      const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
      apiReorderStoryboards(projectId, reordered.map(s => s.id)).catch(console.error);
      return reordered;
    });
    setDragId(null);
    setOverId(null);
  }, [dragId, projectId, setShots, setDragId, setOverId]);

  return { updateShot, addShotAfter, copyShot, deleteShot, addNewShot, handleDrop };
}
