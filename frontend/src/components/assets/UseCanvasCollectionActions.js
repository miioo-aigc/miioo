import { useEffect, useRef, useState } from 'react';
import { canvasAssetLibrary as api } from '../../api/CanvasAssetLibrary';
import { showGlobalToast } from '../../stores/toastStore';

const taskKey = (owner) => `miioo:canvas-library:${owner}:operations`;
function readTasks(owner) {
  try {
    const value = JSON.parse(localStorage.getItem(taskKey(owner)) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === 'string' && ['copy', 'download'].includes(item.kind)) : [];
  } catch { return []; }
}
function saveTasks(owner, tasks) {
  try { localStorage.setItem(taskKey(owner), JSON.stringify(tasks)); } catch { /* 存储受限不阻止当前任务。 */ }
}
function download(result) {
  if (!result?.download_url) throw new Error('服务端未返回打包下载地址');
  const url = new URL(result.download_url, window.location.href);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('下载地址无效');
  const link = document.createElement('a');
  link.href = url.href; link.download = result.filename || '画布资产.zip'; link.rel = 'noopener';
  document.body.append(link); link.click(); link.remove();
  showGlobalToast('success', result.omitted_count ? `已开始下载，跳过 ${result.omitted_count} 个不可用素材` : '已开始下载');
}

/** 集合写入与持久化后台任务；恢复只查询原任务，不重复提交。 */
export default function useCanvasCollectionActions(library) {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = library.refresh;
  useEffect(() => {
    if (!library.owner) return;
    const owner = library.owner;
    let cancelled = false;
    let timer;
    const poll = async () => {
      const tasks = readTasks(owner);
      for (const task of tasks) {
        if (cancelled) return;
        try {
          const result = await api.operation(task.id);
          if (cancelled) return;
          if (!['completed', 'failed'].includes(result.status)) continue;
          saveTasks(owner, readTasks(owner).filter((item) => item.id !== task.id));
          if (result.status === 'failed') showGlobalToast('error', result.error?.message || '后台操作失败');
          else if (task.kind === 'download') {
            try { download(result.result); }
            catch (cause) { showGlobalToast('error', `${cause.message}，请重新发起下载`); }
          }
          else { refresh(); showGlobalToast('success', '资产集合复制完成'); }
        } catch { /* 网络失败保留操作编号，下次继续查询。 */ }
      }
      if (!cancelled) timer = setTimeout(poll, 2500);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [library.owner, refresh]);
  const run = async (action) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { return await action(); }
    catch (cause) { showGlobalToast('error', cause.message || '操作失败，请重试'); }
    finally { lock.current = false; setBusy(false); }
  };
  const settle = (result, kind) => {
    if (result.status === 'failed') throw new Error(result.error?.message || '后台操作失败');
    if (['pending', 'processing'].includes(result.status)) {
      if (!result.operation_id) throw new Error('服务端未返回操作编号，请刷新确认结果');
      const tasks = readTasks(library.owner);
      saveTasks(library.owner, [...tasks.filter((task) => task.id !== result.operation_id), { id: result.operation_id, kind }]);
      showGlobalToast('success', kind === 'copy' ? '正在复制资产集合' : '正在打包资产');
    } else if (kind === 'download') download(result.result ?? result);
    else { library.refresh(); showGlobalToast('success', '资产集合复制完成'); }
  };
  const open = (kind, item) => {
    if (busy) return;
    if (kind === 'rename') { setDialog({ kind, item }); return; }
    run(async () => {
      if (kind === 'copy') return settle(await api.copyCollection(item.id, { base_revision: item.revision }), 'copy');
      if (kind === 'delete') {
        const preview = await api.preview({ selection: [{ type: 'collection', id: item.id, base_revision: item.revision }] });
        setDialog({ kind, item, preview });
      } else {
        const preview = await api.previewDownload(item.id);
        if (!preview.downloadable_count) throw new Error('集合内没有可下载素材');
        if (preview.omitted_count) setDialog({ kind, item, preview });
        else settle(await api.downloadCollection(item.id, { preview_token: preview.preview_token, allow_partial: false }), 'download');
      }
    });
  };
  const confirm = (name) => run(async () => {
    const current = dialog;
    try {
      if (current.kind === 'rename') { await api.renameCollection(current.item.id, { name: name.trim(), base_revision: current.item.revision }); library.refresh(); }
      else if (current.kind === 'delete') { await api.commit({ preview_token: current.preview.preview_token }); library.refresh(); }
      else settle(await api.downloadCollection(current.item.id, { preview_token: current.preview.preview_token, allow_partial: true }), 'download');
      setDialog(null);
    } catch (cause) {
      // 预检不可在失败后复用；名称编辑失败则保留输入。
      if (current.kind !== 'rename') setDialog(null);
      throw cause;
    }
  });
  return { dialog, busy, open, confirm, close: () => { if (!busy) setDialog(null); } };
}
