import { useEffect, useRef, useState } from 'react';
import { Move, Pencil, Download, Trash2 } from 'lucide-react';
import Checkbox from '../Checkbox';
import CreationAudioResultCard from '../creation/CreationAudioResultCard';
import CreationCardActionButton from '../creation/CreationCardActionButton';
import AddVirtualGroupCard from './AddVirtualGroupCard';
import SeedanceFolderCard from './SeedanceFolderCard';
import SeedanceAssetCard from './SeedanceAssetCard';
import AssetFolderGrid from './AssetFolderGrid';
import useCanvasDragPreview from './UseCanvasDragPreview';
import { canvasLibraryItemKey, canvasLibraryMedia, canvasLibraryAudioUrl, canvasLibraryDragType, canvasLibraryDrop } from './CanvasLibraryItems';

/** 卡片、选择与拖放展示；所有写入经上层串行执行。
 * 2026-11-02：松手后卡片缩小飞入目标，末段淡出，失败恢复原卡片。
 * 2026-11-02：拖入文件夹复用悬停动画，拖离、放下及取消后清理。
 */
export default function CanvasLibraryGrid({ collectionId, parentId, items, selected, batch, busy, onSelect, onOpen, onCreate, onRename, onDelete, onMove, onDestination, onDownload }) {
  const dragPreview = useCanvasDragPreview();
  const [dragOverKey, setDragOverKey] = useState(null);
  const draggedKeys = useRef(new Set());
  const cardNodes = useRef(new Map());
  const flights = useRef(new Set());
  const [flightTarget, setFlightTarget] = useState(null);

  useEffect(() => () => {
    flights.current.forEach((animation) => animation.cancel());
  }, []);

  const moveWithAnimation = async (list, target) => {
    const targetKey = 'folder:' + target;
    if (list.some((entry) => canvasLibraryItemKey(entry) === targetKey)) return;
    const destination = cardNodes.current.get(targetKey)?.getBoundingClientRect();
    const animations = [];
    if (destination) {
      setFlightTarget(targetKey);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const entry of list) {
        const node = cardNodes.current.get(canvasLibraryItemKey(entry));
        if (!node?.animate) continue;
        const source = node.getBoundingClientRect();
        const x = destination.left + destination.width / 2 - source.left - source.width / 2;
        const y = destination.top + destination.height * 0.55 - source.top - source.height / 2;
        const animation = node.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0, zIndex: 10 },
          { transform: 'translate(0, 0) scale(0.82)', opacity: 1, offset: 0.2, zIndex: 10 },
          { transform: 'translate(' + x * 0.8 + 'px, ' + y * 0.8 + 'px) scale(0.22, 0.3)', opacity: 0.9, offset: 0.75, zIndex: 10 },
          { transform: 'translate(' + x + 'px, ' + y + 'px) scale(0.04, 0.02)', opacity: 0, offset: 1, zIndex: 10 },
        ], { duration: reducedMotion ? 1 : 520, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
        animations.push(animation);
        flights.current.add(animation);
      }
    }
    const finished = Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    try {
      await onMove(list, target, finished);
      await finished;
      // 让新快照先提交，再撤销保留的动画样式，避免原卡片闪回。
      await new Promise((resolve) => requestAnimationFrame(resolve));
    } finally {
      animations.forEach((animation) => { animation.cancel(); flights.current.delete(animation); });
      setFlightTarget(null);
    }
  };

  useEffect(() => {
    const clearDrag = () => {
      draggedKeys.current.clear();
      setDragOverKey(null);
    };
    window.addEventListener('dragend', clearDrag);
    window.addEventListener('drop', clearDrag);
    window.addEventListener('blur', clearDrag);
    return () => {
      window.removeEventListener('dragend', clearDrag);
      window.removeEventListener('drop', clearDrag);
      window.removeEventListener('blur', clearDrag);
    };
  }, []);

  return <AssetFolderGrid>
    <AddVirtualGroupCard label="新增文件夹" onClick={() => !busy && onCreate()} />
    {items.map((item) => {
      const key = canvasLibraryItemKey(item);
      const folder = item.type === 'folder';
      const locked = folder && item.kind === 'root';
      const media = canvasLibraryMedia(item);
      const audio = media.asset_type === 'audio' || media.asset_type?.startsWith('audio/');
      const select = () => { if (!busy) onSelect(key); };
      const open = () => { if (!busy) { if (batch) select(); else onOpen(item); } };
      const handleDragOver = folder && !busy ? (event) => {
        if (!Array.from(event.dataTransfer.types).includes(canvasLibraryDragType)) return;
        event.preventDefault();
        const accepted = draggedKeys.current.size > 0 && !draggedKeys.current.has(key);
        setDragOverKey(accepted ? key : null);
        dragPreview.scale(accepted);
      } : undefined;
      const actions = !batch && !folder ? (
        <div className="absolute bottom-[8px] right-[8px] z-[3] flex gap-[4px] opacity-0 transition-opacity group-hover/library-card:opacity-100 group-focus-within/library-card:opacity-100" onClick={(event) => event.stopPropagation()}>
          <CreationCardActionButton icon={<Pencil size={16} />} tooltip="重命名" disabled={busy} onClick={() => onRename(item)} />
          <CreationCardActionButton icon={<Move size={16} />} tooltip="移动到" disabled={busy} onClick={() => onDestination([item])} />
          <CreationCardActionButton icon={<Download size={16} />} tooltip="下载" disabled={busy} onClick={() => onDownload([item])} />
          <CreationCardActionButton icon={<Trash2 size={16} />} tooltip="删除" disabled={busy} onClick={() => onDelete([item])} />
        </div>
      ) : null;
      return <div key={key} ref={(node) => { if (node) cardNodes.current.set(key, node); else cardNodes.current.delete(key); }} className={`group/library-card relative min-w-0 self-start ${folder ? 'max-w-[270px]' : ''}`} draggable={!busy && !locked} onDragStart={(event) => {
        if (busy || locked) { event.preventDefault(); return; }
        const scope = selected.has(key) ? items.filter((entry) => selected.has(canvasLibraryItemKey(entry))) : [item];
        if (scope.some((entry) => entry.kind === 'project')) { event.preventDefault(); return; }
        draggedKeys.current = new Set(scope.map(canvasLibraryItemKey));
        setDragOverKey(null);
        dragPreview.start(event);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(canvasLibraryDragType, JSON.stringify(scope.map((entry) => ({ type: entry.type, id: entry.id, collection_id: collectionId, source_folder_id: parentId, base_revision: entry.revision }))));
      }} onDragEnter={handleDragOver} onDragOver={handleDragOver} onDragLeave={folder ? (event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setDragOverKey((current) => current === key ? null : current);
        dragPreview.scale(false);
      } : undefined} onDrop={folder && !busy ? (event) => {
        event.stopPropagation();
        setDragOverKey(null);
        draggedKeys.current.clear();
        canvasLibraryDrop(event, moveWithAnimation, item.id);
      } : undefined}>
        {folder ? (
          <SeedanceFolderCard dragHovered={flightTarget === key || (!busy && dragOverKey === key)} name={item.name} count={item.count} images={item.images || []} disabled={busy} editLabel="重命名" onEdit={!batch && !locked ? () => onRename(item) : undefined} onMove={!batch && !locked ? () => onDestination([item]) : undefined} onDelete={!batch ? () => onDelete([item]) : undefined} onOpen={open} />
        ) : audio ? (
          <CreationAudioResultCard
            id={key} playbackKey={`canvas-library:${collectionId}:${key}`} status="done"
            audioUrl={canvasLibraryAudioUrl(item.asset)} retainUnavailableLayout prompt={typeof media.prompt === 'string' && media.prompt.trim() ? media.prompt : '暂无台词'}
            onCardClick={open} batchMode={batch} isSelected={selected.has(key)}
            onToggleSelect={select} selectionDisabled={busy}
            selectionCheckboxPosition="left" showSelection={false} showFavorite={false}
            actions={actions} height="160px" overlayActions fillWaveform
          />
        ) : (
          <SeedanceAssetCard asset={media} width="100%" showActions={false} selected={selected.has(key)} disabled={busy} onClick={open} />
        )}
        {batch && (
          <div className={`absolute z-[4] ${folder ? 'left-[24px] top-[12px]' : 'left-[8px] top-[8px]'}`}>
            <Checkbox checked={selected.has(key)} disabled={busy} aria-label={`选择${item.name || item.asset?.name || '素材'}`} onChange={(event) => { event.stopPropagation(); select(); }} />
          </div>
        )}
        {!audio && actions}
      </div>;
    })}
  </AssetFolderGrid>;
}
