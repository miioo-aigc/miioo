import { useState } from 'react';
import { Button, TextField } from '../ui';
import { CanvasLibraryDialog, CanvasLibraryDeleteDialog } from './CanvasLibraryDialogs';

function RenameDialog({ item, actions }) {
  const [name, setName] = useState(item.name);
  return <CanvasLibraryDialog title="重命名" busy={actions.busy} onClose={actions.close} footer={<><Button variant="secondary" disabled={actions.busy} onClick={actions.close}>取消</Button><Button disabled={actions.busy || !name.trim()} loading={actions.busy} onClick={() => actions.confirm(name)}>确认</Button></>}>
    <TextField label="名称" autoFocus value={name} disabled={actions.busy} onChange={(event) => setName(typeof event === 'string' ? event : event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && name.trim() && !actions.busy) actions.confirm(name); }} />
  </CanvasLibraryDialog>;
}
export default function CanvasCollectionDialogs({ actions }) {
  const { dialog, busy, close, confirm } = actions;
  if (!dialog) return null;
  if (dialog.kind === 'rename') return <RenameDialog key={dialog.item.id} item={dialog.item} actions={actions} />;
  if (dialog.kind === 'delete') return <CanvasLibraryDeleteDialog collection preview={dialog.preview} busy={busy} onClose={close} onConfirm={() => confirm()} />;
  return <CanvasLibraryDialog title="确认部分下载" busy={busy} onClose={close} footer={<><Button variant="secondary" disabled={busy} onClick={close}>取消</Button><Button loading={busy} disabled={busy} onClick={() => confirm()}>继续下载</Button></>}>
    <p>可下载 {dialog.preview.downloadable_count} 个素材，将跳过 {dialog.preview.omitted_count} 个不可用素材。</p>
    <ul className="mt-[12px] flex flex-col gap-[8px] text-text-secondary">{dialog.preview.omissions?.map((item, index) => <li key={item.asset_id || index}>{item.name || '未命名素材'}：{item.message || item.reason}</li>)}</ul>
  </CanvasLibraryDialog>;
}
