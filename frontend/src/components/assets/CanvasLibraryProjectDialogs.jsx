import ConfirmDialog from '../ConfirmDialog';
import { useState } from 'react';
import { AssetsProjectRenameModal } from './AssetsProjectModals';

/** 复用项目资产的重命名弹窗，保存失败时保留输入。 */
function ProjectRenameDialog({ item, actions }) {
  const [name, setName] = useState(item.name || '');
  return <AssetsProjectRenameModal value={name} onChange={setName}
    onClose={actions.close} onConfirm={() => actions.confirm(name)}
    confirming={actions.busy} confirmingText="保存中…" />;
}

/** 项目删除与集合删除分开确认，明确操作整个项目。 */
export default function CanvasLibraryProjectDialogs({ actions }) {
  const { dialog, busy, close, confirm } = actions;
  if (!dialog) return null;
  if (dialog.kind === 'rename') return <ProjectRenameDialog key={dialog.item.id} item={dialog.item} actions={actions} />;
  return <ConfirmDialog title="确认删除项目" busy={busy} manageFocus onCancel={close} onConfirm={() => confirm()} confirmText="删除项目">
    <div className="break-words">
      <p>将永久删除项目「{dialog.item.name}」及其相关内容，删除后无法恢复。</p>
      <p className="mt-[12px]">此操作针对整个项目，包含该项目下的所有画布，并非仅移除资产集合。</p>
    </div>
  </ConfirmDialog>;
}
