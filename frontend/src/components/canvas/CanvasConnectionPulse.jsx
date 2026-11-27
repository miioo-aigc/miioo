import { useLayoutEffect, useRef, useState } from 'react';
import './canvas-connection-pulse.css';
import { getCanvasPulseTravel } from './CanvasPulseMotion';

const PULSE_TAIL_PERCENTAGES = [10, 7, 4, 1];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function getPathLength(element) {
  if (!element || typeof element.getTotalLength !== 'function') return 0;
  try {
    const length = element.getTotalLength();
    return Number.isFinite(length) && length > 0 ? length : 0;
  } catch (error) {
    console.warn('[画布] 连线流光路径测量失败，已跳过本次动画:', error);
    return 0;
  }
}

function startAnimation(element, frames, options) {
  if (!element || typeof element.animate !== 'function') return null;
  try {
    return element.animate(frames, options);
  } catch (error) {
    console.warn('[画布] 连线流光启动失败，已跳过本次动画:', error);
    return null;
  }
}

function setAnimationTime(animation, time) {
  if (!animation) return;
  try {
    animation.currentTime = time;
  } catch {
    // 个别浏览器不支持回拨尚未开始的动画，保持从当前位置播放即可。
  }
}

// 连线和卡片共享事件时钟，挂载或尺寸变化不会重新播放。
export function CanvasPulsePath({ path, pulse, delay = 0, onMeasure, measurementKind = 'edge' }) {
  const groupRef = useRef(null);
  useLayoutEffect(() => {
    const length = getPathLength(groupRef.current?.firstElementChild);
    if (!length || !onMeasure) return;
    try {
      onMeasure(pulse.id, length, measurementKind);
    } catch (error) {
      console.warn('[画布] 连线流光测量回调失败，已跳过本次动画:', error);
    }
  }, [path, pulse.id, onMeasure, measurementKind]);
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || pulse.startedAt === null || !(pulse.speed > 0)) return;
    if (prefersReducedMotion()) return;
    const pathLength = getPathLength(group.firstElementChild);
    if (!pathLength) return;
    const animations = [];
    [...group.children].forEach((element, index) => {
      const tailPercentage = PULSE_TAIL_PERCENTAGES[index];
      if (!tailPercentage) return;
      const travel = getCanvasPulseTravel(pathLength, tailPercentage, pulse.speed);
      if (!Number.isFinite(travel.duration) || travel.duration <= 0) return;
      try {
        element.setAttribute('stroke-dasharray', `${travel.tailLength} ${pathLength * 2}`);
      } catch (error) {
        console.warn('[画布] 连线流光样式设置失败，已跳过本次动画:', error);
        return;
      }
      // 位移只使用两个关键帧和真实路径像素；透明度单独播放，不能干扰运动插值。
      const movement = startAnimation(element, [
        { strokeDashoffset: `${travel.from}px` },
        { strokeDashoffset: `${travel.to}px` },
      ], { duration: travel.duration, delay, fill: 'both', easing: 'linear' });
      const opacity = startAnimation(element, [
        { opacity: 0 },
        { opacity: 1, offset: 0.06 },
        { opacity: 1, offset: 0.96 },
        { opacity: 0 },
      ], { duration: travel.duration, delay, fill: 'both', easing: 'linear' });
      const elapsed = Math.max(0, performance.now() - pulse.startedAt);
      setAnimationTime(movement, elapsed);
      setAnimationTime(opacity, elapsed);
      if (movement) animations.push(movement);
      if (opacity) animations.push(opacity);
    });
    return () => animations.forEach((animation) => {
      try {
        animation.cancel();
      } catch {
        // 动画已经失效或随节点卸载时无需继续处理。
      }
    });
  }, [pulse.startedAt, pulse.speed, delay, path]);
  return <g ref={groupRef} className="canvas-connection-pulse" aria-hidden="true">
    {PULSE_TAIL_PERCENTAGES.map((tail, index) => <path key={tail} d={path}
      className={`canvas-connection-pulse__layer canvas-connection-pulse__layer--${index}`} />)}
  </g>;
}

export default function CanvasNodeConnectionPulse({ pulses, onMeasure }) {
  const svgRef = useRef(null);
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const frame = svgRef.current?.parentElement;
    if (!frame) return;
    const measure = () => {
      const width = Math.max(0, frame.offsetWidth);
      const height = Math.max(0, frame.offsetHeight);
      setSize((current) => current?.width === width && current?.height === height
        ? current
        : { width, height });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    try {
      const observer = new ResizeObserver(measure);
      observer.observe(frame);
      return () => observer.disconnect();
    } catch (error) {
      console.warn('[画布] 连线流光尺寸监听启动失败，已使用当前尺寸:', error);
    }
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
