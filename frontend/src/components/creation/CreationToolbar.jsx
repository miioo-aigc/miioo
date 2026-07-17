/**
 * @file CreationToolbar.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   CreationToolbar  创作页 Tab、批量操作和清空历史展示层
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只负责展示、按钮状态和回调透传；不读取 Store、不调用 API
 *   常规操作按钮统一复用 components/ui/Button；Tab 保留导航型按钮语义
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 CreationPage 抽离顶部 Tab、批量操作和清空历史展示层
 *   2026-07-15  批量操作、清空历史、全选、下载、删除和取消按钮统一复用 components/ui/Button
 */
import { useState } from 'react';
import { Button } from '../ui';

/**
 * 创作页顶部工具栏。
 * 只负责 Tab、批量操作和清空历史的展示与事件出口，不读取 Store、不调用 API。
 */

function CreationTabBar({ tabs, activeTab, onChange, font, fontMedium }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '24px', paddingTop: '16px', paddingLeft: '24px', flex: 1, alignSelf: 'stretch' }}>
      {tabs.map(({ key, label }) => {
        const isActive = key === activeTab;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', outline: 'none' }}
          >
            <span style={{ fontFamily: isActive ? fontMedium : font, fontWeight: isActive ? 500 : 400, fontSize: '16px', lineHeight: isActive ? '20px' : '18px', color: isActive ? '#FFFFFF' : '#FFFFFF99', transition: 'color 0.2s, font-weight 0.2s', whiteSpace: 'pre' }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BatchButton({ onClick, font }) {
  return (
    <Button
      variant="primary"
      size="large"
      type="button"
      icon={<BatchIcon />}
      onClick={onClick}
      style={{ fontFamily: font }}
    >
      批量操作
    </Button>
  );
}

function BatchIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}><path d="M11.333 1.667H2.667C2.114 1.667 1.667 2.114 1.667 2.667V11.333C1.667 11.886 2.114 12.333 2.667 12.333H11.333C11.886 12.333 12.333 11.886 12.333 11.333V2.667C12.333 2.114 11.886 1.667 11.333 1.667Z" stroke="#FFFFFF" strokeLinejoin="round" /><path d="M14.667 4.334V14C14.667 14.368 14.368 14.667 14 14.667H4.334" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4.333 6.829L6.333 8.67L9.667 5.24" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CreationGhostBtn({ children, onClick, font }) {
  return (
    <Button
      type="button"
      variant="primary"
      size="large"
      onClick={onClick}
      style={{ fontFamily: font }}
    >
      {children}
    </Button>
  );
}

function CreationPlainBtn({ children, onClick, font, danger = false }) {
  return (
    <Button type="button" variant={danger ? 'danger' : 'secondary'} size="large" onClick={onClick} style={{ fontFamily: font }}>{children}</Button>
  );
}

function ClearHistoryButton({ onClick, font }) {
  const [hov, setHov] = useState(false);
  return (
    <Button type="button" variant="primary" size="large" icon={<ClearIcon />} onClick={onClick} style={{ position: 'relative', fontFamily: font }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      清空
      {hov && <span style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: '8px', backgroundColor: '#262626', border: '1px solid #FFFFFF1A', fontFamily: font, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFE6', boxShadow: '#00000066 0px 4px 12px', pointerEvents: 'none', zIndex: 1200 }}>仅清除本页记录，创作资产仍可在资产库找到</span>}
    </Button>
  );
}

function ClearIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path fillRule="evenodd" clipRule="evenodd" d="M6.66663 1.97144H9.33329V4.63812H14.3333V7.30478H1.66663V4.63812H6.66663V1.97144Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.66663 13.3333H13.3333V7.33325H2.66663V13.3333Z" stroke="#FFFFFF" strokeLinejoin="round" /><path d="M5.33337 13.2992V11.3047M8 13.2993V11.2993M10.6666 13.2992V11.3047M4 13.3333H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function SelectedActions({ font, selectedCount, onSelectAll, onDownload, onDelete, onCancel }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: '24px', paddingRight: '32px', gap: '16px', flex: 1, paddingTop: '6px', paddingBottom: '6px' }}><span style={{ fontFamily: font, fontSize: '14px', color: '#FFFFFF99' }}>已选 {selectedCount} 项</span><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CreationGhostBtn onClick={onSelectAll} font={font}><SelectAllIcon /><span>全选</span></CreationGhostBtn><CreationGhostBtn onClick={onDownload} font={font}><DownloadIcon /><span>下载</span></CreationGhostBtn><CreationPlainBtn onClick={onDelete} font={font} danger><DeleteIcon /><span>删除</span></CreationPlainBtn><CreationPlainBtn onClick={onCancel} font={font}><span>取消</span></CreationPlainBtn></div></div>;
}

function SelectAllIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M14 6.667V13C14 13.552 13.552 14 13 14H3C2.448 14 2 13.552 2 13V3C2 2.448 2.448 2 3 2H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 6.667L8.667 9.333L13.667 2.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, rotate: '180deg', transformOrigin: '50% 50%' }}><path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DeleteIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M3 3.333V14.667H13V3.333H3Z" stroke="#F75F5F" strokeLinejoin="round" /><path d="M6.667 6.667V11M9.333 6.667V11" stroke="#F75F5F" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.333 3.333H14.667M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#F75F5F" strokeLinejoin="round" /></svg>;
}

export default function CreationToolbar({ tabs, activeTab, onTabChange, batchMode, selectedCount, onEnterBatch, onSelectAll, onDownload, onDelete, onCancelBatch, onClearHistory, font, fontMedium }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><CreationTabBar tabs={tabs} activeTab={activeTab} onChange={onTabChange} font={font} fontMedium={fontMedium} />{batchMode ? <SelectedActions font={font} selectedCount={selectedCount} onSelectAll={onSelectAll} onDownload={onDownload} onDelete={onDelete} onCancel={onCancelBatch} /> : <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'flex-end', paddingRight: '24px', paddingTop: '6px', paddingBottom: '6px' }}><ClearHistoryButton onClick={onClearHistory} font={font} /><BatchButton onClick={onEnterBatch} font={font} /></div>}</div>;
}
