import { createPortal } from 'react-dom';
import { Copy, CopyPlus, ClipboardPaste, Group, Ungroup, Layers, Layers2, Trash2, LogOut, FolderInput, Plus, Undo2, Redo2 } from 'lucide-react';
import { DropdownMenu } from '../ui';
import ConfirmDialog from '../ConfirmDialog';
import { canMoveCanvasNodesInto } from './CanvasGroupTransfer';
import CanvasNodeIcon from './CanvasNodeIcon';
import { CANVAS_NODE_MENU_ITEMS } from './CanvasNodeAddMenuConfig';

export default function CanvasNodeActionOverlays({ menu, dialog, nodes, canPaste, canUndo, canRedo, onAction, onCloseMenu, onCloseDialog, onConfirm, onAddNode }) {
  const node = nodes.find((item) => item.id === menu?.id);
  const selected = nodes.filter((item) => item.selected);
  const groups = nodes.filter((item) => item.type === 'canvasGroup');
  const addToGroup = {
    key: 'moveInto', label: '添加到组', icon: <FolderInput size={16} />,
    submenuMaxVisible: 6, submenuWidth: 200,
    items: groups.length ? groups.map((group) => ({
      key: group.id, label: <span className="block truncate" title={group.data.label}>{group.data.label}</span>,
      disabled: !canMoveCanvasNodesInto(nodes, selected.map((item) => item.id), group.id),
      onClick: () => onAction('moveInto', group.id),
    })) : [{ key: 'empty', label: '暂无分组', disabled: true }],
  };
  const item = (key, label, shortcut, Icon, disabled = false) => ({ key,
    label: <span className="flex items-center justify-between gap-[16px]"><span>{label}</span><span className="shrink-0 text-[12px] text-text-hint">{shortcut}</span></span>,
    icon: <Icon size={16} />, disabled, danger: key === 'clear', dangerOnHover: key === 'delete', onClick: () => onAction(key),
  });
  const createNode = {
    key: 'create', label: '新建节点', icon: <Plus size={16} />,
    items: CANVAS_NODE_MENU_ITEMS.map(({ value, label }) => ({
      key: value, label, icon: <CanvasNodeIcon nodeType={value} />,
      onClick: () => onAddNode(value, menu.flowPosition, null, null, node?.type === 'canvasGroup' ? node.id : undefined),
    })),
  };
  const items = menu?.kind === 'pane' ? [
    createNode,
    item('paste', '粘贴', '⌘V', ClipboardPaste, !canPaste),
    item('undo', '撤销', '⌘Z', Undo2, !canUndo),
    item('redo', '重做', '⌘⇧Z', Redo2, !canRedo),
    item('clear', '清空画布', '', Trash2, !nodes.length),
  ] : node?.type === 'canvasGroup' ? [
    ...(!node.data.stacked && menu?.flowPosition ? [createNode, { key: 'create-divider', type: 'separator' }] : []),
    item('duplicate', '创建副本', '⌘D', CopyPlus),
    item('copy', '复制', '⌘C', Copy),
    { key: 'copy-divider', type: 'separator' },
    item('ungroup', '解组', '⌘⇧G', Ungroup),
    node.data.stacked ? item('unstack', '取消堆叠', '⌘⌥⇧G', Layers2) : item('stack', '堆叠组', '⌘⌥G', Layers),
    addToGroup,
    item('moveOut', '移出组', '', LogOut, !node?.parentId),
    { key: 'delete-divider', type: 'separator' },
    item('delete', '删除组', '⌫ / del', Trash2),
  ] : [
    item('duplicate', '创建副本', '⌘D', CopyPlus),
    item('copy', '复制', '⌘C', Copy),
    { key: 'copy-divider', type: 'separator' },
    item('group', '组合', '⌘G', Group),
    addToGroup,
    item('moveOut', '移出组', '', LogOut, !node?.parentId),
    { key: 'delete-divider', type: 'separator' },
    item('delete', '删除节点', '⌫ / del', Trash2),
  ];
  return <>
    {menu && (node || menu.kind === 'pane') && createPortal(<DropdownMenu items={items} onClose={onCloseMenu} width="200px" style={{
      position: 'fixed', bottom: 'auto', right: 'auto', zIndex: 100,
      maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
      left: Math.max(8, Math.min(menu.x, window.innerWidth - 208)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - (items.reduce((height, entry) => height + (entry.type === 'separator' ? 9 : 34), 18)))),
    }} />, document.body)}
    {dialog?.type === 'clear' && <ConfirmDialog title="创作任务执行中，确定要清空画布吗？"
      description="画布中存在执行中或排队中的任务。撤销仅恢复画布中的节点，不能保证找回本次生成结果。"
      confirmText="仍然清空" onConfirm={onConfirm} onCancel={onCloseDialog} />}
    {dialog?.type === 'delete' && <ConfirmDialog title="AI创作任务执行中，确定要删除吗？"
      description="所选节点或组内存在执行中或排队中的任务。撤销仅恢复画布中的节点，不能保证找回本次生成结果。"
      confirmText="仍然删除" onConfirm={onConfirm} onCancel={onCloseDialog} />}
  </>;
}
