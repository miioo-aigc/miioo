import { useRef, useState } from 'react';
import { apiCreateComposition, apiUpdateComposition, apiDeleteComposition } from '../../api/compositions';
import { getErrorMessage } from '../../api/error';
import { AssetsProjectRenameModal } from '../assets/AssetsProjectModals';
import ConfirmDialog from '../ConfirmDialog';
import EditDraftList from './EditDraftList';

export default function EditDraftManager({ projectId, drafts, onChange, showToast, disabled, ...listProps }) {
  const [target, setTarget] = useState(null);
  const [name, setName] = useState('');
  const [working, setWorking] = useState(false);
  const lock = useRef(false);

  async function perform(action, draft) {
    if (lock.current || disabled || !draft?.id) return;
    const trimmedName = name.trim();
    if (action === 'rename' && !trimmedName) return;
    lock.current = true;
    setWorking(true);
    try {
      if (action === 'rename') {
        const updated = await apiUpdateComposition(projectId, draft.id, { name: trimmedName });
        onChange((items) => items.map((item) => item.id === draft.id ? { ...item, name: updated.name || trimmedName, updatedAt: updated.updatedAt || item.updatedAt } : item));
      } else if (action === 'copy') {
        const copied = await apiCreateComposition(projectId, {
          name: (draft.name || '草稿') + '副本',
          timeline: draft.timeline,
          resolution: draft.resolution,
          aspectRatio: draft.aspectRatio,
        });
        if (!copied?.id) throw new Error('复制草稿失败：未返回工程 ID');
        onChange((items) => [...items, copied]);
      } else {
        await apiDeleteComposition(projectId, draft.id);
        onChange((items) => items.filter((item) => item.id !== draft.id));
      }
      setTarget(null);
      showToast?.(action === 'rename' ? '重命名成功' : action === 'copy' ? '草稿已复制' : '草稿已删除', 'success');
    } catch (cause) {
      showToast?.(getErrorMessage(cause, '草稿操作失败，请重试'), 'error');
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }

  return (
    <>
      <EditDraftList {...listProps} drafts={drafts} disabled={disabled || working}
        onRename={(draft) => { setName(draft.name || ''); setTarget({ action: 'rename', draft }); }}
        onCopy={(draft) => perform('copy', draft)}
        onDelete={(draft) => setTarget({ action: 'delete', draft })} />
      {target?.action === 'rename' && <AssetsProjectRenameModal title="重命名" nameLabel="草稿名称" value={name} onChange={setName} confirming={working} onClose={() => { if (!lock.current) setTarget(null); }} onConfirm={() => perform('rename', target.draft)} />}
      {target?.action === 'delete' && <ConfirmDialog title="删除草稿" description={`确定删除「${target.draft.name || '未命名成片'}」吗？此操作不可恢复。`} confirmText={working ? '删除中…' : '删除'} onCancel={() => { if (!lock.current) setTarget(null); }} onConfirm={() => perform('delete', target.draft)} />}
    </>
  );
}
