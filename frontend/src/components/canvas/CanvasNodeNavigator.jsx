/**
 * @file CanvasNodeNavigator.jsx
 * @structure-index
 *   CanvasNodeNavigator 左下角节点导航器；收起为计数入口，展开为可搜索、筛选、分组浏览和定位的侧拉窗。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, FileText, Grid3X3, Image as ImageIcon, List, Video, Volume2 } from 'lucide-react';
import AsyncImagePreview from '../AsyncImagePreview';
import { Button } from '../ui/Button';
import TextField from '../ui/TextField';
import CanvasNodeIcon from './CanvasNodeIcon';
import { CANVAS_SEARCH_TYPES, canvasSearchName, canvasSearchParts } from './CanvasSearch.js';
import { getCanvasNodeNavigator } from './CanvasNodeNavigatorData.js';
import { getCanvasImagePreview, getCanvasVideoPoster } from './CanvasMediaSources.js';
import CanvasSearchNodeRow from './CanvasSearchNodeRow';
import './CanvasNodeNavigator.css';

const EMPTY_COLLAPSED_GROUPS = new Set();

function PanelGlyph() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 2.5H12C12.828 2.5 13.5 3.172 13.5 4V12C13.5 12.828 12.828 13.5 12 13.5H4C3.172 13.5 2.5 12.828 2.5 12V4C2.5 3.172 3.172 2.5 4 2.5Z" fill="none" stroke="currentColor" />
    <path d="M4 2.5H5C5.828 2.5 6.5 3.172 6.5 4V12C6.5 12.828 5.828 13.5 5 13.5H4C3.172 13.5 2.5 12.828 2.5 12V4C2.5 3.172 3.172 2.5 4 2.5Z" fill="none" stroke="currentColor" />
  </svg>;
}

function GroupGlyph() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M1.333 3V13.667L3 7H13.167V5C13.167 4.632 12.868 4.333 12.5 4.333H8L6.333 2.333H2C1.632 2.333 1.333 2.632 1.333 3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.333 13.667L14.667 7H2.938L1.333 13.667H13.333Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function HighlightedName({ name, query }) {
  return canvasSearchParts(name, query).map((part, index) => part.match
    ? <mark key={index} className="canvas-node-navigator__match">{part.text}</mark>
    : <span key={index}>{part.text}</span>);
}

function PreviewFallback({ type }) {
  const props = { size: 20, strokeWidth: 1.2, 'aria-hidden': true };
  if (type === 'text') return <FileText {...props} />;
  if (type === 'video') return <Video {...props} />;
  if (type === 'audio') return <Volume2 {...props} />;
  return <ImageIcon {...props} />;
}

function NodeCard({ item, nodes, query, onLocate, viewMode }) {
  const { node } = item;
  const asset = node.data?.asset;
  const preview = node.type === 'image'
    ? getCanvasImagePreview(asset)
    : node.type === 'video' ? getCanvasVideoPoster(asset) : '';
  const name = canvasSearchName(node);

  if (viewMode === 'list') {
    return <CanvasSearchNodeRow node={node} nodes={nodes} query={query} active={Boolean(node.selected)}
      onClick={() => onLocate(node.id)} />;
  }

  return <button type="button" className="canvas-node-navigator__card" data-selected={Boolean(node.selected)}
    onClick={() => onLocate(node.id)} title={name}>
    <span className="canvas-node-navigator__card-title">
      <span className="canvas-node-navigator__node-icon"><CanvasNodeIcon nodeType={node.type} /></span>
      <span className="canvas-node-navigator__card-name"><HighlightedName name={name} query={query} /></span>
    </span>
    <span className="canvas-node-navigator__preview">
      {preview
        ? <AsyncImagePreview plain decorative automaticRecovery src={preview} alt="" draggable={false}
          imageStyle={{ objectFit: 'cover' }} />
        : <span className="canvas-node-navigator__preview-fallback"><PreviewFallback type={node.type} /></span>}
    </span>
  </button>;
}

function GroupSection({ group, nodes, query, collapsedGroups, onToggleGroup, onLocate, viewMode, depth = 0 }) {
  const expanded = !collapsedGroups.has(group.id);
  const name = canvasSearchName(group.node);
  return <section className="canvas-node-navigator__group" data-depth={depth}>
    <div className="canvas-node-navigator__group-header">
      <button type="button" className="canvas-node-navigator__group-name" onClick={() => onLocate(group.node.id)} title={name}>
        <span className="canvas-node-navigator__group-icon"><GroupGlyph /></span>
        <span><HighlightedName name={name} query={query} /></span>
      </button>
      <button type="button" className="canvas-node-navigator__group-toggle" aria-label={expanded ? `收起${name}` : `展开${name}`}
        aria-expanded={expanded} onClick={() => onToggleGroup(group.id)}>
        <ChevronDown size={12} strokeWidth={1.7} aria-hidden="true" />
      </button>
    </div>
    {expanded && <div className="canvas-node-navigator__group-body">
      {group.childNodes.length > 0 && <div className="canvas-node-navigator__grid">
        {group.childNodes.map((item) => <NodeCard key={item.node.id} item={item} nodes={nodes} query={query}
          onLocate={onLocate} viewMode={viewMode} />)}
      </div>}
      {group.childGroups.map((childGroup) => <GroupSection key={childGroup.id} group={childGroup} nodes={nodes} query={query}
        collapsedGroups={collapsedGroups} onToggleGroup={onToggleGroup} onLocate={onLocate} viewMode={viewMode}
        depth={depth + 1} />)}
    </div>}
  </section>;
}

export default function CanvasNodeNavigator({ nodes, open, onOpenChange, onLocate }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [collapsedGroups, setCollapsedGroups] = useState(EMPTY_COLLAPSED_GROUPS);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const data = useMemo(() => getCanvasNodeNavigator(nodes, query, type), [nodes, query, type]);
  const filtering = Boolean(query.trim()) || type !== 'all';

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      const otherModal = event.target.closest?.('[role="dialog"][aria-modal="true"]');
      if (otherModal && !panelRef.current?.contains(otherModal)) return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onOpenChange, open]);

  const close = () => onOpenChange(false);
  const visibleCollapsedGroups = filtering ? EMPTY_COLLAPSED_GROUPS : collapsedGroups;
  const toggleGroup = (id) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return <div className="canvas-node-navigator-shell" data-open={open ? 'true' : 'false'}
    onContextMenu={(event) => event.stopPropagation()}>
    <button type="button" className="canvas-node-navigator__collapsed"
      aria-haspopup="dialog" aria-expanded={open} aria-hidden={open ? 'true' : undefined}
      tabIndex={open ? -1 : undefined} aria-label={`展开节点导航器，共 ${nodes.length} 节点`}
      onClick={() => onOpenChange(true)}>
      <span className="canvas-node-navigator__panel-glyph"><PanelGlyph /></span>
      <span>共 {nodes.length} 节点</span>
    </button>
    <aside ref={panelRef} className="canvas-node-navigator" role="dialog" aria-label="节点导航器"
      aria-hidden={!open} inert={open ? undefined : true}>
      <form className="canvas-node-navigator__search-row" role="search"
        onSubmit={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
        <TextField inputRef={inputRef} value={query} onChange={(event) => setQuery(event.target.value)}
          aria-label="搜索节点名称" placeholder="搜索节点" autoComplete="off" spellCheck="false" showFocusState={false}
          wrapperClassName="canvas-node-navigator__search-field"
          inputClassName="canvas-node-navigator__search-input"
          suffix={<Button type="submit" variant="secondary" size="small"
            className="canvas-node-navigator__search-button !h-6 !rounded-[6px] !px-2">搜索</Button>} />
        <button type="button" className="canvas-node-navigator__view-toggle"
          aria-label={viewMode === 'grid' ? '切换为列表展示' : '切换为宫格展示'}
          title={viewMode === 'grid' ? '切换为列表展示' : '切换为宫格展示'}
          aria-pressed={viewMode === 'list'}
          onClick={() => setViewMode((current) => current === 'grid' ? 'list' : 'grid')}>
          {viewMode === 'grid'
            ? <Grid3X3 className="canvas-node-navigator__view-glyph--grid"
              size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
            : <List size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />}
        </button>
      </form>
      <div className="canvas-node-navigator__filters" role="group" aria-label="节点类型筛选">
        {CANVAS_SEARCH_TYPES.map((item) => <button key={item.value} type="button" aria-pressed={type === item.value}
          onClick={() => setType(item.value)}>{item.label}</button>)}
      </div>
      <div className="canvas-node-navigator__content" aria-live="polite" data-view={viewMode}>
        {!nodes.length && <div className="canvas-node-navigator__empty" role="status">暂无节点</div>}
        {nodes.length > 0 && data.count === 0 && <div className="canvas-node-navigator__empty" role="status">未找到匹配节点</div>}
        {data.groups.map((group) => <GroupSection key={group.id} group={group} nodes={nodes} query={query}
          collapsedGroups={visibleCollapsedGroups} onToggleGroup={toggleGroup} onLocate={onLocate} viewMode={viewMode} />)}
        {data.ungrouped.length > 0 && <div className="canvas-node-navigator__grid">
          {data.ungrouped.map((item) => <NodeCard key={item.node.id} item={item} nodes={nodes} query={query}
            onLocate={onLocate} viewMode={viewMode} />)}
        </div>}
      </div>
      <div className="canvas-node-navigator__footer">
        <button type="button" className="canvas-node-navigator__back" aria-label="收起节点导航器" title="收起"
          onClick={close}>
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <span aria-live="polite">共 {data.count} 节点</span>
      </div>
    </aside>
  </div>;
}
