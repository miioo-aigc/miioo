import { useEffect, useRef } from 'react';

/** 原生拖放负责数据传递，独立 DOM 影像负责跟随鼠标及缩放，不改动网格卡片。 */
export default function useCanvasDragPreview() {
  const preview = useRef(null);
  const nativePlaceholder = useRef(null);
  const clear = () => {
    if (preview.current?.frame) cancelAnimationFrame(preview.current.frame);
    preview.current?.host.remove();
    preview.current = null;
  };
  useEffect(() => {
    // Chromium/WebKit 需要已挂载且已绘制的节点作为拖动快照；
    // 临时创建、未挂载的透明 canvas 可能被忽略并回退到原卡片影像。
    const blank = document.createElement('canvas');
    blank.width = blank.height = 1;
    blank.setAttribute('aria-hidden', 'true');
    Object.assign(blank.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', pointerEvents: 'none', zIndex: '-1' });
    document.body.append(blank);
    nativePlaceholder.current = blank;
    const follow = (event) => {
      const current = preview.current;
      if (!current) return;
      current.host.style.left = `${event.clientX}px`;
      current.host.style.top = `${event.clientY}px`;
    };
    const leave = (event) => {
      if (!event.relatedTarget && preview.current) preview.current.host.style.visibility = 'hidden';
    };
    const enter = () => { if (preview.current) preview.current.host.style.visibility = 'visible'; };
    window.addEventListener('dragover', follow, true);
    window.addEventListener('dragenter', enter, true);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear, true);
    window.addEventListener('blur', clear);
    return () => {
      clear();
      blank.remove();
      nativePlaceholder.current = null;
      window.removeEventListener('dragover', follow, true);
      window.removeEventListener('dragenter', enter, true);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear, true);
      window.removeEventListener('blur', clear);
    };
  }, []);
  return {
    start(event) {
      clear();
      event.stopPropagation();
      const node = event.currentTarget;
      if (nativePlaceholder.current) event.dataTransfer.setDragImage(nativePlaceholder.current, 0, 0);
      const rect = node.getBoundingClientRect();
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.inert = true;
      Object.assign(host.style, { position: 'fixed', left: `${event.clientX}px`, top: `${event.clientY}px`, width: `${rect.width}px`, height: `${rect.height}px`, pointerEvents: 'none', zIndex: '9999', visibility: 'hidden' });
      const clone = node.cloneNode(true);
      // 固化当前外观，避免脱离父容器后样式或媒体尺寸变化。
      const originals = [node, ...node.querySelectorAll('*')];
      const copies = [clone, ...clone.querySelectorAll('*')];
      copies.forEach((copy, index) => {
        const style = getComputedStyle(originals[index]);
        for (const name of style) copy.style.setProperty(name, style.getPropertyValue(name));
        copy.style.pointerEvents = 'none';
        copy.removeAttribute('id');
        copy.removeAttribute('name');
        copy.removeAttribute('autoplay');
      });
      Object.assign(clone.style, { width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', transformOrigin: 'center', transform: 'scale(1)', transition: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'transform 240ms ease', opacity: '1' });
      host.style.marginLeft = `${-rect.width / 2}px`;
      host.style.marginTop = `${-rect.height / 2}px`;
      host.append(clone);
      document.body.append(host);
      const current = { host, clone, frame: null };
      preview.current = current;
      // 等浏览器完成原生快照再显示自定义影像，避免它也进入拖动快照。
      current.frame = requestAnimationFrame(() => {
        if (preview.current === current) host.style.visibility = 'visible';
      });
    },
    scale(accepted) {
      if (preview.current) preview.current.clone.style.transform = accepted ? 'scale(0.5)' : 'scale(1)';
    },
  };
}
