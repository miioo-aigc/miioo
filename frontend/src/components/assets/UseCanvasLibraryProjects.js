import { useCallback, useEffect, useRef, useState } from 'react';
import { apiReadCanvasLibraryProjects } from '../../api/CanvasLibraryProjects';
import { apiGetCurrentUser } from '../../api/user';
import { getAuthSessionGeneration } from '../../api/request';
import { removeCanvasLibraryCollection, removeCanvasLibraryProject } from '../../utils/CanvasLibraryProjects';
import { readCollectionMemory, saveCollectionMemory } from './UseCanvasCollections';

export default function useCanvasLibraryProjects() {
  const [state, setState] = useState({ items: [], selectedId: null, collectionId: null, loading: true, error: '', owner: null });
  const [epoch, setEpoch] = useState(0);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
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
        if (stateRef.current.owner && stateRef.current.owner !== user.id) setState({ items: [], selectedId: null, collectionId: null, owner: user.id, loading: true, error: '' });
        if (!user.id) throw new Error('请重新登录');
        const { items, warning } = await apiReadCanvasLibraryProjects(current, controller.signal);
        if (!current()) return;
        const saved = stateRef.current.owner === user.id ? stateRef.current.collectionId : readCollectionMemory(user.id);
        const project = items.find(item => item.canvases.some(canvas => canvas.id === saved)) || items.find(item => item.canvases.length) || items[0];
        const collectionId = project?.canvases.find(item => item.id === saved)?.id || project?.canvases[0]?.id || null;
        saveCollectionMemory(user.id, collectionId);
        setState({ items, selectedId: project?.id || null, collectionId, owner: user.id, loading: false, error: '', warning });
      } catch (cause) { if (current()) setState(old => ({ ...old, loading: false, error: cause.message })); }
    })();
    return () => controller.abort();
  }, [epoch]);
  useEffect(() => {
    let timer;
    const schedule = () => {
      if (document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    };
    const visible = () => { if (document.visibilityState === 'visible') schedule(); };
    window.addEventListener('canvas-assets-changed', schedule);
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('canvas-assets-changed', schedule);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  const project = state.items.find(item => item.id === state.selectedId);
  const selectCanvas = (id) => {
    const target = state.items.find(item => item.canvases.some(canvas => canvas.id === id));
    if (!target) return;
    saveCollectionMemory(state.owner, id);
    setState(old => ({ ...old, selectedId: target.id, collectionId: id }));
  };
  const forgetProject = useCallback((projectId) => {
    setState((old) => {
      const next = removeCanvasLibraryProject(old, projectId);
      if (next.collectionId !== old.collectionId) saveCollectionMemory(next.owner, next.collectionId);
      return next;
    });
  }, []);
  const forgetCollection = useCallback((collectionId) => {
    setState((old) => {
      const next = removeCanvasLibraryCollection(old, collectionId);
      if (next.collectionId !== old.collectionId) saveCollectionMemory(next.owner, next.collectionId);
      return next;
    });
    // 本地切换先卸载旧目录，再用服务端结果校准侧栏；两步在同一轮交互中完成。
    setEpoch(value => value + 1);
  }, []);
  return { ...state, project, collection: project?.canvases.find(item => item.id === state.collectionId), selectCanvas, forgetProject, forgetCollection, refresh };
}
