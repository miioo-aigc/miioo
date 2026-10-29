import { useEffect, useRef } from 'react';
import PropertySlider from './PropertySlider';
import { Button } from '../ui';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { canvasRatio, scaleVisualTransform, visualScalePercent } from '../../utils/CompositionTransform';

/** 尺寸调整复用属性滑杆；一次手势对应一次构图撤销。 */
export default function VisualSizeControl({ segment }) {
  const sourceRatio = useCompositionEditorStore(s => s.sourceRatios[segment.id]);
  const aspectRatio = useCompositionEditorStore(s => s.aspectRatio);
  const locked = useCompositionEditorStore(s => s.trackSettings[segment.track || 'V1']?.locked);
  const beforeRef = useRef(null);
  const outputRatio = canvasRatio(aspectRatio);
  const disabled = !sourceRatio || locked;
  const begin = () => {
    if (!beforeRef.current) beforeRef.current = useCompositionEditorStore.getState();
  };
  const preview = (percent) => {
    if (disabled) return;
    begin();
    const original = beforeRef.current.segments.find(s => s.id === segment.id);
    const next = scaleVisualTransform(original.visualTransform, sourceRatio, outputRatio, percent);
    if (next) useCompositionEditorStore.getState().previewTransform(segment.id, next);
  };
  const finish = (cancel = false) => {
    if (!beforeRef.current) return;
    useCompositionEditorStore.getState().commitTransform(beforeRef.current, cancel);
    beforeRef.current = null;
  };
  useEffect(() => () => {
    if (beforeRef.current) useCompositionEditorStore.getState().commitTransform(beforeRef.current);
  }, []);
  const percent = visualScalePercent(segment.visualTransform, sourceRatio, outputRatio);
  return <div className="flex flex-col gap-[8px]">
    <PropertySlider label="尺寸调整" min={1} max={200} middleValue={100} step={1} precision={0} unit="%"
      value={percent} disabled={disabled} onChange={preview} onCommit={value => { preview(value); finish(); }}
      sliderProps={{ onPointerDown: event => { begin(); event.currentTarget.setPointerCapture(event.pointerId); },
        onPointerUp: () => finish(), onPointerCancel: () => finish(true), onLostPointerCapture: () => finish(),
        onKeyUp: () => finish(), onBlur: () => finish() }} />
    <div className="flex gap-[8px] w-full">
      <Button className="flex-1 min-w-0" variant="secondary" size="small" disabled={disabled} onClick={() => useCompositionEditorStore.getState().fitVisualAxis(segment.id, 'width')}>宽度铺满</Button>
      <Button className="flex-1 min-w-0" variant="secondary" size="small" disabled={disabled} onClick={() => useCompositionEditorStore.getState().fitVisualAxis(segment.id, 'height')}>高度铺满</Button>
      <Button className="flex-1 min-w-0" variant="secondary" size="small" disabled={locked} onClick={() => useCompositionEditorStore.getState().updateSegment(segment.id, { visualTransform: { version: 1, mode: 'cover' } })}>恢复默认</Button>
    </div>
  </div>;
}
