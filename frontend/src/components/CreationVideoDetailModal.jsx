/**
 * @file CreationVideoDetailModal.jsx
 * @structure-index
 *
 * ─── 辅助组件与工具 ─────────────────────────────── L38–L230
 *   formatVideoDuration / ReferenceVideoCard / CopyPromptButton / PanelAction / EditTool 详情字段、参考素材与操作按钮
 *
 * ─── 创作视频详情弹窗 ───────────────────────────── L231–L752
 *   CreationVideoDetailModal                        视频预览、详情信息和操作回调
 *   视频播放区                                      点击画面切换播放状态，中央反馈显示 0.5 秒后隐藏，保留原生 controls
 *   右侧信息区                                      顶部操作、中间滚动、底部视频编辑固定布局
 *
 * ─── 更新记录 ─────────────────────────────────────
 *   2026-09-07                                       中央播放状态短暂显示 0.5 秒；外层圆角裁剪；右栏改为固定布局；更新视频编辑按钮图标
 *   2026-09-03                                       视频控制组件样式对齐分镜详情弹窗，保留创作页业务架构
 *   2026-09-09                                       接入智能超清、去字幕、剪辑与纯前端选帧；选帧优先读取独立原视频地址，打开前暂停播放
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import ConfirmDialog from './ConfirmDialog';
import FilePreviewTooltip from './FilePreviewTooltip';
import AsyncImagePreview from './AsyncImagePreview';
import { formatReferenceMode } from '../utils/referenceMode';
import { apiGetLiveMaterialPreviewByRef } from '../api/liveMaterials';
import { showGlobalToast } from '../stores/toastStore';
import CopyPromptButton from './ui/CopyPromptButton';
import { DeleteIcon, FavoriteIcon } from './ui';
import VideoPlaybackControls from './ui/VideoPlaybackControls';
import VideoUpscaleModal from './video-edit/VideoUpscaleModal';
import VideoSubtitleModal from './video-edit/VideoSubtitleModal';
import VideoTrimModal from './video-edit/VideoTrimModal';
import VideoFrameModal from './video-edit/VideoFrameModal';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function formatVideoDuration(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return /s$/i.test(text) ? text : `${text}s`;
}

// ConfirmDeleteModal 已迁移至 ConfirmDialog 共享组件


// ─── Reference video card (thumbnail + hover preview) ──────────────────────
function ReferenceVideoCard({ vidUrl }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [cardRect, setCardRect] = useState(null);
  const hoverTimerRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!vidUrl) return;
    let cancelled = false;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    if (!vidUrl.startsWith('blob:')) video.crossOrigin = 'anonymous';
    const timeoutId = setTimeout(() => { cancelled = true; }, 5000);

    const handleLoadedData = () => { if (!cancelled) video.currentTime = 0.1; };
    const handleSeeked = () => {
      if (cancelled) return;
      try {
        const maxW = 320; const scale = Math.min(1, maxW / (video.videoWidth || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round((video.videoWidth || 320) * scale);
        canvas.height = Math.round((video.videoHeight || 240) * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.7));
      } catch { /* CORS — use fallback */ }
      clearTimeout(timeoutId);
    };
    const handleError = () => { cancelled = true; };
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);
    video.src = vidUrl;
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [vidUrl]);

  return (
    <>
      <div
        ref={cardRef}
        className="rounded-md overflow-clip w-full aspect-square bg-[#FFFFFF14] border border-solid border-[#FFFFFF14] cursor-pointer"
        style={previewUrl ? { backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: '50%' } : {}}
        onMouseEnter={() => {
          hoverTimerRef.current = setTimeout(() => {
            if (cardRef.current) setCardRect(cardRef.current.getBoundingClientRect());
            setTooltipVisible(true);
          }, 500);
        }}
        onMouseLeave={() => {
          clearTimeout(hoverTimerRef.current);
          setTooltipVisible(false);
        }}
      >
        {!previewUrl && (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.25 }}>
              <path d="M5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5Zm10.7 7.316a1 1 0 0 1 0 1.368l-4.7 4.8a1 1 0 0 1-1.7-.684V7.2a1 1 0 0 1 1.7-.684l4.7 4.8Z" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>
      {tooltipVisible && vidUrl && (
        <FilePreviewTooltip isVideo previewUrl={previewUrl} videoSrc={vidUrl} cardRect={cardRect} />
      )}
    </>
  );
}

// Confirm delete modal component
// eslint-disable-next-line no-unused-vars
function CopyPromptButtonLegacy({ text, onCopy }) {
  const [hovCopy, setHovCopy] = useState(false);
  const [pressCopy, setPressCopy] = useState(false);
  const copyColor = pressCopy ? '#FFFFFF99' : '#FFFFFFCC';
  return (
    <button
      type="button"
      style={{ width: '24px', minWidth: '24px', height: '24px', padding: 0, margin: 0, border: 0, borderRadius: '6px', background: hovCopy ? '#FFFFFF14' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copyColor, transition: 'color 120ms ease, background 120ms ease', flexShrink: 0 }}
      onMouseEnter={() => setHovCopy(true)}
      onMouseLeave={() => { setHovCopy(false); setPressCopy(false); }}
      onMouseDown={() => setPressCopy(true)}
      onMouseUp={() => setPressCopy(false)}
      onClick={() => {
        navigator.clipboard.writeText(text || '');
        onCopy?.();
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="currentColor" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

function PanelAction({ icon, label, onClick, active = false }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '24px', minWidth: '24px', height: '24px', padding: 0,
        border: 0, borderRadius: '7px',
        backgroundColor: hovered ? '#FFFFFF14' : '#161616',
        cursor: 'pointer', transition: 'background-color 0.12s',
      }}
    >
      {icon}
    </button>
  );
}

function EditTool({ label, icon, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flex: '1 1 0%', minWidth: 0, height: '64px', padding: '12px 8px',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
        border: 0, borderRadius: '6px', backgroundColor: hovered ? '#FFFFFF14' : '#FFFFFF0D',
        color: '#FFFFFFCC', cursor: 'pointer', transition: 'background-color 0.12s',
      }}
    >
      {icon}
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        {label}
      </span>
    </button>
  );
}

function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M13.506 11.439C14.601 10.668 15.071 9.277 14.667 8C14.262 6.723 13.024 6.024 11.684 6.025H10.911C10.405 4.054 8.736 2.599 6.715 2.366C4.693 2.133 2.737 3.171 1.796 4.975C0.856 6.78 1.125 8.977 2.474 10.501" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.003 13.667L8 7.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.121 11.545L8 13.667L5.879 11.545" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// ConfirmDeleteModal 已迁移至 ConfirmDialog 共享组件

/**
 * 创作页视频详情弹窗
 * @param {Object} props
 * @param {Function} props.onClose - 关闭弹窗
 * @param {string} props.videoUrl - 视频地址
 * @param {string} props.posterUrl - 视频封面地址
 * @param {string} props.prompt - 提示词
 * @param {string} props.model - 模型名称
 * @param {string} props.ratio - 画面比例
 * @param {string} props.resolution - 分辨率
 * @param {string} props.duration - 时长
 * @param {string} props.refMode - 参考模式
 * @param {string} props.refModeLabel - 后端返回的参考模式展示文案
 * @param {Array} props.refImages - 参考图片数组
 * @param {Array} props.refVideos - 参考视频数组
 * @param {Array} props.refAudios - 参考音频数组
 * @param {string} props.firstFrame - 首帧图片 URL（首尾帧模式下）
 * @param {string} props.lastFrame - 尾帧图片 URL（首尾帧模式下）
 * @param {boolean} props.sound - 是否有声音
 * @param {string} props.createdAt - 生成时间
 * @param {Function} props.onDownload - 下载回调
 * @param {Function} props.onDelete - 删除回调
 * @param {Function} props.onFavorite - 收藏回调
 */
export default function CreationVideoDetailModal({
  onClose,
  videoUrl,
  originalVideoUrl,
  posterUrl = '',
  prompt = '',
  promptHTML = '',
  model = '',
  ratio = '16:9',
  resolution = '',
  duration = '',
  refMode = '',
  refModeLabel = '',
  refImages = [],
  refVideos = [],
  refAudios = [],
  firstFrame = '',
  lastFrame = '',
  sound,
  createdAt = '',
  onDownload,
  onDelete,
  favorited = false,
  onFavorite,
}) {
  console.log('CreationVideoDetailModal props:', { videoUrl, posterUrl, prompt, model, ratio, resolution, duration });

  if (!videoUrl) {
    console.error('CreationVideoDetailModal: videoUrl is missing!');
  }

  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const [isPlaying, setIsPlaying] = useState(false);
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [subtitleOpen, setSubtitleOpen] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const [frameOpen, setFrameOpen] = useState(false);
  const [playbackFeedbackVisible, setPlaybackFeedbackVisible] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovClose, setHovClose] = useState(false);
  const [toastVisible] = useState(false);
  const videoRef = useRef(null);
  const playbackFeedbackTimerRef = useRef(null);

  function handleCopyPrompt() {
    showGlobalToast('您已复制提示词', 'success');
  }

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onLoaded = () => console.log('Video loaded:', vid.duration, vid.videoWidth, vid.videoHeight);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onError = (e) => {
      console.error('Video error:', e, vid.error);
    };

    vid.addEventListener('loadedmetadata', onLoaded);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('ended', onEnded);
    vid.addEventListener('error', onError);

    return () => {
      vid.removeEventListener('loadedmetadata', onLoaded);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('ended', onEnded);
      vid.removeEventListener('error', onError);
    };
  }, [videoUrl]);

  useEffect(() => () => {
    clearTimeout(playbackFeedbackTimerRef.current);
  }, []);

  // 弹窗打开后自动播放视频
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoUrl) return;
    const onCanPlay = () => {
      vid.play().then(() => setIsPlaying(true)).catch(() => {});
    };
    vid.addEventListener('canplay', onCanPlay, { once: true });
    return () => vid.removeEventListener('canplay', onCanPlay);
  }, [videoUrl]);

  function togglePlay() {
    const vid = videoRef.current;
    if (!vid) return;

    const shouldPlay = vid.paused;
    clearTimeout(playbackFeedbackTimerRef.current);
    setIsPlaying(shouldPlay);
    setPlaybackFeedbackVisible(true);
    playbackFeedbackTimerRef.current = setTimeout(() => {
      setPlaybackFeedbackVisible(false);
    }, 500);

    if (shouldPlay) {
      vid.play().catch(() => {
        setIsPlaying(false);
        setPlaybackFeedbackVisible(false);
      });
      return;
    }

    vid.pause();
  }

  const isFrameReference = refMode === 'frame'
    || ['first_frame', 'last_frame', 'start_end', 'multiframe'].includes(refMode);
  const firstFrameImage = firstFrame || refImages.find((image) => (
    typeof image !== 'string' && image?.role === 'first_frame'
  )) || (refMode === 'first_frame' ? refImages[0] : null);
  const lastFrameImage = lastFrame || refImages.find((image) => (
    typeof image !== 'string' && image?.role === 'last_frame'
  )) || (refMode === 'last_frame' ? refImages[0] : null);
  const getFrameImageUrl = (image) => typeof image === 'string'
    ? image
    : (image?.url || image?.previewUrl || '');

  return (
    <>
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
        className="flex flex-col overflow-hidden rounded-2xl h-fit [box-shadow:#00000099_-10px_24px_64px] bg-[#161616] border border-solid border-[#FFFFFF14]" style={{ width: `${modalW}px`, height: `${modalH}px`, transform: `scale(${modalScale})`, transformOrigin: 'center center' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 py-[20px] px-[24px] bg-[#161616]">
          <div className="tracking-[0.01em] inline-block font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-base/5">
            查看详情
          </div>
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: '0' }}>
              <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex grow shrink basis-[0%] min-h-0 h-[540px]">
          {/* Left: video player */}
          <div className="flex flex-col grow shrink basis-[0%] min-w-0 min-h-0 bg-[#0D0D0D]">
            <div className="grow shrink basis-[0%] flex items-center justify-center min-h-0 bg-[#0A0A0A]">
              <div className="w-full aspect-video flex items-center justify-center overflow-clip self-stretch relative" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(21.8% 0 0) 0%, oklab(17.8% 0 0) 100%)' }}>
                {/* Real video element */}
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    poster={posterUrl || undefined}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                    preload="metadata"
                    playsInline
                    controls
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF66', fontFamily: FONT, fontSize: '14px' }}>
                    视频加载失败
                  </div>
                )}
                <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 40%, oklab(0% 0 0 / 40%) 100%)', pointerEvents: 'none' }} />
                {videoUrl && <VideoPlaybackControls isPlaying={isPlaying} feedbackVisible={playbackFeedbackVisible} onToggle={togglePlay} />}
              </div>
            </div>
          </div>

          {/* Right: params panel */}
          <div className="w-[340px] flex flex-col min-h-0 h-full shrink-0 bg-[#161616] border-l border-l-solid border-l-[#FFFFFF0F]">
            <div className="flex items-center justify-between shrink-0 py-[12px] px-[20px] bg-[#161616] border-b border-b-solid border-b-[#FFFFFF0A]">
              <div className="flex items-center gap-[8px]">
                <PanelAction
                  label="收藏"
                  active={favorited}
                  onClick={() => {
                    setStarAnim(true);
                    setTimeout(() => setStarAnim(false), 300);
                    onFavorite?.();
                  }}
                  icon={(
                    <div style={{ display: 'flex', transform: starAnim ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                      <FavoriteIcon filled={favorited} />
                    </div>
                  )}
                />
                <PanelAction label="下载" onClick={onDownload} icon={<DownloadIcon />} />
              </div>
              <PanelAction label="删除" onClick={() => setConfirmDelete(true)} icon={<DeleteIcon size={14} />} />
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
            {/* Prompt */}
            <div className="flex flex-col py-[16px] px-[20px] gap-[10px]">
              <div className="flex items-center justify-between w-full">
                <div className="tracking-[0.66px] uppercase font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                  提示词
                </div>
                <CopyPromptButton text={prompt} onCopy={handleCopyPrompt} />
              </div>
              <div className="tracking-[0.12px] font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-xs/5 m-0">
                {promptHTML
                  ? <span dangerouslySetInnerHTML={{ __html: promptHTML }} />
                  : (prompt || '无')
                }
              </div>
            </div>

            {/* Reference */}
            {isFrameReference ? (
              <>
                <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
                <div className="flex py-[16px] px-[20px] gap-[12px]">
                  <div className="flex flex-col items-start gap-[12px] flex-1 h-fit">
                    <div className="tracking-[0.66px] uppercase inline-block self-stretch font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                      首帧
                    </div>
                    <div className="rounded-md overflow-clip flex flex-col items-center gap-0 justify-center h-[84px] self-stretch shrink-0 bg-[#FFFFFF14] border border-solid border-[#FFFFFF14] p-0">
                      {getFrameImageUrl(firstFrameImage) ? (
                        <AsyncImagePreview
                          src={getFrameImageUrl(firstFrameImage)}
                          alt="首帧参考"
                          resolveSrc={apiGetLiveMaterialPreviewByRef}
                          style={{ width: '100%', height: '84px', border: 'none', borderRadius: 0 }}
                        />
                      ) : (
                        <div className="font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF40] text-[12px]">无</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-[12px] flex-1 h-fit">
                    <div className="tracking-[0.66px] uppercase inline-block self-stretch font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                      尾帧
                    </div>
                    <div className="rounded-md overflow-clip flex flex-col items-center gap-0 justify-center h-[84px] self-stretch shrink-0 bg-[#FFFFFF14] border border-solid border-[#FFFFFF14] p-0">
                      {getFrameImageUrl(lastFrameImage) ? (
                        <AsyncImagePreview
                          src={getFrameImageUrl(lastFrameImage)}
                          alt="尾帧参考"
                          resolveSrc={apiGetLiveMaterialPreviewByRef}
                          style={{ width: '100%', height: '84px', border: 'none', borderRadius: 0 }}
                        />
                      ) : (
                        <div className="font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF40] text-[12px]">无</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (refImages.length > 0 || refVideos.length > 0 || refAudios.length > 0) && (
              <>
                {refImages.length > 0 && (
                  <>
                    <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
                    <div className="flex flex-col py-[16px] px-[20px] gap-[12px]">
                      <div className="tracking-[0.66px] uppercase inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                        参考图
                      </div>
                      <div className="grid grid-cols-4 gap-[8px] self-stretch">
                        {refImages.map((img, i) => {
                          const imgUrl = typeof img === 'string' ? img : (img.url || img.previewUrl || '');
                          return (
                            <AsyncImagePreview
                              key={`${i}-${imgUrl}`}
                              src={imgUrl}
                              alt="参考图"
                              resolveSrc={apiGetLiveMaterialPreviewByRef}
                              style={{ width: '100%', height: 'auto', aspectRatio: '1' }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                {refVideos.length > 0 && (
                  <>
                    <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
                    <div className="flex flex-col py-[16px] px-[20px] gap-[12px]">
                      <div className="tracking-[0.66px] uppercase inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                        参考视频
                      </div>
                      <div className="grid grid-cols-4 gap-[8px] self-stretch">
                        {refVideos.map((vid, i) => {
                          const vidUrl = typeof vid === 'string' ? vid : (vid.url || vid.previewUrl || '');
                          return vidUrl ? <ReferenceVideoCard key={i} vidUrl={vidUrl} /> : null;
                        })}
                      </div>
                    </div>
                  </>
                )}
                {refAudios.length > 0 && (
                  <>
                    <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
                    <div className="flex flex-col py-[16px] px-[20px] gap-[12px]">
                      <div className="tracking-[0.66px] uppercase inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                        参考音频
                      </div>
                      <div className="grid grid-cols-4 gap-[8px] self-stretch">
                        {refAudios.map((audio, i) => (
                          <div key={i} className="flex flex-col items-start gap-[2px] px-[8px] py-[6px] overflow-clip rounded-lg w-full aspect-square justify-between bg-[#1D1E1E] border border-solid border-[#FFFFFF14]">
                            <div className="text-[12px] leading-[150%] self-stretch flex-1 overflow-hidden font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white">
                              {(typeof audio === 'string' ? 'audio.mp3' : (audio.name || 'audio.mp3'))}
                            </div>
                            <div className="text-[12px] leading-[150%] self-stretch font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF66]">
                              {(typeof audio === 'string' ? '' : (audio.size || '2M'))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Generation params */}
            <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
            <div className="flex flex-col py-[16px] px-[20px] gap-[12px] bg-[#161616]">
              <div className="tracking-[0.66px] uppercase inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                生成参数
              </div>
              {model && (
                <div className="flex items-center justify-between">
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-xs/4">
                    模型
                  </div>
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-xs/4">
                    {model}
                  </div>
                </div>
              )}
              {(refModeLabel || refMode) && (
                <div className="flex items-center justify-between">
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-xs/4">
                    参考模式
                  </div>
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-xs/4">
                    {formatReferenceMode(refMode, refModeLabel)}
                  </div>
                </div>
              )}
              {ratio && (
                <div className="flex items-center justify-between">
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-xs/4">
                    画面比例
                  </div>
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-xs/4">
                    {ratio}
                  </div>
                </div>
              )}
              {resolution && (
                <div className="flex items-center justify-between">
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-xs/4">
                    分辨率
                  </div>
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-xs/4">
                    {resolution}
                  </div>
                </div>
              )}
              {duration && (
                <div className="flex items-center justify-between">
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-xs/4">
                    时长
                  </div>
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-xs/4">
                    {formatVideoDuration(duration)}
                  </div>
                </div>
              )}
              {sound !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-xs/4">
                    声音
                  </div>
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-xs/4">
                    {sound ? '有' : '无'}
                  </div>
                </div>
              )}
            </div>

            {/* AI generation time */}
            {createdAt && (
              <>
                <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
                <div className="flex flex-row items-center justify-start w-[340px] py-[16px] px-[20px] gap-[4px] shrink-0 bg-[#161616]">
                  <div className="flex-1 tracking-[0.72px] uppercase font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[12px]/[14px]">
                    AI 生成时间
                  </div>
                  <div className="tracking-[0.12px] font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-[12px]/[16px]">
                    {createdAt}
                  </div>
                </div>
              </>
            )}

              <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
            </div>

            <div
              style={{
                display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0,
                width: '100%', padding: '16px 20px 16px', boxSizing: 'border-box',
                borderTop: '1px solid #FFFFFF0D', backgroundColor: '#161616',
              }}
            >
              <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>
                视频编辑
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}>
                <EditTool
                  label="智能超清"
                  onClick={() => { videoRef.current?.pause(); setUpscaleOpen(true); }}
                  icon={(
                    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                      <path d="M447.849 45.176a53.489 53.489 0 0 1 0 106.978H226.424c-49.393 0-89.33 39.936-89.33 89.33l0.121 122.88c393.276 37.466 594.04 216.666 602.353 537.6h58.067c46.622 0 84.871-35.6 88.967-81.198l0.362-8.132V527.12a53.368 53.368 0 0 1 106.857 0v285.515c0 108.424-87.823 196.307-196.307 196.307h-571.09A196.247 196.247 0 0 1 30.057 812.634v-571.09A196.367 196.367 0 0 1 226.363 45.176H447.85z m-153.24 581.271a32.407 32.407 0 0 0-32.406 32.407v64.873H197.33v-64.873a32.407 32.407 0 0 0-64.873 0v194.62a32.407 32.407 0 0 0 64.873 0V788.6h64.873v64.874a32.407 32.407 0 0 0 64.874 0v-194.56a32.407 32.407 0 0 0-32.467-32.467z m162.215 0H391.95a32.407 32.407 0 0 0-32.286 29.094l-0.18 3.313v194.62c0 17.95 14.516 32.467 32.466 32.467h64.874a97.28 97.28 0 0 0 97.28-97.34v-64.874c0-53.73-43.55-97.28-97.28-97.28z m0 64.873c17.89 0 32.406 14.517 32.406 32.407V788.6a32.407 32.407 0 0 1-32.406 32.467h-32.467V691.32zM812.994 0a22.89 22.89 0 0 1 21.264 14.456l11.384 27.709c19.276 46.742 55.658 84.269 101.798 104.93l32.407 14.456a23.853 23.853 0 0 1 0 43.37l-34.334 15.3A197.15 197.15 0 0 0 845.22 322.017l-11.204 25.359a22.89 22.89 0 0 1-42.165 0l-11.083-25.48A196.97 196.97 0 0 0 680.477 220.22l-34.274-15.3a23.974 23.974 0 0 1 0-43.369l32.347-14.456a197.15 197.15 0 0 0 101.677-104.99l11.445-27.649A22.89 22.89 0 0 1 812.995 0z" fill="#FFFFFF99" />
                    </svg>
                  )}
                />
                <EditTool
                  label="去字幕"
                  onClick={() => { videoRef.current?.pause(); setSubtitleOpen(true); }}
                  icon={(
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M2 11V13C2 13.5523 2.44772 14 3 14H5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M11 14H13C13.5523 14 14 13.5523 14 13V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 5V3C14 2.44772 13.5523 2 13 2H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 5V3C2 2.44772 2.44772 2 3 2H5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 5V11.6667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5.66663 5H7.99996H10.3333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                />
                <EditTool
                  label="选帧"
                  onClick={() => { videoRef.current?.pause(); setFrameOpen(true); }}
                  icon={(
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path opacity="0.6" d="M8.38096 12.3819L2.51207 13.6294L0.640869 4.82605L3.57531 4.20231L4.30892 4.04638" stroke="currentColor" strokeLinejoin="round" />
                      <path opacity="0.8" d="M7.5 12H4.5V3H10.5V3.79344" stroke="currentColor" strokeLinejoin="round" />
                      <rect x="9.78113" y="3.27368" width="6" height="9" transform="rotate(18 9.78113 3.27368)" stroke="currentColor" strokeLinejoin="round" />
                    </svg>
                  )}
                />
                <EditTool
                  label="剪辑"
                  onClick={() => { videoRef.current?.pause(); setTrimOpen(true); }}
                  icon={(
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M14.3333 5.66667V3H11.3333M14.3333 5.66667V10.3333M14.3333 5.66667H11.3333M11.3333 3V5.66667M11.3333 3H9.99996M14.3333 10.3333V13H11.3333M14.3333 10.3333H11.3333M11.3333 5.66667H9.99996M1.66663 5.66667V3H4.66663M1.66663 5.66667V10.3333M1.66663 5.66667H4.66663M4.66663 3V5.66667M4.66663 3H5.99996M1.66663 10.3333V13H4.66663M1.66663 10.3333H4.66663M4.66663 5.66667H5.99996M4.66663 13V10.3333M4.66663 13H5.99996M4.66663 10.3333H5.99996M11.3333 13V10.3333M11.3333 13H9.99996M11.3333 10.3333H9.99996" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 2.33337V3.66671" stroke="currentColor" strokeLinecap="round" />
                      <path d="M8 5.66663V6.99996" stroke="currentColor" strokeLinecap="round" />
                      <path d="M8 9V10.3333" stroke="currentColor" strokeLinecap="round" />
                      <path d="M8 12.3334V13.6667" stroke="currentColor" strokeLinecap="round" />
                    </svg>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {upscaleOpen && <VideoUpscaleModal key={videoUrl} videoUrl={videoUrl} posterUrl={posterUrl} onClose={() => setUpscaleOpen(false)} />}
    {subtitleOpen && <VideoSubtitleModal key={videoUrl} videoUrl={videoUrl} posterUrl={posterUrl} onClose={() => setSubtitleOpen(false)} />}
    {trimOpen && <VideoTrimModal key={videoUrl} videoUrl={videoUrl} posterUrl={posterUrl} onClose={() => setTrimOpen(false)} />}
    {frameOpen && <VideoFrameModal key={originalVideoUrl || videoUrl} videoUrl={originalVideoUrl || videoUrl} onClose={() => setFrameOpen(false)} />}
    {confirmDelete && (
      <ConfirmDialog
        title="确认删除"
        description="删除后无法恢复，确定要删除这个视频吗？"
        confirmText="确认删除"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete?.();
        }}
        onCancel={() => setConfirmDelete(false)}
        zIndex={1100}
      />
    )}
    {toastVisible && createPortal(
      <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
        <div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]" style={{ whiteSpace: 'nowrap', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
            <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>您已复制提示词</span>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
