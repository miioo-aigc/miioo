import { useEffect, useRef, useState } from 'react';
import { apiCreateAdminAnnouncement, apiUpdateAdminAnnouncement } from '../../api/admin';
import { ActionButton, FieldLabel, TextInput, TextArea, Toggle } from './adminShared';

export default function AnnouncementEditorModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    title: item?.title || '', content: item?.content || '',
    popupEnabled: item?.popupEnabled ?? true, isActive: item?.isActive ?? true,
    publish: item ? Boolean(item.publishedAt) : true,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const field = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const close = () => { if (!locked.current) onClose(); };
  const save = async () => {
    if (locked.current) return;
    if (!form.title.trim()) { setError('公告标题不能为空'); return; }
    if (form.title.trim().length > 200) { setError('公告标题最多200字'); return; }
    locked.current = true;
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, title: form.title.trim() };
      if (item) await apiUpdateAdminAnnouncement(item.id, payload);
      else await apiCreateAdminAnnouncement(payload);
      if (alive.current) onSaved();
    } catch (err) {
      if (alive.current) setError(err.message || '保存失败');
    } finally {
      locked.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface-overlay" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label={item ? '编辑公告' : '新建公告'} className="w-[560px] max-w-[calc(100vw-40px)] max-h-[86vh] overflow-y-auto rounded-large border border-stroke-normal bg-neutral-300 p-[24px]" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-[18px] text-text-primary">{item ? '编辑公告' : '新建公告'}</h2>
        <fieldset disabled={saving} className="mt-[20px] flex flex-col gap-[18px] min-w-0">
          <div><FieldLabel>公告标题 *</FieldLabel><TextInput value={form.title} onChange={field('title')} maxLength={200} /></div>
          <div><FieldLabel>公告内容</FieldLabel><TextArea value={form.content} onChange={field('content')} rows={6} /></div>
          {[['popupEnabled', '登录后弹窗提醒'], ['publish', '立即发布'], ['isActive', '启用公告']].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-[16px] text-text-primary text-font-size-14">
              <span>{label}</span><Toggle checked={form[key]} onChange={field(key)} disabled={saving || (key === 'publish' && Boolean(item?.publishedAt))} />
            </div>
          ))}
        </fieldset>
        {error && <p role="alert" className="mt-[16px] text-text-danger text-font-size-14">{error}</p>}
        <div className="mt-[20px] flex justify-end gap-[12px]">
          <ActionButton variant="secondary" onClick={close} disabled={saving}>取消</ActionButton>
          <ActionButton onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</ActionButton>
        </div>
      </div>
    </div>
  );
}
