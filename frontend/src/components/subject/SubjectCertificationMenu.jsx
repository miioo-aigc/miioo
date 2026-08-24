/**
 * @file SubjectCertificationMenu.jsx
 * @structure-index
 * 角色卡片认证标签下的真人素材组选择菜单。
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DropdownMenu } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function SubjectCertificationMenu({ groups = [], onSelectGroup, onCreateGroup, disabled = false, failed = false }) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const items = [...groups, { id: '__create__', name: '新增真人素材组', create: true }];

  useEffect(() => {
    if (!open) return undefined;
    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    };
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [open]);

  const toggle = (event) => {
    event.stopPropagation();
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    setPosition(rect ? { top: rect.bottom + 4, right: window.innerWidth - rect.right } : null);
    setOpen((value) => !value);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={toggle}
        className="flex items-center gap-[4px] border-0 rounded-tl-none rounded-bl-[6px] px-[8px] py-[4px]"
        style={{ backgroundColor: failed ? 'var(--color-status-wrong)' : 'var(--color-brand-main)', color: '#090909', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', cursor: disabled ? 'default' : 'pointer' }}
      >{failed ? '认证失败' : '真人认证 >'}</button>
      {open && position && createPortal(
        <div style={{ position: 'fixed', top: position.top, right: position.right, zIndex: 10001 }}>
          <DropdownMenu
            items={items.map((item) => ({
              key: item.id || item.name,
              label: item.name || '未命名素材组',
              onClick: () => (item.create ? onCreateGroup?.() : onSelectGroup?.(item)),
            }))}
            onClose={() => setOpen(false)}
            style={{ position: 'relative', inset: 'auto', marginBottom: 0 }}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
