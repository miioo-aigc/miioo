/**
 * @file CanvasCenterActions.jsx
 * @structure-index
 *
 * ─── 交互区 ─────────────────────────────────────────────────────
 *   CanvasCenterActions 画布中央的素材和创作入口
 */

import { useState } from 'react';
import { ChevronDown, FileText, Image, Plus, Video } from 'lucide-react';

export default function CanvasCenterActions({ onAction }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { key: 'script', label: '剧本创作', icon: FileText },
    { key: 'image', label: '图片创作', icon: Image },
    { key: 'video', label: '视频创作', icon: Video },
  ];

  return (
    <div className="pointer-events-auto relative z-10 flex flex-wrap items-center justify-center gap-[16px]">
      <div className="relative">
        <button type="button" className="flex h-[40px] cursor-pointer items-center gap-[8px] rounded-[12px] border border-white-10 bg-white-5 px-[14px] text-[13px] text-text-primary hover:bg-white-10" onClick={() => setOpen((value) => !value)}>
          <Plus size={16} />
          <span>添加素材</span>
          <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {open && (
          <div className="absolute bottom-[48px] left-0 flex w-[132px] flex-col gap-[2px] rounded-[9px] border border-white-10 bg-surface-modal p-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            {['文本', '图片', '视频'].map((label) => (
              <button key={label} type="button" className="cursor-pointer rounded-[6px] border-0 bg-transparent px-[10px] py-[8px] text-left text-[13px] text-text-secondary hover:bg-white-5 hover:text-text-primary" onClick={() => { setOpen(false); onAction('material', label); }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {actions.map(({ key, label, icon: Icon }) => (
        <button key={key} type="button" className="flex h-[40px] cursor-pointer items-center gap-[8px] rounded-[12px] border border-white-10 bg-white-5 px-[14px] text-[13px] text-text-primary hover:bg-white-10" onClick={() => onAction(key)}>
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
