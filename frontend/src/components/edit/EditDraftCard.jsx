import { useState } from 'react';
import { Copy, Pencil, EllipsisVertical } from 'lucide-react';
import { DropdownMenu, DeleteIcon } from '../ui';
import { formatRelativeTime } from '../../utils/formatTime';

export default function EditDraftCard({ draft, index, disabled, onOpen, onRename, onCopy, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const name = draft.name || '草稿' + String(index + 1).padStart(2, '0');
  const unavailable = disabled || !draft.id;
  const savedAt = draft.updatedAt || draft.createdAt;
  const savedDate = savedAt ? new Date(savedAt) : null;
  const validSavedDate = savedDate && Number.isFinite(savedDate.getTime());
  return (
    <div className="group relative aspect-[3/2] w-full min-w-0 rounded-[8px] border border-stroke-normal bg-[#1D1E1E] transition-[border-color,transform] duration-150 hover:border-white/[0.22]" style={{ zIndex: menuOpen ? 1 : undefined }}>
      <div role="button" tabIndex={unavailable ? -1 : 0} aria-label={'打开草稿：' + name} onClick={() => !unavailable && onOpen(draft.id)} onKeyDown={(event) => { if (!unavailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(draft.id); } }} className="absolute inset-0 cursor-pointer overflow-hidden rounded-[8px] text-left focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-brand-main" style={{ opacity: unavailable ? 0.5 : 1 }}>
        <span className="pointer-events-none absolute inset-0 rounded-[8px] bg-white/[0.04] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
        <span className="pointer-events-none absolute inset-x-0 bottom-[57px] top-[16px] flex items-center justify-center">
          <svg viewBox="0 0 163.84 163.84" width="32" height="32" aria-hidden="true" className="text-text-hint" fill="currentColor">
            <path d="M81.921 114.103a5.851 5.851 90 0 1 5.852 5.851v11.703a5.851 5.851 90 0 1-11.703 0v-11.703a5.851 5.851 90 0 1 5.851-5.851z m-17.554-81.92a5.851 5.851 90 0 1 5.811 5.166L70.219 38.034a5.851 5.851 90 0 1-5.852 5.851h-5.851v11.703h5.851a5.851 5.851 90 0 1 5.811 5.167L70.219 61.44a5.851 5.851 90 0 1-5.852 5.851H32.184v29.257H64.367a5.851 5.851 90 0 1 0 11.703h-5.851v11.703h5.851a5.851 5.851 90 0 1 5.811 5.167L70.219 125.805a5.851 5.851 90 0 1-5.852 5.852H26.333a5.851 5.851 90 0 1-5.852-5.852v-87.771a5.851 5.851 90 0 1 5.852-5.851H64.367z m73.143 0a5.851 5.851 90 0 1 5.81 5.166l0.041 0.685v87.771a5.851 5.851 90 0 1-5.851 5.852H99.476a5.851 5.851 90 0 1 0-11.703h5.851v-11.703h-5.851a5.851 5.851 90 0 1-5.811-5.167L93.624 102.4a5.851 5.851 90 0 1 5.852-5.852h32.183v-29.257H99.476a5.851 5.851 90 0 1 0-11.703h5.851v-11.703h-5.851a5.851 5.851 90 0 1-5.811-5.166L93.624 38.034a5.851 5.851 90 0 1 5.852-5.851h38.034z m-5.851 76.068H117.03v11.703h14.629v-11.703zM46.813 108.251H32.184v11.703H46.813v-11.703z m35.108-23.406a5.851 5.851 90 0 1 5.852 5.852v11.703a5.851 5.851 90 0 1-11.703 0v-11.703a5.851 5.851 90 0 1 5.851-5.852z m0-29.257a5.851 5.851 90 0 1 5.852 5.852v11.702a5.851 5.851 90 0 1-11.703 0v-11.702a5.851 5.851 90 0 1 5.851-5.852z m49.738-11.703H117.03v11.703h14.629v-11.703zM46.813 43.885H32.184v11.703H46.813v-11.703z m35.108-17.554a5.851 5.851 90 0 1 5.852 5.852v11.702a5.851 5.851 90 0 1-11.703 0v-11.702a5.851 5.851 90 0 1 5.851-5.852z" />
          </svg>
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[80px] rounded-b-[12px]" style={{ background: 'linear-gradient(to top, #000000CC, transparent)' }} />
        <span className="absolute inset-x-0 bottom-0 flex min-w-0 items-end justify-between gap-[8px] p-[12px]">
          <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
            <span title={name} style={{ fontFamily: "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '14px', lineHeight: '1.2', color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span title={validSavedDate ? `最近保存：${savedDate.toLocaleString('zh-CN', { hour12: false })}` : '最近保存时间未知'} style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '12px', color: '#FFFFFF66' }}>最近保存：{validSavedDate ? formatRelativeTime(savedAt) : '未知'}</span>
          </span>
          <span className="relative z-10 h-[28px] w-[28px] shrink-0">
            <button type="button" aria-label={'更多操作：' + name} aria-haspopup="menu" aria-expanded={menuOpen} disabled={unavailable} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value); }} className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-[6px] bg-black/[0.4] text-text-primary opacity-0 transition-opacity hover:bg-black/[0.55] group-hover:opacity-100 group-focus-within:opacity-100 disabled:cursor-not-allowed" style={menuOpen ? { opacity: 1, background: 'rgba(0,0,0,0.65)' } : undefined}>
              <EllipsisVertical size={16} />
            </button>
            {menuOpen && !unavailable && <DropdownMenu onClose={() => setMenuOpen(false)} items={[
              { key: 'rename', label: '重命名', icon: <Pencil size={16} />, onClick: () => onRename(draft) },
              { key: 'copy', label: '复制草稿', icon: <Copy size={16} />, onClick: () => onCopy(draft) },
              { key: 'delete', label: '删除', icon: <DeleteIcon color="currentColor" />, danger: true, onClick: () => onDelete(draft) },
            ]} />}
          </span>
        </span>
      </div>
    </div>
  );
}
