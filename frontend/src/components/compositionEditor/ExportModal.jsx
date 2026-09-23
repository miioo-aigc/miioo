import { formatTime, computeVisualWindows, useCompositionEditorStore } from '../../stores/compositionEditorStore';

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

function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center h-9 shrink-0 rounded-medium px-[16px] gap-[4px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border disabled:border-transparent disabled:bg-btn-primary-bg-disabled disabled:cursor-not-allowed cursor-pointer"
    >
      <span className="text-btn-primary-text text-font-size-14 font-font-weight-regular shrink-0" style={{ fontFamily: FONT }}>
        {children}
      </span>
    </button>
  );
}

function AccentButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center h-9 shrink-0 rounded-medium px-[16px] gap-[4px] bg-btn-accent-bg-normal hover:bg-btn-accent-bg-hover active:bg-btn-accent-bg-active border border-btn-accent-border cursor-pointer"
      style={{
        backgroundImage: 'linear-gradient(157.78deg, #7AE5B94D 2.88%, #7AE5B900 56.77%)',
      }}
    >
      <span className="text-btn-accent-text text-font-size-14 font-font-weight-medium shrink-0" style={{ fontFamily: FONT_MEDIUM }}>
        {children}
      </span>
    </button>
  );
}

export default function ExportModal() {
  const exportState = useCompositionEditorStore((s) => s.exportState);
  const name = useCompositionEditorStore((s) => s.name);
  const segments = useCompositionEditorStore((s) => s.segments);
  const closeExport = useCompositionEditorStore((s) => s.closeExport);
  const retryExport = useCompositionEditorStore((s) => s.retryExport);
  const downloadExport = useCompositionEditorStore((s) => s.downloadExport);

  const { total } = computeVisualWindows(segments);
  const { status, progress, error } = exportState;

  const renderBody = () => {
    if (status === 'exporting') {
      return (
        <>
          <div className="flex flex-col gap-[12px]">
            <div className="h-[6px] w-full rounded-full bg-white-10 overflow-hidden">
              <div className="h-full bg-brand-main rounded-full" style={{ width: `${Math.min(100, Math.round(progress || 0))}%` }} />
            </div>
            <div className="text-font-size-12 text-text-hint text-center" style={{ fontFamily: FONT }}>
              正在渲染…… {Math.round(progress || 0)}%
            </div>
          </div>
          <p className="text-font-size-12 text-text-secondary text-center" style={{ fontFamily: FONT }}>
            关闭本窗口不会中断导出，可稍后在资产库查看
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
          <div className="flex items-center justify-center gap-[16px] pt-[4px]">
            <SecondaryButton onClick={closeExport}>关闭</SecondaryButton>
            <AccentButton onClick={downloadExport}>下载</AccentButton>
          </div>
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
        <div className="flex items-center justify-center gap-[16px] pt-[4px]">
          <SecondaryButton onClick={closeExport}>关闭</SecondaryButton>
          <AccentButton onClick={retryExport}>重试</AccentButton>
        </div>
      </>
    );
  };

  const title = status === 'exporting' ? '正在导出成片' : status === 'completed' ? '导出完成' : '导出失败';

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-surface-overlay backdrop-blur-[20px]">
      <div className="w-[420px] rounded-large border border-stroke-normal bg-surface-card p-[24px] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between gap-[16px]">
          <span className="text-text-primary text-font-size-16 font-font-weight-medium" style={{ fontFamily: FONT_MEDIUM }}>
            {title}
          </span>
          <button type="button" onClick={closeExport} className="cursor-pointer bg-transparent border-0 p-0">
            <CloseIcon />
          </button>
        </div>
        {renderBody()}
      </div>
    </div>
  );
}
