import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import MediaLoadStatus from '../feedback/MediaLoadStatus';
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton } from '../ui';
import ConfirmDialog from '../ConfirmDialog';
import { useModalSize } from '../../utils/useModalSize';
import './FinalVideoDetailModal.css';

function formatCreatedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date).replaceAll('/', '-');
}

/** 成片仅供查看和管理，不接入创作视频的任何编辑流程。 */
export default function FinalVideoDetailModal({ asset, onClose, onDownload, onDelete }) {
  const { width, height, scale } = useModalSize();
  const videoRef = useRef(null);
  const media = useMediaPlayback(videoRef, asset.videoUrl, { autoPlay: true });
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const duration = asset.duration == null || asset.duration === ''
    ? '' : /s$/i.test(String(asset.duration)) ? asset.duration : `${asset.duration}s`;
  const params = [
    ['画面比例', asset.ratio], ['分辨率', asset.resolution], ['时长', duration],
    ['声音', asset.sound == null ? '' : asset.sound ? '有' : '无'],
  ].filter(([, value]) => value !== '' && value != null);

  return <>
    <div className="final-video-detail-backdrop" onClick={onClose}>
      <section
        role="dialog" aria-modal="true" aria-labelledby="final-video-detail-title"
        className="final-video-detail"
        style={{ width, height, transform: `scale(${scale})` }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === 'Escape' && !confirmDelete) onClose(); }}
      >
        <header className="final-video-detail-header">
          <h2 id="final-video-detail-title">查看详情</h2>
          <IconButton variant="link" size="small" aria-label="关闭" onClick={onClose} icon={<X size={16} />}
            contentClassName="!text-text-secondary group-hover:!text-text-primary group-active:!text-text-primary"
          />
        </header>
        <div className="final-video-detail-body">
          <div className="final-video-detail-player"
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          >
            {asset.videoUrl ? <video
              ref={videoRef} src={asset.videoUrl}
              poster={asset.posterUrl || asset.url || undefined}
              controls={hovered} playsInline preload="metadata"
              aria-label="成片视频"
              onFocus={() => setHovered(true)}
              onBlur={() => setHovered(false)}
              onTouchStart={() => setHovered(true)}
            /> : null}
            {asset.videoUrl && <MediaLoadStatus visual loadingVariant="spinner" {...media} onPause={media.pause} onRetry={media.retry} onPlay={() => media.play()} />}
          </div>
          <aside className="final-video-detail-info">
            <div className="final-video-detail-scroll">
              <section className="final-video-detail-section">
                <p className="final-video-detail-name">{asset.name || '—'}</p>
              </section>
              <section className="final-video-detail-section">
                <h3>成片参数</h3>
                <dl>{params.map(([label, value]) => <div className="final-video-detail-row" key={label}>
                  <dt>{label}</dt><dd>{value}</dd>
                </div>)}</dl>
              </section>
              <section className="final-video-detail-section final-video-detail-row">
                <h3>创建时间</h3><span>{formatCreatedAt(asset.createdAt || asset.created_at)}</span>
              </section>
            </div>
            <footer className="final-video-detail-actions">
              <Button variant="secondary" onClick={onDownload}>下载</Button>
              <Button variant="secondary" onClick={() => { media.pause(); setConfirmDelete(true); }}>删除</Button>
            </footer>
          </aside>
        </div>
      </section>
    </div>
    {confirmDelete && <ConfirmDialog
      title="确认删除" description="删除后无法恢复，确定要删除这个成片吗？" confirmText="确认删除"
      onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
      onCancel={() => setConfirmDelete(false)} zIndex={1100}
    />}
  </>;
}
