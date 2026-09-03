/**
 * @file CreationVideoDetailModal.jsx
 * @structure-index
 *
 * ─── 辅助组件与工具 ─────────────────────────────── L1–L140
 *   formatVideoDuration / ReferenceVideoCard / CopyPromptButton 详情字段与参考素材展示
 *
 * ─── 创作视频详情弹窗 ───────────────────────────── L166–L642
 *   CreationVideoDetailModal                        视频预览、详情信息和操作回调
 *   视频播放区                                      保留创作页播放状态与自动播放逻辑，使用原生 controls 展示控制组件
 *
 * ─── 更新记录 ─────────────────────────────────────
 *   2026-09-03                                       视频控制组件样式对齐分镜详情弹窗，保留创作页业务架构
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
        className="rounded-md overflow-clip h-[84px] w-[calc(47.49%)] bg-[#FFFFFF14] border border-solid border-[#FFFFFF14] cursor-pointer"
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
function CopyPromptButton({ text, onCopy }) {
  const [hovCopy, setHovCopy] = useState(false);
  const [pressCopy, setPressCopy] = useState(false);
  const copyColor = pressCopy ? '#FFFFFF99' : hovCopy ? '#FFFFFFCC' : '#FFFFFF66';
  return (
    <button
      type="button"
      style={{ padding: 0, margin: 0, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: copyColor, transition: 'color 120ms ease', flexShrink: 0 }}
      onMouseEnter={() => setHovCopy(true)}
      onMouseLeave={() => { setHovCopy(false); setPressCopy(false); }}
      onMouseDown={() => setPressCopy(true)}
      onMouseUp={() => setPressCopy(false)}
      onClick={() => {
        navigator.clipboard.writeText(text || '');
        onCopy?.();
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="currentColor" strokeLinejoin="round"/>
      </svg>
    </button>
  );
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
  const [starAnim, setStarAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovClose, setHovClose] = useState(false);
  const [toastVisible] = useState(false);
  const videoRef = useRef(null);

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
    if (vid.paused) { vid.play(); setIsPlaying(true); }
    else { vid.pause(); setIsPlaying(false); }
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
        className="flex flex-col rounded-2xl h-fit [box-shadow:#00000099_-10px_24px_64px] bg-[#161616] border border-solid border-[#FFFFFF14]" style={{ width: `${modalW}px`, height: `${modalH}px`, transform: `scale(${modalScale})`, transformOrigin: 'center center' }}
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
                <button
                  type="button"
                  className="flex items-center justify-center rounded-[50%] relative shrink-0 [backdrop-filter:blur(8px)] bg-[#FFFFFF1F] border border-solid border-[#FFFFFF33] size-[56px]"
                  style={{ cursor: 'pointer' }}
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
              </div>
            </div>
          </div>

          {/* Right: params panel */}
          <div className="w-[280px] flex flex-col min-h-0 h-full shrink-0 bg-[#161616] border-l border-l-solid border-l-[#FFFFFF0F]">
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
                      <div className="flex items-start gap-[12px] self-stretch flex-wrap">
                        {refImages.map((img, i) => {
                          const imgUrl = typeof img === 'string' ? img : (img.url || img.previewUrl || '');
                          return (
                            <AsyncImagePreview
                              key={`${i}-${imgUrl}`}
                              src={imgUrl}
                              alt="参考图"
                              resolveSrc={apiGetLiveMaterialPreviewByRef}
                              style={{ width: '47.49%' }}
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
                      <div className="flex items-start gap-[12px] self-stretch flex-wrap">
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
                      <div className="flex items-start gap-[12px] self-stretch flex-wrap">
                        {refAudios.map((audio, i) => (
                          <div key={i} className="flex flex-col items-start gap-[2px] px-[8px] py-[6px] overflow-clip rounded-lg w-[calc(47.699%)] h-[84px] justify-between bg-[#1D1E1E] border border-solid border-[#FFFFFF14]">
                            <div className="text-[14px] leading-[150%] self-stretch flex-1 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white">
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
                <div className="flex flex-col w-[280px] h-[66px] py-[16px] px-[20px] gap-[4px] shrink-0 bg-[#161616]">
                  <div className="tracking-[0.66px] uppercase font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                    AI 生成时间
                  </div>
                  <div className="tracking-[0.12px] font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF66] text-xs/4">
                    {createdAt}
                  </div>
                </div>
              </>
            )}

              <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
            </div>

            {/* Fixed action buttons at bottom */}
            <div className="flex items-start gap-[16px] w-full box-border bg-[#161616] px-[20px] pt-[16px] pb-[20px] shrink-0 border-t border-t-solid border-t-[#FFFFFF0A]">
              <button
                type="button"
                className="flex items-center justify-center w-full h-[40px] rounded-lg gap-[4px] bg-[#FFFFFF14] border border-solid border-[#FFFFFF1F]"
                style={{ cursor: 'pointer', transform: starAnim ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                onClick={() => {
                  setStarAnim(true);
                  setTimeout(() => setStarAnim(false), 300);
                  onFavorite?.();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: '0' }}>
                  <path d="M8 1.667L5.962 5.826L1.333 6.497L4.686 9.775L3.885 14.333L8 12.14L12.115 14.333L11.32 9.775L14.667 6.497L10.064 5.826L8 1.667Z"
                    fill={favorited ? '#F0B429' : 'none'}
                    stroke={favorited ? '#F0B429' : '#FFFFFF99'}
                    strokeLinejoin="round" />
                </svg>
                <div className="tracking-[0.13px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[13px]/4">
                  收藏
                </div>
              </button>
              <button
                type="button"
                className="flex items-center justify-center w-full h-[40px] rounded-lg gap-[4px] bg-[#FFFFFF14] border border-solid border-[#FFFFFF1F]"
                style={{ cursor: 'pointer' }}
                onClick={onDownload}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: '0' }}>
                  <path d="M8.003 11.3V2" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14H12" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="tracking-[0.13px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[13px]/4">
                  下载
                </div>
              </button>
              <button
                type="button"
                className="flex items-center justify-center w-full h-[40px] rounded-lg gap-[4px] bg-[#FFFFFF14] border border-solid border-[#FFFFFF1F]"
                style={{ cursor: 'pointer' }}
                onClick={() => setConfirmDelete(true)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: '0' }}>
                  <path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF99" strokeLinejoin="round" />
                  <path d="M6.667 6.667V11" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9.333 6.667V11" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M1.333 3.333H14.667" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF99" strokeLinejoin="round" />
                </svg>
                <div className="tracking-[0.13px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[13px]/4">
                  删除
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
