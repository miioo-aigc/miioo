import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeToolbar, Position } from '@xyflow/react';
import { Copy, CopyPlus, Download, FolderInput, Group, Layers, Layers2, LogOut, Trash2, Ungroup, LayoutGrid, Columns3, Rows3 } from 'lucide-react';
import { DropdownMenu } from '../ui';
import CanvasToolbarSurface from './CanvasToolbarSurface';
import CanvasToolbarButton from './CanvasToolbarButton';
import { canMoveCanvasNodesInto } from './CanvasGroupTransfer';
import { canvasDescendantIds } from './CanvasNodeActions';
import { getCanvasArrangement } from './CanvasArrangement';

export default function CanvasSelectionToolbar({ nodes, onAction }) {
  const [menu, setMenu] = useState(null);
  const selected = nodes.filter((node) => node.selected);
  const singleGroup = selected.length === 1 && selected[0].type === 'canvasGroup' ? selected[0] : null;
  if (selected.length < 2 && !singleGroup) return null;
  const ids = selected.map((node) => node.id);
  const groups = nodes.filter((node) => node.type === 'canvasGroup');
  const downloadIds = canvasDescendantIds(nodes, ids);
  const media = nodes.some((node) => downloadIds.has(node.id) && node.type !== 'canvasGroup' && (node.type === 'text' ? node.data?.content?.trim() : node.data?.asset?.url));
  const hasGroup = selected.some((node) => node.type === 'canvasGroup');
  const hasNode = selected.some((node) => node.type !== 'canvasGroup');
  const allStacked = selected.filter((node) => node.type === 'canvasGroup').every((node) => node.data?.stacked);
  const actions = singleGroup ? [
    { key: 'ungroup', label: '解组', Icon: Ungroup },
    { key: singleGroup.data.stacked ? 'unstack' : 'stack', label: singleGroup.data.stacked ? '取消堆叠' : '堆叠组', Icon: singleGroup.data.stacked ? Layers2 : Layers },
    { key: 'moveInto', label: '添加到组', Icon: FolderInput, submenu: true },
    { key: 'moveOut', label: '移出组', Icon: LogOut, disabled: !singleGroup.parentId },
  ] : [
    ...(hasNode ? [{ key: 'group', label: '组合', Icon: Group }] : []),
    ...(hasGroup ? [{ key: 'ungroup', label: '解组', Icon: Ungroup }] : []),
    ...(hasGroup ? [{ key: allStacked ? 'unstack' : 'stack', label: allStacked ? '取消堆叠' : '堆叠组', Icon: allStacked ? Layers2 : Layers }] : []),
    { key: 'moveInto', label: '添加到组', Icon: FolderInput, submenu: true },
    { key: 'moveOut', label: '移出组', Icon: LogOut, disabled: !selected.some((node) => node.parentId) },
  ];
  const selectionKey = ids.join(',');
  const arrangement = getCanvasArrangement(nodes);
  const activeMenu = menu?.selectionKey === selectionKey && (menu.key === 'arrange' ? !arrangement.reason : actions.some((action) => action.key === menu.key)) ? menu : null;
  const arrangementItems = [
    { key: 'grid', label: '宫格排列', icon: <LayoutGrid size={16} /> },
    { key: 'horizontal', label: '水平排列', icon: <Columns3 size={16} /> },
    { key: 'vertical', label: '垂直排列', icon: <Rows3 size={16} /> },
  ].map((item) => ({ ...item, onClick: () => { setMenu(null); onAction('arrange', item.key); } }));
  const menuItems = activeMenu?.key === 'arrange' ? arrangementItems : groups.length ? groups.map((group) => ({ key: group.id, label: group.data.label, disabled: !canMoveCanvasNodesInto(nodes, ids, group.id), onClick: () => { onAction('moveInto', group.id); setMenu(null); } })) : [{ key: 'empty', label: '暂无分组', disabled: true }];
  // 单组工具栏与组顶部间距为 16px；框选工具栏保持 32px。
  // 组的展示层级为 -2000，不能继承 NodeToolbar 自动计算的负层级；操作层高于画布和连线操作层。
  return <NodeToolbar nodeId={ids} position={Position.Top} offset={singleGroup ? 16 : 32} isVisible className="canvas-selection-toolbar-anchor" style={{ zIndex: 1003, pointerEvents: 'auto' }}>
    <CanvasToolbarSurface className="canvas-selection-toolbar canvas-node__toolbar--content" label={singleGroup ? '所选组操作' : '所选节点操作'}>
      <div className="canvas-node__toolbar-group" role="group" aria-label="排列操作">
        <CanvasToolbarButton label={arrangement.reason || '排列'} disabled={Boolean(arrangement.reason)} aria-haspopup="menu" aria-expanded={activeMenu?.key === 'arrange'} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setMenu(activeMenu?.key === 'arrange' ? null : { key: 'arrange', selectionKey, x: rect.left, y: rect.bottom + 6 });
        }}><LayoutGrid size={18} strokeWidth={1.5} /></CanvasToolbarButton>
      </div>
      <span className="canvas-node__toolbar-separator" role="separator" aria-orientation="vertical" />
      <div className="canvas-node__toolbar-group" role="group" aria-label="分组操作">
      {actions.map(({ key, label, Icon, disabled, submenu }) => <CanvasToolbarButton key={key} label={label} showLabel disabled={disabled} aria-haspopup={submenu ? 'menu' : undefined} aria-expanded={submenu ? activeMenu?.key === key : undefined} onMouseDown={(event) => { if (submenu) event.stopPropagation(); }} onClick={(event) => {
          if (submenu) { const rect = event.currentTarget.getBoundingClientRect(); setMenu(activeMenu?.key === key ? null : { key, selectionKey, x: rect.left, y: rect.bottom + 6 }); }
          else { setMenu(null); onAction(key); }
        }}><Icon size={18} strokeWidth={1.5} className="shrink-0" /><span>{label}</span></CanvasToolbarButton>)}
      </div>
      <span className="canvas-node__toolbar-separator" role="separator" aria-orientation="vertical" />
      <div className="canvas-node__toolbar-group" role="group" aria-label="复制操作">
        <CanvasToolbarButton label={hasGroup && !hasNode ? '复制组' : '复制节点'} showLabel onClick={() => { setMenu(null); onAction('copy'); }}><Copy size={18} strokeWidth={1.5} className="shrink-0" /><span>{hasGroup && !hasNode ? '复制组' : '复制节点'}</span></CanvasToolbarButton>
        <CanvasToolbarButton label="创建副本" showLabel onClick={() => { setMenu(null); onAction('duplicate'); }}><CopyPlus size={18} strokeWidth={1.5} className="shrink-0" /><span>创建副本</span></CanvasToolbarButton>
      </div>
      <span className="canvas-node__toolbar-separator" role="separator" aria-orientation="vertical" />
      <div className="canvas-node__toolbar-group" role="group" aria-label="下载与删除">
        <CanvasToolbarButton label="下载" disabled={!media} onClick={() => { setMenu(null); onAction('download'); }}><Download size={18} strokeWidth={1.5} /></CanvasToolbarButton>
        <CanvasToolbarButton label={singleGroup ? '删除组' : '删除'} className="canvas-selection-toolbar__delete" onClick={() => { setMenu(null); onAction('delete'); }}><Trash2 size={18} strokeWidth={1.5} /></CanvasToolbarButton>
      </div>
      {/* 挂载到 body，避免 NodeToolbar 的 transform 改变 fixed 定位坐标系。 */}
      {activeMenu && createPortal(<DropdownMenu items={menuItems} onClose={() => setMenu(null)} width="200px" style={{ borderColor: 'rgba(255,255,255,0.15)', '--dropdown-menu-item-gap': '6px', position: 'fixed', bottom: 'auto', right: 'auto', left: Math.max(8, Math.min(activeMenu.x, window.innerWidth - 208)), top: activeMenu.y, maxWidth: 'calc(100vw - 16px)', maxHeight: Math.max(40, window.innerHeight - activeMenu.y - 8), overflowY: 'auto', zIndex: 1004 }} />, document.body)}
    </CanvasToolbarSurface>
  </NodeToolbar>;
}
