import { useEffect, useRef, useState } from 'react';
import { apiArchiveCanvasDocument, apiDuplicateCanvasDocument, apiCreateCanvasDocument, apiGetCanvasDocument, apiListCanvasDocuments, apiUpdateCanvasDocument } from '../../api/canvas';
import { createDevelopmentCanvas, isDevelopmentCanvas, listDevelopmentCanvases } from '../../api/CanvasDevelopment';
import { showGlobalToast } from '../../stores/toastStore';

// 仅管理同项目画布目录及其动作；节点、历史和视口仍由画布页面管理。
export function useCanvasList({ canvas, persistCanvas, onSelectCanvas, onRenamed, onBackProjects }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const requestId = useRef(null);
  const copyRequests = useRef(new Map());
  const id = canvas?.id;
  const projectId = canvas?.project_id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      if (isDevelopmentCanvas(id)) return listDevelopmentCanvases(projectId);
      const result = [];
      for (let page = 1; ; page += 1) {
        const data = await apiListCanvasDocuments({ projectId, page });
        result.push(...data.items);
        if (result.length >= data.total || !data.items.length) break;
      }
      return result.filter((item) => (item.project_id || null) === (projectId || null));
    };
    load().then((result) => {
      if (!cancelled) { setItems(result); setReady(true); }
    }).catch((error) => { if (!cancelled) showGlobalToast('error', error.message || '读取画布列表失败'); });
    return () => { cancelled = true; };
  }, [id, projectId]);

  const run = async (action) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try { await action(); return true; }
    catch (error) { showGlobalToast('error', error.message || '画布操作失败'); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async () => {
    if (!await persistCanvas()) throw new Error('当前画布尚不能保存，请等待上传或生成完成后重试');
  };
  const select = (targetId) => run(async () => {
    if (targetId === id) return;
    await save();
    onSelectCanvas(targetId);
  });
  const create = () => run(async () => {
    if (!ready) throw new Error('画布列表尚未加载完成，请稍后重试');
    await save();
    const max = items.reduce((value, item) => Math.max(value, Number(/^画布(\d+)$/.exec(item.title)?.[1] || 0)), 0);
    requestId.current ||= crypto.randomUUID();
    const params = { title: `画布${max + 1}`, projectId, clientRequestId: requestId.current };
    const created = isDevelopmentCanvas(id) ? createDevelopmentCanvas(params) : await apiCreateCanvasDocument(params);
    requestId.current = null;
    onSelectCanvas(created.id);
    showGlobalToast('success', `${created.title || params.title}已创建`);
  });
  const rename = (targetId, title) => run(async () => {
    title = title.trim();
    if (!title || title.length > 100) throw new Error('画布名称需为1至100个字符');
    if (targetId === id) await save();
    const current = await apiGetCanvasDocument(targetId);
    const result = await apiUpdateCanvasDocument(targetId, { baseRevision: current.revision, title });
    setItems((previous) => previous.map((item) => item.id === targetId ? { ...item, title, revision: result.revision } : item));
    if (targetId === id) onRenamed(title, result.revision);
    showGlobalToast('success', '画布名称已修改');
  });
  const listed = items.some((item) => item.id === id) ? items : [...items, ...(canvas ? [canvas] : [])];
  const duplicate = (targetId) => run(async () => {
    await save();
    const source = listed.find((item) => item.id === targetId);
    if (!source) throw new Error('画布不存在，请刷新后重试');
    if (!copyRequests.current.has(targetId)) copyRequests.current.set(targetId, crypto.randomUUID());
    const created = await apiDuplicateCanvasDocument(targetId, {
      title: `${(source.title || '未命名画布').slice(0, 97)} 副本`, clientRequestId: copyRequests.current.get(targetId),
    });
    copyRequests.current.delete(targetId);
    setItems((previous) => [...previous, created]);
    onSelectCanvas(created.id);
    showGlobalToast('success', '画布已复制');
  });
  const remove = (targetId) => run(async () => {
    if (!ready) throw new Error('画布列表尚未加载完成，请稍后重试');
    if (listed.length <= 1) throw new Error('项目至少需要保留一个画布');
    await apiArchiveCanvasDocument(targetId);
    const remaining = listed.filter((item) => item.id !== targetId);
    setItems(remaining);
    if (targetId === id) {
      if (remaining.length) onSelectCanvas(remaining[0].id);
      else onBackProjects();
    }
    showGlobalToast('success', '画布已删除');
  });
  return { items: listed.map((item) => ({ ...item, name: item.title })), busy, select, create, rename, duplicate, remove };
}
