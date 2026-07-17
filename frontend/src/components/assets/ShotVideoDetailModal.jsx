/**
 * @file ShotVideoDetailModal.jsx
 * @structure-index
 *
 * ─── 依赖与默认数据 ─────────────── L18–L41
 *   useModalSize / placeholder / ConfirmDialog / FONT  弹窗基础依赖
 *   MOCK_SHOT_VIDEO_DETAIL                         无数据时的默认展示值
 *
 * ─── 分镜视频详情弹窗 ───────────── L43–L664
 *   VideoFrameThumbnail                             视频帧缩略图 L43–L93
 *   ShotVideoDetailModal                            视频预览、参数、删除和下载 L95–L662
 *   [回调] 通过 props 接收 onClose / onDownload / onDelete / onShowToast
 *
 * ─── 更新记录 ─────────────────────
 *   2026-07-16  从 AssetsPage 抽离；API、删除、下载和 Toast 副作用通过显式 props 注入
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../../utils/useModalSize';
import placeholderFlowers from '../../assets/placeholder-flowers.webp';
import ConfirmDialog from '../ConfirmDialog';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const MOCK_SHOT_VIDEO_DETAIL = {
  shotNumber: '03',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  resolution: '1920 × 1080',
  duration: '0:24',
  ratio: '16:9',
  generatedAt: '2026-04-21 15:30:09',
  videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4',
  frames: [
    { id: 'v1', src: placeholderFlowers, finalized: true },
    { id: 'v2', src: placeholderFlowers, finalized: false },
    { id: 'v3', src: placeholderFlowers, finalized: false },
  ],
};

function VideoFrameThumbnail({ frame, isActive, onSelect }) {
  return (
    <div
      style={{
        borderRadius: '6px', overflow: 'hidden',
        width: '120px', height: '84px', flexShrink: 0,
        boxShadow: isActive ? '#2DC3E166 0px 0px 10px 1px' : 'none',
        backgroundColor: '#1A1A1A',
        border: isActive ? '1px solid #2DC3E1' : '1px solid #FFFFFF33',
        cursor: 'pointer', position: 'relative',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onClick={onSelect}
    >
      {frame.src ? (
        <video
          src={frame.src}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          preload="metadata"
          muted
          playsInline
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #2A2A2A 0%, #1F1F1F 100%)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="2" y="2" width="20" height="20" rx="3" stroke="#FFFFFF33" strokeLinejoin="round" />
            <path d="M9 8L16 12L9 16V8Z" fill="#FFFFFF33" />
          </svg>
        </div>
      )}

      {/* 定稿标签 */}
      {frame.finalized && (
        <div style={{
          position: 'absolute', top: '4px', left: '4px',
          paddingLeft: '4px', paddingRight: '4px',
          borderRadius: '2px', backgroundColor: '#4AC981',
          boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
          height: '18px', display: 'flex', alignItems: 'center',
        }}>
          <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
        </div>
      )}

    </div>
  );
}

function ShotVideoDetailModal({ onClose, onDownload, onDelete, onShowToast, shotNumber, prompt, model, resolution, duration, ratio, generatedAt, frames, videoSrc, refMode, firstFrame, lastFrame, refImages, refVideos }) {
  const { width: modalW, height: modalH } = useModalSize();
  const frms = frames ?? MOCK_SHOT_VIDEO_DETAIL.frames;
  const defaultIdx = frms.findIndex((f) => f.finalized);
  const [activeFrame, setActiveFrame] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);
  const [hovDelete, setHovDelete] = useState(false);
  const [pressDelete, setPressDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef(null);
  function showCopyToast() {
    clearTimeout(copyToastTimer.current);
    setCopyToast(true);
    copyToastTimer.current = setTimeout(() => setCopyToast(false), 2000);
  }
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);
  const isDraggingRef = useRef(false);

  const currentFrame = frms[activeFrame];
  const isFinalized = currentFrame?.finalized ?? false;
  const sn = shotNumber ?? MOCK_SHOT_VIDEO_DETAIL.shotNumber;
  // src 优先取当前缩略图对应的视频，无则 fallback 到主视频
  const src = currentFrame?.src || videoSrc || MOCK_SHOT_VIDEO_DETAIL.videoSrc;

  // 切换缩略图时重置播放状态并加载新视频
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    vid.load();
  }, [src]);

  function fmtTime(secs) {
    if (!isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTimeUpdate = () => setCurrentTime(vid.currentTime);
    const onLoaded = () => { setVideoDuration(vid.duration); vid.volume = volume; };
    const onEnded = () => setIsPlaying(false);
    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('loadedmetadata', onLoaded);
    vid.addEventListener('ended', onEnded);
    return () => {
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('loadedmetadata', onLoaded);
      vid.removeEventListener('ended', onEnded);
    };
  }, [volume]);

  // 弹窗打开后自动播放视频
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !src) return;
    const onCanPlay = () => {
      vid.play().then(() => setIsPlaying(true)).catch(() => {});
    };
    vid.addEventListener('canplay', onCanPlay, { once: true });
    return () => vid.removeEventListener('canplay', onCanPlay);
  }, [src]);

  function togglePlay() {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); setIsPlaying(true); }
    else { vid.pause(); setIsPlaying(false); }
  }

  function seekFromEvent(e, bar) {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const vid = videoRef.current;
    if (vid && isFinite(vid.duration)) {
      vid.currentTime = ratio * vid.duration;
      setCurrentTime(vid.currentTime);
    }
  }

  function handleProgressMouseDown(e) {
    isDraggingRef.current = true;
    seekFromEvent(e, progressBarRef.current);
    const onMove = (ev) => { if (isDraggingRef.current) seekFromEvent(ev, progressBarRef.current); };
    const onUp = () => { isDraggingRef.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleVolumeClick(e) {
    const rect = volumeBarRef.current.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
  }

  const progressPct = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column', width: `${modalW}px`,
          borderRadius: '16px', overflow: 'hidden',
          boxShadow: '#00000099 -10px 24px 64px',
          backgroundColor: '#161616', border: '1px solid #FFFFFF14',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, paddingTop: '20px', paddingBottom: '20px',
          paddingLeft: '24px', paddingRight: '24px', backgroundColor: '#161616',
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
          <button
            type="button"
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hovClose ? '#FFFFFF14' : 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '6px', padding: 0, flexShrink: 0, transition: 'background 0.12s',
            }}
            onMouseEnter={() => setHovClose(true)}
            onMouseLeave={() => setHovClose(false)}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', height: `${modalH - 60}px` }}>
          {/* Left: video player */}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 0, minHeight: 0, backgroundColor: '#0D0D0D' }}>
            {/* Main video preview */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, backgroundColor: '#0A0A0A' }}>
              <div style={{
                width: '100%', aspectRatio: '16/9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', alignSelf: 'stretch', position: 'relative',
                backgroundColor: '#111111',
              }}>
                {/* Real video element */}
                <video
                  ref={videoRef}
                  src={src}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                  preload="metadata"
                />
                {/* Bottom gradient overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 40%, oklab(0% 0 0 / 40%) 100%)',
                  pointerEvents: 'none',
                }} />
                {/* Play/pause button */}
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', position: 'relative', flexShrink: 0,
                    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                    backgroundColor: '#FFFFFF1F', border: '1px solid #FFFFFF33',
                    width: '56px', height: '56px', cursor: 'pointer',
                  }}
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                      <rect x="4" y="4" width="4" height="12" rx="1" fill="#FFFFFF" />
                      <rect x="12" y="4" width="4" height="12" rx="1" fill="#FFFFFF" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M7 5L16 10L7 15V5Z" fill="#FFFFFF" />
                    </svg>
                  )}
                </button>
                {/* Shot label */}
                <div style={{
                  position: 'absolute', top: '12px', left: '12px',
                  borderRadius: '6px', paddingTop: '4px', paddingBottom: '4px',
                  paddingLeft: '8px', paddingRight: '8px',
                  backgroundColor: '#00000080',
                }}>
                  <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.02em', color: '#FFFFFF99' }}>镜头 {sn}</span>
                </div>
              </div>
            </div>

            {/* Controls bar */}
            <div style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: '14px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
              gap: '10px', backgroundColor: '#111111',
            }}>
              {/* Play/pause small */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', flexShrink: 0,
                    backgroundColor: '#FFFFFF1A', border: '1px solid #FFFFFF26',
                    width: '32px', height: '32px', cursor: 'pointer',
                  }}
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <rect x="2.5" y="2.5" width="3" height="9" rx="0.75" fill="#FFFFFF" />
                      <rect x="8.5" y="2.5" width="3" height="9" rx="0.75" fill="#FFFFFF" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M5 3L12 7L5 11V3Z" fill="#FFFFFF" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99', flexShrink: 0, width: '36px' }}>{fmtTime(currentTime)}</span>
                <div
                  ref={progressBarRef}
                  style={{ flexGrow: 1, height: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
                  onMouseDown={handleProgressMouseDown}
                >
                  <div style={{ width: '100%', height: '3px', borderRadius: '2px', backgroundColor: '#FFFFFF1F', position: 'relative' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: '2px', backgroundColor: '#FFFFFFB3', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', right: '-5px', top: '50%',
                        width: '10px', height: '10px', borderRadius: '50%',
                        boxShadow: '#00000080 0px 0px 4px', backgroundColor: '#FFFFFF',
                        transform: 'translateY(-50%)',
                      }} />
                    </div>
                  </div>
                </div>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF40', flexShrink: 0, width: '36px', textAlign: 'right' }}>{fmtTime(videoDuration)}</span>
              </div>
              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
                  <path d="M3 6H1V10H3L7 13V3L3 6Z" fill="#FFFFFF" />
                  <path d="M10 5C11.1 6.1 11.1 9.9 10 11M12.5 3C14.7 5.2 14.7 10.8 12.5 13" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <div
                  ref={volumeBarRef}
                  style={{ width: '60px', height: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                  onClick={handleVolumeClick}
                >
                  <div style={{ width: '100%', height: '3px', borderRadius: '2px', backgroundColor: '#FFFFFF1F' }}>
                    <div style={{ width: `${volume * 100}%`, height: '100%', borderRadius: '2px', backgroundColor: '#FFFFFF99' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnails strip */}
            <div style={{
              flexShrink: 0,
              paddingTop: '12px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
              backgroundColor: '#111111', borderTop: '1px solid #FFFFFF14',
            }}>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                {frms.map((frm, idx) => {
                  const isActive = activeFrame === idx;
                  return (
                    <VideoFrameThumbnail
                      key={frm.id}
                      frame={frm}
                      isActive={isActive}
                      onSelect={() => setActiveFrame(idx)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: info panel */}
          <div style={{
            width: '280px', display: 'flex', flexDirection: 'column',
            height: `${modalH - 60}px`, flexShrink: 0,
            backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
          }}>
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
              {/* Finalized status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>是否定稿</span>
                {isFinalized ? (
                  <div style={{
                    paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px',
                    borderRadius: '2px', backgroundColor: '#4AC981',
                    boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>否</span>
                )}
              </div>

              {/* Shot number — no divider above */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分镜编号</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{sn}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Creation mode — if refMode provided */}
              {refMode && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>创作模式</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>
                      {refMode === 'full_ref' ? '全能参考' : refMode === 'frame_ref' ? '首尾帧' : refMode}
                    </span>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {/* Reference items — show based on creation mode */}
              {refMode === 'full_ref' && (
                <>
                  {/* Ref subjects */}
                  {/* Ref images */}
                  {(refImages || []).length > 0 && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>参考图</span>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
                          {refImages.map((ref, idx) => (
                            <div
                              key={idx}
                              style={{
                                borderRadius: '4px', overflow: 'hidden',
                                width: '80px', height: '56px', flexShrink: 0,
                                backgroundColor: '#FFFFFF14',
                                border: '1px solid #FFFFFF33',
                                backgroundImage: `url(${ref.url || ref})`,
                                backgroundSize: 'cover', backgroundPosition: '50%',
                              }}
                              title={ref.title}
                            />
                          ))}
                        </div>
                      </div>
                      <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                    </>
                  )}
                  {/* Ref videos */}
                  {(refVideos || []).length > 0 && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>参考视频</span>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{(refVideos || []).length} 个</span>
                      </div>
                      <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                    </>
                  )}
                </>
              )}

              {refMode === 'frame_ref' && (firstFrame || lastFrame) && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>关键帧</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {firstFrame && (
                        <div
                          style={{
                            borderRadius: '4px', overflow: 'hidden',
                            width: '60px', height: '42px', flexShrink: 0,
                            backgroundColor: '#FFFFFF14',
                            border: '1px solid #FFFFFF33',
                            backgroundImage: `url(${firstFrame})`,
                            backgroundSize: 'cover', backgroundPosition: '50%',
                          }}
                          title="首帧"
                        />
                      )}
                      {lastFrame && (
                        <div
                          style={{
                            borderRadius: '4px', overflow: 'hidden',
                            width: '60px', height: '42px', flexShrink: 0,
                            backgroundColor: '#FFFFFF14',
                            border: '1px solid #FFFFFF33',
                            backgroundImage: `url(${lastFrame})`,
                            backgroundSize: 'cover', backgroundPosition: '50%',
                          }}
                          title="尾帧"
                        />
                      )}
                    </div>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {/* AI Prompt */}
              {(prompt ?? MOCK_SHOT_VIDEO_DETAIL.prompt) && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 提示词</span>
                      <button
                        type="button"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', borderRadius: '4px',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          opacity: 0.6, transition: 'opacity 0.12s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                        onClick={() => {
                          navigator.clipboard.writeText(prompt ?? MOCK_SHOT_VIDEO_DETAIL.prompt);
                          showCopyToast();
                        }}
                        title="复制提示词"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                          <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="white" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="white" strokeOpacity="0.6" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{prompt ?? MOCK_SHOT_VIDEO_DETAIL.prompt}</p>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {/* Generation params */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '12px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</span>
                {[
                  { label: '模型', value: model ?? MOCK_SHOT_VIDEO_DETAIL.model },
                  { label: '分辨率', value: resolution ?? MOCK_SHOT_VIDEO_DETAIL.resolution },
                  { label: '时长', value: duration ?? MOCK_SHOT_VIDEO_DETAIL.duration },
                  { label: '比例', value: ratio ?? MOCK_SHOT_VIDEO_DETAIL.ratio },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* AI generated time */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF66' }}>{generatedAt ?? MOCK_SHOT_VIDEO_DETAIL.generatedAt}</span>
              </div>
            </div>

            {/* Sticky buttons */}
            <div style={{ flexShrink: 0, paddingTop: '12px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A', display: 'flex', gap: '8px' }}>
              {onDelete && (
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                    backgroundColor: pressDelete ? '#FFFFFF26' : hovDelete ? '#FFFFFF1F' : '#FFFFFF14',
                    border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                    opacity: pressDelete ? 0.8 : 1,
                  }}
                  onMouseEnter={() => setHovDelete(true)}
                  onMouseLeave={() => { setHovDelete(false); setPressDelete(false); }}
                  onMouseDown={() => setPressDelete(true)}
                  onMouseUp={() => setPressDelete(false)}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2.333 3.667V12.333C2.333 12.784 2.716 13.167 3.167 13.167H10.833C11.284 13.167 11.667 12.784 11.667 12.333V3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                    <path d="M5.333 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M8.667 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M1 3.667H13" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M4.333 3.667L5.15 1.333H8.85L9.667 3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FF6B6B' }}>删除</span>
                </button>
              )}
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                  backgroundColor: hovDownload ? '#FFFFFF1F' : '#FFFFFF14',
                  border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                }}
                onMouseEnter={() => setHovDownload(true)}
                onMouseLeave={() => setHovDownload(false)}
                onClick={onDownload}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke="#FFFFFF99" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>下载</span>
              </button>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <ConfirmDialog
                title="确定要删除吗？"
                description="删除后，该资产将被清除且不可恢复。"
                confirmText="删除"
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={() => { setShowDeleteConfirm(false); onShowToast?.('删除成功', 'success'); onDelete?.(); }}
                zIndex={300}
              />
            )}
          </div>
        </div>
      </div>
      {copyToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>提示词复制成功</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ShotVideoDetailModal;
