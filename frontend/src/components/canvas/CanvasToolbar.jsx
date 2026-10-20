/**
 * @file CanvasToolbar.jsx
 * @structure-index
 *
 * ─── 交互区 ─────────────────────────────────────────────────────
 *   AddNodeMenu 共用添加节点菜单的工具栏定位容器 L123
 *   CanvasToolbar 画布底部悬浮工具栏、菜单和动作出口 L127
 * ─── 更新记录 ───────────────────────────────────────────────────
 *   2026-10-19：地图与分享之间新增磁铁吸附开关，默认关闭，使用 aria-pressed 表达状态。
 *   2026-10-15 分享菜单新增指定链接和导出图标，颜色跟随菜单文字。
 *   2026-10-14 画布列表抽离 CanvasListMenu，接通新增、切换与行内重命名；2026-10-19 更多菜单接通复制与删除。
 *   2026-10-09 分享复用标准菜单，宽度自适应内容，提供复制画布链接和导出画布入口
 *   2026-10-09 搜索改为独立中央弹窗，仅通过 onOpenSearch 通知页面
 *   2026-09-28 复用图标按钮新增撤销重做；统一添加菜单，工具栏仅负责定位
 *   2026-09-29 撤销重做移动到搜索前，仅在至少一个历史动作可用时显示
 *   2026-09-29 分割线右侧工具默认折叠为更多按钮，展开和收起使用 Gooey 风格过渡
 *   2026-10-08 收起工具按钮改用左尖括号图标
 *   2026-10-09 恢复更多工具中的搜索和分享；保留收起间距、精简画布列表和工具快捷键
 *   2026-10-14 移除工具栏本地上传入口及专用文件选择器；拖拽和节点内上传保持不变
 */

import { useEffect, useRef, useState } from 'react';
import { DropdownMenu, IconButton, Tooltip } from '../ui';
import { ChevronLeft, Magnet, MoreHorizontal, Redo2, Undo2 } from 'lucide-react';
import CanvasNodeAddMenu from './CanvasNodeAddMenu.jsx';
import CanvasListMenu from './CanvasListMenu.jsx';
import './CanvasToolbar.css';

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  'aria-hidden': true,
};

function GradientAddIcon() {
  return (
    <svg {...ICON_PROPS}>
      <defs>
        <linearGradient id="canvas-toolbar-add-fill" x1="8" y1="1.333" x2="8" y2="14.667" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7AE5B9" />
          <stop offset="1" stopColor="#2DC3E1" />
        </linearGradient>
      </defs>
      <path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="url(#canvas-toolbar-add-fill)" stroke="url(#canvas-toolbar-add-fill)" strokeLinejoin="round" />
      <path d="M8 5.333V10.667M5.333 8H10.667" stroke="var(--color-surface-base)" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PointerIcon() {
  return <svg {...ICON_PROPS}><path d="M2.667 2L14.333 8.333L8 9L4.665 14.667L2.667 2Z" stroke="var(--color-white-80)" strokeLinejoin="round" /></svg>;
}

function AssetLibraryIcon() {
  return <svg {...ICON_PROPS}><path d="M1.667 2.667C1.667 2.298 1.965 2 2.333 2H6.333L8 4H13.667C14.035 4 14.333 4.298 14.333 4.667V13.333C14.333 13.701 14.035 14 13.667 14H2.333C1.965 14 1.667 13.701 1.667 13.333V2.667Z" stroke="var(--color-white-80)" strokeLinejoin="round" /><path d="M8 6.667L8.748 8.304L10.536 8.509L9.21 9.726L9.567 11.491L8 10.605L6.433 11.491L6.79 9.726L5.464 8.509L7.252 8.304L8 6.667Z" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NodeListIcon() {
  return <svg {...ICON_PROPS}><path d="M6 2H11.333V4H6V2ZM6 7H12.667V9H6V7ZM6 12H14.667V14H6V12Z" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.667 3.667C3.035 3.667 3.333 3.368 3.333 3C3.333 2.632 3.035 2.333 2.667 2.333C2.298 2.333 2 2.632 2 3C2 3.368 2.298 3.667 2.667 3.667ZM2.667 8.667C3.035 8.667 3.333 8.368 3.333 8C3.333 7.632 3.035 7.333 2.667 7.333C2.298 7.333 2 7.632 2 8C2 8.368 2.298 8.667 2.667 8.667ZM2.667 13.667C3.035 13.667 3.333 13.368 3.333 13C3.333 12.632 3.035 12.333 2.667 12.333C2.298 12.333 2 12.632 2 13C2 13.368 2.298 13.667 2.667 13.667Z" stroke="var(--color-white-80)" /></svg>;
}

function SearchIcon() {
  return <svg {...ICON_PROPS}><path d="M7 12.667C10.13 12.667 12.667 10.13 12.667 7C12.667 3.87 10.13 1.333 7 1.333C3.87 1.333 1.333 3.87 1.333 7C1.333 10.13 3.87 12.667 7 12.667Z" stroke="var(--color-white-80)" strokeLinejoin="round" /><path d="M11.074 11.074L13.902 13.902" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function MiniMapIcon() {
  return <svg {...ICON_PROPS}><path d="M5.667 4L1.333 2V12L5.667 14L10.333 12L14.667 14V4L10.333 2L5.667 4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.333 2V12M5.667 4V14M3.5 3L5.667 4L10.333 2L12.5 3M3.5 13L5.667 14L10.333 12L12.5 13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ShareNodesIcon() {
  return <svg {...ICON_PROPS}><path d="M11.667 5.333C12.587 5.333 13.333 4.587 13.333 3.667C13.333 2.746 12.587 2 11.667 2C10.746 2 10 2.746 10 3.667C10 4.587 10.746 5.333 11.667 5.333ZM4.333 9.667C5.254 9.667 6 8.921 6 8C6 7.08 5.254 6.333 4.333 6.333C3.413 6.333 2.667 7.08 2.667 8C2.667 8.921 3.413 9.667 4.333 9.667ZM10 4.525L5.78 7.082M5.78 8.855L10.226 11.482M11.667 10.667C12.587 10.667 13.333 11.413 13.333 12.333C13.333 13.254 12.587 14 11.667 14C10.746 14 10 13.254 10 12.333C10 11.413 10.746 10.667 11.667 10.667Z" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const TOOL_ITEMS = [
  { key: 'add', label: '添加节点', icon: GradientAddIcon },
  { key: 'move', label: '移动', icon: PointerIcon },
  { key: 'assets', label: '从资产库选择', icon: AssetLibraryIcon },
  { key: 'canvases', label: '画布列表', icon: NodeListIcon },
];

const COLLAPSIBLE_TOOL_ITEMS = [
  { key: 'search', label: '搜索节点', icon: SearchIcon },
  { key: 'map', label: '预览地图', icon: MiniMapIcon },
  { key: 'snap', label: '网格吸附', icon: Magnet },
  { key: 'share', label: '分享', icon: ShareNodesIcon },
];

function ToolbarMenu({ children, className = '' }) {
  return <div className={`absolute bottom-[40px] left-1/2 z-30 min-w-[148px] -translate-x-1/2 rounded-[8px] border border-stroke-normal bg-surface-card p-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${className}`}>{children}</div>;
}

function MenuButton({ children, onClick, active = false }) {
  return <button type="button" onClick={onClick} className={`flex min-h-[32px] w-full cursor-pointer items-center rounded-[6px] border-0 px-[10px] py-[6px] text-left text-[13px] leading-[18px] transition-colors ${active ? 'bg-white-10 text-text-primary' : 'bg-transparent text-text-secondary hover:bg-white-5 hover:text-text-primary'}`}>{children}</button>;
}

function ShareMenu({ onShare, onClose }) {
  return <DropdownMenu width="max-content" onClose={onClose} style={{ bottom: '40px', left: '50%', right: 'auto', transform: 'translateX(-50%)', marginBottom: 0, whiteSpace: 'nowrap' }} items={[
    { key: 'copy-link', label: '复制画布链接', icon: (
      <svg {...ICON_PROPS} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.25331 5.45772L10.3 2.41106C11.1871 1.52395 12.6449 1.54349 13.5562 2.45471C14.4674 3.36592 14.4869 4.82379 13.5998 5.71089L10.9547 8.35599" />
        <path d="M5.03249 7.66772L2.38739 10.3128C1.50025 11.2 1.51982 12.6578 2.43102 13.569C3.34225 14.4803 4.80009 14.4998 5.68722 13.6127L8.73389 10.566" />
        <path d="M7.29688 8.71384C6.38564 7.80261 6.36611 6.34477 7.25321 5.45764" />
        <path d="M8.73376 7.26611C9.64499 8.17735 9.66453 9.63518 8.77743 10.5223" />
      </svg>
    ), onClick: () => onShare?.('copy-link') },
    { key: 'export-canvas', label: '导出画布', icon: (
      <svg {...ICON_PROPS} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 8.33337H14" />
        <path d="M12 6.33337L14 8.33337L12 10.3334" />
        <path d="M7 2V8.66667C7 10.913 4.94493 13.1889 3 14" />
        <path d="M14 4.66667V3C14 2.44772 13.5523 2 13 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V11.8333" />
      </svg>
    ), onClick: () => onShare?.('export-canvas') },
  ]} />;
}

function MoveMenu({ activeTool, onToolChange }) {
  return <ToolbarMenu className="w-[144px]">{[{ tool: 'select', label: '移动', key: 'V' }, { tool: 'hand', label: '抓手工具', key: 'H' }].map((item) => <MenuButton key={item.tool} active={activeTool === item.tool} onClick={() => onToolChange(item.tool)}><span className="flex w-full items-center justify-between gap-[12px]"><span>{item.label}</span><span className="text-text-hint">{item.key}</span></span></MenuButton>)}</ToolbarMenu>;
}

function AddNodeMenu({ onAddNode }) {
  return <div className="absolute bottom-[40px] left-1/2 z-30 -translate-x-1/2"><CanvasNodeAddMenu onAddNode={onAddNode} /></div>;
}

export default function CanvasToolbar({ activeTool, onToolChange, showMiniMap, onMiniMapChange, snapEnabled = false, onSnapChange, onOpenSearch, canvases = [], activeCanvasId, onSelectCanvas, onCreateCanvas, onRenameCanvas, onDuplicateCanvas, onDeleteCanvas, canvasListBusy, onOpenAssetPicker, onAddNode, onShare, canUndo, canRedo, onUndo, onRedo }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [rightToolsExpanded, setRightToolsExpanded] = useState(false);
  const toolbarRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!toolbarRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleToolClick = (key) => {
    if (key === 'snap') { setOpenMenu(null); onSnapChange?.(!snapEnabled); return; }
    if (key === 'map') {
      onMiniMapChange(!showMiniMap);
      return;
    }
    if (key === 'assets') { setOpenMenu(null); onOpenAssetPicker?.(); return; }
    if (key === 'search') { setOpenMenu(null); onOpenSearch?.(); return; }
    setOpenMenu((current) => (current === key ? null : key));
  };

  const renderTool = ({ key, label, icon: Icon }) => {
    const selected = key === 'move' ? activeTool === 'hand' : key === 'map' ? showMiniMap : key === 'snap' ? snapEnabled : openMenu === key;
    return <div key={key} className="relative flex size-[32px] shrink-0 items-center justify-center">
      {openMenu === key && key === 'add' && <AddNodeMenu onAddNode={(type) => { onAddNode?.(type); setOpenMenu(null); }} />}
      {openMenu === key && key === 'move' && <MoveMenu activeTool={activeTool} onToolChange={(tool) => { onToolChange(tool); setOpenMenu(null); }} />}
      {openMenu === key && key === 'canvases' && <CanvasListMenu canvases={canvases} activeCanvasId={activeCanvasId} busy={canvasListBusy} onRenameCanvas={onRenameCanvas} onDuplicateCanvas={async (id) => { if (await onDuplicateCanvas(id)) setOpenMenu(null); }} onDeleteCanvas={onDeleteCanvas} onSelectCanvas={async (id) => { if (await onSelectCanvas?.(id)) setOpenMenu(null); }} onCreateCanvas={async () => { if (await onCreateCanvas?.()) setOpenMenu(null); }} />}
      {openMenu === key && key === 'share' && <ShareMenu onShare={onShare} onClose={() => setOpenMenu(null)} />}
      <Tooltip label={label} placement="top" offset={8}><button type="button" title={label} aria-label={label} aria-pressed={selected} onClick={() => handleToolClick(key)} className={`flex size-[32px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-colors ${selected ? 'bg-white-10' : 'hover:bg-white-5'} ${(key === 'snap' || key === 'map') && selected ? 'text-text-accent' : 'text-white-80'}`}><Icon size={16} strokeWidth={1.7} /></button></Tooltip>
    </div>;
  };

  return (
    <div ref={toolbarRef} className="absolute bottom-[24px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[12px] overflow-visible rounded-full border border-stroke-normal bg-surface-content-area px-[16px] py-[4px] outline outline-1 outline-black-90">
      {TOOL_ITEMS.map(renderTool)}
      <div className="h-[16px] w-px shrink-0 rounded-full bg-stroke-normal" />
      {!rightToolsExpanded && <Tooltip label="更多工具" placement="top" offset={8}><button type="button" aria-label="展开更多工具" title="展开更多工具" onClick={() => setRightToolsExpanded(true)} className="flex size-[32px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 hover:bg-white-5"><MoreHorizontal size={16} strokeWidth={1.7} color="var(--color-white-80)" /></button></Tooltip>}
      <div className={`canvas-toolbar__right-tools ${rightToolsExpanded ? 'canvas-toolbar__right-tools--expanded' : ''}`} aria-hidden={!rightToolsExpanded} inert={!rightToolsExpanded}>
        <div className="canvas-toolbar__right-tools-content">
          {rightToolsExpanded && (canUndo || canRedo) && <>
            <Tooltip label="撤销" placement="top"><span><IconButton aria-label="撤销" variant="link" className="!size-[32px] rounded-full hover:bg-white-5" contentClassName="!text-text-secondary" disabled={!canUndo} onClick={onUndo}><Undo2 size={16} /></IconButton></span></Tooltip>
            <Tooltip label="重做" placement="top"><span><IconButton aria-label="重做" variant="link" className="!size-[32px] rounded-full hover:bg-white-5" contentClassName="!text-text-secondary" disabled={!canRedo} onClick={onRedo}><Redo2 size={16} /></IconButton></span></Tooltip>
          </>}
          {COLLAPSIBLE_TOOL_ITEMS.filter((item) => !item.hidden).map(renderTool)}
          {rightToolsExpanded && <Tooltip label="收起工具" placement="top" offset={8}><button type="button" aria-label="收起工具" title="收起工具" onClick={() => { setOpenMenu(null); setRightToolsExpanded(false); }} className="flex size-[32px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 hover:bg-white-5"><ChevronLeft size={16} strokeWidth={1.7} color="var(--color-white-80)" /></button></Tooltip>}
        </div>
      </div>
    </div>
  );
}
