/** 节点生成态：Paper 动态背景与持续循环的 mask-reveal-up 进度文案。 */
import { useEffect, useRef, useState } from 'react';
import { DotOrbit, MeshGradient } from '@paper-design/shaders-react';
import { getCanvasProgressMessage } from './CanvasGenerationProgress';
import './CanvasGenerationLoading.css';

const layerStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

function ProgressMessage({ message, reducedMotion }) {
  const elementRef = useRef(null);
  const latestRef = useRef(message);
  useEffect(() => { latestRef.current = message; }, [message]);
  useEffect(() => {
    const element = elementRef.current;
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

export default function CanvasGenerationLoading({ message }) {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const text = getCanvasProgressMessage(message);
  return <div className="canvas-node__loading canvas-generation-loading" role="status" aria-label={text}>
    <DotOrbit scale={0.1} size={0.6} sizeRange={0.48} spreading={0.1} speed={reducedMotion ? 0 : 1} stepsPerColor={1} frame={9563964.609994078} colors={['#FFFFFF0A']} colorBack="#00000000" style={{ ...layerStyle, backgroundColor: '#000000' }} />
    <MeshGradient speed={reducedMotion ? 0 : 2} scale={1.45} distortion={0.43} swirl={0.07} frame={17999729.999991026} colors={['#FFFFFF99', '#00000080', '#2DC3E1']} style={{ ...layerStyle, mixBlendMode: 'color-dodge' }} />
    <ProgressMessage message={text} reducedMotion={reducedMotion} />
  </div>;
}
