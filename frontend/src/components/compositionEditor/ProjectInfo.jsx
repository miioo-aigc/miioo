import { computeTotalDuration, formatTime } from '../../stores/compositionEditorStore';

const TYPES = [['video', '视频'], ['image', '图片'], ['audio', '音频'], ['subtitle', '字幕']];

export default function ProjectInfo({ segments }) {
  const tenths = Math.round(computeTotalDuration(segments) * 10);
  const counts = Object.fromEntries(TYPES.map(([type]) => [type, 0]));
  segments.forEach(({ type }) => { if (type in counts) counts[type] += 1; });

  return <section className="flex shrink-0 flex-col gap-[8px] pt-[8px] text-font-size-14 text-text-secondary">
    <span>工程信息</span>
    <dl className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-[12px] gap-y-[8px]">
      <dt>总时长</dt>
      <dd className="m-0 tabular-nums">{formatTime(tenths / 10)}.{tenths % 10}</dd>
      <dt>片段数</dt>
      <dd className="m-0 flex flex-wrap gap-x-[12px] gap-y-[4px]">
        {TYPES.map(([type, label]) => <span key={type} className="whitespace-nowrap">{label} {counts[type]}</span>)}
      </dd>
    </dl>
  </section>;
}
