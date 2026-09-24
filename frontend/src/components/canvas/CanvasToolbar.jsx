/**
 * @file CanvasToolbar.jsx
 * @structure-index
 *
 * ─── 交互区 ─────────────────────────────────────────────────────
 *   CanvasToolbar 画布底部悬浮工具栏、菜单和动作出口
 */

import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '../ui';
import CanvasNodeAddMenu from './CanvasNodeAddMenu.jsx';

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
  return <svg {...ICON_PROPS}><path d="M5.667 4L1.333 2V12L5.667 14L10.333 12L14.667 14V4L10.333 2L5.667 4Z" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.333 2V12M5.667 4V14M3.5 3L5.667 4L10.333 2L12.5 3M3.5 13L5.667 14L10.333 12L12.5 13" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ShareNodesIcon() {
  return <svg {...ICON_PROPS}><path d="M11.667 5.333C12.587 5.333 13.333 4.587 13.333 3.667C13.333 2.746 12.587 2 11.667 2C10.746 2 10 2.746 10 3.667C10 4.587 10.746 5.333 11.667 5.333ZM4.333 9.667C5.254 9.667 6 8.921 6 8C6 7.08 5.254 6.333 4.333 6.333C3.413 6.333 2.667 7.08 2.667 8C2.667 8.921 3.413 9.667 4.333 9.667ZM10 4.525L5.78 7.082M5.78 8.855L10.226 11.482M11.667 10.667C12.587 10.667 13.333 11.413 13.333 12.333C13.333 13.254 12.587 14 11.667 14C10.746 14 10 13.254 10 12.333C10 11.413 10.746 10.667 11.667 10.667Z" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const TOOL_ITEMS = [
  { key: 'add', label: '添加节点', icon: GradientAddIcon },
  { key: 'move', label: '移动', icon: PointerIcon },
  { key: 'assets', label: '从资产库选择', icon: AssetLibraryIcon },
  { key: 'canvases', label: '画布列表', icon: NodeListIcon },
  { key: 'search', label: '搜索节点', icon: SearchIcon, separated: true },
  { key: 'map', label: '预览地图', icon: MiniMapIcon },
  { key: 'share', label: '分享', icon: ShareNodesIcon },
];

const NODE_TYPES = [
  { value: 'all', label: '全部类型' },
  { value: 'text', label: '文本' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
];

function ToolbarMenu({ children, className = '' }) {
  return <div className={`absolute bottom-[40px] left-1/2 z-30 min-w-[148px] -translate-x-1/2 rounded-[8px] border border-stroke-normal bg-surface-card p-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${className}`}>{children}</div>;
}

function MenuButton({ children, onClick, active = false }) {
  return <button type="button" onClick={onClick} className={`flex min-h-[32px] w-full cursor-pointer items-center rounded-[6px] border-0 px-[10px] py-[6px] text-left text-[13px] leading-[18px] transition-colors ${active ? 'bg-white-10 text-text-primary' : 'bg-transparent text-text-secondary hover:bg-white-5 hover:text-text-primary'}`}>{children}</button>;
}

function SearchPanel({ nodes, query, type, onQueryChange, onTypeChange }) {
  return (
    <ToolbarMenu className="w-[248px] p-[8px]">
      <input autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索节点名称" className="mb-[8px] h-[32px] w-full rounded-[6px] border border-stroke-normal bg-input-bg-normal px-[10px] text-[13px] text-text-primary outline-none placeholder:text-text-hint focus:border-stroke-active" />
      <div className="mb-[6px] flex gap-[4px] overflow-x-auto">
        {NODE_TYPES.map((item) => <button key={item.value} type="button" onClick={() => onTypeChange(item.value)} className={`shrink-0 rounded-[4px] border-0 px-[8px] py-[4px] text-[12px] ${type === item.value ? 'bg-white-10 text-text-primary' : 'bg-transparent text-text-hint hover:bg-white-5'}`}>{item.label}</button>)}
      </div>
      <div className="max-h-[160px] overflow-y-auto text-[12px] text-text-hint">
        {nodes.length === 0 ? '暂无节点' : `${nodes.filter((node) => matchesNode(node, query, type)).length} 个匹配节点`}
      </div>
    </ToolbarMenu>
  );
}

function matchesNode(node, query, type) {
  const name = String(node?.data?.label || node?.data?.name || node?.type || '').toLowerCase();
  const nodeType = String(node?.data?.nodeType || node?.type || '').toLowerCase();
  return (!query || name.includes(query.trim().toLowerCase())) && (type === 'all' || nodeType === type);
}

function CanvasListMenu({ canvases, activeCanvasId, onSelectCanvas, onCreateCanvas }) {
  const items = canvases.length ? canvases : [{ id: activeCanvasId || 'current', name: '画布1' }];
  return <ToolbarMenu className="w-[176px]">
    <div className="px-[10px] py-[6px] text-[12px] text-text-hint">当前项目画布</div>
    {items.map((canvas) => <MenuButton key={canvas.id} active={canvas.id === activeCanvasId} onClick={() => onSelectCanvas?.(canvas.id)}>{canvas.name || '未命名画布'}</MenuButton>)}
    <div className="my-[4px] h-px bg-stroke-normal" />
    <MenuButton onClick={onCreateCanvas}>＋ 新增画布</MenuButton>
  </ToolbarMenu>;
}

function ShareMenu({ onShare }) {
  return <ToolbarMenu className="w-[160px]"><MenuButton onClick={() => onShare?.('copy-link')}>复制分享链接</MenuButton><MenuButton onClick={() => onShare?.('export-nodes')}>导出节点</MenuButton></ToolbarMenu>;
}

function MoveMenu({ activeTool, onToolChange }) {
  return <ToolbarMenu className="w-[144px]"><MenuButton active={activeTool === 'select'} onClick={() => onToolChange('select')}>移动</MenuButton><MenuButton active={activeTool === 'hand'} onClick={() => onToolChange('hand')}>抓手工具</MenuButton></ToolbarMenu>;
}

function AddNodeMenu({ onAddNode }) {
  return <ToolbarMenu className="w-[144px]"><CanvasNodeAddMenu onAddNode={onAddNode} /></ToolbarMenu>;
}

export default function CanvasToolbar({ activeTool, onToolChange, showMiniMap, onMiniMapChange, nodes = [], canvases = [], activeCanvasId, onSelectCanvas, onCreateCanvas, onOpenAssetPicker, onAddNode, onShare }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [nodeQuery, setNodeQuery] = useState('');
  const [nodeType, setNodeType] = useState('all');
  const toolbarRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!toolbarRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleToolClick = (key) => {
    if (key === 'map') {
      onMiniMapChange(!showMiniMap);
      return;
    }
    if (key === 'assets') { setOpenMenu(null); onOpenAssetPicker?.(); return; }
    setOpenMenu((current) => (current === key ? null : key));
  };

  return (
    <div ref={toolbarRef} className="absolute bottom-[24px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[12px] overflow-visible rounded-full border border-stroke-normal bg-surface-content-area px-[16px] py-[4px] outline outline-1 outline-black-90">
      {TOOL_ITEMS.map(({ key, label, icon: Icon, separated }) => {
        const selected = key === 'move' ? activeTool === 'hand' : key === 'map' ? showMiniMap : openMenu === key;
        return (
          <div key={key} className="flex items-center gap-[12px]">
            {separated && <div className="h-[16px] w-px shrink-0 rounded-full bg-stroke-normal" />}
            <div className="relative flex size-[32px] shrink-0 items-center justify-center">
        {openMenu === key && key === 'add' && <AddNodeMenu onAddNode={(type) => { onAddNode?.(type); setOpenMenu(null); }} />}
        {openMenu === key && key === 'move' && <MoveMenu activeTool={activeTool} onToolChange={(tool) => { onToolChange(tool); setOpenMenu(null); }} />}
        {openMenu === key && key === 'canvases' && <CanvasListMenu canvases={canvases} activeCanvasId={activeCanvasId} onSelectCanvas={(id) => { onSelectCanvas?.(id); setOpenMenu(null); }} onCreateCanvas={() => { onCreateCanvas?.(); setOpenMenu(null); }} />}
        {openMenu === key && key === 'search' && <SearchPanel nodes={nodes} query={nodeQuery} type={nodeType} onQueryChange={setNodeQuery} onTypeChange={setNodeType} />}
        {openMenu === key && key === 'share' && <ShareMenu onShare={(action) => { onShare?.(action); setOpenMenu(null); }} />}
            <Tooltip label={label} placement="top" offset={8}><button type="button" title={label} aria-label={label} aria-pressed={selected} onClick={() => handleToolClick(key)} className={`flex size-[32px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-colors ${selected ? 'bg-white-10' : 'hover:bg-white-5'}`}><Icon size={16} strokeWidth={1.7} /></button></Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}
