/** 节点结果入口：只适配运行态视图及转发选择，不修改结果协议或请求后端。
 * 2026-11-11：多图生成完成后在入口右侧显示一次性提示（沿用 Tooltip 皮肤加左侧小三角），
 * 打开浮层即上报查看并隐藏；提示由宿主按运行态传入，刷新页面自然消失。
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useStoreApi } from '@xyflow/react';
import { History } from 'lucide-react';
import { IconButton, Tooltip } from '../ui';
import CanvasNodeResultsPopover from './CanvasNodeResultsPopover';
import CanvasNodeReplaceControl from './CanvasNodeReplaceControl';
import { getCanvasResultHistory } from './CanvasNodeResults.js';
import './CanvasNodeResultControls.css';

const OPEN_EVENT = 'canvas-node-results-open';
const stop = event => event.stopPropagation();

/** data.nodeResults 是结果协议；resultAssetViews 按 assetId 索引，asset 仅回退同编号素材。
 * onSelectResult(nodeId, resultId) 由宿主复核保护并写回；这里不乐观更新当前结果。
 * resultHintCount 由宿主在生成完成后传入，onAcknowledgeResultHint(nodeId) 只上报「已查看」。 */
export default function CanvasNodeResultControls({ data, title = '节点', nodeType = 'text' }) {
  const store = useStoreApi();
  const instanceId = useId();
  const triggerRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  useEffect(() => {
    const closeOther = event => {
      if (event.detail !== instanceId) setAnchorRect(null);
    };
    window.addEventListener(OPEN_EVENT, closeOther);
    const closeForPreview = () => setAnchorRect(null);
    window.addEventListener('canvas-media-preview-open', closeForPreview);
    return () => {
      window.removeEventListener(OPEN_EVENT, closeOther);
      window.removeEventListener('canvas-media-preview-open', closeForPreview);
    };
  }, [instanceId]);

  useEffect(() => {
    if (!anchorRect) return undefined;
    // 绝对位置同时覆盖节点自身及其父分组移动，不覆盖页面的视口事件处理器。
    const readAnchor = state => {
      const position = state.nodeLookup.get(data?.nodeId)?.internals.positionAbsolute;
      return [...state.transform, position?.x, position?.y];
    };
    const initial = readAnchor(store.getState());
    return store.subscribe(state => {
      if (readAnchor(state).some((value, index) => value !== initial[index])) setAnchorRect(null);
    });
  }, [anchorRect, data?.nodeId, store]);

  const results = data?.nodeResults;
  const batches = results ? getCanvasResultHistory(results) : [];
  const count = batches.reduce((total, batch) => total + batch.results.length, 0);
  // 入口只在多条结果时出现，提示沿用同一条件，避免气泡指向不存在的入口。
  const hintCount = nodeType !== 'text' && count > 1 ? Math.max(0, Number(data?.resultHintCount) || 0) : 0;
  const hintVisible = hintCount > 0 && !anchorRect;
  const mediaByResultId = {};
  for (const batch of batches) for (const result of batch.results) {
    if (result.type === 'text') continue;
    const view = data?.resultAssetViews?.[result.assetId]
      || (data?.asset?.asset_id === result.assetId ? data.asset : undefined);
    const unavailable = ['missing', 'forbidden'].includes(view?.availability);
    mediaByResultId[result.id] = {
      status: unavailable ? 'unavailable' : view?.status === 'error' ? 'error'
        : view?.status === 'loading' ? 'loading' : view?.url ? 'ready' : 'unavailable',
      src: unavailable ? undefined : view?.url,
      poster: unavailable ? undefined : view?.posterUrl,
      transcript: unavailable ? '' : batch.source === 'generation' && typeof batch.snapshot?.prompt === 'string'
        ? batch.snapshot.prompt.trim() : view?.source !== 'local-preview' ? view?.transcript : '',
      message: view?.message,
    };
  }
  const selectionPending = Boolean(data?.selectionPending || data?.asset?.uploadStatus === 'uploading'
    || data?.pendingCanvasUpload?.asset?.uploadStatus === 'uploading');
  const outputLocked = Boolean(data?.submissionLocked || data?.generating || data?.generationPending || data?.outputLocked
    || data?.editing || data?.upstreamProtected);
  const select = resultId => {
    const current = data;
    if (current?.submissionLocked || current?.generating || current?.generationPending || current?.outputLocked || current?.editing
      || current?.upstreamProtected || current?.selectionPending || current?.asset?.uploadStatus === 'uploading'
      || current?.pendingCanvasUpload?.asset?.uploadStatus === 'uploading') return;
    current?.onSelectResult?.(current.nodeId, resultId);
  };
  const toggleResults = (event, anchor) => {
    if (data?.submissionLocked) return;
    if (anchorRect) { setAnchorRect(null); return; }
    const rect = (anchor || event.currentTarget)?.getBoundingClientRect?.();
    if (!rect) return;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: instanceId }));
    setAnchorRect({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
    // 提示只承受到「用户查看」为止；清不清、怎么存由宿主决定。
    data?.onAcknowledgeResultHint?.(data?.nodeId);
  };
  return <>
    <div className={'canvas-node-result-controls nodrag nopan nowheel' + (hintVisible ? ' canvas-node-result-controls--hint' : '')}
      style={{ '--canvas-result-inverse-zoom': 1 / Math.max(1, data?.viewportZoom || 1) }}
      onPointerDown={stop} onMouseDown={stop} onClick={stop} onDoubleClick={stop} onWheel={stop}>
      {nodeType !== 'text' && Boolean(data?.asset?.url) && <CanvasNodeReplaceControl data={data} nodeType={nodeType}
        disabled={outputLocked || selectionPending} />}
      {nodeType !== 'text' && count > 1 && <Tooltip label={'查看结果（' + count + '）'}>
        <IconButton ref={triggerRef} className="canvas-node-result-controls__trigger"
        variant="secondary" style={{ paddingTop: 8, paddingBottom: 8, alignSelf: 'auto', height: 'auto', width: 32,
          boxShadow: 'none', backgroundColor: 'transparent',
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8))' }}
          aria-label={'查看' + title + '结果（' + count + '）'}
          aria-haspopup="dialog" aria-expanded={Boolean(anchorRect) && !data?.submissionLocked}
          disabled={Boolean(data?.submissionLocked)} onClick={toggleResults}><History size={16} aria-hidden="true" /></IconButton>
      </Tooltip>}
      {hintVisible && <button type="button" className="canvas-node-result-controls__hint"
        onClick={event => toggleResults(event, triggerRef.current)}>{'已生成' + hintCount + '个结果，点击查看'}</button>}
    </div>
    {results && nodeType !== 'text' && <CanvasNodeResultsPopover open={Boolean(anchorRect) && !data?.submissionLocked}
      results={results} anchorRect={anchorRect} returnFocusRef={triggerRef}
      mediaByResultId={mediaByResultId} generating={Boolean(data?.generating || data?.generationPending)} editing={Boolean(data?.editing || data?.outputLocked)}
      upstreamProtected={Boolean(data?.upstreamProtected)} selectionPending={selectionPending}
      selectionError={data?.selectionError} onClose={() => setAnchorRect(null)}
      onSelect={typeof data?.onSelectResult === 'function' ? select : undefined} />}
  </>;
}
