import { useEffect, useRef, useState } from 'react';
import ImageEditChrome from '../image-edit/ImageEditChrome';
import { QualityOption, UpscaleFooter } from '../image-edit/UpscaleControls';
import VideoPlaybackControls from '../ui/VideoPlaybackControls';
import { showGlobalToast } from '../../stores/toastStore';
import '../image-edit/Upscale.css';

const QUALITY_OPTIONS = ['1080P', '2K', '4K'];

export default function VideoUpscaleModal({ videoUrl, posterUrl = '', onClose }) {
  const [quality, setQuality] = useState('1080P');
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState('');
  const videoRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(feedbackTimerRef.current), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return undefined;

    const playVideo = () => {
      video.play().catch(() => {
        // 浏览器阻止自动播放时保留暂停状态，用户仍可通过播放控件启动。
      });
    };
    video.addEventListener('canplay', playVideo, { once: true });
    if (video.readyState >= 3) playVideo();
    return () => video.removeEventListener('canplay', playVideo);
  }, [videoUrl]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    const nextPlaying = video.paused;
    clearTimeout(feedbackTimerRef.current);
    setIsPlaying(nextPlaying);
    setFeedbackVisible(true);
    feedbackTimerRef.current = setTimeout(() => setFeedbackVisible(false), 500);
    if (nextPlaying) video.play().catch(() => { setIsPlaying(false); setFeedbackVisible(false); });
    else video.pause();
  }

  function submit() {
    if (!videoUrl) {
      showGlobalToast('未找到可用视频，请关闭后重试', 'error');
      return;
    }
    showGlobalToast(`已选择${quality}视频智能超清，生成服务暂未接入`, 'info');
    onClose?.();
  }

  return <ImageEditChrome title="智能超清" onClose={onClose} zIndex={1400} footer={<UpscaleFooter onClose={onClose} onSubmit={submit} disabled={!videoUrl || failed} />}>
    <div className="upscale-body">
      <div className="upscale-stage">
        {videoUrl && !failed ? <>
          <video ref={videoRef} src={videoUrl} poster={posterUrl || undefined} preload="metadata" playsInline controls autoPlay muted
            onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)}
            onError={() => setFailed(true)}
            onLoadedMetadata={(event) => setDimensions(`${event.currentTarget.videoWidth} × ${event.currentTarget.videoHeight}`)}
          />
          <VideoPlaybackControls isPlaying={isPlaying} feedbackVisible={feedbackVisible} onToggle={togglePlay} />
        </> : <span role="status">视频加载失败，请关闭后重试</span>}
      </div>
      <div className="upscale-toolbar">
        <span className="upscale-current-quality">当前画质：{dimensions || '未知'}</span>
        <div className="upscale-quality-options" role="group" aria-label="选择输出画质">
          {QUALITY_OPTIONS.map((value) => <QualityOption key={value} value={value} selected={quality === value} onClick={setQuality} />)}
        </div>
      </div>
    </div>
  </ImageEditChrome>;
}
