import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, Plus, Trash2, X } from 'lucide-react';
import { apiDeleteCanvasGenerationHistory, apiListCanvasGenerationHistory } from '../../api/canvas';
import CanvasLibraryDetail from '../assets/CanvasLibraryDetail';
import { showGlobalToast } from '../../stores/toastStore';
import { startDownloadFeedback } from '../../utils/downloadFeedback';
import { downloadBlob } from '../../utils/downloadBlob';
import { apiDownloadCreationImage, apiDownloadCreationVideo, apiDownloadCreationAudio } from '../../api/creation';
import { canvasAssetLibrary } from '../../api/CanvasAssetLibrary';
import { canvasLibraryAudioUrl } from '../assets/CanvasLibraryItems';
import { Button, Select } from '../ui';
import DotsLoading from '../DotsLoading';
import generationHistoryEmptyIcon from '../../assets/generation-history-empty.svg';
import './CanvasGenerationHistory.css';

const TYPES = [{ id: 'all', label: '全部' }, { id: 'image', label: '图片' }, { id: 'video', label: '视频' }, { id: 'audio', label: '音频' }];
const TYPE_LABEL = { image: '图片', video: '视频', audio: '音频' };
const recordType = (item) => String(item?.type || item?.media_type || item?.asset_type || item?.asset?.asset_type || '').toLowerCase().split('/')[0];
const recordDate = (item) => item?.created_at || item?.createdAt || item?.generated_at || item?.generatedAt || '';
function dayLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '日期未知';
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '今天';
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}
function recordAsset(item, type) {
  const raw = item?.asset || item?.media || item;
  const id = item?.asset_id || item?.assetId || raw?.asset_id || raw?.assetId || raw?.id;
  const url = raw?.original_url || raw?.originalUrl || raw?.file_url || raw?.fileUrl || raw?.url || raw?.[type + '_url'] || raw?.[type + 'Url'];
  const preview = raw?.preview_url || raw?.previewUrl || raw?.thumbnail_url || raw?.thumbnailUrl || (type === 'image' ? url : '');
  let metadata = raw?.metadata_json || raw?.metadata || {};
  if (typeof metadata === 'string') { try { metadata = JSON.parse(metadata) || {}; } catch { metadata = {}; } }
  return { ...metadata, ...raw, id, asset_id: id, asset_type: type, type, url, original_url: url, file_url: url, preview_url: preview,
    poster_url: raw?.poster_url || raw?.posterUrl || raw?.thumbnail_url || raw?.thumbnailUrl,
    input_prompt: item?.input_prompt || item?.prompt || raw?.input_prompt || raw?.prompt || metadata.prompt || '', created_at: recordDate(item), media_type: type };
}
function filename(record, type) {
  const name = record.name || record.file_name || record.filename || (TYPE_LABEL[type] || '素材') + '-' + record.id;
  return /\.[a-z0-9]{2,5}$/i.test(name) ? name : name + '.' + ({ image: 'png', video: 'mp4', audio: 'mp3' })[type];
}

export default function CanvasGenerationHistory({ open, canvasId, canvases = [], targetCanvasId, onClose, onAddToCanvas }) {
  const [selection, setSelection] = useState({ sourceCanvasId: targetCanvasId || canvasId, type: 'all', retry: 0 });
  const sourceCanvasId = selection.sourceCanvasId;
  const type = selection.type;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestKey, setRequestKey] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  useEffect(() => {
    if (!open || !sourceCanvasId) return undefined;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setLoading(true); });
    apiListCanvasGenerationHistory(sourceCanvasId, { targetCanvasId: targetCanvasId || canvasId || sourceCanvasId, type, signal: controller.signal }).then((items) => {
      if (!controller.signal.aborted) { setRecords(items.filter((item) => ['image', 'video', 'audio'].includes(recordType(item)))); setError(''); }
    }).catch((loadError) => { if (!controller.signal.aborted) { setRecords([]); setError(loadError.message || '生成历史读取失败'); } })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); setRequestKey(`${sourceCanvasId}:${type}:${selection.retry}`); } });
    return () => controller.abort();
  }, [open, sourceCanvasId, type, selection.retry]);
  const groups = useMemo(() => {
    const sorted = [...records].sort((a, b) => new Date(recordDate(b)).getTime() - new Date(recordDate(a)).getTime());
    const map = new Map();
    sorted.forEach((record) => { const label = dayLabel(recordDate(record)); if (!map.has(label)) map.set(label, []); map.get(label).push(record); });
    return [...map.entries()];
  }, [records]);
  if (!open) return null;

  const download = async (record) => {
    const itemType = recordType(record), asset = recordAsset(record, itemType);
    const feedback = startDownloadFeedback();
    try {
      const id = record.creation_id || record.creationId || record.id;
      const api = { image: apiDownloadCreationImage, video: apiDownloadCreationVideo, audio: apiDownloadCreationAudio }[itemType];
      if (api && id) {
        const blob = await api(id, { onProgress: feedback.setProgress });
        downloadBlob(blob, filename(asset, itemType));
      } else {
        const entry = { type: 'asset', asset_id: asset.asset_id, asset };
        const result = await canvasAssetLibrary.download(entry);
        if (!result.url) throw new Error('下载信息尚未同步，请刷新后重试');
        const response = await fetch(result.url);
        if (!response.ok) throw new Error('下載失敗，請稍後重試');
        downloadBlob(await response.blob(), filename(asset, itemType));
        if (result.revoke) URL.revokeObjectURL(result.url);
      }
      await feedback.complete('下载成功');
    } catch (downloadError) { await feedback.fail(downloadError.message || '下载失败，请稍后重试'); }
  };
  const add = async (record) => {
    const itemType = recordType(record), asset = recordAsset(record, itemType);
    if (!asset.url || !asset.asset_id) { showGlobalToast('历史记录缺少可用的媒体资产信息', 'error'); return; }
    setBusyId(record.id);
    try {
      const added = await onAddToCanvas?.(asset);
      if (added) { setSelected(null); onClose?.(); }
    }
    finally { setBusyId(null); }
  };
  const remove = async (record) => {
    setBusyId(record.id);
    try { await apiDeleteCanvasGenerationHistory(sourceCanvasId, record.id, { targetCanvasId: targetCanvasId || canvasId || sourceCanvasId }); setRecords((items) => items.filter((item) => item.id !== record.id)); setSelected(null); }
    catch (deleteError) { showGlobalToast(deleteError.message || '删除生成历史失败', 'error'); }
    finally { setBusyId(null); }
  };
  const detailEntry = selected ? { id: recordAsset(selected, recordType(selected)).asset_id, type: 'asset', asset_id: recordAsset(selected, recordType(selected)).asset_id, asset: recordAsset(selected, recordType(selected)) } : null;
  return createPortal(<div className="canvas-generation-history__overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) { setSelected(null); onClose?.(); } }}>
    <section className="canvas-generation-history" role="dialog" aria-modal="true" aria-label="生成历史">
      <header className="canvas-generation-history__header"><span>生成历史</span><button type="button" aria-label="关闭生成历史" onClick={onClose}><X size={16} /></button></header>
      <div className="canvas-generation-history__controls">
        <div className="canvas-generation-history__selectors">
          <Select value={sourceCanvasId || ''} displayValue={canvases.find((item) => item.id === sourceCanvasId)?.title || canvases.find((item) => item.id === sourceCanvasId)?.name || '选择画布'} hideTriggerBorder
            width="154px" menuMaxHeight="261px" menuAriaLabel="切换画布" options={canvases.map((item) => ({ value: item.id, label: item.title || item.name || '未命名画布' }))}
            onChange={(value) => { setSelected(null); setRecords([]); setSelection((current) => ({ ...current, sourceCanvasId: value })); }} />
        </div>
        <nav className="canvas-generation-history__tabs" aria-label="生成历史类型">{TYPES.map((item) => <button key={item.id} type="button" aria-current={type === item.id ? 'page' : undefined} className={type === item.id ? 'is-active' : ''} onClick={() => { setRecords([]); setSelection((current) => ({ ...current, type: item.id })); }}>{item.label}</button>)}</nav>
      </div>
      <div className="canvas-generation-history__body">
        {(loading || requestKey !== `${sourceCanvasId}:${type}:${selection.retry}`) && <div role="status" className="canvas-generation-history__state"><DotsLoading size={6} color="#2DC3E1" gap={4} /></div>}
        {!loading && requestKey === `${sourceCanvasId}:${type}:${selection.retry}` && error && <div className="canvas-generation-history__state"><p>{error}</p><Button variant="link" onClick={() => setSelection((current) => ({ ...current, retry: current.retry + 1 }))}>重试</Button></div>}
        {!loading && requestKey === `${sourceCanvasId}:${type}:${selection.retry}` && !error && groups.length === 0 && <div className="canvas-generation-history__state canvas-generation-history__empty"><img src={generationHistoryEmptyIcon} width={48} height={48} alt="" aria-hidden="true" /><p>暂无生成历史</p></div>}
        {!loading && requestKey === `${sourceCanvasId}:${type}:${selection.retry}` && !error && groups.map(([day, items]) => <section className="canvas-generation-history__day" key={day}><h3>{day}</h3><div className="canvas-generation-history__grid">{items.map((record) => {
          const itemType = recordType(record), asset = recordAsset(record, itemType), preview = asset.preview_url || asset.url || canvasLibraryAudioUrl(asset);
          return <article className="canvas-generation-history__card" key={record.id} onClick={() => setSelected(record)} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(record); }} role="button" tabIndex={0} aria-label={'查看' + TYPE_LABEL[itemType] + '详情'}>
            {itemType === 'audio' ? <div className="canvas-generation-history__audio"><span>♪</span><span>音频生成结果</span></div> : itemType === 'video' ? <video src={preview} poster={asset.poster_url} muted preload="metadata" /> : <img src={preview} alt={asset.name || '生成图片'} loading="lazy" />}
            <div className="canvas-generation-history__type">{TYPE_LABEL[itemType]}</div>
            <div className="canvas-generation-history__actions" onClick={(event) => event.stopPropagation()}><button type="button" title="添加到画布" aria-label="添加到画布" disabled={busyId === record.id} onClick={() => void add(record)}><Plus size={16} /></button><button type="button" title="下载" aria-label="下载" onClick={() => void download(record)}><ArrowDownToLine size={16} /></button><button type="button" title="删除" aria-label="删除" disabled={busyId === record.id} onClick={() => void remove(record)}><Trash2 size={16} /></button></div>
          </article>;
        })}</div></section>)}
      </div>
      {selected && <CanvasLibraryDetail key={selected.id} entry={detailEntry} historyMode onAddToCanvas={() => void add(selected)} onClose={() => setSelected(null)} />}
    </section>
  </div>, document.body);
}
