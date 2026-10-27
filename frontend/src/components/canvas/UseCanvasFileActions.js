/** 文件选择、下载与异步保护；页面只提供真实草稿及历史写入回调。 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CANVAS_FILE_LIMIT, mergeCanvasFile, parseCanvasFile, serializeCanvasFile } from './CanvasFile';
import { showGlobalToast } from '../../stores/toastStore';
import { getCanvasFailureReason } from './CanvasFailureFeedback';
import { apiEnableCanvasShare } from '../../api/canvas';
import { copyCanvasShareLink, enableAndCopyCanvasShare } from './CanvasShareLink';

export function useCanvasFileActions({ nodes, setNodes, name, flowInstance, canvasId }) {
  const inputRef = useRef(null);
  const busy = useRef(false);
  const scope = useRef(null);
  const latestExport = useRef(null);
  const [focusIds, setFocusIds] = useState(null);
  useEffect(() => {
    const token = {};
    scope.current = token;
    return () => { scope.current = null; };
  }, [canvasId]);
  useEffect(() => {
    if (!focusIds || !flowInstance) return;
    const frame = requestAnimationFrame(() => {
      flowInstance.fitView({ nodes: focusIds.map((id) => ({ id })), padding: 0.2, maxZoom: 1, duration: 300 });
      setFocusIds(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusIds, flowInstance, nodes]);
  const run = async (action, failurePrefix = null) => {
    if (busy.current) return;
    busy.current = true;
    const token = scope.current;
    try { await action(() => scope.current === token); }
    catch (error) { if (scope.current === token) showGlobalToast(failurePrefix ? failurePrefix + getCanvasFailureReason(error) : error.message || '画布操作失败', 'error'); }
    finally { busy.current = false; }
  };
  const reportSaveError = useCallback((error) => {
    const token = scope.current;
    if (!token) return;
    showGlobalToast('error', '画布保存失败：' + getCanvasFailureReason(error) + '。建议下载画布文件，备份最新进度，请勿刷新或离开。', {
      action: { label: '下载画布', onClick: () => {
        if (scope.current === token) return latestExport.current?.();
      } },
    });
  }, []);
  const actions = {
    reportSaveError,
    inputRef,
    open: () => { if (!busy.current) inputRef.current?.click(); },
    importFile: (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      return run(async (active) => {
        if (file.size > CANVAS_FILE_LIMIT) throw new Error('画布文件不能超过100MB');
        const imported = parseCanvasFile(await file.text());
        if (!active()) return;
        if (!imported.length) throw new Error('画布文件中没有可导入的节点');
        let ids = [];
        setNodes((current) => {
          const merged = mergeCanvasFile(current, imported);
          ids = merged.slice(current.length).filter((node) => !node.parentId).map((node) => node.id);
          return merged;
        });
        setFocusIds(ids);
        showGlobalToast('画布文件已合并导入', 'success');
      });
    },
    share: (action) => {
      if (action === 'copy-link') return run(async (active) => {
        const copied = await enableAndCopyCanvasShare({
          canvasId, origin: window.location.origin, enable: apiEnableCanvasShare,
          copy: copyCanvasShareLink, active,
        });
        if (copied) showGlobalToast('链接已复制，展示服务端已保存的版本', 'success');
      });
      if (action !== 'export-canvas') return;
      return run(async (active) => {
        const text = await serializeCanvasFile(nodes, name);
        if (!active()) return;
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name.replace(/[<>:"/\\|?*]/g, '_')}.miioo.json`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, '画布导出失败：');
    },
  };
  useLayoutEffect(() => { latestExport.current = () => actions.share('export-canvas'); });
  return actions;
}
