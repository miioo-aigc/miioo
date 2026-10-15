import { Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { EditExportIcon, EditFilmIcon } from '../ui/EditIcons';

export default function EditMethodActions({ stacked, busy, hasMaterials, onExport, onDownload, onOnlineEdit }) {
  return (
    <div aria-label="剪辑方式" className={`flex ${stacked ? 'w-[152px] flex-col gap-[12px]' : 'flex-wrap items-center gap-[8px]'}`}>
      <Button className={`${stacked ? '' : 'order-2'} cursor-pointer`} variant="accent" icon={<EditExportIcon />} onClick={onExport} loading={busy === 'export'} disabled={!hasMaterials || Boolean(busy)}>导出剪映格式</Button>
      <Button className="cursor-pointer" icon={<Download size={16} />} onClick={onDownload} loading={busy === 'download'} disabled={!hasMaterials || Boolean(busy)} contentClassName="text-[13px] leading-[18px]">批量下载视频</Button>
      {stacked && <Button className="cursor-pointer" icon={<EditFilmIcon />} onClick={onOnlineEdit} disabled={Boolean(busy)} contentClassName="text-[13px] leading-[18px]">在线剪辑</Button>}
    </div>
  );
}
