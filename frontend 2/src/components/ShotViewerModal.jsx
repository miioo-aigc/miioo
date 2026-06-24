import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Toggle from './Toggle';
import { apiUpdateShotFinalized } from '../api/storyboard';

// ─────────────────────────────────────────────────────────────────────────────

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function formatTime(seconds) {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ─── 进度条 ───────────────────────────────────────────────────────────────────

function ProgressBar({ current, total, onSeek }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const calcRatio = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    onSeek(calcRatio(e.clientX) * total);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => onSeek(calcRatio(e.clientX) * total);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, calcRatio, onSeek, total]);

  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.4)', flexShrink: 0, width: '36px' }}>
        {formatTime(current)}
      </span>
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{ flex: 1, height: '3px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '2px', cursor: 'pointer', position: 'relative' }}
      >
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '2px', position: 'relative' }}>
          <div style={{
            position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)',
            width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FFFFFF',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
          }} />
        </div>
      </div>
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.25)', flexShrink: 0, width: '36px', textAlign: 'right' }}>
        {formatTime(total)}
      </span>
    </div>
  );
}

// ─── 主弹窗 ───────────────────────────────────────────────────────────────────

export default function ShotViewerModal({ shot, onClose, onFinalizeChange }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(shot?.duration ?? 0);
  const [volume, setVolume] = useState(0.7);
  const [finalized, setFinalized] = useState(shot?.finalized ?? false);
  const [downloading, setDownloading] = useState(false);

  // 关闭时恢复滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // 音量同步到 video
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // 键盘快捷键
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleSeek = useCallback((t) => {
    setCurrentTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleVolumeSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(ratio);
    if (videoRef.current) videoRef.current.volume = ratio;
  };

  const handleFinalize = (val) => {
    setFinalized(val);
    apiUpdateShotFinalized(shot?.id, val);
    onFinalizeChange?.(shot?.id, val);
  };

  const handleDownload = async () => {
    if (!shot?.videoUrl || downloading) return;
    setDownloading(true);
    try {
      const a = document.createElement('a');
      a.href = shot.videoUrl;
      a.download = shot.filename ?? `shot_${shot.id}.mp4`;
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const skipSeconds = (s) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Math.max(0, Math.min(duration, v.currentTime + s));
    v.currentTime = t;
    setCurrentTime(t);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column',
        width: '960px',
        borderRadius: '16px', overflow: 'hidden',
        backgroundColor: '#161616',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '-10px 24px 64px rgba(0,0,0,0.6)',
      }}>

        {/* ── 标题栏 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', backgroundColor: '#161616', flexShrink: 0,
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', fontWeight: 500, lineHeight: '20px', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.01em' }}>
            查看镜头{shot?.label ? ` · ${shot.label}` : ''}
          </span>
          <div
            onClick={onClose}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'transparent', transition: 'background-color 0.12s' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* ── 主体 ── */}
        <div style={{ display: 'flex', height: '540px' }}>

          {/* 左：视频区 */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#0D0D0D' }}>

            {/* 视频帧 */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', position: 'relative' }}>
              {shot?.videoUrl ? (
                <video
                  ref={videoRef}
                  src={shot.videoUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setPlaying(false)}
                  onClick={togglePlay}
                />
              ) : (
                /* 占位画面 */
                <div style={{
                  width: '100%', aspectRatio: '16/9',
                  background: 'linear-gradient(135deg, #1A1A1A 0%, #111111 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.4) 100%)' }} />
                  <div
                    onClick={togglePlay}
                    style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative', zIndex: 1,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M7 5L16 10L7 15V5Z" fill="rgba(255,255,255,0.9)" />
                    </svg>
                  </div>
                </div>
              )}

              {/* 镜头标签 */}
              {shot?.label && (
                <div style={{
                  position: 'absolute', top: '12px', left: '12px',
                  backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '6px',
                  padding: '4px 8px',
                }}>
                  <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}>
                    {shot.label}
                  </span>
                </div>
              )}

              {/* 中央播放按钮（有视频时悬浮显示） */}
              {shot?.videoUrl && !playing && (
                <div
                  onClick={togglePlay}
                  style={{
                    position: 'absolute',
                    width: '56px', height: '56px', borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7 5L16 10L7 15V5Z" fill="rgba(255,255,255,0.9)" />
                  </svg>
                </div>
              )}
            </div>

            {/* 播放控制栏 */}
            <div style={{
              flexShrink: 0, backgroundColor: '#111111',
              padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              <ProgressBar current={currentTime} total={duration} onSeek={handleSeek} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* 播放控制 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* 后退 5s */}
                  <div onClick={() => skipSeconds(-5)} style={{ cursor: 'pointer', opacity: 0.5, display: 'flex', alignItems: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 3L3 9L9 15M15 3L9 9L15 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {/* 播放/暂停 */}
                  <div
                    onClick={togglePlay}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {playing ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="3" y="2" width="3" height="10" rx="1" fill="rgba(255,255,255,0.85)" />
                        <rect x="8" y="2" width="3" height="10" rx="1" fill="rgba(255,255,255,0.85)" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 3L12 7L5 11V3Z" fill="rgba(255,255,255,0.85)" />
                      </svg>
                    )}
                  </div>
                  {/* 前进 5s */}
                  <div onClick={() => skipSeconds(5)} style={{ cursor: 'pointer', opacity: 0.5, display: 'flex', alignItems: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 3L15 9L9 15M3 3L9 9L3 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {/* 音量 */}
                <div
                  className="volume-control-group"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                    className="volume-icon"
                    style={{ flexShrink: 0 }}
                  >
                    <style>{'.volume-control-group:hover .volume-icon { opacity: 1 !important; } .volume-icon { opacity: 0.4; }'}</style>
                    <style>{'.volume-control-group:hover .volume-slider-track { background-color: rgba(255,255,255,0.2) !important; }'}</style>
                    <style>{'.volume-control-group:hover .volume-slider-fill { background-color: rgba(255,255,255,1) !important; }'}</style>
                    <path d="M3 6H1V10H3L7 13V3L3 6Z" fill="white" />
                    <path d="M10 5C11.1 6.1 11.1 9.9 10 11M12.5 3C14.7 5.2 14.7 10.8 12.5 13" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <div
                    onClick={handleVolumeSeek}
                    className="volume-slider-track"
                    style={{ width: '60px', height: '3px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '2px', cursor: 'pointer' }}
                  >
                    <div
                      className="volume-slider-fill"
                      style={{ width: `${volume * 100}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '2px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右：信息面板 */}
          <div style={{
            width: '280px', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            backgroundColor: '#161616',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            overflowY: 'auto',
          }}>

            {/* 设为定稿 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px' }}>
              <span style={{ fontFamily: FONT_MEDIUM, fontSize: '13px', fontWeight: 500, lineHeight: '16px', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.01em' }}>
                设为定稿
              </span>
              <Toggle value={finalized} onChange={handleFinalize} />
            </div>

            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '0 20px' }} />

            {/* 提示词 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 20px', minWidth: 0 }}>
              <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>
                提示词
              </span>
              <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.01em', margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {shot?.prompt ?? '—'}
              </p>
            </div>

            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '0 20px' }} />

            {/* 生成参数 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
              <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>
                生成参数
              </span>
              {[
                { label: '模型', value: shot?.model ?? '—' },
                { label: '分辨率', value: shot?.resolution ?? '—' },
                { label: '时长', value: shot?.duration != null ? formatTime(shot.duration) : '—' },
                { label: '比例', value: shot?.aspectRatio ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.01em' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* 参考素材 */}
            {(shot?.referenceImages?.length > 0 || shot?.firstFrameUrl || shot?.lastFrameUrl || shot?.referenceVideoUrl || shot?.referenceAudioUrl) && (
              <>
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '0 20px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>
                    参考素材
                  </span>
                  {shot?.referenceImages?.length > 0 && shot.referenceImages.map((url, i) => (
                    <div key={`refimg-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>
                        参考图{i > 0 ? ` ${i + 1}` : ''}
                      </span>
                      <img src={url} alt="" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px' }} />
                    </div>
                  ))}
                  {shot?.firstFrameUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>首帧</span>
                      <img src={shot.firstFrameUrl} alt="" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px' }} />
                    </div>
                  )}
                  {shot?.lastFrameUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>尾帧</span>
                      <img src={shot.lastFrameUrl} alt="" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px' }} />
                    </div>
                  )}
                  {shot?.referenceVideoUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>参考视频</span>
                      <video src={shot.referenceVideoUrl} controls style={{ width: '100%', borderRadius: '4px' }} />
                    </div>
                  )}
                  {shot?.referenceAudioUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>参考音频</span>
                      <audio src={shot.referenceAudioUrl} controls style={{ width: '100%' }} />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 弹性空白 */}
            <div style={{ flex: 1 }} />

            {/* 下载按钮 */}
            <div style={{ padding: '16px 20px 20px' }}>
              <button
                onClick={handleDownload}
                disabled={downloading || !shot?.videoUrl}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', height: '40px', borderRadius: '8px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: downloading || !shot?.videoUrl ? 'not-allowed' : 'pointer',
                  opacity: downloading || !shot?.videoUrl ? 0.5 : 1,
                  transition: 'opacity 0.12s, background-color 0.12s',
                  outline: 'none',
                }}
                onMouseEnter={(e) => { if (!downloading && shot?.videoUrl) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em' }}>
                  {downloading ? '下载中…' : '下载视频'}
                </span>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
