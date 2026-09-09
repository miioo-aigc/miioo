import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TextField from '../ui/TextField';
import Slider from '../ui/Slider';
import { formatTrimTime, parseTrimTime } from './TrimRange';

const inputStyle = {
  fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif",
  fontSize: '12px', fontWeight: 400, lineHeight: '18px', color: 'rgba(255, 255, 255, 0.8)',
};

function TimeField({ value, label, disabled, onCommit }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(false);
  function commit() {
    if (draft === null) return;
    const parsed = parseTrimTime(draft);
    if (parsed === null) { setError(true); return; }
    onCommit(parsed);
    setDraft(null);
    setError(false);
  }
  return <TextField aria-label={label} style={inputStyle} value={draft ?? formatTrimTime(value)} disabled={disabled}
    error={error} errorMsg={error ? '请输入时:分:秒.十分秒' : ''} wrapperClassName="trim-time-field"
    onChange={(event) => { setDraft(event.target.value); setError(false); }} onBlur={commit} />;
}

export default function VideoTrimFields({ range, total, disabled, zoom, onZoom, onChange }) {
  const length = range.end - range.start;
  const [durationDraft, setDurationDraft] = useState(null);
  function commitDuration() {
    if (durationDraft === null) return;
    const seconds = Number(durationDraft);
    if (durationDraft.trim() && Number.isFinite(seconds)) onChange('end', range.start + seconds * 10);
    setDurationDraft(null);
  }
  return <div className="trim-fields">
    <div className="trim-range-fields"><span>范围</span>
      <TimeField key={`start-${range.start}`} label="开始时间" value={range.start} disabled={disabled} onCommit={(value) => onChange('start', value)} />
      <span>~</span>
      <TimeField key={`end-${range.end}`} label="结束时间" value={range.end} disabled={disabled} onCommit={(value) => onChange('end', value)} />
    </div>
    <div className="trim-duration"><span>时长</span>
      <TextField aria-label="截取时长（秒）" type="number" min="0.1" max={(total - range.start) / 10} step="0.1" value={durationDraft ?? (length / 10).toFixed(1)} disabled={disabled}
        style={inputStyle} inputClassName="trim-duration-input" onChange={(event) => setDurationDraft(event.target.value)} onBlur={commitDuration}
        suffix={<><span>秒</span><div className="trim-steppers">
          <button type="button" aria-label="增加0.1秒" title="增加0.1秒" disabled={disabled || range.end >= total} onClick={() => onChange('end', range.end + 1)}><ChevronUp size={12} /></button>
          <button type="button" aria-label="减少0.1秒" title="减少0.1秒" disabled={disabled || length <= 1} onClick={() => onChange('end', range.end - 1)}><ChevronDown size={12} /></button>
        </div></>} />
    </div>
    <div className="trim-zoom" title="时间轴缩放"><Slider aria-label="时间轴缩放" min={1} max={4} step={0.1} value={zoom} disabled={disabled} onChange={(event) => onZoom(Number(event.target.value))} /></div>
  </div>;
}
