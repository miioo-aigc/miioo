import { useLayoutEffect, useRef } from 'react';
import { createCanvasAutosave } from './CanvasAutosave';
import { serializeCanvasDocument } from './CanvasDocument';
import { showGlobalToast } from '../../stores/toastStore';

export function useCanvasAutosave({ enabled, nodes, edges, viewport, persist, paused, acknowledgeRef }) {
  const controller = useRef(null);
  let key;
  let canSave = !paused && !nodes.some((node) => node.data?.generating || node.data?.generationPending);
  try { key = JSON.stringify(serializeCanvasDocument(nodes, edges, viewport)); }
  catch {
    // 上传中仍是未保存状态，但不能把临时素材写入后端。
    key = JSON.stringify({ nodes, edges, viewport });
    canSave = false;
  }
  useLayoutEffect(() => {
    const instance = createCanvasAutosave({
      onError: (error) => showGlobalToast('error', '画布自动保存失败：' + error.message + '。请勿刷新或离开，稍后重试。'),
    });
    controller.current = instance;
    acknowledgeRef.current = (document) => instance.acknowledge(JSON.stringify(document));
    const beforeUnload = (event) => {
      if (!instance.dirty()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const pageUrl = window.location.href;
    const popState = (event) => {
      if (!instance.dirty() || window.confirm('画布还有未保存的内容，离开会丢失这些修改。确定离开吗？')) return;
      event.stopImmediatePropagation();
      window.history.pushState(null, '', pageUrl);
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', popState, true);
    return () => {
      instance.dispose();
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', popState, true);
    };
  }, [acknowledgeRef]);
  useLayoutEffect(() => {
    if (enabled) controller.current.update(key, canSave, persist);
  }, [enabled, key, canSave, persist]);
  const leave = async (action) => {
    if (!action) return;
    const instance = controller.current;
    if (instance?.dirty()) {
      showGlobalToast('warning', '画布尚未保存完成，正在尝试保存，请稍候');
      try { await instance.flush(); }
      catch (error) { showGlobalToast('error', '画布保存失败：' + error.message); return; }
      if (instance.dirty()) {
        showGlobalToast('warning', '画布仍有未保存内容，请等待上传或生成完成后重试');
        return;
      }
    }
    action();
  };
  return { acknowledge: (document) => controller.current?.acknowledge(JSON.stringify(document)), leave };
}
