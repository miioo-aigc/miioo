import { useLayoutEffect } from 'react';
import { useStoreApi } from '@xyflow/react';
import { handleCanvasTextWheel } from './CanvasTextWheel';

/** 分享和编辑画布共用正文手势；原生非被动监听允许可靠阻止横向默认滚动。 */
export function useCanvasTextWheel(ref, enabled = true) {
  const store = useStoreApi();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let hideTimer;
    const hide = () => { element.dataset.scrolling = 'false'; };
    const show = () => {
      window.clearTimeout(hideTimer);
      if (!enabled || element.scrollHeight <= element.clientHeight + 1) { hide(); return; }
      element.dataset.scrolling = 'true';
      hideTimer = window.setTimeout(hide, 900);
    };
    hide();
    const onWheel = (event) => {
      if (!enabled) return;
      handleCanvasTextWheel(event, element, store.getState().panBy);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('scroll', show, { passive: true });
    element.addEventListener('pointerenter', show);
    element.addEventListener('pointermove', show);
    element.addEventListener('pointerleave', hide);
    return () => {
      window.clearTimeout(hideTimer);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('scroll', show);
      element.removeEventListener('pointerenter', show);
      element.removeEventListener('pointermove', show);
      element.removeEventListener('pointerleave', hide);
      delete element.dataset.scrolling;
    };
  }, [ref, store, enabled]);
}
