/**
 * @file AssetsBatchToolbar.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   AssetsBatchToolbar 资产库批量操作工具栏的展示和事件出口
 *   BatchToolbarButton / PlainToolbarButton 保留资产库现有按钮视觉
 *   图标组件                 全选、批量操作、下载和删除图标
 *
 * ─── 数据边界 ───────────────────────────────────────────────────────
 *   通过 props 接收批量状态、选中数量和页面回调；不调用 API、不读 Store、
 *   不创建删除确认弹窗。删除确认和下载实现仍由 AssetsPage 持有。
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 AssetsPage 抽离项目资产和创作资产共用批量工具栏
 *   2026-08-14  非批量模式下新增可选的「仅显示收藏」过滤开关，仅创作资产传入
 */

import { useState } from 'react';
import Checkbox from '../Checkbox';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function BatchToolbarButton({ children, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        padding: '1px',
        boxShadow: '#00000066 3px 3px 8px',
        backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
        outline: '1px solid #00000080',
        border: 'none',
        cursor: 'pointer',
        opacity: pressed ? 0.75 : 1,
        transition: 'opacity 0.1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    >
      <span style={{
        display: 'flex',
        alignItems: 'center',
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: '0%',
        borderRadius: '7px',
        paddingLeft: '15px',
        paddingRight: '15px',
        gap: '4px',
        backgroundColor: pressed ? '#252525' : hovered ? '#1D1E1E' : '#161616',
        transition: 'background-color 0.12s',
      }}>
        {children}
      </span>
    </button>
  );
}

function PlainToolbarButton({ children, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        gap: '4px',
        boxShadow: '#00000066 3px 3px 8px',
        backgroundColor: pressed ? '#252525' : hovered ? '#1D1E1E' : '#161616',
        border: '1px solid #FFFFFF0D',
        outline: '1px solid #00000080',
        cursor: 'pointer',
        transition: 'background-color 0.12s',
        opacity: pressed ? 0.8 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SelectAllIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14 6.667V13C14 13.552 13.552 14 13 14H3C2.448 14 2 13.552 2 13V3C2 2.448 2.448 2 3 2H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 6.667L8.667 9.333L13.667 2.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BatchModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M11.333 1.667H2.667C2.114 1.667 1.667 2.114 1.667 2.667V11.333C1.667 11.886 2.114 12.333 2.667 12.333H11.333C11.886 12.333 12.333 11.886 12.333 11.333V2.667C12.333 2.114 11.886 1.667 11.333 1.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
      <path d="M14.667 4.334V14C14.667 14.368 14.368 14.667 14 14.667H4.334" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.333 6.829L6.333 8.67L9.667 5.24" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, rotate: '180deg', transformOrigin: '50% 50%' }}>
      <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 3.333V14.667H13V3.333H3Z" stroke="#F75F5F" strokeLinejoin="round" />
      <path d="M6.667 6.667V11M9.333 6.667V11M1.333 3.333H14.667M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#F75F5F" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ToolbarLabel({ children, color = '#FFFFFF' }) {
  return <span style={{ fontFamily: FONT, fontSize: '14px', color, whiteSpace: 'nowrap' }}>{children}</span>;
}

function FavoriteFilterToggle({ checked, onToggle }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0, height: '36px', paddingLeft: '8px', paddingRight: '8px', borderRadius: '8px' }}
    >
      <Checkbox checked={checked} hovered={hovered} />
      <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF66', whiteSpace: 'nowrap' }}>仅显示收藏</span>
    </div>
  );
}

export default function AssetsBatchToolbar({
  batchMode,
  selectedCount = 0,
  onEnterBatch,
  onSelectAll,
  onDownload,
  onDelete,
  onCancel,
  favoritesOnly = false,
  onToggleFavoritesOnly,
}) {
  if (!batchMode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px', paddingRight: '24px', height: '48px', flexShrink: 0 }}>
        {typeof onToggleFavoritesOnly === 'function' && (
          <FavoriteFilterToggle checked={favoritesOnly} onToggle={onToggleFavoritesOnly} />
        )}
        <BatchToolbarButton onClick={onEnterBatch}>
          <BatchModeIcon />
          <ToolbarLabel>批量操作</ToolbarLabel>
        </BatchToolbarButton>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: '24px', paddingRight: '24px', gap: '8px', flex: 1, height: '48px' }}>
      <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>已选 {selectedCount} 项</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BatchToolbarButton onClick={onSelectAll}>
          <SelectAllIcon />
          <ToolbarLabel>全选</ToolbarLabel>
        </BatchToolbarButton>
        <BatchToolbarButton onClick={onDownload}>
          <DownloadIcon />
          <ToolbarLabel>下载</ToolbarLabel>
        </BatchToolbarButton>
        <PlainToolbarButton onClick={onDelete}>
          <TrashIcon />
          <ToolbarLabel color="#F75F5F">删除</ToolbarLabel>
        </PlainToolbarButton>
        <PlainToolbarButton onClick={onCancel}>
          <ToolbarLabel color="#FFFFFFCC">取消</ToolbarLabel>
        </PlainToolbarButton>
      </div>
    </div>
  );
}
