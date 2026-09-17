/**
 * @file OutpaintModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   扩图比例选择、扩图框预览和锁定比例拖拽
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-09-17  拖拽阶段限制四方向 [0,2] 与总面积 3 倍；滚轮缩放重算上限并自动收缩
 *   2026-09-17  图片视觉尺寸仅在滚轮时变化，拖拽编辑框不再带动图片放大
 *   2026-09-16  扩图方向字段及面积约束统一校验
 *   2026-09-14  接入扩图任务和原列表保存回调
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
import useImageEditSubmission from '../../hooks/useImageEditSubmission';
import { validateExpansion } from '../../utils/MediaEditPolicy';

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

// 约束基于“当前显示中的图片”计算：真实像素不变，只随滚轮缩放重新推导显示比例。
// 锁比例居中模型下，宽高面积因子之积不超过 3 即满足总面积 3 倍约束；
// 再以单边比例 [0,2]（对应因子至多 3）收窄，得到该比例下的最大宽度。
function getAreaLimitWidth(ratio, displayedSource) {
  const scaleFactor = Math.sqrt((3 * ratio * displayedSource.width) / displayedSource.height);
  return Math.min(3, scaleFactor) * displayedSource.width;
}

function getDisplayState(frame, imageZoom) {
  const effectiveZoom = Math.min(imageZoom, getMaximumImageZoom(frame));
  return {
    displayedSource: {
      width: frame.sourceWidth * effectiveZoom,
      height: frame.sourceHeight * effectiveZoom,
    },
  };
}

function getMaximumImageZoom(frame) {
  return Math.min(
    frame.width / Math.max(1, frame.sourceWidth),
    frame.height / Math.max(1, frame.sourceHeight)
  );
}

function getMaximumCanvasWidth(frame, imageZoom, ratio) {
  const { displayedSource } = getDisplayState(frame, imageZoom);
  return Math.min(
    getAreaLimitWidth(ratio, displayedSource) / frame.scale,
    frame.availableWidth / frame.scale,
    frame.availableHeight * ratio / frame.scale
  );
}

function getNextCanvas(start, handle, dx, dy, ratio, minimumWidth, maximumWidth) {
  const directionX = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const directionY = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  // 对角拖拽投影到锁定比例方向；中心固定，因此边缘位移对应两倍尺寸变化。
  const widthDelta = directionX && directionY
    ? (dx * directionX + dy * directionY / ratio) / (1 + 1 / ratio ** 2)
    : directionX ? dx * directionX : dy * directionY * ratio;
  const requestedWidth = start.width + widthDelta * 2;
  const width = Math.max(minimumWidth, Math.min(maximumWidth, requestedWidth));
  return { width, height: width / ratio };
}

function RatioButton({ item, selected, onClick }) {
  const [hovered, setHovered] = useState(false);
  const active = selected || hovered;
  return <button type="button" className={`outpaint-ratio-button${active ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => onClick(item.value)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    {cloneElement(item.icon, { color: active ? '#FFFFFF' : '#FFFFFFCC', selected })}
    <span>{item.label}</span>
  </button>;
}

function OutpaintStage({ imageUrl, source, canvas, onChange }) {
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [imageZoom, setImageZoom] = useState(1);
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
    return {
      width: canvas.width * scale,
      height: canvas.height * scale,
      sourceWidth: source.width * scale,
      sourceHeight: source.height * scale,
      scale,
      availableWidth,
      availableHeight,
    };
  }, [canvas.height, canvas.width, source, stageSize.height, stageSize.width]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    // React 的 onWheel 可能由被动委托监听器触发，滚轮放大需要接管默认滚动。
    const handleWheel = (event) => {
      if (!frame) return;
      event.preventDefault();
      const maximumZoom = getMaximumImageZoom(frame);
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      setImageZoom((value) => Math.max(0.5, Math.min(4, maximumZoom, value * factor)));
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [frame]);

  // 滚轮缩小后，旧编辑框可能超过“以当前显示图片计算”的新上限；此时锁定比例自动收缩。
  useEffect(() => {
    if (!frame || !canvas.width || !source.width) return undefined;
    const ratio = getRatio(canvas, source);
    const { displayedSource } = getDisplayState(frame, imageZoom);
    const minimumWidth = Math.max(
      getMinimumCanvas(source, ratio).width,
      getMinimumCanvas(displayedSource, ratio).width / frame.scale
    );
    const clampedWidth = Math.max(minimumWidth, getMaximumCanvasWidth(frame, imageZoom, ratio));
    if (canvas.width <= clampedWidth + 0.01) return undefined;
    onChange({ width: clampedWidth, height: clampedWidth / ratio });
    return undefined;
  }, [canvas, frame, imageZoom, onChange, source]);

  if (!frame) return <div ref={stageRef} className="outpaint-stage" />;

  const { displayedSource } = getDisplayState(frame, imageZoom);
  const sourceWidth = displayedSource.width;
  const sourceHeight = displayedSource.height;
  const minimumWidth = Math.max(
    getMinimumCanvas(source, targetRatio).width,
    getMinimumCanvas(displayedSource, targetRatio).width / frame.scale
  );

  const beginResize = (event, handle) => {
    if (event.button !== 0 || !frame || interactionRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = stageRef.current.getBoundingClientRect();
    interactionRef.current = {
      handle, pointerId: event.pointerId, x: event.clientX, y: event.clientY, canvas,
      scaleX: frame.scale * rect.width / stageSize.width,
      scaleY: frame.scale * rect.height / stageSize.height,
      minimumWidth,
      maximumWidth: Math.max(minimumWidth, getMaximumCanvasWidth(frame, imageZoom, targetRatio)),
      ratio: targetRatio,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event) => {
    const start = interactionRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    onChange(getNextCanvas(start.canvas, start.handle, (event.clientX - start.x) / start.scaleX, (event.clientY - start.y) / start.scaleY, start.ratio, start.minimumWidth, start.maximumWidth));
  };
  const endResize = (event) => {
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleLabels = { nw: '左上角', n: '上边缘', ne: '右上角', e: '右边缘', se: '右下角', s: '下边缘', sw: '左下角', w: '左边缘' };

  return <div ref={stageRef} className="outpaint-stage">
    <div className="outpaint-frame" style={{ width: `${frame.width}px`, height: `${frame.height}px` }}>
      <div className="outpaint-grid" aria-hidden="true" />
      {imageUrl && <img className="outpaint-source" src={imageUrl} alt="扩图原图" style={{ width: `${sourceWidth}px`, height: `${sourceHeight}px` }} />}
      <div className="outpaint-frame-border" aria-hidden="true" />
      {HANDLE_NAMES.map((handle) => <button key={handle} type="button" aria-label={`调整${handleLabels[handle]}`} className={`outpaint-handle handle-${handle}`} onPointerDown={(event) => beginResize(event, handle)} onPointerMove={resize} onPointerUp={endResize} onPointerCancel={endResize} onLostPointerCapture={endResize} />)}
    </div>
  </div>;
}

export default function OutpaintModal({ card, onClose, onSave, onComplete = onClose }) {
  const { busy, submit: generate } = useImageEditSubmission({ card, onSave, onComplete });
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
    if (prompt.length > 4000) { showGlobalToast('提示词不能超过4000字', 'error'); return; }
    const horizontal = Math.max(0, (canvas.width / source.width - 1) / 2);
    const vertical = Math.max(0, (canvas.height / source.height - 1) / 2);
    const expandOptions = {
      left_expansion_ratio: horizontal, right_expansion_ratio: horizontal,
      up_expansion_ratio: vertical, down_expansion_ratio: vertical,
    };
    try { validateExpansion(expandOptions); }
    catch (error) { showGlobalToast(error.message, 'error'); return; }
    generate({ mode: 'outpaint', prompt: prompt.trim(), model_requirement: 'Kling v3', expandOptions });
  };

  return <ImageEditChrome title="扩图" onClose={onClose} busy={busy} footer={<ImageEditFooter onReset={reset} onClose={onClose} onSubmit={submit} busy={busy} disabled={!source.width} label="AI生成" />}>
    <div className="outpaint-body" inert={busy}>
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
