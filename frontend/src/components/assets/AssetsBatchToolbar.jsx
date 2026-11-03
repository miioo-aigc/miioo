/**
 * @file AssetsBatchToolbar.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   AssetsBatchToolbar 资产库批量操作工具栏的展示和事件出口
 *   BatchToolbarButton       统一复用次级按钮，删除仅可用悬停时变红
 *   图标组件                 全选、批量操作、下载和删除图标
 *
 * ─── 数据边界 ───────────────────────────────────────────────────────
 *   通过 props 接收批量状态、选中数量和页面回调；不调用 API、不读 Store、
 *   不创建删除确认弹窗。删除确认和下载实现由各业务面板持有。
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-11-02  批量操作展开按钮统一为次级样式，删除图标与文字仅悬停变红
 *   2026-11-02  画布资产复用工具栏，支持可选移动按钮、禁用规则与嵌入布局
 *   2026-10-27  项目资产和创作资产的批量操作入口统一复用二级按钮
 *   2026-07-15  从 AssetsPage 抽离项目资产和创作资产共用批量工具栏
 *   2026-08-14  非批量模式下新增可选的「仅显示收藏」过滤开关，仅创作资产传入
 */

import { useState } from 'react';
import { Move } from 'lucide-react';
import Checkbox from '../Checkbox';
import { Button, DeleteIcon } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function BatchToolbarButton({ children, onClick, disabled = false, title, dangerOnHover = false }) {
  return (
    <Button
      variant="secondary"
      size="large"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={dangerOnHover ? '[&:enabled:hover>span]:text-btn-danger-text-hover' : ''}
      style={{ fontFamily: FONT }}
    >
      {children}
    </Button>
  );
}

function SelectAllIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14 6.667V13C14 13.552 13.552 14 13 14H3C2.448 14 2 13.552 2 13V3C2 2.448 2.448 2 3 2H10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 6.667L8.667 9.333L13.667 2.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M8.003 4.7V14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 8.667L8 4.667L12 8.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 2H12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ToolbarLabel({ children }) {
  return <span style={{ fontFamily: FONT, fontSize: '14px', whiteSpace: 'nowrap' }}>{children}</span>;
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
      <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>仅显示收藏</span>
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
  onMove,
  disabled = false,
  selectAllDisabled = false,
  downloadDisabled = false,
  deleteDisabled = false,
  moveDisabled = false,
  downloadTitle,
  moveTitle,
  allSelected = false,
  embedded = false,
  favoritesOnly = false,
  onToggleFavoritesOnly,
}) {
  if (!batchMode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: embedded ? 0 : 24, paddingRight: embedded ? 0 : 24, height: embedded ? 36 : 48, flexShrink: 0 }}>
        {typeof onToggleFavoritesOnly === 'function' && (
          <FavoriteFilterToggle checked={favoritesOnly} onToggle={onToggleFavoritesOnly} />
        )}
        <Button variant="secondary" size="large" icon={<BatchModeIcon />} disabled={disabled} onClick={onEnterBatch} style={{ fontFamily: FONT }}>
          批量操作
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: embedded ? 0 : 24, paddingRight: embedded ? 0 : 24, gap: '8px', flex: 1, height: embedded ? 36 : 48 }}>
      <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>已选 {selectedCount} 项</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BatchToolbarButton onClick={onSelectAll} disabled={disabled || selectAllDisabled}>
          <SelectAllIcon />
          <ToolbarLabel>{allSelected ? '取消全选' : '全选'}</ToolbarLabel>
        </BatchToolbarButton>
        {onMove && <BatchToolbarButton onClick={onMove} disabled={disabled || moveDisabled} title={moveTitle}><Move size={16} /><ToolbarLabel>移动</ToolbarLabel></BatchToolbarButton>}
        <BatchToolbarButton onClick={onDownload} disabled={disabled || downloadDisabled} title={downloadTitle}>
          <DownloadIcon />
          <ToolbarLabel>下载</ToolbarLabel>
        </BatchToolbarButton>
        <BatchToolbarButton dangerOnHover onClick={onDelete} disabled={disabled || deleteDisabled}>
          <DeleteIcon size={16} color="currentColor" />
          <ToolbarLabel>删除</ToolbarLabel>
        </BatchToolbarButton>
        <BatchToolbarButton onClick={onCancel} disabled={disabled}>
          <ToolbarLabel>取消</ToolbarLabel>
        </BatchToolbarButton>
      </div>
    </div>
  );
}
