import { useCallback } from 'react';
import { apiCreateStoryboard, apiUpdateStoryboard, apiDeleteStoryboard, apiReorderStoryboards } from '../../../api/storyboard';
import { getEpisodeId } from '../../../utils/episodeUtils';
import { makeShot } from '../../../utils/storyboardUtils';
import { toBackendStoryboard, normalizeStoryboard, enrichMainRefs } from '../../../utils/storyboardHelpers';

export function useShotOperations({ projectId, episode, shots, setShots, chars, hasManuallyInteracted, dragId, setDragId, setOverId }) {
  const updateShot = useCallback((id, next) => {
    setShots((prev) => prev.map((s) => (s.id === id ? next : s)));
    apiUpdateStoryboard(projectId, id, toBackendStoryboard(next)).catch((err) => {
      console.error('[StoryboardPage] 更新分镜失败:', err);
    });
  }, [projectId, setShots]);

  const addShotAfter = useCallback((id) => {
    const idx = shots.findIndex((s) => s.id === id);
    const newShot = makeShot(idx + 2);

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(newShot), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), chars);
        setShots((prev) => {
          const next = [...prev.slice(0, idx + 1), shotWithRealId, ...prev.slice(idx + 1)];
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }, [projectId, episode, shots, setShots, chars]);

  const copyShot = useCallback((id) => {
    const idx = shots.findIndex((s) => s.id === id);
    const original = shots[idx];
    const copy = { ...original, id: undefined };

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(copy), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = { ...copy, ...enrichMainRefs(normalizeStoryboard(created), chars) };
        setShots((prev) => {
          const next = [...prev.slice(0, idx + 1), shotWithRealId, ...prev.slice(idx + 1)];
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 复制分镜失败:', err);
      });
  }, [projectId, episode, shots, setShots, chars]);

  const deleteShot = useCallback((id) => {
    apiDeleteStoryboard(projectId, id)
      .then(() => {
        setShots((prev) => {
          const next = prev.filter((s) => s.id !== id);
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 删除分镜失败:', err);
      });
  }, [projectId, setShots]);

  const addNewShot = useCallback(() => {
    const newNumber = shots.length + 1;
    const newShot = makeShot(newNumber);

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(newShot), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), chars);
        hasManuallyInteracted.current = true;
        setShots((prev) => [...prev, shotWithRealId]);
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }, [projectId, episode, shots, setShots, chars, hasManuallyInteracted]);

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
