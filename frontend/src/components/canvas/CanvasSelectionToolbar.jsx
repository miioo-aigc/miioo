import { useState } from 'react';
import { NodeToolbar, Position } from '@xyflow/react';
import { Copy, CopyPlus, Download, FolderInput, Group, Layers, Layers2, LogOut, Trash2, Ungroup } from 'lucide-react';
import { DropdownMenu } from '../ui';
import CanvasToolbarSurface from './CanvasToolbarSurface';
import CanvasToolbarButton from './CanvasToolbarButton';
import { canMoveCanvasNodesInto } from './CanvasGroupTransfer';
import { canvasDescendantIds } from './CanvasNodeActions';

export default function CanvasSelectionToolbar({ nodes, onAction }) {
  const [menu, setMenu] = useState(null);
  const selected = nodes.filter((node) => node.selected);
  const singleGroup = selected.length === 1 && selected[0].type === 'canvasGroup' ? selected[0] : null;
  if (selected.length < 2 && !singleGroup) return null;
  const ids = selected.map((node) => node.id);
  const groups = nodes.filter((node) => node.type === 'canvasGroup');
  const downloadIds = canvasDescendantIds(nodes, ids);
  const media = nodes.some((node) => downloadIds.has(node.id) && node.type !== 'canvasGroup' && node.type !== 'text' && node.data?.asset?.url);
  const hasGroup = selected.some((node) => node.type === 'canvasGroup');
  const hasNode = selected.some((node) => node.type !== 'canvasGroup');
  const allStacked = selected.filter((node) => node.type === 'canvasGroup').every((node) => node.data?.stacked);
  const actions = singleGroup ? [
    { key: 'duplicate', label: '创建副本', Icon: CopyPlus },
    { key: 'copy', label: '复制', Icon: Copy },
    { key: 'ungroup', label: '解组', Icon: Ungroup },
    { key: singleGroup.data.stacked ? 'unstack' : 'stack', label: singleGroup.data.stacked ? '取消堆叠' : '堆叠组', Icon: singleGroup.data.stacked ? Layers2 : Layers },
    { key: 'moveInto', label: '添加到组', Icon: FolderInput, submenu: true },
    { key: 'moveOut', label: '移出组', Icon: LogOut, disabled: !singleGroup.parentId },
  ] : [
    ...(hasNode ? [{ key: 'group', label: '组合', Icon: Group }] : []),
    ...(hasGroup ? [{ key: 'ungroup', label: '解组', Icon: Ungroup }] : []),
    ...(hasGroup ? [{ key: allStacked ? 'unstack' : 'stack', label: allStacked ? '取消堆叠' : '堆叠组', Icon: allStacked ? Layers2 : Layers }] : []),
    { key: 'copy', label: '复制', Icon: Copy },
    { key: 'duplicate', label: '创建副本', Icon: CopyPlus },
    { key: 'moveOut', label: '移出组', Icon: LogOut, disabled: !selected.some((node) => node.parentId) },
    { key: 'moveInto', label: '添加到组', Icon: FolderInput, submenu: true },
  ];
  const selectionKey = ids.join(',');
  const activeMenu = menu?.selectionKey === selectionKey && actions.some((action) => action.key === menu.key) ? menu : null;
  const menuItems = groups.length ? groups.map((group) => ({ key: group.id, label: group.data.label, disabled: !canMoveCanvasNodesInto(nodes, ids, group.id), onClick: () => { onAction('moveInto', group.id); setMenu(null); } })) : [{ key: 'empty', label: '暂无分组', disabled: true }];
  // 单组工具栏与组顶部间距为 16px；框选工具栏保持 32px。
  // 组的展示层级为 -2000，不能继承 NodeToolbar 自动计算的负层级；操作层高于画布和连线操作层。
  return <NodeToolbar nodeId={ids} position={Position.Top} offset={singleGroup ? 16 : 32} isVisible className="canvas-selection-toolbar-anchor" style={{ zIndex: 1003, pointerEvents: 'auto' }}>
    <CanvasToolbarSurface className="canvas-selection-toolbar" label={singleGroup ? '所选组操作' : '所选节点操作'}>
      {actions.map(({ key, label, Icon, disabled, submenu }) => <CanvasToolbarButton key={key} label={label} disabled={disabled} onClick={(event) => {
          if (submenu) { const rect = event.currentTarget.getBoundingClientRect(); setMenu(activeMenu?.key === key ? null : { key, selectionKey, x: rect.left, y: rect.bottom + 6 }); }
          else onAction(key);
        }}><Icon size={16} strokeWidth={1.5} /></CanvasToolbarButton>)}
      <span className="canvas-selection-toolbar__separator" />
      <CanvasToolbarButton label="下载" disabled={!media} onClick={() => onAction('download')}><Download size={16} strokeWidth={1.5} /></CanvasToolbarButton>
      <CanvasToolbarButton label={singleGroup ? '删除组' : '删除'} className="canvas-selection-toolbar__delete" onClick={() => onAction('delete')}><Trash2 size={16} strokeWidth={1.5} /></CanvasToolbarButton>
      {activeMenu && <DropdownMenu items={menuItems} onClose={() => setMenu(null)} width="200px" style={{ position: 'fixed', left: activeMenu.x, top: activeMenu.y, zIndex: 110 }} />}
    </CanvasToolbarSurface>
  </NodeToolbar>;
}
