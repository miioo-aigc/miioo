import { useEffect, useRef, useState } from 'react';
import ImageEditChrome from '../image-edit/ImageEditChrome';
import Button from '../ui/Button';
import LoadingAnimation from '../LoadingAnimation';
import VideoFrameTimeline from './VideoFrameTimeline';
import useFrameSelection from './useFrameSelection';
import useVideoEditSubmission from '../../hooks/useVideoEditSubmission';
import { videoFrameDestination } from '../../utils/VideoFrameDestination';
import './VideoFrame.css';
import { resolveFrameOriginalUrl } from './FrameOriginalSource';
import { showGlobalToast } from '../../stores/toastStore';

export default function VideoFrameModal({ videoUrl, originalVideoUrl, sourceAsset, onClose, onSaved, persistToCreation = true, resultDestination = '' }) {
  const canvasRef = useRef(null);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const destination = useRef(videoFrameDestination(resultDestination || ''));
  // 2026-10-28：等待宿主完成分镜候选保存，失败时保留选帧弹窗。
  const submission = useVideoEditSubmission(sourceAsset, async (result) => {
    setSavingCandidate(true);
    try {
      if (await onSaved?.(result) !== false) onClose?.();
    } catch (error) {
      showGlobalToast(error.message || '选帧图片保存失败，请重试', 'error');
    } finally {
      setSavingCandidate(false);
    }
  }, 'frame_extract');
  const saving = submission.busy || savingCandidate;
  const previewUrl = sourceAsset?.preview_video_url || sourceAsset?.previewVideoUrl || videoUrl;
  const originalUrl = resolveFrameOriginalUrl({ originalVideoUrl, videoUrl, sourceAsset });
  const state = useFrameSelection(previewUrl, canvasRef, {
    originalUrl,
    onExport: (_blob, _index, timestamp) => submission.submit({ mode: 'frame_extract', timestamp, resultHref: destination.current, persistToCreation, suppressSuccessToast: Boolean(onSaved) }),
  });
  const { times, index, busy, exporting, error, dimensions, thumbnails, requestThumbnails, select, step, download, exportFrame, exportPurpose } = state;
  const start = times[0] || 0;
  const end = times.at(-1) || start;
  const time = times[index] || start;
  const disabled = !times.length || exporting || saving;

  useEffect(() => {
    function keydown(event) {
      if (saving) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('textarea,select,[contenteditable="true"],input:not([type="range"])')) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      step(event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
    }
    document.addEventListener('keydown', keydown, true);
    return () => document.removeEventListener('keydown', keydown, true);
  }, [step, saving]);

  return <ImageEditChrome title="视频选帧" onClose={onClose} busy={saving} zIndex={1400}
    footer={<footer className="image-edit-footer frame-footer">
      <Button variant="secondary" disabled={saving} onClick={onClose}>取消</Button>
      <Button variant="secondary" loading={exporting && exportPurpose === 'download'} disabled={disabled || busy || Boolean(error)} onClick={download}>下载</Button>
      <Button loading={saving || (exporting && exportPurpose === 'prepare')} disabled={disabled || busy || Boolean(error)} onClick={exportFrame}>保存</Button>
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
        </div>
        <VideoFrameTimeline times={times} index={index} dimensions={dimensions} thumbnails={thumbnails} requestThumbnails={requestThumbnails}
          disabled={disabled} onSelect={select} />
        <div className="frame-times"><span>{(time - start).toFixed(3)} 秒</span><span>{(end - start).toFixed(3)} 秒</span></div>
      </div>
    </div>
  </ImageEditChrome>;
}
