/** 统一结果浮层：结果、锁定和分页由宿主控制，仅持有媒体预览和定位状态。 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import Radio from '../ui/Radio';
import { Button, ModalCloseButton } from '../ui';
import CanvasAudioPlayer from './CanvasAudioPlayer';
import MediaLoadStatus from '../feedback/MediaLoadStatus';
import { getCanvasCurrentResult, getCanvasResultHistory } from './CanvasNodeResults.js';
import './CanvasNodeResultsPopover.css';

const stop = event => event.stopPropagation();

/** props 完整契约见 docs/节点结果浮层初版设计-2026-11-06.md。 */
export default function CanvasNodeResultsPopover({
  open = false, results, nodeName = '节点', anchorRect, returnFocusRef,
  mediaByResultId = {}, generating = false, editing = false, upstreamProtected = false,
  selectionPending = false, selectionError = '', loading = false, error = '',
  hasMore = false, loadingMore = false, loadMoreError = '',
  onClose, onSelect, onLoadMore, onRetry, onRetryMedia,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const lockId = useId();
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const lockReason = upstreamProtected ? '操作可能导致下游丢失参考素材，请稍后再试'
    : generating ? '生成中，暂不能切换当前结果'
      : editing ? '编辑中，暂不能切换当前结果'
        : selectionPending ? '正在设置当前结果' : '';

  useLayoutEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    const place = () => {
      if (!panel) return;
      const bounds = window.visualViewport;
      const leftEdge = (bounds?.offsetLeft || 0) + 12;
      const topEdge = (bounds?.offsetTop || 0) + 12;
      const rightEdge = (bounds?.offsetLeft || 0) + (bounds?.width || window.innerWidth) - 12;
      const bottomEdge = (bounds?.offsetTop || 0) + (bounds?.height || window.innerHeight) - 12;
      const maxWidth = Math.max(0, rightEdge - leftEdge);
      const maxHeight = Math.max(0, Math.min(600, bottomEdge - topEdge));
      // 先限制实际尺寸再测量，定位和尺寸使用同一个可视视口。
      panel.style.maxWidth = maxWidth + 'px';
      panel.style.maxHeight = maxHeight + 'px';
      const { width, height } = panel.getBoundingClientRect();
      const right = (anchorRect?.right ?? anchorRect?.left ?? leftEdge) + 8;
      const left = right + width <= rightEdge ? right : (anchorRect?.left ?? leftEdge) - width - 8;
      const top = anchorRect?.top ?? topEdge;
      setPosition(previous => {
        const next = { left: Math.max(leftEdge, Math.min(left, rightEdge - width)),
          top: Math.max(topEdge, Math.min(top, bottomEdge - height)), maxWidth, maxHeight };
        return Object.keys(next).every(key => previous[key] === next[key]) ? previous : next;
      });
    };
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (panel) observer?.observe(panel);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open, anchorRect?.left, anchorRect?.top, anchorRect?.right]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = returnFocusRef?.current || document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    };
    document.addEventListener('keydown', close, true);
    return () => document.removeEventListener('keydown', close, true);
  }, [open, onClose]);

  if (!open) return null;
  const batches = getCanvasResultHistory(results);
  const items = batches.flatMap(batch => batch.results);
  const current = getCanvasCurrentResult(results);
  const switchingDisabled = Boolean(lockReason) || typeof onSelect !== 'function';
  return createPortal(
    <div ref={panelRef} role="dialog" aria-modal="false" aria-labelledby={titleId}
      aria-describedby={lockReason ? lockId : undefined} tabIndex={-1}
      className="canvas-results-popover nodrag nopan nowheel" style={position}
      onPointerDown={stop} onPointerMove={stop} onPointerUp={stop} onMouseDown={stop}
      onTouchStart={stop} onTouchMove={stop} onClick={stop} onDoubleClick={stop}
      onWheel={stop} onKeyDown={stop} onKeyUp={stop} onContextMenu={stop}
      onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>
      <header className="canvas-results-popover__header">
        <h2 id={titleId}>{nodeName}</h2>
        <ModalCloseButton onClick={onClose} />
      </header>
      <div className="canvas-results-popover__scroll" aria-busy={loading || loadingMore}>
        {lockReason && <p id={lockId} role="status">{lockReason}</p>}
        {selectionError && <p role="alert" className="canvas-results-popover__error">{selectionError}</p>}
        {loading ? <p role="status">结果加载中…</p> : error ? <div role="alert">
          <p className="canvas-results-popover__error">{error}</p>
          {onRetry && <Button size="small" variant="secondary" icon={<RefreshCw size={14} />} onClick={onRetry}>重试加载</Button>}
        </div> : <>
          {!batches.length && <p role="status">暂无结果</p>}
          {batches.filter(batch => batch.status === 'partial').map(batch =>
            <p key={batch.id} role="status">部分成功 {batch.results.length}/{batch.requestedCount}</p>)}
          {items.length > 0 && <div className={items[0]?.type === 'text' ? 'canvas-results-popover__list' : 'canvas-results-popover__grid'}>
              {items.map(result => <ResultItem key={result.id} result={result} groupName={titleId}
                current={result.id === current?.id} media={mediaByResultId[result.id]}
                disabled={switchingDisabled} lockReason={lockReason} onSelect={onSelect} onRetryMedia={onRetryMedia} />)}
          </div>}
          {loadMoreError && <p role="alert" className="canvas-results-popover__error">{loadMoreError}</p>}
          {loadingMore && <p role="status">正在加载更多结果…</p>}
          {(hasMore || loadMoreError) && <Button size="small" variant="secondary" disabled={loadingMore || !onLoadMore}
            onClick={onLoadMore} icon={loadMoreError ? <RefreshCw size={14} /> : undefined}>
            {loadMoreError ? '重试加载更多' : '加载更多结果'}
          </Button>}
        </>}
      </div>
    </div>, document.body,
  );
}

function ResultItem(props) {
  // 换源即开启新会话，旧地址的加载状态不能污染新地址。
  return <ResultPreview key={props.media?.status + ':' + props.media?.src} {...props} />;
}

function ResultPreview({ result, current, media, disabled, lockReason, onSelect, onRetryMedia, groupName }) {
  const [previewStatus, setPreviewStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const text = result.type === 'text';
  const available = text || (media?.status === 'ready' && Boolean(media.src));
  const ready = text || (available && previewStatus === 'ready');
  const failed = media?.status === 'error' || (available && previewStatus === 'error');
  const message = failed ? media?.message || '素材加载失败' : media?.status === 'loading' ? '素材解析中…' : '素材不可用';
  const retry = () => {
    setPreviewStatus('loading');
    setAttempt(value => value + 1);
    onRetryMedia?.(result.id);
  };
  const label = (text ? '文本' : result.type === 'image' ? '图片' : result.type === 'audio' ? '音频' : '视频') + '结果 ' + (result.index + 1);
  const selectable = !current && !disabled && ready;
  const select = () => { if (selectable) onSelect?.(result.id); };
  return <article className="canvas-results-popover__result" data-current={current || undefined}
    data-selectable={selectable || undefined} aria-label={label} onClick={event => {
      if (event.target.closest('button, input, label, a, audio, video, [role="button"], .canvas-results-popover__selection, .canvas-node__transcript, .canvas-results-popover__text')) return;
      if (window.getSelection()?.toString()) return;
      select();
    }}>
    {text ? <div className="canvas-results-popover__text" tabIndex={0} aria-label={label + '正文'}>{result.content}</div>
      : <div className={'canvas-results-popover__media canvas-results-popover__media--' + result.type}>
        {available && previewStatus !== 'error' && (result.type === 'image'
          ? <img key={attempt} src={media.src} alt={label} draggable={false} loading="lazy"
            onLoad={() => setPreviewStatus('ready')} onError={() => setPreviewStatus('error')} />
          : result.type === 'audio' ? <CanvasAudioPlayer key={attempt} url={media.src} name={label}
            transcript={media.transcript} compact onReady={() => setPreviewStatus('ready')}
            onError={() => setPreviewStatus('error')} />
          : <video key={attempt} src={media.src} poster={media.poster} controls playsInline preload="metadata" aria-label={label + '预览'}
            onLoadedData={() => setPreviewStatus('ready')} onError={() => setPreviewStatus('error')} />)}
        {available && previewStatus === 'loading' && result.type !== 'audio' && <div className={result.type === 'video' ? 'canvas-results-popover__video-loading' : undefined}>
          <MediaLoadStatus status="loading" visual />
        </div>}
        {(!available || failed) && <div className="canvas-results-popover__unavailable">
          <p role="status">{message}</p>
          {onRetryMedia && media?.status !== 'loading' && <Button size="small" variant="secondary"
            icon={<RefreshCw size={14} />} aria-label={'重试' + label} onClick={retry}>重试</Button>}
        </div>}
      </div>}
    <div className="canvas-results-popover__selection"
      title={lockReason || (!ready ? (failed ? message : '素材尚未就绪') : undefined)}>
      <Radio name={groupName} value={result.id} checked={current} disabled={disabled || !ready}
        aria-label={current ? label + '，当前结果' : '将' + label + '设为当前结果'} onChange={select} />
    </div>
  </article>;
}
