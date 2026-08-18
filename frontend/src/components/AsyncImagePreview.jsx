import { useEffect, useState } from 'react';
import DotsLoading from './DotsLoading';

/**
 * 固定尺寸的图片预览槽：图片网络加载不影响父级信息区的结构。
 */
export default function AsyncImagePreview({ src, alt = '', style, resolveSrc }) {
  const [resolution, setResolution] = useState(() => ({
    source: src,
    resolvedSrc: resolveSrc ? '' : src,
    status: src ? 'loading' : 'error',
  }));
  const isCurrentSource = resolution.source === src;
  const status = isCurrentSource ? resolution.status : (src ? 'loading' : 'error');
  const resolvedSrc = isCurrentSource ? resolution.resolvedSrc : '';

  useEffect(() => {
    let cancelled = false;
    if (!src) return undefined;

    Promise.resolve(resolveSrc ? resolveSrc(src) : src)
      .then((nextSrc) => {
        if (cancelled) return;
        setResolution({
          source: src,
          resolvedSrc: nextSrc || '',
          status: nextSrc ? 'loading' : 'error',
        });
      })
      .catch(() => {
        if (!cancelled) {
          setResolution({ source: src, resolvedSrc: '', status: 'error' });
        }
      });

    return () => { cancelled = true; };
  }, [resolveSrc, src]);

  return (
    <div
      style={{
        position: 'relative',
        width: 'calc(50% - 6px)',
        height: '84px',
        borderRadius: '6px',
        border: '1px solid #FFFFFF14',
        backgroundColor: '#FFFFFF14',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      {status === 'loading' && (
        <div aria-label="图片加载中" role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DotsLoading size={4} color="#2DC3E1" gap={3} />
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF66', fontSize: '12px', backgroundColor: '#FFFFFF0A' }}>
          图片加载失败
        </div>
      )}
      {resolvedSrc && (
        <img
          src={resolvedSrc}
          alt={alt}
          onLoad={() => setResolution((previous) => ({ ...previous, status: 'loaded' }))}
          onError={() => setResolution((previous) => ({ ...previous, status: 'error' }))}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: status === 'loaded' ? 1 : 0 }}
        />
      )}
    </div>
  );
}
