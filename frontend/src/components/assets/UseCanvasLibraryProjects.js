import { useCallback, useEffect, useState } from 'react';
import { apiReadCanvasLibraryProjects } from '../../api/CanvasLibraryProjects';
import { apiGetCurrentUser } from '../../api/user';
import { getAuthSessionGeneration } from '../../api/request';
import { readCollectionMemory, saveCollectionMemory } from './UseCanvasCollections';

export default function useCanvasLibraryProjects() {
  const [state, setState] = useState({ items: [], selectedId: null, collectionId: null, loading: true, error: '', owner: null });
  const [epoch, setEpoch] = useState(0);
  const refresh = useCallback(() => setEpoch(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const session = getAuthSessionGeneration();
    const current = () => !controller.signal.aborted && session === getAuthSessionGeneration();
    (async () => {
      setState(old => ({ ...old, loading: true, error: '' }));
      try {
        const user = await apiGetCurrentUser();
        if (!current()) return;
        if (!user.id) throw new Error('请重新登录');
        const items = await apiReadCanvasLibraryProjects(current, controller.signal);
        if (!current()) return;
        const saved = readCollectionMemory(user.id);
        const project = items.find(item => item.canvases.some(canvas => canvas.id === saved)) || items[0];
        const collectionId = project?.canvases.find(item => item.id === saved)?.id || project?.canvases[0]?.id || null;
        saveCollectionMemory(user.id, collectionId);
        setState({ items, selectedId: project?.id || null, collectionId, owner: user.id, loading: false, error: '' });
      } catch (cause) { if (current()) setState(old => ({ ...old, loading: false, error: cause.message })); }
    })();
    return () => controller.abort();
  }, [epoch]);
  const project = state.items.find(item => item.id === state.selectedId);
  const selectCanvas = (id) => {
    const target = state.items.find(item => item.canvases.some(canvas => canvas.id === id));
    if (!target) return;
    saveCollectionMemory(state.owner, id);
    setState(old => ({ ...old, selectedId: target.id, collectionId: id }));
  };
  return { ...state, project, collection: project?.canvases.find(item => item.id === state.collectionId), selectCanvas, refresh };
}
