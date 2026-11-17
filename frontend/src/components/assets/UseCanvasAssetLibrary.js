import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasAssetLibrary as api } from '../../api/CanvasAssetLibrary';
import { showGlobalToast } from '../../stores/toastStore';
import { CANVAS_ASSETS_CHANGED_EVENT } from '../../utils/canvasAssetsEvents';
import { canvasLibraryRemoveItems } from './CanvasLibraryItems';

/** 目录读取、游标与操作串行化；过期页面响应不得覆盖新目录。
 * 2026-11-02：移动后静默同步已加载范围，不清空列表或重置分页。
 * 2026-11-17：删除成功后就地移除条目，不触发列表清空重载。
 */
export default function useCanvasAssetLibrary(collection, onCollectionUnavailable) {
  const [parentId, setParentId] = useState(collection.root_folder_id);
  const [snapshot, setSnapshot] = useState({ items: [], folder: null, cursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const generation = useRef(0);
  const lock = useRef(false);
  const mounted = useRef(true);
  const moreLock = useRef(false);
  const itemsRef = useRef(snapshot.items);
  useEffect(() => { itemsRef.current = snapshot.items; }, [snapshot.items]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    let timer = null;
    const schedule = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        setEpoch((value) => value + 1);
      }, 250);
    };
    const handleAssetsChanged = (event) => {
      const canvasId = event?.detail?.canvasId;
      if (!canvasId || String(collection.bound_canvas_id || '') !== String(canvasId)) return;
      schedule();
    };
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') schedule();
    };
    window.addEventListener(CANVAS_ASSETS_CHANGED_EVENT, handleAssetsChanged);
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(CANVAS_ASSETS_CHANGED_EVENT, handleAssetsChanged);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [collection.bound_canvas_id]);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return [];
      setLoading(true); setError(''); setSnapshot({ items: [], folder: null, cursor: null });
      return Promise.all([api.list({ collection_id: collection.id, parent_id: parentId }, controller.signal), api.folder(parentId, controller.signal)]);
    })
      .then(([page, folder]) => {
        if (!controller.signal.aborted && current === generation.current) setSnapshot({ items: page.items || [], folder, cursor: page.next_cursor || null });
      }).catch((cause) => {
        if (controller.signal.aborted || current !== generation.current || cause.name === 'AbortError') return;
        if (cause.code === 'COLLECTION_NOT_FOUND') {
          onCollectionUnavailable?.(collection.id);
          return;
        }
        setError(cause.message);
      }).finally(() => { if (!controller.signal.aborted && current === generation.current) setLoading(false); });
    return () => controller.abort();
  }, [collection.id, epoch, onCollectionUnavailable, parentId]);
  const refresh = useCallback(() => setEpoch((value) => value + 1), []);
  // 删除成功后直接移除已提交条目，避免清空快照和整页重载造成闪烁。
  const removeItems = useCallback((removed) => {
    setSnapshot((previous) => {
      const items = canvasLibraryRemoveItems(previous.items, removed);
      return items === previous.items ? previous : { ...previous, items };
    });
  }, []);
  // 移动后静默重读已加载范围，保留旧卡片直到新快照准备好。
  const syncAfterMove = async (moved, target) => {
    const current = generation.current;
    const keys = new Set(moved.map((item) => item.type + ':' + item.id));
    const keepCount = Math.max(1, snapshot.items.length - (target === parentId ? 0 : moved.length));
    try {
      const folder = await api.folder(parentId);
      const items = [];
      let cursor;
      do {
        const page = await api.list({ collection_id: collection.id, parent_id: parentId, ...(cursor ? { cursor } : {}) });
        items.push(...(page.items || []));
        cursor = page.next_cursor || null;
      } while (cursor && items.length < keepCount);
      if (!mounted.current || current !== generation.current) return false;
      setSnapshot({ items, folder, cursor });
      return true;
    } catch (cause) {
      if (mounted.current && current === generation.current && target !== parentId) {
        setSnapshot((previous) => ({ ...previous, items: previous.items.filter((item) => !keys.has(item.type + ':' + item.id)) }));
      }
      throw new Error('文件已移动，但目录同步失败：' + (cause.message || '请稍后重试'), { cause });
    }
  };
  const run = async (action, { reload = true } = {}) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      const result = await action();
      if (mounted.current && reload) refresh();
      return result ?? true;
    } catch (cause) {
      showGlobalToast('error', cause.message || '操作失败，请重试');
      return false;
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const loadMore = async () => {
    if (moreLock.current || !snapshot.cursor || loading) return;
    moreLock.current = true;
    const current = generation.current;
    setLoading(true);
    try {
      const page = await api.list({ collection_id: collection.id, parent_id: parentId, cursor: snapshot.cursor });
      if (current === generation.current) setSnapshot((previous) => ({ ...previous,
        items: Array.from(new Map([...previous.items, ...page.items].map((item) => [`${item.type}:${item.id}`, item])).values()),
        cursor: page.next_cursor || null,
      }));
    } catch (cause) { showGlobalToast('error', cause.message); }
    finally { moreLock.current = false; if (current === generation.current) setLoading(false); }
  };
  return { parentId, navigate: setParentId, ...snapshot, loading, error, busy, refresh, removeItems, run, loadMore, syncAfterMove };
}
