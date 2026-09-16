import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from './ConfirmDialog';
import AsyncImagePreview from './AsyncImagePreview';
import { apiGetLiveMaterialPreviewByRef } from '../api/liveMaterials';
import { useModalSize } from '../utils/useModalSize';
import { showGlobalToast } from '../stores/toastStore';
import ImageCropModal from './ImageCropModal';
import MultiAngleModal from './image-edit/MultiAngleModal';
import InpaintModal from './image-edit/InpaintModal';
import UpscaleModal from './image-edit/UpscaleModal';
import ImageFlipModal from './image-edit/ImageFlipModal';
import OutpaintModal from './image-edit/OutpaintModal';
import CopyPromptButton from './ui/CopyPromptButton';
import { FavoriteIcon, DeleteIcon, CropIcon } from './ui';
import { EDIT_MODE_LABELS, mayShowEditPrompt, readEditMetadata } from '../utils/MediaEditPolicy';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const MultiAngleAction = createContext(null);
const InpaintAction = createContext(null);
const UpscaleAction = createContext(null);
const FlipAction = createContext(null);
const OutpaintAction = createContext(null);

// eslint-disable-next-line no-unused-vars
function LegacyCopyPromptButton({ text, onCopy }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const color = pressed ? '#FFFFFF99' : '#FFFFFFCC';
  return <button type="button" aria-label="复制提示词" title="复制提示词" style={{ width: '24px', minWidth: '24px', height: '24px', padding: 0, margin: 0, border: 0, borderRadius: '6px', background: hovered ? '#FFFFFF14' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'color 120ms ease, background 120ms ease', flexShrink: 0 }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false); }} onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onClick={() => { navigator.clipboard.writeText(text || ''); onCopy?.(); }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 14.3334 11.6666 13.3959V5.27087C11.6666 4.75311 10.7291 4.33337 10.7291 4.33337Z" stroke="currentColor" strokeLinejoin="round" /></svg></button>;
}

function PanelAction({ icon, label, onClick, active = false }) {
  const [hovered, setHovered] = useState(false);
  return <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', minWidth: '24px', height: '24px', padding: 0, border: 0, borderRadius: '7px', backgroundColor: hovered ? '#FFFFFF14' : '#161616', cursor: 'pointer', transition: 'background-color 0.12s' }}>{icon}</button>;
}

function EditTool({ label, icon, onClick }) {
  const openMultiAngle = useContext(MultiAngleAction);
  const openInpaint = useContext(InpaintAction);
  const openUpscale = useContext(UpscaleAction);
  const openFlip = useContext(FlipAction);
  const openOutpaint = useContext(OutpaintAction);
  if (label === '多机位') onClick = openMultiAngle;
  if (label === '局部重绘') onClick = () => openInpaint('inpaint');
  if (label === '消除笔') onClick = () => openInpaint('eraser');
  if (label === '智能超清') onClick = openUpscale;
  if (label === '翻转') onClick = openFlip;
  if (label === '扩图') onClick = openOutpaint;
  const [hovered, setHovered] = useState(false);
  const renderedIcon = label === '裁剪' ? <CropIcon size={16} /> : icon;
  return <button type="button" aria-label={label} title={label} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: 'flex', flex: '1 1 0%', minWidth: 0, height: '64px', padding: '12px 8px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 0, borderRadius: '6px', backgroundColor: hovered ? '#FFFFFF14' : '#FFFFFF0D', color: '#FFFFFFCC', cursor: 'pointer', transition: 'background-color 0.12s' }}>{renderedIcon}<span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{label}</span></button>;
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

export default function ImageDetailModal({ card, onClose, onDelete, onDownload, favorited = false, onToggleFavorite, onCreateImage }) {
  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const [starAnim, setStarAnim] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [multiAngleOpen, setMultiAngleOpen] = useState(false);
  const [inpaintMode, setInpaintMode] = useState(null);
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [flipOpen, setFlipOpen] = useState(false);
  const [outpaintOpen, setOutpaintOpen] = useState(false);
  const editMetadata = readEditMetadata(card);
  const showPrompt = mayShowEditPrompt(card);

  const handleStarClick = () => {
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  };
  const handleCopyPrompt = () => showGlobalToast('您已复制提示词', 'success');

  if (multiAngleOpen) return <MultiAngleModal card={card} onClose={() => setMultiAngleOpen(false)} />;
  if (inpaintMode) return <InpaintModal card={card} mode={inpaintMode} onSave={onCreateImage} onComplete={onClose} onClose={() => setInpaintMode(null)} />;
  if (upscaleOpen) return <UpscaleModal card={card} onClose={() => setUpscaleOpen(false)} />;
  if (flipOpen) return <ImageFlipModal imageUrl={card.imageUrl} sourceAsset={card} onClose={() => setFlipOpen(false)} />;
  if (outpaintOpen) return <OutpaintModal card={card} onSave={onCreateImage} onComplete={onClose} onClose={() => setOutpaintOpen(false)} />;

  if (cropOpen) {
    return <ImageCropModal imageUrl={card.imageUrl} sourceAsset={card} onClose={() => setCropOpen(false)} />;
  }

  return <OutpaintAction.Provider value={() => setOutpaintOpen(true)}><FlipAction.Provider value={() => setFlipOpen(true)}><UpscaleAction.Provider value={() => setUpscaleOpen(true)}><InpaintAction.Provider value={setInpaintMode}><MultiAngleAction.Provider value={() => setMultiAngleOpen(true)}>
    {createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div style={{ width: `${modalW}px`, height: `${modalH}px`, boxSizing: 'border-box', transform: `scale(${modalScale})`, transformOrigin: 'center center', borderRadius: '16px', border: '1px solid #FFFFFF14', backgroundColor: '#161616', boxShadow: '#00000099 -10px 24px 64px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', backgroundColor: '#161616', flexShrink: 0 }}><span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', fontWeight: 500, lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span><div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHovered ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }} onClick={onClose} onMouseEnter={() => setCloseHovered(true)} onMouseLeave={() => setCloseHovered(false)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke={closeHovered ? '#FFFFFF' : '#FFFFFF99'} strokeWidth="1.5" strokeLinecap="round" /></svg></div></div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', position: 'relative', overflow: 'hidden' }}>{card.imageUrl && <img src={card.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />}</div>
          <div style={{ width: '340px', flexShrink: 0, minHeight: 0, boxSizing: 'border-box', backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #FFFFFF0A', backgroundColor: '#161616' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PanelAction label="收藏" active={favorited} onClick={handleStarClick} icon={<div style={{ transform: starAnim ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex' }}><FavoriteIcon filled={favorited} color="rgba(255,255,255,0.8)" /></div>} /><PanelAction label="下载" onClick={() => (onDownload ? onDownload() : downloadImage(card.imageUrl))} icon={<DownloadIcon />} /></div><PanelAction label="删除" onClick={() => setConfirmDelete(true)} icon={<DeleteIcon size={14} />} /></div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {DETAIL_PANEL_DIVIDER}
              {editMetadata.edit_mode && <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 20px', flexShrink: 0 }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>编辑模式</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>{EDIT_MODE_LABELS[editMetadata.edit_mode] || editMetadata.edit_mode}</span></div>}
              {showPrompt && <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 20px', flexShrink: 0 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>提示词</div><CopyPromptButton text={card.prompt} onCopy={handleCopyPrompt} /></div><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.promptHTML ? <span dangerouslySetInnerHTML={{ __html: card.promptHTML }} /> : (card.prompt || '—')}</div></div>}
              {card.refImages?.length > 0 && <>{DETAIL_PANEL_DIVIDER}<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>参考图</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}>{card.refImages.map((img, index) => { const imageUrl = img.url || img.previewUrl || ''; return <AsyncImagePreview key={`${index}-${imageUrl}`} src={imageUrl} alt="参考图" resolveSrc={apiGetLiveMaterialPreviewByRef} style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1' }} />; })}</div></div></>}
              {DETAIL_PANEL_DIVIDER}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 20px', flexShrink: 0 }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>生成参数</div>{card.model && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>模型</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.model}</span></div>}{card.ratio && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>画面比例</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.ratio}</span></div>}{card.resolution && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分辨率</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.resolution}</span></div>}</div>
              {DETAIL_PANEL_DIVIDER}<div style={{ display: 'flex', flexDirection: 'row', gap: '4px', padding: '16px 20px', justifyContent: 'flex-start', alignItems: 'center', flexShrink: 0 }}><span style={{ flex: '1 1 0px', fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>AI 生成时间</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{formatCreationDate(card.createdAt || card.generatedAt)}</span></div>{DETAIL_PANEL_DIVIDER}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: '340px', padding: '16px 20px 16px', boxSizing: 'border-box', borderTop: '1px solid #FFFFFF0D', backgroundColor: '#161616' }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>图片编辑</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}><EditTool label="多机位" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="9" height="8" rx="1.5" stroke="#FFFFFFCC" /><path d="M10 6.5L14.5 4.5V11.5L10 9.5V6.5Z" stroke="#FFFFFFCC" strokeLinejoin="round" /></svg>} /><EditTool label="局部重绘" icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ height: '16px', width: '16px', flexShrink: 0 }}><path d="M392.704 165.952a401.92 401.92 0 0 1 148.16 1.856 32 32 0 1 0 12.608-62.72 464.832 464.832 0 0 0-171.776-2.176 32 32 0 1 0 11.008 63.04z m-129.28 47.488a32 32 0 1 0-32.64-55.104 419.52 419.52 0 0 0-120.832 107.072 32 32 0 0 0 50.944 38.656c27.264-35.84 62.08-66.752 102.464-90.624z m458.88-36.16a32 32 0 0 0-36.928 52.288c21.76 15.36 41.472 32.768 58.88 52.032a32 32 0 1 0 47.488-42.88 419.968 419.968 0 0 0-69.44-61.44z m-618.88 249.344a32 32 0 1 0-62.4-14.08 371.264 371.264 0 0 0-4.096 141.952 32 32 0 1 0 63.168-10.432 307.968 307.968 0 0 1 3.392-117.44z m28.8 212.352a32 32 0 1 0-56.64 29.888 399.36 399.36 0 0 0 71.68 96.448 32 32 0 0 0 45.12-45.44 335.168 335.168 0 0 1-60.16-80.896z m141.696 141.696a32 32 0 1 0-30.72 56.128c17.28 9.472 35.456 17.92 54.208 25.088a32 32 0 1 0 22.912-59.776 379.52 379.52 0 0 1-46.4-21.44z m496.512-52.096a64 64 0 0 1-91.008 30.592l-40.704-23.488a64 64 0 0 1-19.008-94.08l248.32-328.064a36.224 36.224 0 0 1 62.336 35.968l-160 379.072z m-281.984 131.2c34.048-123.52 92.736-121.152 151.488-91.776 53.312 21.312 64 96 0 160-66.176 66.176-193.408 24.96-187.904-9.984 1.92-11.904 10.176-21.248 18.432-30.72 7.552-8.448 15.104-17.024 17.984-27.52z" fill="#FFFFFFCC" /></svg>} /><EditTool label="智能超清" icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ width: '16px', height: '16px', flexShrink: 0 }}><path d="M456.615 96.598a47.501 46.176 90 0 1 0 95.001H265.465c-42.64 0-77.116 35.465-77.116 79.329l0.105 109.123c339.504 33.271 512.818 192.409 519.994 477.412h50.127c40.247 0 73.267-31.614 76.803-72.107l0.312-7.222V524.585a47.393 46.071 90 0 1 92.247 0v253.55c0 96.285-75.815 174.329-169.466 174.329h-493.006A174.276 169.414 90 0 1 95.947 778.134v-507.152A174.382 169.518 90 0 1 265.413 96.598H456.616z m-132.288 516.194a28.779 27.976 90 0 0-27.975 28.779v57.61H240.349v-57.61a28.779 27.976 90 0 0-56.003 0v172.831a28.779 27.976 90 0 0 56.003 0V756.791h56.003v57.611a28.779 27.976 90 0 0 56.004 0v-172.778a28.779 27.976 90 0 0 -28.028-28.832z m140.036 0H408.359a28.779 27.976 90 0 0-27.872 25.837l-0.155 2.942v172.831c0 15.94 12.531 28.832 28.027 28.832h56.004a86.389 83.979 90 0 0 83.979-86.442v-57.611c0-47.715-37.595-86.389-83.979-86.389z m0 57.61c15.444 0 27.975 12.892 27.975 28.779V756.791a28.779 27.976 90 0 1-27.975 28.832h-28.028V670.402zM771.834 56.48a20.327 19.76 90 0 1 18.357 12.838l9.827 24.606c16.64 41.509 48.048 74.835 87.88 93.183l27.976 12.837a21.182 20.592 90 0 1 0 38.515l-29.64 13.587A175.078 170.194 90 0 0 799.654 342.445l-9.672 22.52a20.327 19.76 90 0 1-36.4 0l-9.568-22.627A174.918 170.039 90 0 0 657.436 252.045l-29.588-13.587a21.29 20.696 90 0 1 0-38.514l27.925-12.837a175.078 170.194 90 0 0 87.774-93.236l9.881-24.553A20.327 19.76 90 0 1 771.835 56.48z" fill="#FFFFFFCC" /></svg>} /><EditTool label="消除笔" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.5 3L13 6.5L6.5 13H3V9.5L9.5 3Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M7 5.5L10.5 9M3 13H13" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}><EditTool label="扩图" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="3.5" width="9" height="9" rx="0.5" stroke="#FFFFFFCC" strokeDasharray="2 1.5" /><path d="M1.5 1.5L3.5 3.5M14.5 1.5L12.5 3.5M1.5 14.5L3.5 12.5M14.5 14.5L12.5 12.5" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /><EditTool label="裁剪" onClick={() => setCropOpen(true)} icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ width: '16px', height: '16px', flexShrink: 0 }}><path d="M902.978 735.755 794.79 735.786 794.79 290.533C794.79 245.399 759.3 208.812 715.52 208.812L688.78 208.812C687.994 208.763 687.203 208.73 686.404 208.73L392.766 208.812 291.611 208.812 291.611 208.84 284.461 208.842 284.461 130.017 284.311 130.017 284.302 96.557C284.297 74.645 267.064 56.885 245.808 56.889 224.554 56.894 207.326 74.66 207.33 96.572L207.339 130.017 207.33 130.017 207.33 208.864 99.126 208.894C77.872 208.899 60.645 226.665 60.648 248.578 60.653 270.489 77.886 288.25 99.142 288.246L207.33 288.216 207.33 733.467C207.33 778.601 242.82 815.188 286.6 815.188L313.34 815.188C314.126 815.237 314.917 815.27 315.716 815.27L609.354 815.188 710.509 815.188 710.509 815.16 717.659 815.158 717.659 893.983 717.809 893.983 717.818 927.443C717.823 949.355 735.056 967.115 756.312 967.111 777.566 967.106 794.794 949.34 794.79 927.428L794.781 893.983 794.79 893.983 794.79 815.136 902.994 815.106C924.248 815.101 941.475 797.335 941.472 775.422 941.468 753.511 924.234 735.752 902.978 735.755L902.978 735.755ZM609.209 735.838 325.382 735.838C304.639 735.838 284.462 714.872 284.462 693.488L284.462 288.193 392.913 288.162 676.741 288.162C697.483 288.162 717.66 309.128 717.66 330.512L717.66 735.807 609.209 735.838 609.209 735.838Z" fill="#FFFFFFCC" /></svg>} /><EditTool label="翻转" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V14" stroke="#FFFFFFCC" strokeLinecap="round" strokeDasharray="2 1.5" /><path d="M2 5L5.5 8L2 11V5ZM14 5L10.5 8L14 11V5Z" fill="#FFFFFFCC" /></svg>} /><div style={{ width: '100%', height: '64px', opacity: 0 }} /></div></div>
          </div>
        </div>
      </div>
    </div>, document.body)}
    {confirmDelete && <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这张图片吗？" confirmText="删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />}
  </MultiAngleAction.Provider></InpaintAction.Provider></UpscaleAction.Provider></FlipAction.Provider></OutpaintAction.Provider>;
}
