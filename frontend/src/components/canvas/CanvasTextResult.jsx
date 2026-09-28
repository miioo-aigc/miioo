/** 生成正文逐行入场；测量实际换行，动画结束后恢复普通文本。 */
import { useLayoutEffect, useRef } from 'react';
import { getRevealCharacters, getRevealLines, shouldRevealResult } from './CanvasTextReveal';

export default function CanvasTextResult({ content = '', generating = false, editing = false }) {
  const elementRef = useRef(null);
  const previousRef = useRef({ content, generating, editing });

  useLayoutEffect(() => {
    const element = elementRef.current;
    const current = { content, generating, editing };
    const reveal = shouldRevealResult(previousRef.current, current);
    previousRef.current = current;
    element.textContent = content;
    if (!reveal || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) return;

    // 在原始文本上测量行位置，不用字符盒子改变浏览器的自动换行。
    const range = document.createRange();
    let offset = 0;
    const lines = getRevealLines(getRevealCharacters(content).map(({ text }) => {
      range.setStart(element.firstChild, offset);
      offset += text.length;
      range.setEnd(element.firstChild, offset);
      return { text, top: range.getClientRects()[0]?.top ?? 0 };
    }));
    const lineHeight = getComputedStyle(element).lineHeight;
    element.setAttribute('aria-label', content);
    const fragment = document.createDocumentFragment();
    const spans = lines.map(({ text }) => {
      const mask = document.createElement('div');
      mask.style.height = lineHeight;
      mask.style.overflow = 'hidden';
      mask.setAttribute('aria-hidden', 'true');
      const span = document.createElement('span');
      span.textContent = text.replace(/\r?\n$/, '');
      span.style.display = 'block';
      span.style.whiteSpace = 'pre';
      mask.append(span);
      fragment.append(mask);
      return span;
    });
    element.replaceChildren(fragment);
    const animations = spans.map((span, index) => span.animate([
      { opacity: 0, transform: 'translateY(30px)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
    ], { duration: 760, delay: lines[index].delay, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }));
    let cancelled = false;
    Promise.all(animations.map((animation) => animation.finished)).then(() => {
      if (cancelled) return;
      element.textContent = content;
      element.removeAttribute('aria-label');
    }).catch(() => {});
    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
      element.removeAttribute('aria-label');
    };
  }, [content, generating, editing]);

  return <div ref={elementRef} hidden={!content || editing} className="canvas-node__text-result" />;
}
