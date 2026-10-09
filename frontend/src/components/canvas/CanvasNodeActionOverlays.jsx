import { createPortal } from 'react-dom';
import { Copy, CopyPlus, ClipboardPaste, Group, Ungroup, Layers, Layers2, Pencil, Trash2, LogOut, FolderInput } from 'lucide-react';
import { DropdownMenu } from '../ui';
import ConfirmDialog from '../ConfirmDialog';
import { AssetsProjectRenameModal } from '../assets/AssetsProjectModals';
import { canMoveCanvasNodesInto } from './CanvasGroupTransfer';

export default function CanvasNodeActionOverlays({ menu, dialog, nodes, canPaste, onAction, onCloseMenu, onCloseDialog, onNameChange, onConfirm }) {
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
    icon: <Icon size={16} />, disabled, danger: key === 'delete', onClick: () => onAction(key),
  });
  const items = node?.type === 'canvasGroup' ? [
    item('ungroup', '解组', '⌘⇧G', Ungroup),
    node.data.stacked ? item('unstack', '取消堆叠', '⌘⌥⇧G', Layers2) : item('stack', '堆叠组', '⌘⌥G', Layers),
    item('rename', '重命名', '⌘R', Pencil, selected.length !== 1),
    addToGroup,
    item('delete', '删除组', '⌫ / del', Trash2),
  ] : [
    item('copy', '复制节点', '⌘C', Copy),
    item('duplicate', '创建副本', '⌘D', CopyPlus),
    item('paste', '粘贴', '⌘V', ClipboardPaste, !canPaste),
    item('group', '组合', '⌘G', Group, selected.length < 2),
    item('rename', '重命名', '⌘R', Pencil, selected.length !== 1),
    addToGroup,
    ...(node?.parentId ? [item('moveOut', '移出组', '', LogOut)] : []),
    item('delete', '删除节点', '⌫ / del', Trash2),
  ];
  return <>
    {menu && node && createPortal(<DropdownMenu items={items} onClose={onCloseMenu} width="200px" style={{
      position: 'fixed', bottom: 'auto', right: 'auto', zIndex: 100,
      maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
      left: Math.max(8, Math.min(menu.x, window.innerWidth - 208)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - (items.length * 34 + 18))),
    }} />, document.body)}
    {dialog?.type === 'delete' && <ConfirmDialog title={dialog.group ? '删除组' : '删除节点'}
      description={dialog.group ? '确认删除所选组及组内所有节点？相关连线也将删除，此操作可以撤销。' : '确认删除所选节点？相关连线也将删除，此操作可以撤销。'}
      confirmText="删除" onConfirm={onConfirm} onCancel={onCloseDialog} />}
    {dialog?.type === 'rename' && <AssetsProjectRenameModal title="重命名" nameLabel="名称" value={dialog.value} onChange={onNameChange} onClose={onCloseDialog} onConfirm={onConfirm} />}
  </>;
}
