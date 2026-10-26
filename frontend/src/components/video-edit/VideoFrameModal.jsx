import { useEffect, useRef } from 'react';
import ImageEditChrome from '../image-edit/ImageEditChrome';
import Button from '../ui/Button';
import LoadingAnimation from '../LoadingAnimation';
import VideoFrameTimeline from './VideoFrameTimeline';
import useFrameSelection from './useFrameSelection';
import useVideoEditSubmission from '../../hooks/useVideoEditSubmission';
import { videoFrameDestination } from '../../utils/VideoFrameDestination';
import './VideoFrame.css';

export default function VideoFrameModal({ videoUrl, originalVideoUrl, sourceAsset, onClose, onSaved, persistToCreation = true, resultDestination = '' }) {
  const canvasRef = useRef(null);
  const destination = useRef(videoFrameDestination(resultDestination || ''));
  const submission = useVideoEditSubmission(sourceAsset, (result) => {
    onSaved?.(result);
    onClose?.();
  }, 'frame_extract');
  const previewUrl = sourceAsset?.preview_video_url || sourceAsset?.previewVideoUrl || videoUrl;
  const state = useFrameSelection(previewUrl, canvasRef, { originalUrl: originalVideoUrl || videoUrl });
  const { times, index, busy, exporting, error, dimensions, thumbnails, requestThumbnails, select, step, download } = state;
  const start = times[0] || 0;
  const end = times.at(-1) || start;
  const time = times[index] || start;
  const disabled = !times.length || exporting || submission.busy;

  useEffect(() => {
    function keydown(event) {
      if (submission.busy) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('textarea,select,[contenteditable="true"],input:not([type="range"])')) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      step(event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
    }
    document.addEventListener('keydown', keydown, true);
    return () => document.removeEventListener('keydown', keydown, true);
  }, [step, submission.busy]);

  return <ImageEditChrome title="视频选帧" onClose={onClose} busy={submission.busy} zIndex={1400}
    footer={<footer className="image-edit-footer frame-footer">
      <Button variant="secondary" disabled={submission.busy} onClick={onClose}>取消</Button>
      <Button variant="secondary" loading={exporting} disabled={busy || Boolean(error) || submission.busy} onClick={download}>下载</Button>
      <Button loading={submission.busy} disabled={disabled || busy || Boolean(error)} onClick={() => submission.submit({ mode: 'frame_extract', timestamp: times[index], resultHref: destination.current, persistToCreation, suppressSuccessToast: Boolean(onSaved) })}>保存</Button>
    </footer>}>
    <div className="frame-body">
      <div className="frame-stage" aria-busy={busy}>
        <canvas ref={canvasRef} aria-label="选中的视频画面" style={{ visibility: dimensions ? 'visible' : 'hidden' }} />
        {(busy || error) && <div className="frame-status" role="status">
          {error || (times.length ? '正在定位画面…' : <div className="frame-reading">
            <LoadingAnimation width={88} />
            <span>正在读取视频</span>
          </div>)}
        </div>}
      </div>
      <div className="frame-controls">
        <div className="frame-toolbar">
          <span>{times.length ? `第 ${index + 1} / ${times.length} 帧` : '—'}</span>
          <span className="frame-keyboard-hint">使用键盘方向键切换上一帧或者下一帧</span>
          <span className="frame-dimensions">{dimensions ? `${dimensions.width} × ${dimensions.height}` : ''}</span>
        </div>
        <VideoFrameTimeline times={times} index={index} dimensions={dimensions} thumbnails={thumbnails} requestThumbnails={requestThumbnails}
          disabled={disabled} onSelect={select} />
        <div className="frame-times"><span>{(time - start).toFixed(3)} 秒</span><span>{(end - start).toFixed(3)} 秒</span></div>
      </div>
    </div>
  </ImageEditChrome>;
}
