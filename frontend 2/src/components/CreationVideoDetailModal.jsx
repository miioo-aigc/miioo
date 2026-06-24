import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import ConfirmDialog from './ConfirmDialog';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// ConfirmDeleteModal 已迁移至 ConfirmDialog 共享组件

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
 * @param {string} props.prompt - 提示词
 * @param {string} props.model - 模型名称
 * @param {string} props.ratio - 画面比例
 * @param {string} props.resolution - 分辨率
 * @param {string} props.duration - 时长
 * @param {string} props.refMode - 参考模式
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
  prompt = '',
  promptHTML = '',
  model = '',
  ratio = '16:9',
  resolution = '',
  duration = '',
  refMode = '',
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
  console.log('CreationVideoDetailModal props:', { videoUrl, prompt, model, ratio, resolution, duration });

  if (!videoUrl) {
    console.error('CreationVideoDetailModal: videoUrl is missing!');
  }

  const { width: modalW } = useModalSize();
  const [isPlaying, setIsPlaying] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [hovClose, setHovClose] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);
  const isDraggingRef = useRef(false);

  function handleCopyPrompt() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

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
    const onLoaded = () => {
      setVideoDuration(vid.duration);
      vid.volume = volume;
      console.log('Video loaded:', vid.duration, vid.videoWidth, vid.videoHeight);
    };
    const onEnded = () => setIsPlaying(false);
    const onError = (e) => {
      console.error('Video error:', e, vid.error);
    };

    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('loadedmetadata', onLoaded);
    vid.addEventListener('ended', onEnded);
    vid.addEventListener('error', onError);

    return () => {
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('loadedmetadata', onLoaded);
      vid.removeEventListener('ended', onEnded);
      vid.removeEventListener('error', onError);
    };
  }, [volume, videoUrl]);

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
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      console.log('Volume set to:', v);
    }
  }

  const progressPct = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

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
        className="flex flex-col rounded-2xl h-fit [box-shadow:#00000099_-10px_24px_64px] bg-[#161616] border border-solid border-[#FFFFFF14]" style={{ width: `${modalW}px` }}
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
        <div className="flex grow shrink basis-[0%] h-[540px]">
          {/* Left: video player */}
          <div className="flex flex-col grow shrink basis-[0%] min-w-0 min-h-0 bg-[#0D0D0D]">
            <div className="grow shrink basis-[0%] flex items-center justify-center min-h-0 bg-[#0A0A0A]">
              <div className="w-full aspect-video flex items-center justify-center overflow-clip self-stretch relative" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(21.8% 0 0) 0%, oklab(17.8% 0 0) 100%)' }}>
                {/* Real video element */}
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                    preload="metadata"
                    playsInline
                    onClick={togglePlay}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF66', fontFamily: FONT, fontSize: '14px' }}>
                    视频加载失败
                  </div>
                )}
                <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 40%, oklab(0% 0 0 / 40%) 100%)' }} />
                {!isPlaying && (
                <button
                  type="button"
                  className="flex items-center justify-center rounded-[50%] relative shrink-0 [backdrop-filter:blur(8px)] bg-[#FFFFFF1F] border border-solid border-[#FFFFFF33] size-[56px]"
                  style={{ cursor: 'pointer' }}
                  onClick={togglePlay}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: '0' }}>
                    <path d="M7 5L16 10L7 15V5Z" fill="#FFFFFF" />
                  </svg>
                </button>
                )}
              </div>
            </div>
            {/* Controls bar */}
            <div className="flex flex-col shrink-0 pt-[14px] pb-[16px] gap-[10px] bg-[#111111] px-[16px]">
              <div className="flex items-center justify-between gap-[24px]">
                <div className="flex items-center gap-[16px]">
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-[50%] shrink-0 bg-[#FFFFFF1A] border border-solid border-[#FFFFFF26] size-[32px]"
                    style={{ cursor: 'pointer' }}
                    onClick={togglePlay}
                  >
                    {isPlaying ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <rect x="2" y="2" width="3" height="10" rx="0.5" fill="#FFFFFF" />
                        <rect x="9" y="2" width="3" height="10" rx="0.5" fill="#FFFFFF" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: '0' }}>
                        <path d="M5 3L12 7L5 11V3Z" fill="#FFFFFF" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-[10px] flex-1">
                  <div className="tracking-[0.01em] shrink-0 w-[36px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-xs/4">
                    {fmtTime(currentTime)}
                  </div>
                  <div
                    ref={progressBarRef}
                    className="grow shrink basis-[0%] h-[3px] rounded-xs bg-[#FFFFFF1F]"
                    style={{ cursor: 'pointer' }}
                    onMouseDown={handleProgressMouseDown}
                  >
                    <div className="h-full rounded-xs relative bg-[#FFFFFFB3]" style={{ width: `${progressPct}%` }}>
                      <div className="-right-[5px] top-[50%] rounded-[50%] absolute [box-shadow:#00000080_0px_0px_4px] bg-white size-[10px]" style={{ translate: '0px -50%' }} />
                    </div>
                  </div>
                  <div className="tracking-[0.01em] shrink-0 w-[36px] text-right inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF40] text-xs/4">
                    {fmtTime(videoDuration)}
                  </div>
                </div>
                <div className="flex items-center gap-[8px]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: '0.4', flexShrink: '0' }}>
                    <path d="M3 6H1V10H3L7 13V3L3 6Z" fill="#FFFFFF" />
                    <path d="M10 5C11.1 6.1 11.1 9.9 10 11M12.5 3C14.7 5.2 14.7 10.8 12.5 13" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <div
                    ref={volumeBarRef}
                    className="w-[60px] h-[3px] rounded-xs shrink-0 bg-[#FFFFFF1F]"
                    style={{ cursor: 'pointer' }}
                    onClick={handleVolumeClick}
                  >
                    <div className="h-full rounded-xs bg-[#FFFFFF99]" style={{ width: `${volume * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: params panel */}
          <div className="w-[280px] flex flex-col min-h-[unset] h-[540px] shrink-0 bg-[#161616] border-l border-l-solid border-l-[#FFFFFF0F]">
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
            {refMode === 'frame' ? (
              <>
                <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
                <div className="flex py-[16px] px-[20px] gap-[12px]">
                  <div className="flex flex-col items-start gap-[12px] flex-1 h-fit">
                    <div className="tracking-[0.66px] uppercase inline-block self-stretch font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                      首帧
                    </div>
                    <div className="rounded-md overflow-clip flex flex-col items-center gap-0 justify-center h-[84px] self-stretch shrink-0 bg-[#FFFFFF14] border border-solid border-[#FFFFFF14] p-0">
                      {firstFrame ? (
                        <div className="w-full h-full shrink-0 bg-cover bg-[center]" style={{ backgroundImage: `url(${firstFrame})` }} />
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
                      {lastFrame ? (
                        <div className="w-full h-full shrink-0 bg-cover bg-[center]" style={{ backgroundImage: `url(${lastFrame})` }} />
                      ) : (
                        <div className="font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF40] text-[12px]">无</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (refImages.length > 0 || refVideos.length > 0 || refAudios.length > 0) && (
              <>
                <div className="h-px shrink-0 bg-[#FFFFFF0A] my-0 mx-[20px]" />
                <div className="flex flex-col py-[16px] px-[20px] gap-[12px]">
                  <div className="tracking-[0.66px] uppercase inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[11px]/[14px]">
                    参考
                  </div>
                  <div className="flex items-start gap-[12px] self-stretch flex-wrap">
                    {refImages.map((img, i) => {
                      const imgUrl = typeof img === 'string' ? img : (img.url || img.previewUrl || '');
                      return (
                        <div key={i} className="rounded-md overflow-clip h-[84px] w-[calc(47.49%)] bg-[#FFFFFF14] border border-solid border-[#FFFFFF14]">
                          <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${imgUrl})` }} />
                        </div>
                      );
                    })}
                    {refVideos.map((vid, i) => {
                      const vidUrl = typeof vid === 'string' ? vid : (vid.url || vid.previewUrl || '');
                      return (
                        <div key={i} className="rounded-md overflow-clip flex flex-col items-center gap-0 justify-center h-[84px] w-[calc(47.49%)] relative bg-[#FFFFFF14] border border-solid border-[#FFFFFF14] p-0">
                          <video src={vidUrl} className="w-[93px] h-[144px] shrink-0 object-cover" />
                          <div className="flex items-center justify-center rounded-[50%] absolute left-[50%] top-[50%] [backdrop-filter:blur(8px)] bg-[#0000001F] border border-solid border-[#FFFFFF33] size-[32px]" style={{ translate: '-50% -50%' }}>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: '0' }}>
                              <path d="M7 5L16 10L7 15V5Z" fill="#FFFFFF" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
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
              {refMode && (
                <div className="flex items-center justify-between">
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-xs/4">
                    参考模式
                  </div>
                  <div className="tracking-[0.12px] inline-block font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-xs/4">
                    {refMode === 'frame' ? '首尾帧' : refMode}
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
                    {duration}
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
            <div className="pb-[20px] flex items-start gap-[16px] w-[280px] bg-[#161616] px-[20px] shrink-0">
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
