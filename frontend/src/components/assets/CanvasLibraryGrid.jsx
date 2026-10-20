import { Move, CopyPlus, Pencil, Download, Trash2 } from 'lucide-react';
import { Button } from '../ui';
import AddVirtualGroupCard from './AddVirtualGroupCard';
import SeedanceFolderCard from './SeedanceFolderCard';
import SeedanceAssetCard from './SeedanceAssetCard';
import AssetFolderGrid from './AssetFolderGrid';
import { canvasLibraryItemKey, canvasLibraryMedia, canvasLibraryDragType, canvasLibraryDrop } from './CanvasLibraryItems';

/** 卡片、选择与拖放展示；所有写入经上层串行执行。 */
export default function CanvasLibraryGrid({ collectionId, allSelected, items, selected, batch, busy, onSelect, onOpen, onCreate, onRename, onDelete, onMove, onDestination, onReference, onDownload }) {
  return <AssetFolderGrid gap={24}>
    <AddVirtualGroupCard label="新增文件夹" onClick={() => !busy && onCreate()} />
    {items.map((item) => {
      const key = canvasLibraryItemKey(item);
      const folder = item.type === 'folder';
      const locked = folder && item.kind === 'root';
      return <div key={key} className="min-w-0" draggable={!busy && !locked && !allSelected} onDragStart={(event) => {
        if (busy || locked || allSelected) { event.preventDefault(); return; }
        const scope = selected.has(key) ? items.filter((entry) => selected.has(canvasLibraryItemKey(entry))) : [item];
        if (scope.some((entry) => entry.kind === 'project')) { event.preventDefault(); return; }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(canvasLibraryDragType, JSON.stringify(scope.map((entry) => ({ type: entry.type, id: entry.id, collection_id: collectionId, base_revision: entry.revision }))));
      }} onDragOver={folder && !busy ? (event) => event.preventDefault() : undefined} onDrop={folder && !busy ? (event) => { event.stopPropagation(); canvasLibraryDrop(event, onMove, item.id); } : undefined}>
        {batch && <label title={allSelected ? '请先取消全选，再单独选择条目' : undefined} className="mb-[8px] flex items-center gap-[8px] text-[12px] text-text-secondary"><input type="checkbox" checked={selected.has(key)} disabled={busy || allSelected} onChange={() => onSelect(key)} aria-label={`选择${item.name || item.asset?.name || '素材'}`} />选择</label>}
        {folder ? <SeedanceFolderCard name={item.name} count={item.count} images={item.images || []} onOpen={() => !busy && (batch ? onSelect(key) : onOpen(item))} /> : <SeedanceAssetCard asset={canvasLibraryMedia(item)} width="100%" showActions={false} selected={selected.has(key)} onClick={() => !busy && (batch ? onSelect(key) : onOpen(item))} />}
        {!batch && <div className="mt-[8px] flex flex-wrap gap-[4px]">
          {!locked && <Button iconOnly icon={<Pencil size={14} />} title="重命名" aria-label="重命名" disabled={busy} onClick={() => onRename(item)} />}
          {!locked && <Button iconOnly icon={<Move size={14} />} title="移动到" aria-label="移动到" disabled={busy} onClick={() => onDestination([item])} />}
          {!folder && <Button iconOnly icon={<CopyPlus size={14} />} title="添加到文件夹" aria-label="添加到文件夹" disabled={busy} onClick={() => onReference([item])} />}
          {!folder && <Button iconOnly icon={<Download size={14} />} title="下载" aria-label="下载" disabled={busy} onClick={() => onDownload([item])} />}
          <Button iconOnly icon={<Trash2 size={14} />} title="删除" aria-label="删除" disabled={busy} onClick={() => onDelete([item])} />
        </div>}
      </div>;
    })}
  </AssetFolderGrid>;
}
