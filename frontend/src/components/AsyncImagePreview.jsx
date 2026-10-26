import VisualMediaStatus from './feedback/VisualMediaStatus';
import { useEffect, useRef, useState } from 'react';
import DotsLoading from './DotsLoading';
import { TextButton } from './ui/TextButton';
import { createImagePreviewLoad } from '../utils/ImagePreviewLoad';

/** 固定预览槽；换源重建会话，图片加载与生成任务状态独立。 */
export default function AsyncImagePreview(props) {
  return <ImagePreviewSession key={[props.src, props.fallbackSrc].join('|')} {...props} />;
}

function ImagePreviewSession({ src, alt = '', style, imageStyle, imageClassName, fallbackSrc, decorative = false, onMouseDown, resolveSrc, plain = false, visual = false }) {
  const [resolution, setResolution] = useState({ status: src ? 'loading' : 'error' });
  const loader = useRef(null);
  useEffect(() => {
    if (!src) return undefined;
    const session = createImagePreviewLoad({ src, fallbackSrc, resolveSrc, onChange: setResolution });
    loader.current = session;
    queueMicrotask(session.start);
    return () => session.dispose();
  }, [src, fallbackSrc, resolveSrc]);
  const { status, resolvedSrc, message } = resolution;
  return (
    <div onMouseDown={onMouseDown} style={{
      position: 'relative', width: plain ? '100%' : 'calc(50% - 6px)',
      height: plain ? '100%' : '84px', borderRadius: plain ? 0 : '6px',
      border: plain ? 'none' : '1px solid var(--color-stroke-normal)',
      backgroundColor: plain ? 'transparent' : 'var(--color-stroke-normal)',
      overflow: 'hidden', flexShrink: 0, ...style,
    }}>
      {visual && <VisualMediaStatus status={status} onRetry={src && !decorative ? () => loader.current?.retry() : undefined} />}
      {!visual && status === 'loading' && (
        <div aria-label="图片加载中" role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DotsLoading size={4} color="var(--color-brand-main)" gap={3} />
        </div>
      )}
      {!visual && status === 'error' && (
        <div className="text-text-hint text-font-size-12" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
          <span role="status">{message || '图片加载失败'}</span>
          {src && !decorative && <TextButton size="small" variant="link" aria-label={alt ? '重试' + alt : '重试图片'} className="nodrag nopan" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); loader.current?.retry(); }}>重试</TextButton>}
        </div>
      )}
      {resolvedSrc && status !== 'error' && (
        <img className={imageClassName} draggable={false} key={resolution.attempt} src={resolvedSrc} alt={alt}
          onLoad={resolution.onLoad} onError={resolution.onError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...imageStyle, opacity: status === 'loaded' ? 1 : 0 }} />
      )}
    </div>
  );
}
