import { useLayoutEffect } from 'react';

/** 只读正文的剩余内容提示；不遮挡编辑器，不改变正文或滚动位置。 */
export function useCanvasTextOverflow(ref, editing = false) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || editing) return;
    const measure = () => {
      element.dataset.hasMore = String(element.scrollHeight - element.clientHeight - element.scrollTop > 1);
    };
    const resize = new ResizeObserver(measure);
    const observeSize = () => {
      resize.disconnect();
      resize.observe(element);
      for (const child of element.children) resize.observe(child);
      measure();
    };
    const mutation = new MutationObserver(observeSize);
    mutation.observe(element, { childList: true, characterData: true, subtree: true });
    element.addEventListener('scroll', measure, { passive: true });
    observeSize();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      element.removeEventListener('scroll', measure);
      delete element.dataset.hasMore;
    };
  }, [ref, editing]);
}
