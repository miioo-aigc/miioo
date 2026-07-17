/**
 * @file ReferenceMentionDropdown.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   ReferenceMentionDropdown 展示 @ 提及筛选、分类 Tab 和 Portal 下拉
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收参考素材、查询词和显式选择/关闭/定位回调，不处理编辑器 value、光标或 API
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MENTION_TYPE_COLOR, MENTION_TYPE_LABEL, MENTION_TABS } from './PanelPromptConstants';

export default function ReferenceMentionDropdown({ referenceItems = [], query, onSelect, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, visibility: 'hidden' });
  const [selectedTab, setSelectedTab] = useState('all');

  const allItems = referenceItems.filter((item) => {
    return item.name && item.name.includes(query);
  });

  useEffect(() => {
    if (!triggerRef?.current || !ref.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + 4;
    setPos((prev) => {
      const next = { top, left: rect.left, width: rect.width, visibility: 'visible' };
      if (prev.top === next.top && prev.left === next.left && prev.visibility === 'visible') return prev;
      return next;
    });
  }, [triggerRef]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filteredItems = selectedTab === 'all'
    ? allItems
    : selectedTab === 'char'
      ? allItems.filter(item => ['char', 'scene', 'prop', 'other'].includes(item._type))
      : allItems.filter(item => item._type === selectedTab);

  // 只显示当前有匹配项的 tab
  const visibleTabs = MENTION_TABS.filter(tab => {
    if (tab.key === 'all') return true;
    if (tab.key === 'char') return allItems.some(item => ['char', 'scene', 'prop', 'other'].includes(item._type));
    return allItems.some(item => item._type === tab.key);
  });

  if (filteredItems.length === 0) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        minWidth: Math.max(pos.width, 160),
        visibility: pos.visibility,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.40)',
        maxHeight: '240px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', gap: '2px', padding: '2px 4px 6px', flexShrink: 0 }}>
        {visibleTabs.map(tab => (
          <div
            key={tab.key}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSelectedTab(tab.key)}
            style={{
              padding: '3px 8px', borderRadius: '4px', fontSize: '12px', lineHeight: '16px',
              cursor: 'pointer', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
              color: selectedTab === tab.key ? '#FFFFFF' : 'rgba(255,255,255,0.50)',
              backgroundColor: selectedTab === tab.key ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition: 'background-color 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => { if (selectedTab !== tab.key) e.currentTarget.style.color = 'rgba(255,255,255,0.80)'; }}
            onMouseLeave={(e) => { if (selectedTab !== tab.key) e.currentTarget.style.color = 'rgba(255,255,255,0.50)'; }}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '180px' }}>
      {filteredItems.map((item) => (
        <div
          key={`${item._type}-${item.id}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item.name, item._type);
          }}
          style={{
            padding: '7px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: '18px',
            color: 'rgba(255,255,255,0.60)',
            cursor: 'pointer',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <span style={{
            fontSize: '11px',
            lineHeight: '16px',
            padding: '0 5px',
            borderRadius: '3px',
            backgroundColor: `${MENTION_TYPE_COLOR[item._type] ?? MENTION_TYPE_COLOR.char}22`,
            color: MENTION_TYPE_COLOR[item._type] ?? MENTION_TYPE_COLOR.char,
            flexShrink: 0,
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          }}>
            {MENTION_TYPE_LABEL[item._type] || '其他'}
          </span>
          {item.name}
        </div>
      ))}
      </div>
    </div>,
    document.body
  );
}

