import { useRef } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Button, TextField, Select } from '../ui';
import { DEFAULT_SUBTITLE_STYLE } from '../../utils/SubtitleImport';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';
import PropertySlider from './PropertySlider';

function ColorField({ label, value, onChange, onBlur }) {
  return <div className="flex items-center gap-[12px] text-font-size-14 text-text-secondary">
    <div className="flex min-w-0 items-center gap-[8px]">
      <span className="w-[64px] shrink-0">{label}</span>
    </div>
      <input aria-label={label} type="color" value={value}
        className="h-[20px] w-[40px] shrink-0 cursor-pointer appearance-none overflow-hidden rounded-small border border-stroke-accent bg-transparent p-0 focus-visible:outline focus-visible:outline-brand-main disabled:cursor-not-allowed disabled:opacity-40 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:border-0"
        onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
  </div>;
}

function StyleSection({ label, enabled, onToggle, children }) {
  return <section className="flex flex-col gap-[12px]">
    <div className="flex items-center gap-[12px]">
      <span className="w-[64px] shrink-0 text-font-size-14 text-text-secondary">{label}</span>
      <button type="button" role="switch" aria-label={`启用${label}`} aria-checked={enabled} aria-expanded={enabled} onClick={() => onToggle(!enabled)}
        className={`flex h-[20px] w-[36px] cursor-pointer items-center rounded-full p-[2px] ${enabled ? 'bg-brand-main' : 'bg-white-10'}`}>
        <span className={`h-[16px] w-[16px] rounded-full bg-text-primary transition-transform ${enabled ? 'translate-x-[16px]' : ''}`} />
      </button>
    </div>
    {enabled && <div className="ml-[12px] flex flex-col gap-[12px] border-l border-stroke-normal pl-[12px]">{children}</div>}
  </section>;
}

const FONT_LABELS = { 'sans-serif': '无衬线字体', serif: '衬线字体', Arial: '阿里亚尔', 'Microsoft YaHei': '微软雅黑' };
const ALIGN_OPTIONS = [{ value: 'left', label: '左对齐', Icon: AlignLeft }, { value: 'center', label: '居中对齐', Icon: AlignCenter }, { value: 'right', label: '右对齐', Icon: AlignRight }];

function NumberField({ label, value, min, max, disabled = false, unit = '', hideLabel = false, slider = false, compact = false, onChange, onBlur }) {
  return <PropertySlider label={label} value={value} min={min} max={max} disabled={disabled} step={1} unit={unit} hideLabel={hideLabel} leftAligned unitInside inputOnly precision={1} inlineSlider={slider} compact={compact}
    onChange={onChange} sliderProps={{ onPointerUp: onBlur, onPointerCancel: onBlur, onBlur, onKeyUp: onBlur }}
    onCommit={(next) => { onChange(next); onBlur(); }} />;
}

export default function SubtitleProperties({ segment }) {
  const before = useRef(null);
  const style = { ...DEFAULT_SUBTITLE_STYLE, ...segment.style };
  const outlineEnabled = style.outlineOn ?? (style.outline > 0);
  const begin = () => { before.current ??= { segments: useCompositionEditorStore.getState().segments, selectedId: segment.id }; };
  const commit = () => {
    if (before.current) useCompositionEditorStore.getState().commitVisualSegment(segment.id, before.current);
    before.current = null;
  };
  const change = (patch, immediate = false) => {
    begin();
    useCompositionEditorStore.getState().previewSubtitle(segment.id, patch, before.current);
    if (immediate) commit();
  };
  return <aside className="timeline-scrollbar flex w-full min-w-0 min-h-0 flex-col gap-[16px] overflow-y-auto overflow-x-hidden bg-neutral-200 px-[20px] py-[16px] [&>*]:shrink-0 [&>*]:min-w-0">
    <span className="text-text-primary text-font-size-14">字幕 · {segment.track}</span>
    <div className="flex items-start gap-[12px]">
      <label htmlFor="subtitle-text-editor" className="w-[64px] shrink-0 pt-[8px] text-font-size-14 text-text-secondary">字幕内容</label>
      <div className="min-w-0 flex-1"><TextField id="subtitle-text-editor" aria-label="字幕内容" multiline resizable height={120} value={segment.text} onChange={(event) => change({ text: event.target.value })} onBlur={commit} /></div>
    </div>
    <NumberField label="总时长" unit="秒" value={segment.duration} min={1} max={Math.max(1, 86400 - segment.start)} onChange={(duration) => change({ duration })} onBlur={commit} />
    <div className="flex flex-wrap items-center justify-between gap-[12px]">
      <NumberField label="开始时间" unit="秒" value={segment.start} min={0} max={86400} onChange={(start) => change({ start })} onBlur={commit} />
      <NumberField label="结束时间" unit="秒" value={segment.start + segment.duration} min={segment.start + 0.001} max={86400} onChange={(end) => change({ duration: end - segment.start })} onBlur={commit} />
    </div>
    <div className="flex items-center gap-[12px]">
      <span className="w-[64px] shrink-0 text-font-size-14 text-text-secondary">字体字号</span>
      <div className="w-[140px] min-w-0 shrink"><Select menuAriaLabel="字体" width="100%" triggerStyle={{ height: '28px', borderRadius: '4px' }} value={style.fontFamily} displayValue={FONT_LABELS[style.fontFamily] || style.fontFamily} options={[...new Set([style.fontFamily, ...Object.keys(FONT_LABELS)])].map((value) => ({ value, label: FONT_LABELS[value] || value }))} onChange={(fontFamily) => change({ style: { fontFamily } }, true)} /></div>
      <NumberField label="字号" hideLabel value={style.fontSize} min={8} max={200} onChange={(fontSize) => change({ style: { fontSize } })} onBlur={commit} />
    </div>
    <div className="flex items-center gap-[12px]">
      <span className="w-[64px] shrink-0 text-font-size-14 text-text-secondary">对齐方式</span>
      <div role="group" aria-label="对齐方式" className="flex gap-[4px]">
        {ALIGN_OPTIONS.map(({ value, label, Icon }) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={style.align === value}
          className={`flex h-[32px] w-[32px] shrink-0 cursor-pointer items-center justify-center rounded-small ${style.align === value ? 'bg-tag-bg-blue text-brand-main' : 'text-text-secondary hover:bg-white-10'}`}
          onClick={() => change({ style: { align: value } }, true)}><Icon size={16} /></button>)}
      </div>
    </div>
    <ColorField label="文字颜色" value={style.color} onChange={(color) => change({ style: { color } })} onBlur={commit} />
    <NumberField label="不透明度" slider unit="%" value={style.textOpacity ?? 100} min={0} max={100} onChange={(textOpacity) => change({ style: { textOpacity } })} onBlur={commit} />
    <NumberField label="水平位置" slider unit="%" value={style.x} min={0} max={100} onChange={(x) => change({ style: { x } })} onBlur={commit} />
    <NumberField label="垂直位置" slider unit="%" value={style.y} min={0} max={100} onChange={(y) => change({ style: { y } })} onBlur={commit} />
    <StyleSection label="文字描边" enabled={outlineEnabled} onToggle={(outlineOn) => change({ style: { outlineOn, ...(outlineOn && style.outline === 0 ? { outline: 2 } : {}) } }, true)}>
      <ColorField label="颜色" value={style.outlineColor} onChange={(outlineColor) => change({ style: { outlineColor } })} onBlur={commit} />
      <NumberField label="宽度" value={style.outline} min={0} max={10} onChange={(outline) => change({ style: { outline } })} onBlur={commit} />
      <NumberField label="不透明度" slider unit="%" value={style.outlineOpacity ?? 100} min={0} max={100} onChange={(outlineOpacity) => change({ style: { outlineOpacity } })} onBlur={commit} />
    </StyleSection>
    <StyleSection label="字幕背景" enabled={style.backgroundOn} onToggle={(backgroundOn) => change({ style: { backgroundOn } }, true)}>
      <ColorField label="颜色" value={style.background} onChange={(background) => change({ style: { background } })} onBlur={commit} />
      <NumberField label="不透明度" slider unit="%" value={style.backgroundOpacity ?? 100} min={0} max={100} onChange={(backgroundOpacity) => change({ style: { backgroundOpacity } })} onBlur={commit} />
    </StyleSection>
    <div className="flex flex-wrap items-center gap-[12px]">
      <span className="w-[64px] shrink-0 text-font-size-14 text-text-secondary">批量操作</span>
      <Button variant="secondary" size="large" style={{ height: '32px' }} className="shrink-0 cursor-pointer" onClick={() => { commit(); useCompositionEditorStore.getState().applySubtitleStyle(segment.id); }}>应用样式到本轨字幕</Button>
    </div>
  </aside>;
}
