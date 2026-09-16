import { useEffect, useRef } from 'react';
import { Download, StepBack, StepForward } from 'lucide-react';
import ImageEditChrome from '../image-edit/ImageEditChrome';
import Button from '../ui/Button';
import VideoFrameTimeline from './VideoFrameTimeline';
import useFrameSelection from './useFrameSelection';
import { buildVideoEditRequest } from '../../utils/MediaEditRequest';
import { showGlobalToast } from '../../stores/toastStore';
import './VideoFrame.css';

export default function VideoFrameModal({ videoUrl, sourceAsset, onPrepare, onClose }) {
  const canvasRef = useRef(null);
  const state = useFrameSelection(videoUrl, canvasRef, {
    onExport: async (blob, exportedIndex) => {
      try {
        const request = buildVideoEditRequest(sourceAsset, {
          mode: 'frame_extract',
          frame_time_seconds: times[exportedIndex],
          file: new File([blob], `视频选帧-${exportedIndex + 1}.png`, { type: 'image/png' }),
        });
        await onPrepare?.(request);
        showGlobalToast('已准备选帧图片与保存参数，等待后端编辑接口接入', 'info');
      } catch (exportError) {
        showGlobalToast(exportError.message || '选帧参数准备失败，请重试', 'error');
      }
    },
  });
  const { times, index, busy, exporting, error, dimensions, step, seek, download, exportFrame } = state;
  const start = times[0] || 0;
  const end = times.at(-1) || start;
  const time = times[index] || start;
  const disabled = !times.length || exporting;

  useEffect(() => {
    function keydown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('textarea,select,[contenteditable="true"],input:not([type="range"])')) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      event.stopPropagation();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
    document.addEventListener('keydown', keydown, true);
    return () => document.removeEventListener('keydown', keydown, true);
  }, [step]);

  return <ImageEditChrome title="视频选帧" onClose={onClose} zIndex={1400}
    footer={<footer className="image-edit-footer frame-footer">
      <Button variant="secondary" onClick={onClose}>取消</Button>
      <Button loading={exporting} disabled={busy || Boolean(error)} onClick={exportFrame}>准备保存</Button>
      <Button icon={<Download size={16} />} loading={exporting} disabled={busy || Boolean(error)} onClick={download}>下载图片</Button>
    </footer>}>
    <div className="frame-body">
      <div className="frame-stage" aria-busy={busy}>
        <canvas ref={canvasRef} aria-label="选中的视频画面" style={{ visibility: dimensions ? 'visible' : 'hidden' }} />
        {(busy || error) && <div className="frame-status" role="status">{error || (times.length ? '正在定位画面…' : '正在读取视频…')}</div>}
      </div>
      <div className="frame-controls">
        <div className="frame-toolbar">
          <div className="frame-step-buttons">
            <button type="button" className="frame-step-button" aria-label="上一帧" title="上一帧" disabled={disabled || index === 0} onClick={() => step(-1)}><StepBack width={16} height={16} /></button>
            <button type="button" className="frame-step-button" aria-label="下一帧" title="下一帧" disabled={disabled || index >= times.length - 1} onClick={() => step(1)}><StepForward width={16} height={16} /></button>
          </div>
          <span>{times.length ? `第 ${index + 1} / ${times.length} 帧` : '—'}</span>
          <span className="frame-dimensions">{dimensions ? `${dimensions.width} × ${dimensions.height}` : ''}</span>
        </div>
        <VideoFrameTimeline videoUrl={videoUrl} start={start} end={end} time={time} index={index}
          disabled={disabled || times.length < 2} onSeek={seek} />
        <div className="frame-times"><span>{(time - start).toFixed(3)} 秒</span><span>{(end - start).toFixed(3)} 秒</span></div>
      </div>
    </div>
  </ImageEditChrome>;
}
