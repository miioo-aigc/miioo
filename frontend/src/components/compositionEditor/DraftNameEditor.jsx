import { useState } from 'react';

import { TextField, Tooltip } from '../ui';

export default function DraftNameEditor({ name, disabled, onCommit }) {
  const [draft, setDraft] = useState(null);
  const finish = () => {
    const next = draft?.trim();
    if (next && next !== name) onCommit(next);
    setDraft(null);
  };
  if (draft !== null) return <TextField aria-label="草稿名称" autoFocus value={draft} maxLength={60}
    inputStyle={{ color: 'var(--color-white-80)', fontSize: 14, fontWeight: 500 }}
    wrapperClassName="w-[280px] max-w-full min-w-0" onChange={(event) => setDraft(event.target.value)} onBlur={finish}
    onKeyDown={(event) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); setDraft(null); }
    }} />;
  return <Tooltip label="点击修改草稿名称" placement="bottom" offset={8}><button type="button" disabled={disabled} aria-label="修改草稿名称"
    onClick={() => setDraft(name.slice(0, 60))}
    className="group flex min-w-0 max-w-[280px] cursor-pointer items-center gap-[6px] rounded-small border border-transparent px-0 py-[6px] text-font-size-14 text-white-80 font-font-weight-medium disabled:cursor-default disabled:opacity-40">
    <span className="truncate">{disabled ? '加载中…' : name || '未命名成片'}</span>

  </button></Tooltip>;
}
