import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGetAdminAnnouncements, apiPublishAdminAnnouncement, apiUpdateAdminAnnouncement, apiDeleteAdminAnnouncement } from '../../api/admin';
import useAdminRemoteList from '../../hooks/useAdminRemoteList';
import { ActionButton, EmptyState, PaginationControls, SectionShell, TextInput } from './adminShared';
import AnnouncementEditorModal from './AnnouncementEditorModal';
import AnnouncementList from './AnnouncementList';
import ConfirmDialog from '../ConfirmDialog';

export default function AdminAnnouncementPage({ refreshSignal = 0, showToast }) {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const query = useMemo(() => ({ page, pageSize: 10, keyword: search }), [page, search]);
  const { data, loading, error } = useAdminRemoteList(apiGetAdminAnnouncements, query, `${refreshSignal}:${revision}`);
  const reload = () => setRevision((value) => value + 1);
  const mutate = async (operation, message) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await operation();
      if (!alive.current) return;
      setDeleting(null);
      setPage(1);
      reload();
      showToast?.(message, 'success');
    } catch (err) {
      if (alive.current) showToast?.(err.message || '操作失败', 'warning');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <SectionShell title="系统公告" extra={<ActionButton disabled={busy} onClick={() => setEditor({ item: null })}>新建公告</ActionButton>}>
      <div className="flex flex-wrap gap-[12px] mb-[16px]">
        <div className="w-[280px] max-w-full"><TextInput value={keyword} onChange={setKeyword} placeholder="搜索标题或内容" /></div>
        <ActionButton variant="secondary" onClick={() => { setSearch(keyword.trim()); setPage(1); reload(); }}>搜索</ActionButton>
        <ActionButton variant="secondary" onClick={reload} disabled={loading}>刷新</ActionButton>
      </div>
      {loading ? <EmptyState message="加载中..." /> : error ? <p role="alert" className="text-text-danger">{error}</p> : !data?.list.length ? <EmptyState message="暂无公告" /> : (
        <AnnouncementList items={data.list} busy={busy} onEdit={(item) => setEditor({ item })} onDelete={setDeleting}
          onPublish={(item) => mutate(() => apiPublishAdminAnnouncement(item.id), '公告已发布')}
          onToggle={(item) => mutate(() => apiUpdateAdminAnnouncement(item.id, { isActive: !item.isActive }), item.isActive ? '公告已停用' : '公告已启用')} />
      )}
      <PaginationControls page={page} pageSize={10} total={data?.total || 0} hasMore={page * 10 < (data?.total || 0)} loading={loading || busy} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
      {editor && <AnnouncementEditorModal item={editor.item} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setPage(1); reload(); showToast?.('保存成功', 'success'); }} />}
      {deleting && <ConfirmDialog title="确认删除公告？" description={`「${deleting.title}」删除后不可恢复，并会清除所有用户的已读记录。`} confirmText={busy ? '删除中...' : '确认删除'} onCancel={() => { if (!lock.current) setDeleting(null); }} onConfirm={() => mutate(() => apiDeleteAdminAnnouncement(deleting.id), '公告已删除')} />}
    </SectionShell>
  );
}
