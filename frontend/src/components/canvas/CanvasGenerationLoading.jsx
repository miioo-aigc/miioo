/** 节点生成态：Paper Shaders 动态背景与持续循环的 mask-reveal-up 进度文案。 */
import { useEffect, useRef, useState } from 'react';
import { getCanvasProgressMessage } from './CanvasGenerationProgress';
import CanvasEffectBoundary from './CanvasEffectBoundary';
import CanvasGenerationShader from './CanvasGenerationShader';
import './CanvasGenerationLoading.css';

function getReducedMotionQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    return null;
  }
}

function ProgressMessage({ message, reducedMotion }) {
  const elementRef = useRef(null);
  const latestRef = useRef(message);
  useEffect(() => { latestRef.current = message; }, [message]);
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    if (reducedMotion || !element.animate) {
      element.textContent = latestRef.current;
      return;
    }
    let cancelled = false;
    let animations = [];
    let timer;
    let wake;
    const wait = (ms) => new Promise((resolve) => { wake = resolve; timer = setTimeout(resolve, ms); });
    const animate = async (spans, entering) => {
      animations = spans.map((span, index) => span.animate(entering ? [
        { opacity: 0, transform: 'translateY(30px)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
      ] : [
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
        { opacity: 0, transform: 'translateY(-22px)', filter: 'blur(6px)' },
      ], { duration: entering ? 760 : 520, delay: index * (entering ? 90 : 70),
        easing: entering ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.64, 0, 0.78, 0)', fill: 'both' }));
      await Promise.all(animations.map((animation) => animation.finished));
      animations.forEach((animation) => { animation.commitStyles(); animation.cancel(); });
    };
    const loop = async () => {
      while (!cancelled) {
        const spans = latestRef.current.split('\n').map((line) => {
          const mask = document.createElement('div');
          mask.className = 'canvas-generation-loading__mask';
          const span = document.createElement('span');
          span.textContent = line || '\u00a0';
          span.style.display = 'block';
          mask.append(span);
          return { mask, span };
        });
        element.replaceChildren(...spans.map(({ mask }) => mask));
        await animate(spans.map(({ span }) => span), true);
        if (cancelled) break;
        await wait(1600);
        if (cancelled) break;
        await animate(spans.map(({ span }) => span), false);
        if (cancelled) break;
        await wait(35);
      }
    };
    loop().catch(() => { if (!cancelled) element.textContent = latestRef.current; });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      wake?.();
      animations.forEach((animation) => animation.cancel());
    };
  }, [reducedMotion]);
  return <div className="canvas-generation-loading__message">
    {reducedMotion ? <span>{message}</span> : null}
    <div ref={elementRef} hidden={reducedMotion} aria-hidden="true" />
  </div>;
}

const fallbackBackground = <div className="canvas-generation-loading__fallback" aria-hidden="true" />;

export function CanvasGenerationFallback({ message }) {
  const text = getCanvasProgressMessage(message);
  return <div className="canvas-node__loading canvas-generation-loading canvas-generation-loading--fallback" role="status" aria-label={text}>
    {fallbackBackground}
    <div className="canvas-generation-loading__message">
      <span>{text}</span>
    </div>
  </div>;
}

export default function CanvasGenerationLoading({ message }) {
  const [reducedMotion, setReducedMotion] = useState(() => getReducedMotionQuery()?.matches ?? false);
  useEffect(() => {
    const query = getReducedMotionQuery();
    if (!query) return;
    const update = () => setReducedMotion(query.matches);
    if (typeof query.addEventListener !== 'function') return;
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const text = getCanvasProgressMessage(message);
  return <div className="canvas-node__loading canvas-generation-loading" role="status" aria-label={text}>
    <CanvasGenerationShader reducedMotion={reducedMotion} />
    <CanvasEffectBoundary fallback={<div className="canvas-generation-loading__message"><span>{text}</span></div>}>
      <ProgressMessage message={text} reducedMotion={reducedMotion} />
    </CanvasEffectBoundary>
  </div>;
}
