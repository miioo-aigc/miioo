import { useLayoutEffect } from 'react';
import { useStoreApi } from '@xyflow/react';
import { handleCanvasTextWheel } from './CanvasTextWheel';

/** 分享和编辑画布共用正文手势；原生非被动监听允许可靠阻止横向默认滚动。 */
export function useCanvasTextWheel(ref) {
  const store = useStoreApi();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event) => handleCanvasTextWheel(event, element, store.getState().panBy);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [ref, store]);
}
