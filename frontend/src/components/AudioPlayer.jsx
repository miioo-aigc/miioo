import { useEffect, useMemo, useRef, useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const AUDIO_PLAYER_SYNC_EVENT = 'miioo-audio-player:play';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4.375 3.20703L10.5 7.00003L4.375 10.793V3.20703Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4.375 3.5C4.375 3.15482 4.65482 2.875 5 2.875C5.34518 2.875 5.625 3.15482 5.625 3.5V10.5C5.625 10.8452 5.34518 11.125 5 11.125C4.65482 11.125 4.375 10.8452 4.375 10.5V3.5Z" fill="currentColor" />
      <path d="M8.375 3.5C8.375 3.15482 8.65482 2.875 9 2.875C9.34518 2.875 9.625 3.15482 9.625 3.5V10.5C9.625 10.8452 9.34518 11.125 9 11.125C8.65482 11.125 8.375 10.8452 8.375 10.5V3.5Z" fill="currentColor" />
    </svg>
  );
}

export default function AudioPlayer({
  src,
  duration: fallbackDuration = 0,
  label = '音频预览',
  size = 'default',
}) {
  const audioRef = useRef(null);
  const playerIdRef = useRef(`audio-player-${Math.random().toString(36).slice(2)}`);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number(fallbackDuration) || 0);
  const [hovered, setHovered] = useState(false);

  const compact = size === 'compact';
  const isDisabled = !src;
  const totalDuration = duration > 0 ? duration : (Number(fallbackDuration) || 0);
  const progressPercent = useMemo(() => {
    if (!totalDuration) return 0;
    return clamp((currentTime / totalDuration) * 100, 0, 100);
  }, [currentTime, totalDuration]);

  useEffect(() => {
    setDuration(Number(fallbackDuration) || 0);
  }, [fallbackDuration, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  useEffect(() => {
    const handleExternalPlay = (event) => {
      const nextPlayerId = event?.detail?.playerId;
      if (!nextPlayerId || nextPlayerId === playerIdRef.current) return;
      audioRef.current?.pause();
    };

    window.addEventListener(AUDIO_PLAYER_SYNC_EVENT, handleExternalPlay);
    return () => window.removeEventListener(AUDIO_PLAYER_SYNC_EVENT, handleExternalPlay);
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  async function handleTogglePlay(event) {
    event.stopPropagation();
    if (isDisabled || !audioRef.current) return;

    const audio = audioRef.current;
    if (!audio.paused) {
      audio.pause();
      return;
    }

    if ((audio.duration || totalDuration) && audio.currentTime >= (audio.duration || totalDuration)) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }

    window.dispatchEvent(new CustomEvent(AUDIO_PLAYER_SYNC_EVENT, {
      detail: { playerId: playerIdRef.current },
    }));

    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }

  function handleSeek(event) {
    event.stopPropagation();
    if (!audioRef.current) return;
    const nextTime = Number(event.target.value) || 0;
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <div
      className="w-full"
      onClick={(event) => event.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: compact ? '40px' : '44px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.12)',
        backgroundColor: hovered || isPlaying ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
        boxShadow: isPlaying ? '0 0 16px rgba(45,195,225,0.18)' : 'none',
        transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <audio ref={audioRef} src={src || undefined} preload="metadata" />
      <div className={`flex h-full items-center ${compact ? 'gap-[8px] px-[10px]' : 'gap-[10px] px-spacing-12'}`}>
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={isDisabled}
          aria-label={isPlaying ? '暂停音频' : '播放音频'}
          className={`flex flex-shrink-0 items-center justify-center rounded-[6px] transition-all ${
            isPlaying
              ? 'bg-btn-accent-bg-normal text-text-inverse'
              : 'bg-transparent text-text-secondary'
          } ${isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          style={{
            width: compact ? '24px' : '26px',
            height: compact ? '24px' : '26px',
            boxShadow: isPlaying ? '0 0 12px rgba(45,195,225,0.22)' : 'none',
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <span
          className={`${compact ? 'max-w-[72px]' : 'max-w-[92px]'} flex-shrink-0 truncate ${compact ? 'text-font-size-12' : 'text-[13px]'} text-text-secondary`}
          style={{ fontFamily: FONT, lineHeight: compact ? '16px' : '18px', letterSpacing: '0.01em' }}
          title={label}
        >
          {label}
        </span>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(totalDuration, 1)}
            step="0.1"
            value={clamp(currentTime, 0, Math.max(totalDuration, 1))}
            onChange={handleSeek}
            disabled={isDisabled}
            aria-label="音频播放进度"
            className="h-[4px] w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(90deg, rgba(45,195,225,1) 0%, rgba(45,195,225,1) ${progressPercent}%, rgba(255,255,255,0.12) ${progressPercent}%, rgba(255,255,255,0.12) 100%)`,
              accentColor: 'var(--color-brand-main)',
            }}
          />
        </div>

        <span
          className={`${compact ? 'min-w-[64px]' : 'min-w-[72px]'} flex-shrink-0 text-right text-font-size-12 text-text-hint`}
          style={{ fontFamily: FONT, fontVariantNumeric: 'tabular-nums', lineHeight: '16px' }}
        >
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}
