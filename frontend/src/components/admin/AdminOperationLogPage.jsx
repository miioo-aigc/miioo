import { useMemo, useState } from 'react';
import { apiGetAdminOperationLogs } from '../../api/admin';
import useAdminRemoteList from '../../hooks/useAdminRemoteList';
import { ActionButton, EmptyState, PaginationControls, SectionShell } from './adminShared';
import OperationLogFilters from './OperationLogFilters';
import OperationLogTable from './OperationLogTable';
import { formatOperationLogTime } from '../../utils/OperationLogTime';

const EMPTY = { keyword: '', feature: '', action: '', model: '', result: '', start: '', end: '' };

export default function AdminOperationLogPage({ refreshSignal = 0 }) {
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [validation, setValidation] = useState('');
  const query = useMemo(() => ({ ...filters, page, pageSize: 20 }), [filters, page]);
  const { data, loading, error } = useAdminRemoteList(apiGetAdminOperationLogs, query, `${refreshSignal}:${revision}`);
  const reload = () => setRevision((value) => value + 1);
  const search = () => {
    if (draft.start && draft.end && draft.start > draft.end) { setValidation('结束时间不能早于起始时间'); return; }
    setValidation('');
    setFilters({ ...draft, start: formatOperationLogTime(draft.start), end: formatOperationLogTime(draft.end) });
    setPage(1);
    reload();
  };
  return <SectionShell title="操作日志" extra={<ActionButton variant="secondary" onClick={reload} disabled={loading}>刷新</ActionButton>}>
    <OperationLogFilters values={draft} options={data?.filterOptions} loading={loading}
      onChange={(key, value) => setDraft((prev) => ({ ...prev, [key]: value }))} onSearch={search}
      onReset={() => { setDraft(EMPTY); setFilters(EMPTY); setPage(1); setValidation(''); reload(); }} />
    {(validation || error) && <p role="alert" className="mb-[16px] text-text-danger">{validation || error}</p>}
    {loading ? <EmptyState message="加载中..." /> : data?.list.length ? <OperationLogTable key={`${page}:${revision}:${refreshSignal}`} items={data.list} /> : !error && <EmptyState message="当前筛选条件下没有操作记录" />}
    <PaginationControls page={page} pageSize={20} total={data?.total || 0} hasMore={data?.hasMore || false} loading={loading} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
  </SectionShell>;
}
