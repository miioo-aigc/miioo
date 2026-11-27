import { Play, RefreshCw, LoaderCircle, TriangleAlert } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import DotsLoading from '../DotsLoading';

/** 2026-10-30：像素加载统一替换为青色圆点；保留占位、失败刷新与播放入口。 */
export default function VisualMediaStatus({ status, requiresClick, onRetry, onPlay, overlay = true, loadingVariant = 'dots', showRetry = true }) {
  if (status !== 'loading' && status !== 'error' && !requiresClick) return null;
  const loading = status === 'loading';
  const action = loading ? undefined : status === 'error' ? (showRetry ? onRetry : undefined) : onPlay;
  const label = status === 'error' ? '重新加载媒体' : '播放媒体';
  const Icon = status === 'error' ? RefreshCw : Play;
  const showStaticError = status === 'error' && !showRetry;
  return <div className="nodrag nopan" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    style={{ ...(overlay ? { position: 'absolute', inset: 0, zIndex: 2 } : { position: 'relative', width: '100%', height: '40px', flexShrink: 0 }), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 'inherit' }}>
    {loading && (loadingVariant === 'spinner'
      ? <span role="status" aria-label="视频缓冲中"><LoaderCircle size={24} className="animate-spin motion-reduce:animate-none text-white-80" aria-hidden="true" /></span>
      : <div role="status" aria-label="媒体加载中" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'inherit', pointerEvents: 'none', background: 'var(--color-surface-card)' }}>
          <DotsLoading size={5} color="var(--color-brand-main)" gap={4} />
        </div>)}
    {showStaticError && <span role="status" aria-label="媒体加载失败" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--color-text-hint)', fontSize: '12px', lineHeight: '16px', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}><TriangleAlert size={20} aria-hidden="true" />媒体加载失败</span>}
    {action && <IconButton variant="secondary" aria-label={label} onClick={action} style={{ position: 'relative', zIndex: 1 }}><Icon size={16} aria-hidden="true" /></IconButton>}
  </div>;
}
