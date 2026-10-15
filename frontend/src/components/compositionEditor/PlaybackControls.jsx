import { CirclePause } from 'lucide-react';
import playIcon from '../../assets/compositionEditor/play.svg';
import restartIcon from '../../assets/compositionEditor/restart.svg';
import Tooltip from '../ui/Tooltip';
import { formatTime } from '../../stores/compositionEditorStore';
import './PlaybackControls.css';

export default function PlaybackControls({ playing, cursor, total, onToggle, onRestart, onSeek }) {
  const position = Math.max(0, Math.min(cursor, total));
  const percent = total > 0 ? position / total * 100 : 0;
  const buttonClass = 'flex h-[32px] w-[32px] shrink-0 cursor-pointer items-center justify-center rounded-small border-0 bg-transparent text-text-primary hover:bg-white-10 disabled:cursor-not-allowed disabled:opacity-40';
  const timeWidth = `${Math.max(formatTime(total).length, 5)}ch`;
  return <div className="flex h-[48px] min-w-0 shrink-0 items-center gap-[12px] bg-neutral-200 px-[16px]">
    <div className="mr-[4px] flex shrink-0 items-center gap-[8px]">
      <Tooltip label={playing ? '暂停' : '播放'} delay={250}>
        <button type="button" className={buttonClass} disabled={total <= 0} aria-label={playing ? '暂停' : '播放'} onClick={onToggle}>
          {playing ? <CirclePause size={20} strokeWidth={1.75} /> : <img src={playIcon} width={20} height={20} alt="" aria-hidden="true" draggable={false} />}
        </button>
      </Tooltip>
      <Tooltip label="重新播放" delay={250}>
        <button type="button" className={buttonClass} disabled={total <= 0} aria-label="重新播放" onClick={onRestart}><img src={restartIcon} width={20} height={20} alt="" aria-hidden="true" draggable={false} /></button>
      </Tooltip>
    </div>
    <span className="shrink-0 font-mono text-font-size-12 tabular-nums text-text-primary" style={{ width: timeWidth }}>{formatTime(position)}</span>
    <input type="range" min={0} max={total || 1} step={0.01} value={position} disabled={total <= 0}
      aria-label="播放进度" aria-valuetext={`${formatTime(position)} / ${formatTime(total)}`}
      className="playback-progress" style={{ '--playback-progress': `${percent}%` }}
      onChange={(event) => onSeek(Number(event.target.value))} />
    <span className="shrink-0 font-mono text-font-size-12 tabular-nums text-text-primary" style={{ width: timeWidth }}>{formatTime(total)}</span>
  </div>;
}
