import { useLayoutEffect, useRef, useState } from 'react';
import './canvas-connection-pulse.css';
import { getCanvasPulseTravel } from './CanvasPulseMotion';

// 连线和卡片共享事件时钟，挂载或尺寸变化不会重新播放。
export function CanvasPulsePath({ path, pulse, delay = 0, onMeasure, measurementKind = 'edge' }) {
  const groupRef = useRef(null);
  useLayoutEffect(() => {
    const length = groupRef.current.firstElementChild.getTotalLength();
    onMeasure?.(pulse.id, length, measurementKind);
  }, [path, pulse.id, onMeasure, measurementKind]);
  useLayoutEffect(() => {
    if (pulse.startedAt === null || !pulse.speed) return;
    const pathLength = groupRef.current.firstElementChild.getTotalLength();
    const animations = [...groupRef.current.children].map((element, index) => {
      const travel = getCanvasPulseTravel(pathLength, [10, 7, 4, 1][index], pulse.speed);
      element.setAttribute('stroke-dasharray', `${travel.tailLength} ${pathLength * 2}`);
      // 位移只使用两个关键帧和真实路径像素；透明度单独播放，不能干扰运动插值。
      const movement = element.animate([
        { strokeDashoffset: `${travel.from}px` },
        { strokeDashoffset: `${travel.to}px` },
      ], { duration: travel.duration, delay, fill: 'both', easing: 'linear' });
      const opacity = element.animate([
        { opacity: 0 },
        { opacity: 1, offset: 0.06 },
        { opacity: 1, offset: 0.96 },
        { opacity: 0 },
      ], { duration: travel.duration, delay, fill: 'both', easing: 'linear' });
      const elapsed = Math.max(0, performance.now() - pulse.startedAt);
      movement.currentTime = elapsed;
      opacity.currentTime = elapsed;
      return [movement, opacity];
    });
    return () => animations.flat().forEach((animation) => animation.cancel());
  }, [pulse.startedAt, pulse.speed, delay, path]);
  return <g ref={groupRef} className="canvas-connection-pulse" aria-hidden="true">
    {[10, 7, 4, 1].map((tail, index) => <path key={tail} d={path}
      className={`canvas-connection-pulse__layer canvas-connection-pulse__layer--${index}`} />)}
  </g>;
}

export default function CanvasNodeConnectionPulse({ pulses, onMeasure }) {
  const svgRef = useRef(null);
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const frame = svgRef.current.parentElement;
    const measure = () => setSize({ width: frame.offsetWidth, height: frame.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const w = (size?.width || 240) - 1;
  const h = (size?.height || 240) - 1;
  const r = Math.min(15.5, w / 2, h / 2);
  const middle = (h + .5) / 2;
  const top = `M .5 ${middle} V ${r + .5} Q .5 .5 ${r + .5} .5 H ${w - r} Q ${w} .5 ${w} ${r + .5} V ${middle}`;
  const bottom = `M .5 ${middle} V ${h - r} Q .5 ${h} ${r + .5} ${h} H ${w - r} Q ${w} ${h} ${w} ${h - r} V ${middle}`;
  return <svg ref={svgRef} className="canvas-node-connection-pulse" aria-hidden="true">
    {size && pulses.map((pulse) => <g key={pulse.id}>
      <CanvasPulsePath path={top} pulse={pulse} delay={pulse.edgeDuration ?? 0} onMeasure={onMeasure} measurementKind="card" />
      <CanvasPulsePath path={bottom} pulse={pulse} delay={pulse.edgeDuration ?? 0} />
    </g>)}
  </svg>;
}
