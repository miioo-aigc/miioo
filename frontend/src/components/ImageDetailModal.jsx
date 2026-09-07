import { useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from './ConfirmDialog';
import AsyncImagePreview from './AsyncImagePreview';
import { apiGetLiveMaterialPreviewByRef } from '../api/liveMaterials';
import { useModalSize } from '../utils/useModalSize';
import { showGlobalToast } from '../stores/toastStore';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function StarIcon({ filled = false, strokeColor = '#FFFFFF' }) {
  return <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}><path d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z" fill={filled ? '#F0B429' : 'none'} stroke={filled ? '#F0B429' : strokeColor} strokeWidth="1.1" strokeLinejoin="round" /></svg>;
}

function CopyPromptButton({ text, onCopy }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const color = pressed ? '#FFFFFF99' : hovered ? '#FFFFFFCC' : '#FFFFFF66';
  return <button type="button" aria-label="复制提示词" title="复制提示词" style={{ padding: 0, margin: 0, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color, transition: 'color 120ms ease', flexShrink: 0 }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false); }} onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onClick={() => { navigator.clipboard.writeText(text || ''); onCopy?.(); }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="currentColor" strokeLinejoin="round" /></svg></button>;
}

function PanelAction({ icon, label, onClick, active = false }) {
  const [hovered, setHovered] = useState(false);
  return <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', minWidth: '24px', height: '24px', padding: 0, border: 0, borderRadius: '7px', backgroundColor: hovered ? '#FFFFFF14' : '#161616', cursor: 'pointer', transition: 'background-color 0.12s' }}>{icon}</button>;
}

function EditTool({ label, icon }) {
  const [hovered, setHovered] = useState(false);
  return <button type="button" aria-label={label} title={label} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: 'flex', flex: '1 1 0%', minWidth: 0, height: '64px', padding: '12px 8px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 0, borderRadius: '6px', backgroundColor: hovered ? '#FFFFFF14' : '#FFFFFF0D', color: '#FFFFFFCC', cursor: 'pointer', transition: 'background-color 0.12s' }}>{icon}<span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{label}</span></button>;
}

function formatCreationDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const DETAIL_PANEL_DIVIDER = <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px', flexShrink: 0 }} />;

async function downloadImage(url) {
  if (!url) return;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = 'creation.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, '_blank');
  }
}

function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M13.506 11.439C14.601 10.668 15.071 9.277 14.667 8C14.262 6.723 13.024 6.024 11.684 6.025H10.911C10.405 4.054 8.736 2.599 6.715 2.366C4.693 2.133 2.737 3.171 1.796 4.975C0.856 6.78 1.125 8.977 2.474 10.501" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.003 13.667L8 7.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.121 11.545L8 13.667L5.879 11.545" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DeleteIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.625 2.916V12.834H11.375V2.916H2.625Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M5.834 5.834V9.625M8.166 5.834V9.625M1.166 2.916H12.834M4.666 2.916L5.626 1.166H8.393L9.334 2.916H4.666Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function ImageDetailModal({ card, onClose, onDelete, onDownload, favorited = false, onToggleFavorite }) {
  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const [starAnim, setStarAnim] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleStarClick = () => {
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  };
  const handleCopyPrompt = () => showGlobalToast('您已复制提示词', 'success');

  return <>
    {createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div style={{ width: `${modalW}px`, height: `${modalH}px`, transform: `scale(${modalScale})`, transformOrigin: 'center center', borderRadius: '16px', border: '1px solid #FFFFFF14', backgroundColor: '#161616', boxShadow: '#00000099 -10px 24px 64px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', backgroundColor: '#161616', flexShrink: 0 }}><span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', fontWeight: 500, lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span><div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHovered ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }} onClick={onClose} onMouseEnter={() => setCloseHovered(true)} onMouseLeave={() => setCloseHovered(false)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke={closeHovered ? '#FFFFFF' : '#FFFFFF99'} strokeWidth="1.5" strokeLinecap="round" /></svg></div></div>
        <div style={{ display: 'flex', height: `${modalH - 60}px` }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', position: 'relative', overflow: 'hidden' }}>{card.imageUrl && <img src={card.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />}</div>
          <div style={{ width: '340px', flexShrink: 0, backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F', display: 'flex', flexDirection: 'column', height: `${modalH - 60}px`, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #FFFFFF0A', backgroundColor: '#161616' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PanelAction label="收藏" active={favorited} onClick={handleStarClick} icon={<div style={{ transform: starAnim ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex' }}><StarIcon filled={favorited} strokeColor="rgba(255,255,255,0.8)" /></div>} /><PanelAction label="下载" onClick={() => (onDownload ? onDownload() : downloadImage(card.imageUrl))} icon={<DownloadIcon />} /></div><PanelAction label="删除" onClick={() => setConfirmDelete(true)} icon={<DeleteIcon />} /></div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {DETAIL_PANEL_DIVIDER}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 20px', flexShrink: 0 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>提示词</div><CopyPromptButton text={card.prompt} onCopy={handleCopyPrompt} /></div><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.promptHTML ? <span dangerouslySetInnerHTML={{ __html: card.promptHTML }} /> : (card.prompt || '—')}</div></div>
              {card.refImages?.length > 0 && <>{DETAIL_PANEL_DIVIDER}<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>参考图</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}>{card.refImages.map((img, index) => { const imageUrl = img.url || img.previewUrl || ''; return <AsyncImagePreview key={`${index}-${imageUrl}`} src={imageUrl} alt="参考图" resolveSrc={apiGetLiveMaterialPreviewByRef} style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1' }} />; })}</div></div></>}
              {DETAIL_PANEL_DIVIDER}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 20px', flexShrink: 0 }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>生成参数</div>{card.model && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>模型</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.model}</span></div>}{card.ratio && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>画面比例</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.ratio}</span></div>}{card.resolution && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分辨率</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.resolution}</span></div>}</div>
              {DETAIL_PANEL_DIVIDER}<div style={{ display: 'flex', flexDirection: 'row', gap: '4px', padding: '16px 20px', justifyContent: 'flex-start', alignItems: 'center', flexShrink: 0 }}><span style={{ flex: '1 1 0px', fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>AI 生成时间</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{formatCreationDate(card.createdAt || card.generatedAt)}</span></div>{DETAIL_PANEL_DIVIDER}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: '340px', padding: '16px 20px 16px', boxSizing: 'border-box', borderTop: '1px solid #FFFFFF0D', backgroundColor: '#161616' }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>图片编辑</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}><EditTool label="多机位" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="9" height="8" rx="1.5" stroke="#FFFFFFCC" /><path d="M10 6.5L14.5 4.5V11.5L10 9.5V6.5Z" stroke="#FFFFFFCC" strokeLinejoin="round" /></svg>} /><EditTool label="局部重绘" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13L10.8 5.2L13 7.4L5.2 15.2H3V13Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M9.5 6.5L11.5 8.5M3 15H13" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /><EditTool label="智能超清" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6V3H6M10 3H13V6M13 10V13H10M6 13H3V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 4.5V11.5M4.5 8H11.5" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /><EditTool label="消除笔" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.5 3L13 6.5L6.5 13H3V9.5L9.5 3Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M7 5.5L10.5 9M3 13H13" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}><EditTool label="扩图" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="3.5" width="9" height="9" rx="0.5" stroke="#FFFFFFCC" strokeDasharray="2 1.5" /><path d="M1.5 1.5L3.5 3.5M14.5 1.5L12.5 3.5M1.5 14.5L3.5 12.5M14.5 14.5L12.5 12.5" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /><EditTool label="裁剪" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3V13H13M5 5H11V11H5V5Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>} /><EditTool label="翻转" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V14" stroke="#FFFFFFCC" strokeLinecap="round" strokeDasharray="2 1.5" /><path d="M2 5L5.5 8L2 11V5ZM14 5L10.5 8L14 11V5Z" fill="#FFFFFFCC" fillOpacity="0.6" /></svg>} /><div style={{ width: '100%', height: '64px', opacity: 0 }} /></div></div>
          </div>
        </div>
      </div>
    </div>, document.body)}
    {confirmDelete && <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这张图片吗？" confirmText="删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />}
  </>;
}
