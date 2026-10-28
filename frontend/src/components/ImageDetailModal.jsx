import ImageEditIcon from './image-edit/ImageEditIcon';
import { SHOW_MULTI_ANGLE_ENTRIES } from '../config/MultiAngleEntryVisibility';
import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from './ConfirmDialog';
import AsyncImagePreview from './AsyncImagePreview';
import { apiGetLiveMaterialPreviewByRef } from '../api/liveMaterials';
import { useModalSize } from '../utils/useModalSize';
import { showGlobalToast } from '../stores/toastStore';
import { downloadUrlWithFeedback } from '../utils/downloadFeedback';
import ImageCropModal from './ImageCropModal';
import MultiAngleModal from './image-edit/MultiAngleModal';
import InpaintModal from './image-edit/InpaintModal';
import UpscaleModal from './image-edit/UpscaleModal';
import ImageFlipModal from './image-edit/ImageFlipModal';
import OutpaintModal from './image-edit/OutpaintModal';
import CopyPromptButton from './ui/CopyPromptButton';
import { FavoriteIcon, DeleteIcon, Tooltip } from './ui';
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
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', minWidth: '24px', height: '24px', padding: 0, border: 0, borderRadius: '7px', backgroundColor: hovered ? '#FFFFFF14' : '#161616', cursor: 'pointer', transition: 'background-color 0.12s' }}>{icon}</button>
    </Tooltip>
  );
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
  const renderedIcon = icon;
  if (label === '多机位' && !SHOW_MULTI_ANGLE_ENTRIES) return null;
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
  await downloadUrlWithFeedback(url, 'creation.png');
}

function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M13.506 11.439C14.601 10.668 15.071 9.277 14.667 8C14.262 6.723 13.024 6.024 11.684 6.025H10.911C10.405 4.054 8.736 2.599 6.715 2.366C4.693 2.133 2.737 3.171 1.796 4.975C0.856 6.78 1.125 8.977 2.474 10.501" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.003 13.667L8 7.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.121 11.545L8 13.667L5.879 11.545" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function ImageDetailModal({ visualMedia = false, card, onClose, onDelete, onDownload, favorited = false, onToggleFavorite, onCreateImage }) {
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

  if (multiAngleOpen) return <MultiAngleModal card={card} onSave={onCreateImage} onComplete={onClose} onClose={onClose} />;
  if (inpaintMode) return <InpaintModal card={card} mode={inpaintMode} onSave={onCreateImage} onComplete={onClose} onClose={onClose} />;
  if (upscaleOpen) return <UpscaleModal card={card} onSave={onCreateImage} onComplete={onClose} onClose={onClose} />;
  if (flipOpen) return <ImageFlipModal imageUrl={card.imageUrl} sourceAsset={card} onSave={onCreateImage} onComplete={onClose} onClose={onClose} />;
  if (outpaintOpen) return <OutpaintModal card={card} onSave={onCreateImage} onComplete={onClose} onClose={onClose} />;

  if (cropOpen) {
    return <ImageCropModal imageUrl={card.imageUrl} sourceAsset={card} onSave={onCreateImage} onComplete={onClose} onClose={onClose} />;
  }

  return <OutpaintAction.Provider value={() => setOutpaintOpen(true)}><FlipAction.Provider value={() => setFlipOpen(true)}><UpscaleAction.Provider value={() => setUpscaleOpen(true)}><InpaintAction.Provider value={setInpaintMode}><MultiAngleAction.Provider value={() => setMultiAngleOpen(true)}>
    {createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div style={{ width: `${modalW}px`, height: `${modalH}px`, boxSizing: 'border-box', transform: `scale(${modalScale})`, transformOrigin: 'center center', borderRadius: '16px', border: '1px solid #FFFFFF14', backgroundColor: '#161616', boxShadow: '#00000099 -10px 24px 64px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', backgroundColor: '#161616', flexShrink: 0 }}><span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', fontWeight: 500, lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span><div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHovered ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }} onClick={onClose} onMouseEnter={() => setCloseHovered(true)} onMouseLeave={() => setCloseHovered(false)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke={closeHovered ? '#FFFFFF' : '#FFFFFF99'} strokeWidth="1.5" strokeLinecap="round" /></svg></div></div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', position: 'relative', overflow: 'hidden' }}>{card.imageUrl && <AsyncImagePreview visual={visualMedia} plain src={card.imageUrl} alt={''} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} imageStyle={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />}</div>
          <div style={{ width: '340px', flexShrink: 0, minHeight: 0, boxSizing: 'border-box', backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #FFFFFF0A', backgroundColor: '#161616' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PanelAction label="收藏" active={favorited} onClick={handleStarClick} icon={<div style={{ transform: starAnim ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex' }}><FavoriteIcon filled={favorited} color="rgba(255,255,255,0.8)" /></div>} /><PanelAction label="下载" onClick={() => (onDownload ? onDownload() : downloadImage(card.imageUrl))} icon={<DownloadIcon />} /></div><PanelAction label="删除" onClick={() => setConfirmDelete(true)} icon={<DeleteIcon size={14} />} /></div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {DETAIL_PANEL_DIVIDER}
              {editMetadata.edit_mode && <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 20px', flexShrink: 0 }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>编辑模式</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>{EDIT_MODE_LABELS[editMetadata.edit_mode] || editMetadata.edit_mode}</span></div>}
              {showPrompt && <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 20px', flexShrink: 0 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>提示词</div><CopyPromptButton text={card.prompt} onCopy={handleCopyPrompt} /></div><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.promptHTML ? <span dangerouslySetInnerHTML={{ __html: card.promptHTML }} /> : (card.prompt || '—')}</div></div>}
              {card.refImages?.length > 0 && <>{DETAIL_PANEL_DIVIDER}<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>参考图</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}>{card.refImages.map((img, index) => { const imageUrl = img.url || img.previewUrl || ''; return <AsyncImagePreview retryOnError={false} visual={visualMedia} key={`${index}-${imageUrl}`} src={imageUrl} alt="参考图" resolveSrc={apiGetLiveMaterialPreviewByRef} style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1' }} />; })}</div></div></>}
              {DETAIL_PANEL_DIVIDER}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 20px', flexShrink: 0 }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>生成参数</div>{card.model && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>模型</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.model}</span></div>}{card.ratio && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>画面比例</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.ratio}</span></div>}{card.resolution && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分辨率</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.resolution}</span></div>}</div>
              {DETAIL_PANEL_DIVIDER}<div style={{ display: 'flex', flexDirection: 'row', gap: '4px', padding: '16px 20px', justifyContent: 'flex-start', alignItems: 'center', flexShrink: 0 }}><span style={{ flex: '1 1 0px', fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>AI 生成时间</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{formatCreationDate(card.createdAt || card.generatedAt)}</span></div>{DETAIL_PANEL_DIVIDER}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: '340px', padding: '16px 20px 16px', boxSizing: 'border-box', borderTop: '1px solid #FFFFFF0D', backgroundColor: '#161616' }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>图片编辑</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}><EditTool label="多机位" icon={<ImageEditIcon label="多机位" />} /><EditTool label="局部重绘" icon={<ImageEditIcon label="局部重绘" />} /><EditTool label="智能超清" icon={<ImageEditIcon label="智能超清" />} /><EditTool label="消除笔" icon={<ImageEditIcon label="消除笔" />} /><EditTool label="扩图" icon={<ImageEditIcon label="扩图" />} /><EditTool label="裁剪" onClick={() => setCropOpen(true)} icon={<ImageEditIcon label="裁剪" />} /><EditTool label="翻转" icon={<ImageEditIcon label="翻转" />} /><div style={{ width: '100%', height: '64px', opacity: 0 }} /></div></div>
          </div>
        </div>
      </div>
    </div>, document.body)}
    {confirmDelete && <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这张图片吗？" confirmText="删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />}
  </MultiAngleAction.Provider></InpaintAction.Provider></UpscaleAction.Provider></FlipAction.Provider></OutpaintAction.Provider>;
}
