/**
 * @file OutpaintModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   扩图比例选择、扩图框预览和锁定比例拖拽
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-09-09  初始实现，扩图区域使用 CSS 像素格绘制
 *   2026-09-09  原图固定为展示区面积 10%，统一显示比例，修正锁比例拖拽
 */
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImageEditChrome, { ImageEditFooter } from './ImageEditChrome';
import TextField from '../ui/TextField';
import { OriginalRatioIcon, RatioIcon } from '../ui';
import { showGlobalToast } from '../../stores/toastStore';
import './Outpaint.css';
import './Inpaint.css';

const RATIOS = [
  { label: '原比例', value: null, icon: <OriginalRatioIcon /> },
  { label: '16:9', value: 16 / 9, icon: <RatioIcon rw={16} rh={9} /> },
  { label: '9:16', value: 9 / 16, icon: <RatioIcon rw={9} rh={16} /> },
  { label: '4:3', value: 4 / 3, icon: <RatioIcon rw={4} rh={3} /> },
  { label: '3:4', value: 3 / 4, icon: <RatioIcon rw={3} rh={4} /> },
  { label: '1:1', value: 1, icon: <RatioIcon rw={1} rh={1} /> },
];
const INITIAL_SCALE = 1.5;
const HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function getMinimumCanvas(source, ratio) {
  if (!ratio) return { width: source.width, height: source.height };
  if (source.width / source.height >= ratio) {
    return { width: source.width, height: source.width / ratio };
  }
  return { width: source.height * ratio, height: source.height };
}

function getInitialCanvas(source, ratio) {
  const minimum = getMinimumCanvas(source, ratio);
  return ratio ? minimum : { width: source.width * INITIAL_SCALE, height: source.height * INITIAL_SCALE };
}

function getRatio(canvas, source) {
  return canvas.width / canvas.height || source.width / source.height;
}

function getNextCanvas(start, handle, dx, dy, ratio, source, maximumWidth) {
  const directionX = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const directionY = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  // 对角拖拽投影到锁定比例方向；中心固定，因此边缘位移对应两倍尺寸变化。
  const widthDelta = directionX && directionY
    ? (dx * directionX + dy * directionY / ratio) / (1 + 1 / ratio ** 2)
    : directionX ? dx * directionX : dy * directionY * ratio;
  const requestedWidth = start.width + widthDelta * 2;
  const minimum = getMinimumCanvas(source, ratio);
  const width = Math.max(minimum.width, Math.min(maximumWidth, requestedWidth));
  return { width, height: width / ratio };
}

function RatioButton({ item, selected, onClick }) {
  return <button type="button" className={`outpaint-ratio-button${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => onClick(item.value)}>
    {cloneElement(item.icon, { color: 'currentColor' })}
    <span>{item.label}</span>
  </button>;
}

function OutpaintStage({ imageUrl, source, canvas, onChange }) {
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const interactionRef = useRef(null);
  const targetRatio = getRatio(canvas, source);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const update = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const frame = useMemo(() => {
    if (!stageSize.width || !stageSize.height || !source.width || !source.height) return null;
    const availableWidth = Math.max(1, stageSize.width - 32);
    const availableHeight = Math.max(1, stageSize.height - 32);
    const areaScale = Math.sqrt((stageSize.width * stageSize.height * 0.1) / (source.width * source.height));
    // 极端长宽比在初次布局时让步，确保默认框和所有预设的控制杆可见。
    const fitScales = RATIOS.map((item) => {
      const minimum = getInitialCanvas(source, item.value);
      return Math.min(availableWidth / minimum.width, availableHeight / minimum.height);
    });
    const scale = Math.min(areaScale, ...fitScales);
    return { width: canvas.width * scale, height: canvas.height * scale, sourceWidth: source.width * scale, sourceHeight: source.height * scale, scale, availableWidth, availableHeight };
  }, [canvas.height, canvas.width, source, stageSize.height, stageSize.width]);

  const beginResize = (event, handle) => {
    if (event.button !== 0 || !frame || interactionRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = stageRef.current.getBoundingClientRect();
    interactionRef.current = {
      handle, pointerId: event.pointerId, x: event.clientX, y: event.clientY, canvas,
      scaleX: frame.scale * rect.width / stageSize.width,
      scaleY: frame.scale * rect.height / stageSize.height,
      maximumWidth: Math.min(frame.availableWidth, frame.availableHeight * targetRatio) / frame.scale,
      ratio: targetRatio,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event) => {
    const start = interactionRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    onChange(getNextCanvas(start.canvas, start.handle, (event.clientX - start.x) / start.scaleX, (event.clientY - start.y) / start.scaleY, start.ratio, source, start.maximumWidth));
  };
  const endResize = (event) => {
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleLabels = { nw: '左上角', n: '上边缘', ne: '右上角', e: '右边缘', se: '右下角', s: '下边缘', sw: '左下角', w: '左边缘' };

  return <div ref={stageRef} className="outpaint-stage">
    {frame && <div className="outpaint-frame" style={{ width: `${frame.width}px`, height: `${frame.height}px` }}>
      <div className="outpaint-grid" aria-hidden="true" />
      {imageUrl && <img className="outpaint-source" src={imageUrl} alt="扩图原图" style={{ width: `${frame.sourceWidth}px`, height: `${frame.sourceHeight}px` }} />}
      <div className="outpaint-frame-border" aria-hidden="true" />
      {HANDLE_NAMES.map((handle) => <button key={handle} type="button" aria-label={`调整${handleLabels[handle]}`} className={`outpaint-handle handle-${handle}`} onPointerDown={(event) => beginResize(event, handle)} onPointerMove={resize} onPointerUp={endResize} onPointerCancel={endResize} onLostPointerCapture={endResize} />)}
    </div>}
  </div>;
}

export default function OutpaintModal({ card, onClose }) {
  const [source, setSource] = useState({ width: 0, height: 0 });
  const [ratio, setRatio] = useState(null);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const [prompt, setPrompt] = useState('');

  const handleLoad = useCallback((event) => {
    const nextSource = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
    setSource(nextSource);
    setCanvas(getInitialCanvas(nextSource, null));
  }, []);

  const reset = () => {
    if (source.width && source.height) setCanvas(getInitialCanvas(source, null));
    setRatio(null);
    setPrompt('');
  };

  const handleRatioChange = (nextRatio) => {
    setRatio(nextRatio);
    if (source.width && source.height) setCanvas(getInitialCanvas(source, nextRatio));
  };

  const submit = () => {
    if (!card?.imageUrl || !source.width) {
      showGlobalToast('未找到可用原图，请关闭后重试', 'error');
      return;
    }
    showGlobalToast('扩图参数已准备完成，生成服务暂未接入', 'info');
  };

  return <ImageEditChrome title="扩图" onClose={onClose} footer={<ImageEditFooter onReset={reset} onClose={onClose} onSubmit={submit} disabled={!source.width} label="AI生成" />}>
    <div className="outpaint-body">
      <OutpaintStage imageUrl={card?.imageUrl} source={source} canvas={canvas} onChange={setCanvas} />
      <div className="outpaint-ratios" role="group" aria-label="选择扩图比例">
        {RATIOS.map((item) => <RatioButton key={item.label} item={item} selected={ratio === item.value} onClick={handleRatioChange} />)}
      </div>
      <div className="inpaint-prompt outpaint-prompt">
        <TextField multiline height="72px" wrapperStyle={{ width: '100%' }} aria-label="扩图提示词" placeholder="请描述想要扩展的内容" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      </div>
      <img className="outpaint-image-loader" src={card?.imageUrl} alt="" onLoad={handleLoad} onError={() => setSource({ width: 0, height: 0 })} />
    </div>
  </ImageEditChrome>;
}
