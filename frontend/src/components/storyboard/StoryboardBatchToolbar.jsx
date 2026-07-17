import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';

/**
 * @file StoryboardBatchToolbar.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   StoryboardBatchToolbar  分镜页批量生成、批量下载和剪辑入口
 *   BatchToolbarIcons       批量生成、下载和剪辑按钮图标
 *
 * ─── 数据边界 ───────────────────────────────────────────────────────
 *   只通过 props 接收生成/下载模式、选中数量、禁用状态和事件回调；
 *   不调用 API、不读取页面 Store、不持有任务状态和 Toast 副作用。
 *   批量生成展开状态属于工具栏交互状态，由本组件自己管理。
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 StoryboardPage 抽离批量生成和批量下载工具栏展示层
 */

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function BatchImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFF" strokeLinejoin="round" />
      <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFF" />
      <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BatchVideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12.333 2.333H3.667V13.667H12.333V2.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.667 3.667H1.333V12.333H3.667V3.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.667 3.667H12.333V12.333H14.667V3.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.333 6.667L9.333 8L7.333 9.333V6.667Z" fill="#FFFFFF" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8.003 11.3V2" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M14.333 5.667V3H11.333M14.333 5.667V10.333M14.333 5.667H11.333M11.333 3V5.667M11.333 3H10M14.333 10.333V13H11.333M14.333 10.333H11.333M11.333 5.667H10M1.667 5.667V3H4.667M1.667 5.667V10.333M1.667 5.667H4.667M4.667 3V5.667M4.667 3H6M1.667 10.333V13H4.667M1.667 10.333H4.667M4.667 5.667H6M4.667 13V10.333M4.667 13H6M4.667 10.333H6M11.333 13V10.333M11.333 13H10M11.333 10.333H10" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2.333V3.667M8 5.667V7M8 9V10.333M8 12.333V13.667" stroke="#090909" strokeLinecap="round" />
    </svg>
  );
}

function SelectAllControl({ allSelected, onClick }) {
  return (
    <label onClick={onClick} className="flex items-center gap-[4px] h-[36px] px-[16px] cursor-pointer select-none shrink-0">
      <span className="flex items-center gap-0 p-[2px] cursor-pointer">
        <span
          className={
            'relative rounded-sm shrink-0 border border-solid w-[16px] h-[16px] [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 ' +
            (allSelected ? 'bg-checkbox-bg-active border-checkbox-border-active' : 'bg-checkbox-bg-normal border-checkbox-border-normal')
          }
        >
          {allSelected && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
              <path d="M3.333 8L6.667 11.333L13.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>
        {allSelected ? '取消全选' : '全选'}
      </span>
    </label>
  );
}

export default function StoryboardBatchToolbar({
  downloadMode,
  selectedCount = 0,
  totalCount = 0,
  generationDisabled = false,
  onOpenImageModal,
  onOpenVideoModal,
  onEnterDownloadMode,
  onSelectAll,
  onDownloadImages,
  onDownloadVideos,
  onExitDownloadMode,
  onStartEdit,
}) {
  const [batchExpanded, setBatchExpanded] = useState(false);
  const toolbarRef = useRef(null);

  useEffect(() => {
    if (!batchExpanded) return undefined;
    function handleMouseDown(event) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setBatchExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [batchExpanded]);

  function closeBatchMenu() {
    setBatchExpanded(false);
  }

  return (
    <div ref={toolbarRef} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {downloadMode ? (
        <>
          <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', userSelect: 'none' }}>
            已选 {selectedCount} / {totalCount}
          </span>
          <SelectAllControl allSelected={totalCount > 0 && selectedCount === totalCount} onClick={onSelectAll} />
          <Button variant="primary" size="large" icon={<DownloadIcon />} onClick={onDownloadImages}>下载图片</Button>
          <Button variant="primary" size="large" icon={<DownloadIcon />} onClick={onDownloadVideos}>下载视频</Button>
          <Button variant="secondary" size="large" onClick={onExitDownloadMode}>取消</Button>
        </>
      ) : (
        <>
          {batchExpanded ? (
            <>
              <Button variant="primary" size="large" icon={<BatchImageIcon />} loading={generationDisabled} disabled={generationDisabled} onClick={() => { closeBatchMenu(); onOpenImageModal?.(); }}>
                批量生成分镜图
              </Button>
              <Button variant="primary" size="large" icon={<BatchVideoIcon />} loading={generationDisabled} disabled={generationDisabled} onClick={() => { closeBatchMenu(); onOpenVideoModal?.(); }}>
                批量生成分镜视频
              </Button>
            </>
          ) : (
            <Button variant="primary" size="large" icon={<BatchImageIcon />} loading={generationDisabled} disabled={generationDisabled} onClick={() => setBatchExpanded(true)}>
              批量生成
            </Button>
          )}
          <Button variant="primary" size="large" icon={<DownloadIcon />} disabled={generationDisabled} onClick={onEnterDownloadMode}>批量下载</Button>
          <Button variant="accent" size="large" icon={<EditIcon />} onClick={onStartEdit}>开始剪辑</Button>
        </>
      )}
    </div>
  );
}
