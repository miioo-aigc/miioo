import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, Trash2, X } from 'lucide-react';
import {
  apiDeleteCanvasGenerationHistory,
  apiListCanvasGenerationHistory,
  apiResolveCanvasAssetViews,
} from '../../api/canvas';
import { apiDownloadAsset } from '../../api/assets';
import { canvasAssetLibrary } from '../../api/CanvasAssetLibrary';
import CanvasLibraryDetail from '../assets/CanvasLibraryDetail';
import { canvasLibraryAudioUrl } from '../assets/CanvasLibraryItems';
import ConfirmDialog from '../ConfirmDialog';
import { showGlobalToast } from '../../stores/toastStore';
import { startDownloadFeedback } from '../../utils/downloadFeedback';
import { downloadBlob } from '../../utils/downloadBlob';
import {
  canvasGenerationFilename,
  canvasGenerationRecordKey,
  groupCanvasGenerationRecords,
  isCanvasGenerationRecordReady,
  mergeCanvasGenerationResolvedAssets,
  mergeCanvasGenerationRecords,
  mergeValidatedCanvasGenerationDetail,
  sortCanvasGenerationRecords,
} from '../../utils/canvasGenerationHistoryAdapter';
import { AddToCanvasIcon, Button, Select, Tooltip } from '../ui';
import DotsLoading from '../DotsLoading';
import CanvasNodeIcon from './CanvasNodeIcon';
import generationHistoryEmptyIcon from '../../assets/generation-history-empty.svg';
import './CanvasGenerationHistory.css';

const TYPES = [{ id: 'all', label: '全部' }, { id: 'image', label: '图片' }, { id: 'video', label: '视频' }, { id: 'audio', label: '音频' }];
const TYPE_LABEL = { image: '图片', video: '视频', audio: '音频' };
const PAGE_SIZE = 50;
const RESOLVE_BATCH_SIZE = 200;
const PREVIEW_RETRY_LIMIT = 1;

function normalizedPage(page, deletedIds) {
  return mergeCanvasGenerationRecords(page?.items)
    .filter((record) => record.type)
    .filter((record) => !record.historyId || !deletedIds.has(record.historyId));
}

function generationHistoryErrorMessage(error, fallback = '生成历史读取失败') {
  if (error?.code === 'INVALID_CURSOR') return '分页已失效，请重新加载第一页';
  switch (Number(error?.status)) {
    case 401: return '登录已过期，请重新登录';
    case 403: return '无法访问该画布的生成历史';
    case 404: return '画布或历史不存在，或无权访问';
    case 422: return '请求参数无效，请刷新后重试';
    case 500: return '生成历史服务异常，请稍后重试';
    default: return error?.message || fallback;
  }
}

async function resolveCanvasGenerationRecords(sourceCanvasId, records, signal) {
  const readyRecords = records.filter((record) => isCanvasGenerationRecordReady(record));
  const assetIds = [...new Set(readyRecords.map((record) => record.assetId).filter(Boolean))];
  if (!assetIds.length) return records;

  const resolvedByKey = new Map();
  for (let index = 0; index < assetIds.length; index += RESOLVE_BATCH_SIZE) {
    const batchIds = assetIds.slice(index, index + RESOLVE_BATCH_SIZE);
    const batchIdSet = new Set(batchIds);
    const batchRecords = readyRecords.filter((record) => batchIdSet.has(record.assetId));
    try {
      const response = await apiResolveCanvasAssetViews(sourceCanvasId, batchIds, { signal });
      for (const record of mergeCanvasGenerationResolvedAssets(batchRecords, response)) {
        resolvedByKey.set(canvasGenerationRecordKey(record), record);
      }
    } catch (resolutionError) {
      if (signal?.aborted || resolutionError?.name === 'AbortError') throw resolutionError;
      // A failed view refresh must not make the history page fail. Keep the
      // server-provided summary for this batch and still expose the list.
    }
  }
  return records.map((record) => resolvedByKey.get(canvasGenerationRecordKey(record)) || record);
}

export default function CanvasGenerationHistory({ open, canvasId, targetCanvasId, ...props }) {
  if (!open) return null;

  return (
    <CanvasGenerationHistoryDialog
      key={`${targetCanvasId || canvasId || ''}:${canvasId || ''}`}
      canvasId={canvasId}
      targetCanvasId={targetCanvasId}
      {...props}
    />
  );
}

function CanvasGenerationHistoryDialog({ canvasId, canvases = [], targetCanvasId, onClose, onAddToCanvas }) {
  const initialSourceId = targetCanvasId || canvasId || '';
  const [selection, setSelection] = useState({ sourceCanvasId: initialSourceId, type: 'all', retry: 0 });
  const [records, setRecords] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [detailBusyId, setDetailBusyId] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [previewFailed, setPreviewFailed] = useState(() => new Set());
  const generation = useRef(0);
  const controller = useRef(null);
  const moreLock = useRef(false);
  const deletedIds = useRef(new Set());
  const previewAttempts = useRef(new Map());
  const previewLoading = useRef(new Set());
  const sourceCanvasId = selection.sourceCanvasId;
  const resolvedTargetCanvasId = targetCanvasId || canvasId || sourceCanvasId;

  const resetLoadedState = useCallback(({ resetDeletedIds = false } = {}) => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    moreLock.current = false;
    if (resetDeletedIds) deletedIds.current.clear();
    previewAttempts.current.clear();
    previewLoading.current.clear();
    setRecords([]);
    setCursor(null);
    setLoading(false);
    setLoadingMore(false);
    setError('');
    setMoreError('');
    setSelected(null);
    setBusyId('');
    setDetailBusyId('');
    setPendingDelete(null);
    setPreviewFailed(new Set());
  }, []);

  const replaceRecord = useCallback((record) => {
    const key = canvasGenerationRecordKey(record);
    if (!key) return;
    setRecords((current) => sortCanvasGenerationRecords(current.map((item) => (
      canvasGenerationRecordKey(item) === key ? record : item
    ))));
    setSelected((current) => (
      current && canvasGenerationRecordKey(current) === key ? record : current
    ));
  }, []);

  const applyResolvedViews = useCallback((resolvedRecords) => {
    const resolvedByKey = new Map(resolvedRecords.map((record) => [canvasGenerationRecordKey(record), record]));
    setRecords((current) => sortCanvasGenerationRecords(current.map((record) => (
      resolvedByKey.get(canvasGenerationRecordKey(record)) || record
    ))));
    setSelected((current) => (
      current ? resolvedByKey.get(canvasGenerationRecordKey(current)) || current : current
    ));
  }, []);

  useEffect(() => {
    if (!sourceCanvasId) return undefined;

    const requestGeneration = ++generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    const load = async () => {
      setLoading(true);
      try {
        const page = await apiListCanvasGenerationHistory(sourceCanvasId, {
          targetCanvasId: resolvedTargetCanvasId,
          type: selection.type,
          limit: PAGE_SIZE,
          signal: requestController.signal,
        });
        if (requestController.signal.aborted || requestGeneration !== generation.current) return;
        const initialRecords = normalizedPage(page, deletedIds.current);
        setRecords(initialRecords);
        setCursor(page?.next_cursor || null);
        setError('');
        void resolveCanvasGenerationRecords(sourceCanvasId, initialRecords, requestController.signal)
          .then((resolvedRecords) => {
            if (!requestController.signal.aborted && requestGeneration === generation.current) {
              applyResolvedViews(resolvedRecords);
            }
          })
          .catch(() => {});
      } catch (loadError) {
        if (requestController.signal.aborted || requestGeneration !== generation.current || loadError.name === 'AbortError') return;
        setError(generationHistoryErrorMessage(loadError));
      } finally {
        if (controller.current === requestController) controller.current = null;
        if (!requestController.signal.aborted && requestGeneration === generation.current) setLoading(false);
      }
    };
    void load();
    return () => {
      requestController.abort();
      if (controller.current === requestController) controller.current = null;
    };
  }, [applyResolvedViews, resolvedTargetCanvasId, selection.retry, selection.type, sourceCanvasId]);

  const refreshRecord = useCallback(async (record) => {
    if (!isCanvasGenerationRecordReady(record)) throw new Error(record?.availabilityLabel || '素材不可用');
    let detail;
    try {
      detail = await canvasAssetLibrary.detail({ asset_id: record.assetId });
    } catch {
      throw new Error('生成结果详情不可用，请刷新历史后重试');
    }
    const refreshed = mergeValidatedCanvasGenerationDetail(record, detail);
    if (!refreshed) throw new Error('生成结果详情不可用，请刷新历史后重试');
    replaceRecord(refreshed);
    setPreviewFailed((current) => {
      if (!current.has(record.assetId)) return current;
      const next = new Set(current);
      next.delete(record.assetId);
      return next;
    });
    return refreshed;
  }, [replaceRecord]);

  const refreshPreview = useCallback(async (record) => {
    if (!isCanvasGenerationRecordReady(record) || previewLoading.current.has(record.assetId)) return;
    const attempts = previewAttempts.current.get(record.assetId) || 0;
    if (attempts >= PREVIEW_RETRY_LIMIT) {
      setPreviewFailed((current) => new Set(current).add(record.assetId));
      return;
    }
    previewAttempts.current.set(record.assetId, attempts + 1);
    previewLoading.current.add(record.assetId);
    try {
      await refreshRecord(record);
    } catch (previewError) {
      if (attempts + 1 >= PREVIEW_RETRY_LIMIT) {
        setPreviewFailed((current) => new Set(current).add(record.assetId));
        showGlobalToast(previewError.message || '预览地址已过期，无法重新读取', 'error');
      }
    } finally {
      previewLoading.current.delete(record.assetId);
    }
  }, [refreshRecord]);

  const openDetail = async (record) => {
    if (!isCanvasGenerationRecordReady(record) || detailBusyId) return;
    setDetailBusyId(record.historyId || record.assetId);
    try {
      const refreshed = await refreshRecord(record);
      setSelected(refreshed);
    } catch (detailError) {
      showGlobalToast(detailError.message || '历史素材详情读取失败', 'error');
    } finally {
      setDetailBusyId('');
    }
  };

  const download = async (record) => {
    const actionId = record.historyId || record.assetId;
    if (busyId) return;
    setBusyId(actionId);
    const feedback = startDownloadFeedback();
    try {
      const refreshed = await refreshRecord(record);
      const blob = await apiDownloadAsset(refreshed.assetId, { onProgress: feedback.setProgress });
      downloadBlob(blob, canvasGenerationFilename(refreshed));
      await feedback.complete('下载成功');
    } catch (downloadError) {
      await feedback.fail(downloadError.message || '下载失败，请稍后重试');
    } finally {
      setBusyId('');
    }
  };

  const add = async (record) => {
    const actionId = record.historyId || record.assetId;
    if (busyId) return;
    setBusyId(actionId);
    try {
      const refreshed = await refreshRecord(record);
      const added = await onAddToCanvas?.(refreshed.asset);
      if (!added) throw new Error('未能添加到画布，请重试');
      setSelected(null);
      onClose?.();
    } catch (addError) {
      showGlobalToast(addError.message || '添加到画布失败', 'error');
    } finally {
      setBusyId('');
    }
  };

  const requestRemove = (record) => {
    if (busyId || !record?.historyId) return;
    setPendingDelete(record);
  };

  const remove = async () => {
    const record = pendingDelete;
    const actionId = record.historyId || record.assetId;
    if (busyId || !record.historyId) return;
    setBusyId(actionId);
    try {
      await apiDeleteCanvasGenerationHistory(sourceCanvasId, record.historyId, {
        targetCanvasId: resolvedTargetCanvasId,
      });
      deletedIds.current.add(record.historyId);
      setRecords((current) => current.filter((item) => item.historyId !== record.historyId));
      setSelected((current) => (
        current && current.historyId === record.historyId ? null : current
      ));
      showGlobalToast('success', '历史记录已删除');
    } catch (deleteError) {
      showGlobalToast(deleteError.message || '删除生成历史失败', 'error');
    } finally {
      setBusyId('');
      setPendingDelete(null);
    }
  };

  const loadMore = async () => {
    if (!cursor || loading || loadingMore || moreLock.current) return;
    const requestGeneration = generation.current;
    const nextCursor = cursor;
    moreLock.current = true;
    setLoadingMore(true);
    setMoreError('');
    try {
      const page = await apiListCanvasGenerationHistory(sourceCanvasId, {
        targetCanvasId: resolvedTargetCanvasId,
        type: selection.type,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      if (requestGeneration !== generation.current) return;
      const pageRecords = normalizedPage(page, deletedIds.current);
      setRecords((current) => mergeCanvasGenerationRecords(current, pageRecords));
      const returnedCursor = page?.next_cursor || null;
      setCursor(returnedCursor === nextCursor ? null : returnedCursor);
      void resolveCanvasGenerationRecords(sourceCanvasId, pageRecords)
        .then((resolvedRecords) => {
          if (requestGeneration === generation.current) applyResolvedViews(resolvedRecords);
        })
        .catch(() => {});
    } catch (moreLoadError) {
      if (requestGeneration === generation.current) {
        if (moreLoadError?.code === 'INVALID_CURSOR') {
          setRecords([]);
          setCursor(null);
          setMoreError('');
          setSelected(null);
          showGlobalToast('分页已失效，已重新加载第一页', 'info');
          setSelection((current) => ({ ...current, retry: current.retry + 1 }));
        } else {
          setMoreError(generationHistoryErrorMessage(moreLoadError, '更多历史读取失败'));
        }
      }
    } finally {
      moreLock.current = false;
      if (requestGeneration === generation.current) setLoadingMore(false);
    }
  };

  const groups = useMemo(() => groupCanvasGenerationRecords(records), [records]);

  const changeSource = (value) => {
    resetLoadedState({ resetDeletedIds: true });
    setSelection((current) => ({ ...current, sourceCanvasId: value }));
  };
  const changeType = (value) => {
    resetLoadedState();
    setSelection((current) => ({ ...current, type: value }));
  };
  const retry = () => {
    resetLoadedState();
    setSelection((current) => ({ ...current, retry: current.retry + 1 }));
  };
  const detailEntry = selected ? {
    id: selected.assetId,
    type: 'asset',
    asset_id: selected.assetId,
    asset: selected.asset,
  } : null;

  return createPortal(
    <div className="canvas-generation-history__overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busyId) {
        setSelected(null);
        onClose?.();
      }
    }}>
      <section className="canvas-generation-history" role="dialog" aria-modal="true" aria-label="生成历史">
        <header className="canvas-generation-history__header">
          <span>生成历史</span>
          <button type="button" aria-label="关闭生成历史" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="canvas-generation-history__controls">
          <div className="canvas-generation-history__selectors">
            <Select
              value={sourceCanvasId || ''}
              displayValue={canvases.find((item) => item.id === sourceCanvasId)?.title
                || canvases.find((item) => item.id === sourceCanvasId)?.name
                || '选择画布'}
              hideTriggerBorder
              width="154px"
              menuMaxHeight="261px"
              menuAriaLabel="切换画布"
              options={canvases.map((item) => ({
                value: item.id,
                label: item.title || item.name || '未命名画布',
              }))}
              onChange={changeSource}
            />
          </div>
          <nav className="canvas-generation-history__tabs" aria-label="生成历史类型">
            {TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={selection.type === item.id ? 'page' : undefined}
                className={selection.type === item.id ? 'is-active' : ''}
                onClick={() => changeType(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="canvas-generation-history__body">
          {loading && records.length === 0 && <div role="status" className="canvas-generation-history__state"><DotsLoading size={6} color="#2DC3E1" gap={4} /></div>}
          {!loading && error && <div className="canvas-generation-history__state"><p>{error}</p><Button variant="link" onClick={retry}>重试</Button></div>}
          {!loading && !error && records.length === 0 && (
            <div className="canvas-generation-history__state canvas-generation-history__empty">
              <img src={generationHistoryEmptyIcon} width={48} height={48} alt="" aria-hidden="true" />
              <p>暂无生成历史</p>
            </div>
          )}
          {!error && groups.map(([day, items]) => (
            <section className="canvas-generation-history__day" key={day}>
              <h3>{day}</h3>
              <div className="canvas-generation-history__grid">
                {items.map((record) => {
                  const ready = isCanvasGenerationRecordReady(record);
                  const videoPoster = record.type === 'video'
                    ? record.asset.thumbnail_url || record.asset.poster_url
                    : '';
                  const preview = record.asset.preview_url
                    || record.asset.url
                    || canvasLibraryAudioUrl(record.asset);
                  const previewUnavailable = !ready || previewFailed.has(record.assetId) || !(videoPoster || preview);
                  const cardBusy = busyId === (record.historyId || record.assetId)
                    || detailBusyId === (record.historyId || record.assetId);
                  return (
                    <article
                      className={`canvas-generation-history__card${ready ? '' : ' is-unavailable'}`}
                      key={canvasGenerationRecordKey(record)}
                      onClick={() => void openDetail(record)}
                      onKeyDown={(event) => {
                        if (ready && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          void openDetail(record);
                        }
                      }}
                      role="button"
                      tabIndex={ready ? 0 : -1}
                      aria-disabled={!ready}
                      aria-label={ready ? `查看${TYPE_LABEL[record.type]}详情` : `${TYPE_LABEL[record.type]}不可用`}
                    >
                      {previewUnavailable ? (
                        <div className="canvas-generation-history__unavailable">
                          <span>{ready ? '预览正在更新' : record.availabilityLabel}</span>
                        </div>
                      ) : record.type === 'audio' ? (
                        <div className="canvas-generation-history__audio" aria-hidden="true">
                          <CanvasNodeIcon nodeType="audio" size={24} />
                        </div>
                      ) : videoPoster ? (
                        <img
                          src={videoPoster}
                          alt={record.asset.name || '生成视频'}
                          loading="lazy"
                          decoding="async"
                          onError={() => void refreshPreview(record)}
                        />
                      ) : record.type === 'video' ? (
                        <video
                          src={preview}
                          poster={record.asset.poster_url}
                          muted
                          preload="metadata"
                          onError={() => void refreshPreview(record)}
                        />
                      ) : (
                        <img
                          src={preview}
                          alt={record.asset.name || '生成图片'}
                          loading="lazy"
                          onError={() => void refreshPreview(record)}
                        />
                      )}
                      <div className="canvas-generation-history__actions" onClick={(event) => event.stopPropagation()}>
                        <Tooltip label="添加到画布" placement="top" offset={8}>
                          <button type="button" aria-label="添加到画布" disabled={!ready || cardBusy} onClick={() => void add(record)}><AddToCanvasIcon size={16} /></button>
                        </Tooltip>
                        <Tooltip label="下载" placement="top" offset={8}>
                          <button type="button" aria-label="下载" disabled={!ready || cardBusy} onClick={() => void download(record)}><ArrowDownToLine size={16} /></button>
                        </Tooltip>
                        <Tooltip label="删除历史记录" placement="top" offset={8}>
                          <button type="button" aria-label="删除历史记录" disabled={cardBusy || !record.historyId} onClick={() => requestRemove(record)}><Trash2 size={16} /></button>
                        </Tooltip>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {!!records.length && (
            <div className="canvas-generation-history__more">
              {moreError && <span>{moreError}</span>}
              {cursor && (
                <Button variant="secondary" loading={loadingMore} disabled={loadingMore} onClick={() => void loadMore()}>
                  {moreError ? '重新加载' : '加载更多'}
                </Button>
              )}
            </div>
          )}
        </div>
        {selected && (
          <CanvasLibraryDetail
            key={`${selected.historyId}:${selected.assetId}:${selected.asset.revision || 0}`}
            entry={detailEntry}
            historyMode
            onAddToCanvas={() => void add(selected)}
            onDownload={() => void download(selected)}
            onDelete={() => requestRemove(selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </section>
      {pendingDelete && (
        <ConfirmDialog
          title="确认删除生成历史？"
          description="只会从生成历史中隐藏这条记录；对应的资产、文件和画布节点不会被删除。"
          busy={Boolean(busyId)}
          manageFocus
          confirmText={busyId ? '删除中...' : '删除历史'}
          onCancel={() => { if (!busyId) setPendingDelete(null); }}
          onConfirm={() => void remove()}
        />
      )}
    </div>,
    document.body,
  );
}
