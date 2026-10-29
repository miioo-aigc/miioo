import { createPortal } from 'react-dom';
import LoadingAnimation from '../LoadingAnimation';
import { Button } from '../ui/Button';
import { formatTime, computeTotalDuration, useCompositionEditorStore } from '../../stores/compositionEditorStore';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ExportModal() {
  const exportState = useCompositionEditorStore((s) => s.exportState);
  const name = useCompositionEditorStore((s) => s.name);
  const segments = useCompositionEditorStore((s) => s.segments);
  const hideExport = useCompositionEditorStore((s) => s.closeExport);
  const retryExport = useCompositionEditorStore((s) => s.retryExport);
  const downloadExport = useCompositionEditorStore((s) => s.downloadExport);
  const projectId = useCompositionEditorStore((s) => s.projectId);

  const total = computeTotalDuration(segments);
  const { status, error } = exportState;
  const closeExport = () => {
    hideExport();
  };
  const viewResult = () => {
    const targetProjectId = exportState.projectId || projectId;
    if (!targetProjectId) return;
    hideExport();
    const query = new URLSearchParams({ module: 'project', project_id: targetProjectId, category: 'final' });
    window.history.pushState({}, '', `/workspace/assets?${query}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const renderBody = () => {
    if (status === 'exporting') {
      return (
        <>
          <div role="status" className="flex items-center justify-center gap-[8px] text-[14px] text-white-80" style={{ fontFamily: FONT }}>
            <LoadingAnimation width="auto" style={{ height: 24 }} />
            <span>正在导出</span>
          </div>
          <p className="text-font-size-12 text-text-secondary text-center" style={{ fontFamily: FONT }}>
            关闭弹窗，导出将在后台继续进行
          </p>
        </>
      );
    }

    if (status === 'completed') {
      return (
        <>
          <div className="flex flex-col items-center gap-[8px]">
            <span className="text-tag-text-green text-font-size-16 font-font-weight-medium" style={{ fontFamily: FONT_MEDIUM }}>
              {name || '未命名成片'}
            </span>
            <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT }}>
              总时长 {formatTime(total)}
            </span>
          </div>
          <p className="text-font-size-12 text-text-secondary text-center" style={{ fontFamily: FONT }}>
            成片已同步到素材库
          </p>
        </>
      );
    }

    // failed
    return (
      <>
        <div className="text-font-size-14 text-text-danger text-center" style={{ fontFamily: FONT }}>
          导出失败
        </div>
        <p className="text-font-size-12 text-text-secondary text-center" style={{ fontFamily: FONT }}>
          {error || '未知错误，请重试'}
        </p>
      </>
    );
  };

  const title = status === 'exporting' ? '正在导出成片' : status === 'completed' ? '导出完成' : '导出失败';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface-overlay backdrop-blur-[20px]" onClick={closeExport}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-[400px] max-w-[calc(100vw-32px)] min-h-[240px] max-h-[min(600px,calc(100dvh-32px))] rounded-large bg-surface-modal overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-[16px] px-[24px] py-[16px]">
          <span className="text-text-primary text-font-size-16 font-font-weight-medium" style={{ fontFamily: FONT_MEDIUM }}>
            {title}
          </span>
          <button type="button" aria-label="关闭" onClick={closeExport} className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] cursor-pointer bg-transparent border-0 p-0 hover:bg-white-10">
            <CloseIcon />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-[16px] overflow-y-auto px-[24px] py-[8px]">{renderBody()}</div>
        <div className="flex shrink-0 items-center justify-end gap-[16px] px-[24px] py-[16px]">
          {status === 'completed' ? <>
            <Button variant="secondary" onClick={() => { void downloadExport(); hideExport(); }}>下载</Button>
            <Button variant="primary" onClick={viewResult}>查看</Button>
          </> : <Button variant="secondary" onClick={closeExport}>关闭</Button>}
          {status === 'failed' && <Button variant="primary" onClick={retryExport}>重试</Button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
