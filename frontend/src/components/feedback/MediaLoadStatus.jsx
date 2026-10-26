import VisualMediaStatus from './VisualMediaStatus';
import { TextButton } from '../ui/TextButton';

/** 媒体局部反馈；所有动作由媒体会话持有。 */
export default function MediaLoadStatus({ status, message, requiresClick, onRetry, onPlay, onPause, overlay = true, visual = false, showLoading = true }) {
  if (!showLoading && status === 'loading') return null;
  if (visual) return <VisualMediaStatus {...{ status, requiresClick, onRetry, onPlay, onPause, overlay }} />;
  if (status !== 'loading' && status !== 'error' && !requiresClick) return null;
  return <div onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} className="nodrag nopan text-text-secondary text-font-size-12" style={{ ...(overlay ? { position: 'absolute', inset: 0, zIndex: 2, background: 'var(--color-surface-overlay)' } : {}), display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }} onClick={e => e.stopPropagation()}>
    <span role="status">{status === 'loading' ? '媒体加载中…' : message || '请点击播放'}</span>
    {status === 'loading' && onPause && <TextButton size="small" variant="link" onClick={onPause}>取消等待</TextButton>}
    {status === 'error'  && <TextButton size="small" variant="link" onClick={onRetry}>重试</TextButton>}
    {status !== 'loading' && status !== 'error' && requiresClick && <TextButton size="small" variant="link" onClick={onPlay}>播放</TextButton>}
  </div>;
}
