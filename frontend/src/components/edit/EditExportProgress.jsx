import { useState } from 'react';
import { Check, ChevronDown, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useCompositionExportStore } from '../../stores/CompositionExportStore';
import { showGlobalToast } from '../../stores/toastStore';

function ExportRow({ task }) {
  const dismiss = useCompositionExportStore((state) => state.dismiss);
  const active = task.status === 'exporting';
  const completed = task.status === 'completed';
  const Icon = active ? LoaderCircle : completed ? Check : TriangleAlert;
  function viewResult() {
    const query = new URLSearchParams({ module: 'project', project_id: task.projectId, category: 'final' });
    window.history.pushState({}, '', `/workspace/assets?${query}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  return (
    <div className="flex min-h-[24px] min-w-0 items-center gap-[8px] text-[14px] leading-[20px] text-white-80" role="status">
      <Icon size={16} className={`shrink-0 ${active ? 'animate-spin text-brand-main' : completed ? 'text-brand-main' : 'text-text-danger'}`} />
      <span className="min-w-0 flex-1 truncate" title={task.name}>{task.name || '未命名成片'} · {active ? '正在导出' : completed ? '导出完成' : '导出失败'}</span>
      {!active && <div className="ml-[8px] flex shrink-0 items-center gap-[2px]">
        {completed
          ? <button type="button" onClick={viewResult} className="flex h-[24px] items-center cursor-pointer text-brand-main hover:text-text-primary">查看</button>
          : <button type="button" onClick={() => showGlobalToast(task.error || '导出失败，请检查任务', 'error')} className="flex h-[24px] items-center cursor-pointer text-brand-main">查看原因</button>}
        <button type="button" aria-label="关闭导出提示" title="关闭导出提示" onClick={() => dismiss(task.taskId)} className="flex h-[24px] w-[24px] items-center justify-center cursor-pointer hover:text-text-primary"><X size={16} /></button>
      </div>}
    </div>
  );
}

export default function EditExportProgress({ projectId }) {
  const allTasks = useCompositionExportStore((state) => state.tasks);
  const [expanded, setExpanded] = useState(false);
  const tasks = allTasks.filter((task) => task.projectId === projectId);
  if (!tasks.length) return null;
  const active = tasks.filter((task) => task.status === 'exporting');
  return (
    <div className="relative ml-auto w-fit max-w-full min-w-0">
      {tasks.length === 1 ? <ExportRow task={tasks[0]} /> : <>
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="ml-auto flex cursor-pointer items-center gap-[8px] py-[6px] text-[14px] text-white-80 hover:text-text-primary">
          {active.length > 0 && <LoaderCircle size={16} className="animate-spin text-brand-main" />}
          {active.length ? `正在导出 ${active.length} 个成片` : `${tasks.length} 个导出结果`}<ChevronDown size={16} />
        </button>
        {expanded && <div className="absolute right-0 top-full z-50 flex w-max max-w-[min(400px,calc(100vw-48px))] flex-col gap-[12px] rounded-[8px] border border-stroke-normal bg-surface-modal p-[12px]" onKeyDown={(event) => { if (event.key === 'Escape') setExpanded(false); }}>
          {tasks.map((task) => <ExportRow key={task.taskId} task={task} />)}
        </div>}
      </>}
    </div>
  );
}
