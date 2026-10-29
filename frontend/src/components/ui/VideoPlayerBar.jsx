/** 成片控制栏按视频详情原生控件的双排布局呈现，宿主提供整片状态。 */
import { useEffect, useRef, useState } from 'react';
import { Scan, MoreVertical, Pause, Play, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import IconButton from './IconButton';
import DropdownMenu from './DropdownMenu';
import './VideoPlayerBar.css';

function playerTime(value) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return [Math.floor(seconds / 60), String(seconds % 60).padStart(2, '0')].join(':');
}

export default function VideoPlayerBar({ playing, currentTime = 0, duration = 0, volume = 1, muted = false,
  onToggle, onToggleKeyDown, onSeek, onVolumeChange, onMutedChange, onFullscreen, disabled = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    const close = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const escape = event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setMenuOpen(false);
        menuRef.current?.querySelector('[aria-haspopup="menu"]')?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape, true); };
  }, [menuOpen]);
  const silent = muted || volume === 0;
  const toggleMuted = () => {
    if (silent && volume === 0) onVolumeChange(1);
    onMutedChange(!silent);
  };
  const position = Math.max(0, Math.min(currentTime, duration || 0));
  return <div className="video-player-bar" role="group" aria-label="视频播放控制"
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <div className="video-player-actions">
      <IconButton className="video-player-button video-player-toggle" variant="link" aria-label={playing ? '暂停视频' : '播放视频'} title={playing ? '暂停视频' : '播放视频'} disabled={disabled} onClick={onToggle} onKeyDown={onToggleKeyDown}>
        {playing ? <Pause size={20} fill="currentColor" strokeWidth={0} /> : <Play size={20} fill="currentColor" strokeWidth={0} />}
      </IconButton>
      <span className="video-player-time">{playerTime(position)} / {playerTime(duration)}</span>
      <div className="video-player-volume-group">
        <input className="video-player-range video-player-volume" type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
          disabled={disabled} aria-label="播放音量" onChange={event => { onVolumeChange(Number(event.target.value)); onMutedChange(false); }} />
        <IconButton className="video-player-button" variant="link" aria-label={silent ? '取消静音' : '静音'} title={silent ? '取消静音' : '静音'} disabled={disabled} onClick={toggleMuted}>
          {muted || volume === 0 ? <VolumeX size={22} fill="currentColor" /> : <Volume2 size={22} fill="currentColor" />}
        </IconButton>
      </div>
      <IconButton className="video-player-button" variant="link" aria-label="切换全屏" title="切换全屏" disabled={disabled || !onFullscreen} onClick={onFullscreen}><Scan size={20} /></IconButton>
      <div ref={menuRef} className="video-player-more" onMouseDown={event => event.stopPropagation()}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}
        onKeyDown={event => {
          if (!menuOpen || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const items = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
          const current = items.indexOf(document.activeElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
          items[next]?.focus();
        }}>
        <IconButton className="video-player-button" variant="link" aria-label="更多播放选项" title="更多播放选项" aria-haspopup="menu" aria-expanded={menuOpen} disabled={disabled} onClick={() => setMenuOpen(value => !value)}><MoreVertical size={22} /></IconButton>
        {menuOpen && <DropdownMenu width="max-content" style={{ minWidth: '120px', whiteSpace: 'nowrap' }} onClose={() => {
          if (menuRef.current?.contains(document.activeElement)) {
            menuRef.current.querySelector('[aria-haspopup="menu"]')?.focus();
          }
          setMenuOpen(false);
        }} items={[
          { label: '从头播放', icon: <RotateCcw size={16} />, onClick: () => { onSeek(0); if (!playing) onToggle(); } },
          { label: silent ? '取消静音' : '静音', icon: <Volume2 size={16} />, onClick: toggleMuted },
          { label: '切换全屏', icon: <Scan size={16} />, disabled: !onFullscreen, onClick: onFullscreen },
        ]} />}
      </div>
    </div>
    <input className="video-player-range video-player-seek" type="range" min={0} max={duration || 1} step={0.01}
      style={{ '--video-progress': duration > 0 ? position / duration * 100 + '%' : '0%' }}
      value={position} disabled={disabled} aria-label="播放进度" aria-valuetext={playerTime(position)}
      onChange={event => onSeek(Number(event.target.value))} />
  </div>;
}
