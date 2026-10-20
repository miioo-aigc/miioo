import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasAssetLibrary as api } from '../../api/CanvasAssetLibrary';

/** 素材来源与目标目录共用的集合范围浏览，不使用全库空目录查询。 */
export default function useCanvasLibraryBrowser(collection = null) {
  const [path, setPath] = useState(() => collection ? [{ ...collection, id: collection.root_folder_id, collection_id: collection.id }] : []);
  const [page, setPage] = useState({ items: [], next_cursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const moreLock = useRef(false);
  const current = path.at(-1);
  const parentId = current?.id;
  const collectionId = path[0]?.collection_id;
  const read = useCallback((cursor, signal) => collectionId
    ? api.list({ collection_id: collectionId, parent_id: parentId, ...(cursor ? { cursor } : {}) }, signal)
    : api.collections(cursor ? { cursor } : {}, signal).then((result) => ({ ...result, items: result.items.map((item) => ({ ...item, type: 'collection', collection_id: item.id, id: item.root_folder_id })) })), [collectionId, parentId]);
  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setLoading(true); setError(''); setPage({ items: [], next_cursor: null });
      try {
        const result = await read(null, controller.signal);
        if (!controller.signal.aborted && version === generation.current) setPage(result);
      } catch (cause) {
        if (!controller.signal.aborted && version === generation.current) setError(cause.message);
      } finally {
        if (!controller.signal.aborted && version === generation.current) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [read, retry]);
  const more = async () => {
    if (moreLock.current || !page.next_cursor || loading) return;
    moreLock.current = true;
    const version = generation.current;
    try {
      const result = await read(page.next_cursor);
      if (version === generation.current) setPage((old) => ({ ...result, items: [...new Map([...old.items, ...result.items].map((item) => [item.id, item])).values()] }));
    } catch (cause) { if (version === generation.current) setError(cause.message); }
    finally { moreLock.current = false; }
  };
  return { path, page, loading, error, parentId, more, retry: () => setRetry((value) => value + 1),
    enter: (item) => { generation.current++; setPath((old) => [...old, item]); },
    back: () => { generation.current++; setPath((old) => old.slice(0, -1)); } };
}
