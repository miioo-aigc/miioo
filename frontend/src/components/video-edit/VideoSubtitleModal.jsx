import { useEffect, useRef, useState } from 'react';
import ImageEditChrome from '../image-edit/ImageEditChrome';
import Button from '../ui/Button';
import useVideoEditSubmission from '../../hooks/useVideoEditSubmission';
import VideoEditComparison from './VideoEditComparison';
import SubtitleMask from './SubtitleMask';
import { DEFAULT_SUBTITLE_MASK } from './SubtitleMaskGeometry';
import './VideoSubtitle.css';

export default function VideoSubtitleModal({ videoUrl, posterUrl = '', sourceAsset, onClose, onCloseDetail }) {
  const submission = useVideoEditSubmission(sourceAsset, undefined, 'subtitle_remove');
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const [source, setSource] = useState({ width: 0, height: 0 });
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [subtitleMask, setSubtitleMask] = useState(DEFAULT_SUBTITLE_MASK);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const available = Boolean(videoUrl && ready && !failed && source.width && source.height);
  const scale = source.width && source.height ? Math.min(area.width / source.width, Math.max(0, area.height - 64) / source.height) : 0;

  useEffect(() => {
    const stage = stageRef.current;
    const measure = () => setArea({ width: stage.clientWidth, height: stage.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  function close() {
    videoRef.current?.pause();
    onClose();
    if (submission.active) onCloseDetail?.();
  }

  function submit() {
    if (!available) return;
    submission.submit({ mode: 'subtitle_remove', duration: videoRef.current?.duration, region: { ...subtitleMask } });
  }

  return <ImageEditChrome title="去字幕" onClose={close} busy={submission.busy} allowCloseWhileBusy zIndex={1400} footer={
    <footer className="subtitle-footer">
      <Button variant="secondary" size="large" onClick={close}>关闭</Button>
      <Button variant="primary" size="large" onClick={submit} loading={submission.busy} disabled={!available || submission.busy}>AI生成</Button>
    </footer>
  }>
    <div className="subtitle-body">
      <VideoEditComparison submission={submission} onRetry={() => submission.submit({ mode: 'subtitle_remove' })}>
      <div ref={stageRef} className="subtitle-stage">
        {videoUrl && !failed ? <>
          <video className="subtitle-source-video" ref={videoRef} src={videoUrl} poster={posterUrl || undefined} autoPlay muted controls playsInline preload="auto"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              setSource({ width: video.videoWidth, height: video.videoHeight });
            }}
            onLoadedData={() => setReady(true)} onError={() => setFailed(true)}
          />
          {available && <div className="subtitle-mask-area">
            <div ref={frameRef} className="subtitle-frame" style={{ width: source.width * scale, height: source.height * scale }} inert={submission.busy}>
              <SubtitleMask value={subtitleMask} onChange={setSubtitleMask} frameRef={frameRef} />
            </div>
          </div>}
        </> : <span role="status">视频加载失败，请关闭后重试</span>}
      </div>
      </VideoEditComparison>
    </div>
  </ImageEditChrome>;
}
