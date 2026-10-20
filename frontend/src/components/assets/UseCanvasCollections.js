import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasAssetLibrary as api, canvasLibraryMockEnabled } from '../../api/CanvasAssetLibrary';
import { apiGetCurrentUser } from '../../api/user';
import { showGlobalToast } from '../../stores/toastStore';

export const collectionMemoryKey = (owner) => `miioo:canvas-library:${owner}:collection`;
export function readCollectionMemory(owner) {
  try { return localStorage.getItem(collectionMemoryKey(owner)); } catch { return null; }
}
export function saveCollectionMemory(owner, id) {
  if (!owner) return;
  try {
    if (id) localStorage.setItem(collectionMemoryKey(owner), id);
    else localStorage.removeItem(collectionMemoryKey(owner));
  } catch { /* 浏览器禁用存储时仍允许访问集合。 */ }
}

/** 服务端排序分页；恢复目标未在首屏时继续取页，不将首屏当成完整列表。 */
export default function useCanvasCollections() {
  const [state, setState] = useState({ items: [], selectedId: null, cursor: null, owner: null, loading: true, error: '' });
  const [epoch, setEpoch] = useState(0);
  const preferred = useRef(undefined);
  const generation = useRef(0);
  const moreLock = useRef(false);
  const refresh = useCallback((id) => { if (id !== undefined) preferred.current = id; setEpoch((n) => n + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    const valid = () => !controller.signal.aborted && current === generation.current;
    (async () => {
      setState((old) => ({ ...old, loading: true, error: '' }));
      try {
        const user = canvasLibraryMockEnabled ? { id: 'development' } : await apiGetCurrentUser();
        if (!valid()) return;
        if (!user.id) throw new Error('无法确定当前账号，请重新登录');
        const desired = preferred.current === undefined ? readCollectionMemory(user.id) : preferred.current;
        let page = await api.collections({ limit: 60 }, controller.signal);
        const items = [...page.items];
        const cursors = new Set();
        while (desired && !items.some((item) => item.id === desired) && page.next_cursor) {
          if (cursors.has(page.next_cursor)) throw new Error('集合分页异常，请重试');
          cursors.add(page.next_cursor);
          page = await api.collections({ cursor: page.next_cursor, limit: 60 }, controller.signal);
          items.push(...page.items);
        }
        if (!valid()) return;
        const unique = [...new Map(items.map((item) => [item.id, item])).values()];
        const selectedId = unique.find((item) => item.id === desired)?.id || unique[0]?.id || null;
        preferred.current = selectedId;
        saveCollectionMemory(user.id, selectedId);
        setState({ items: unique, selectedId, cursor: page.next_cursor, owner: user.id, loading: false, error: '' });
      } catch (cause) {
        if (valid()) setState((old) => ({ ...old, loading: false, error: cause.message }));
      }
    })();
    return () => controller.abort();
  }, [epoch]);
  const select = (id) => {
    if (!state.items.some((item) => item.id === id)) return;
    preferred.current = id;
    saveCollectionMemory(state.owner, id);
    setState((old) => ({ ...old, selectedId: id }));
  };
  const more = async () => {
    if (moreLock.current || state.loading || !state.cursor) return;
    moreLock.current = true;
    const current = generation.current;
    setState((old) => ({ ...old, loading: true }));
    try {
      const page = await api.collections({ cursor: state.cursor, limit: 60 });
      if (current === generation.current) setState((old) => ({ ...old, cursor: page.next_cursor,
        items: [...new Map([...old.items, ...page.items].map((item) => [item.id, item])).values()] }));
    } catch (cause) { if (current === generation.current) showGlobalToast('error', cause.message); }
    finally { moreLock.current = false; if (current === generation.current) setState((old) => ({ ...old, loading: false })); }
  };
  return { ...state, collection: state.items.find((item) => item.id === state.selectedId), select, refresh, more };
}
