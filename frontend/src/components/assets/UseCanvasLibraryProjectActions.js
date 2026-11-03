import { useEffect, useRef, useState } from 'react';
import { apiCopyProject, apiDeleteProject, apiDownloadProjectAssets, apiUpdateProject } from '../../api/project';
import { getAuthSessionGeneration } from '../../api/request';
import { downloadBlob } from '../../utils/downloadBlob';
import { showGlobalToast } from '../../stores/toastStore';

/** 左侧项目级操作；所有请求使用项目编号，不能传资产集合编号。 */
export default function useCanvasLibraryProjectActions(library) {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const session = getAuthSessionGeneration();
    const current = () => mounted.current && session === getAuthSessionGeneration();
    try { await action(current); }
    catch (cause) { if (current()) showGlobalToast('error', cause.message || '项目操作失败，请重试'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const open = (kind, item) => {
    if (lock.current || library.loading) return;
    if (kind === 'rename' || kind === 'delete') { setDialog({ kind, item }); return; }
    if (kind !== 'copy' && kind !== 'download') return;
    run(async (current) => {
      if (kind === 'copy') {
        const created = await apiCopyProject(item.id);
        if (!current()) return;
        if (!created?.id) throw new Error('复制结果未确认，请刷新项目列表核对');
        library.refresh();
        showGlobalToast('success', '项目复制成功');
      } else {
        const result = await apiDownloadProjectAssets(item.id);
        if (!current()) return;
        const filename = (item.name || '项目').replace(/[\\/:*?"<>|]/g, '_') + '.zip';
        if (result.type === 'url') {
          const url = new URL(result.value, window.location.href);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('下载地址无效');
          const link = document.createElement('a');
          link.href = url.href; link.download = filename; link.rel = 'noopener';
          document.body.append(link); link.click(); link.remove();
        } else downloadBlob(result.value, filename);
        showGlobalToast('success', '已开始下载项目资产');
      }
    });
  };
  const confirm = (name) => {
    if (!dialog) return;
    const target = dialog;
    if (target.kind === 'rename' && !name?.trim()) return;
    return run(async (current) => {
      if (target.kind === 'rename') await apiUpdateProject(target.item.id, { name: name.trim() });
      else await apiDeleteProject(target.item.id);
      if (!current()) return;
      setDialog(null);
      library.refresh();
      showGlobalToast('success', target.kind === 'rename' ? '项目重命名成功' : '项目删除成功');
    });
  };
  return { dialog, busy, open, confirm, close: () => { if (!lock.current) setDialog(null); } };
}
