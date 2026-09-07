import { cloneElement, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import Button from './ui/Button';
import { RotateCounterClockwiseIcon, RotateClockwiseIcon, FlipHorizontalIcon, FlipVerticalIcon, OriginalRatioIcon, CustomRatioIcon, RatioIcon } from './ui';
import { showGlobalToast } from '../stores/toastStore';
import ImageCropEditor from './ImageCropEditor';
import { renderImageCropBlob } from '../utils/imageCrop';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const RATIOS = [
  { label: '原比例', value: null, icon: <OriginalRatioIcon /> },
  { label: '自定义', value: 'custom', icon: <CustomRatioIcon /> },
  { label: '16:9', value: 16 / 9, icon: <RatioIcon rw={16} rh={9} /> },
  { label: '9:16', value: 9 / 16, icon: <RatioIcon rw={9} rh={16} /> },
  { label: '4:3', value: 4 / 3, icon: <RatioIcon rw={4} rh={3} /> },
  { label: '3:4', value: 3 / 4, icon: <RatioIcon rw={3} rh={4} /> },
  { label: '1:1', value: 1, icon: <RatioIcon rw={1} rh={1} /> },
];

function CloseIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>; }
function ResetIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}><path d="M2 7C2 4.24 4.24 2 7 2C8.66 2 10.13 2.81 11.06 4.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M12 7C12 9.76 9.76 12 7 12C5.34 12 3.87 11.19 2.94 9.94" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M11 2L11.06 4.06L9 4M3 12L2.94 9.94L5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function ToolButton({ label, icon, disabled, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = hovered || pressed;
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false); }} onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} style={{ width: '32px', height: '32px', padding: 0, border: 0, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: disabled ? '#FFFFFF33' : active ? '#FFFFFF' : '#FFFFFFCC', background: disabled ? 'transparent' : pressed ? '#FFFFFF1A' : hovered ? '#FFFFFF0D' : 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background-color 120ms ease, color 120ms ease' }}>{cloneElement(icon, { color: disabled ? '#FFFFFF33' : active ? '#FFFFFF' : '#FFFFFFCC' })}</button>;
}

export default function ImageCropModal({ imageUrl, imageId, onBasicEdit, onClose, onSave }) {
  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const editorRef = useRef(null);
  const [editState, setEditState] = useState({ imageSize: { width: 0, height: 0 }, crop: { x: 0, y: 0, width: 1, height: 1 }, zoom: 1, panX: 0, panY: 0 });
  const [ratio, setRatio] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hoveredRatio, setHoveredRatio] = useState(undefined);
  const reset = () => { editorRef.current?.reset(); setRotation(0); setFlipX(false); setFlipY(false); };
  const handleRatio = (nextRatio) => { setRatio(nextRatio); setHoveredRatio(undefined); };

  const handleSave = async () => {
    if (!imageUrl || !editState.imageSize.width || saving) return;
    setSaving(true);
    try {
      const { image, imageSize, crop, zoom, panX, panY } = editorRef.current.getEditState();
      const blob = await renderImageCropBlob({ image, crop, rotation, flipX, flipY, zoom, panX, panY, imageWidth: imageSize.width, imageHeight: imageSize.height });
      if (!blob) throw new Error('裁剪结果生成失败');
      const objectUrl = URL.createObjectURL(blob);
      const isQuarterTurn = Math.abs(rotation) % 180 === 90;
      const outputWidth = isQuarterTurn ? imageSize.height : imageSize.width;
      const outputHeight = isQuarterTurn ? imageSize.width : imageSize.height;
      const localImage = { id: `local-crop-${Date.now()}`, fileUrl: objectUrl, url: objectUrl, src: objectUrl, blob, width: Math.round(outputWidth * crop.width), height: Math.round(outputHeight * crop.height), is_primary: false, isNew: true, source: 'frontend-crop' };
      const savedImage = imageId && onBasicEdit
        ? await onBasicEdit({ operations: ['crop'], crop })
        : null;
      const remoteUrl = savedImage?.preview_url || savedImage?.previewUrl || savedImage?.original_url || savedImage?.originalUrl || savedImage?.url || savedImage?.file_url || savedImage?.fileUrl;
      await onSave?.(remoteUrl ? { ...savedImage, fileUrl: remoteUrl, url: remoteUrl, src: remoteUrl, isNew: true } : localImage);
      onClose?.();
    } catch (error) {
      console.error('[ImageCropModal] 生成裁剪图片失败:', error);
      showGlobalToast('裁剪失败，请重试', 'error');
    } finally { setSaving(false); }
  };

  const stageMaxWidth = modalW - 48;
  const stageMaxHeight = modalH - 288;
  const sourceRatio = editState.imageSize.width && editState.imageSize.height ? editState.imageSize.width / editState.imageSize.height : 1;
  const isQuarterTurn = Math.abs(rotation) % 180 === 90;
  const stageRatio = isQuarterTurn ? 1 / sourceRatio : sourceRatio;
  const stageWidth = Math.min(stageMaxWidth, stageMaxHeight * stageRatio);
  const stageHeight = stageWidth / stageRatio;

  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={onClose}>
    <div style={{ width: `${modalW}px`, height: `${modalH}px`, transform: `scale(${modalScale})`, transformOrigin: 'center center', borderRadius: '16px', overflow: 'hidden', boxShadow: '#00000099 -10px 24px 64px', background: '#161616', border: '1px solid #FFFFFF14', display: 'flex', flexDirection: 'column' }} onClick={(event) => event.stopPropagation()}>
      <div style={{ height: '60px', padding: '20px 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid #FFFFFF14' }}><span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>图片裁剪</span><button type="button" aria-label="关闭" onClick={onClose} style={{ width: '24px', height: '24px', border: 0, padding: 0, color: '#FFFFFF99', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CloseIcon /></button></div>
      <div style={{ height: '64px', padding: '16px 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090909', flexShrink: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ToolButton label="向左旋转" icon={<RotateCounterClockwiseIcon size={16} />} onClick={() => setRotation((value) => value - 90)} /><ToolButton label="向右旋转" icon={<RotateClockwiseIcon size={16} />} onClick={() => setRotation((value) => value + 90)} /><ToolButton label="水平翻转" icon={<FlipHorizontalIcon size={16} />} onClick={() => setFlipX((value) => !value)} /><ToolButton label="垂直翻转" icon={<FlipVerticalIcon size={16} />} onClick={() => setFlipY((value) => !value)} /></div><span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF99' }}>裁剪区域大小：{editState.imageSize.width ? `${Math.round((isQuarterTurn ? editState.imageSize.height : editState.imageSize.width) * editState.crop.width)} × ${Math.round((isQuarterTurn ? editState.imageSize.width : editState.imageSize.height) * editState.crop.height)}` : '—'}</span></div>
      <div style={{ flex: 1, minHeight: 0, background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0 24px' }}><div style={{ width: `${stageWidth}px`, height: `${stageHeight}px`, position: 'relative', flexShrink: 0 }}><ImageCropEditor ref={editorRef} imageUrl={imageUrl} ratio={ratio} rotation={rotation} flipX={flipX} flipY={flipY} onRatioChange={handleRatio} onChange={setEditState} /></div></div>
      <div style={{ height: '92px', padding: '16px 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#090909' }}>{RATIOS.map((item) => { const selected = ratio === item.value; const active = selected || hoveredRatio === item.value; return <button key={item.label} type="button" onClick={() => handleRatio(item.value)} onMouseEnter={() => setHoveredRatio(item.value)} onMouseLeave={() => setHoveredRatio(undefined)} style={{ width: '60px', height: '61px', padding: 0, border: 0, borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center', background: active ? '#FFFFFF1A' : '#FFFFFF0D', color: active ? '#FFFFFF' : '#FFFFFFCC', cursor: 'pointer' }}>{cloneElement(item.icon, { color: active ? '#FFFFFF' : '#FFFFFFCC', selected })}<span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: active ? '#FFFFFF' : '#FFFFFFCC' }}>{item.label}</span></button>; })}</div>
      <div style={{ height: '72px', padding: '16px 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexShrink: 0, borderTop: '1px solid #FFFFFF0A' }}><Button variant="link" size="large" icon={<ResetIcon />} className="h-[40px] px-[12px] gap-[4px]" contentClassName="text-[13px] leading-[16px] !text-[#FFFFFFCC] group-hover:!text-white group-active:!text-[#FFFFFFCC]" onClick={reset}>重置</Button><Button variant="secondary" size="large" onClick={onClose}>取消</Button><Button variant="primary" size="large" loading={saving} disabled={!editState.imageSize.width} onClick={handleSave}>保存</Button></div>
    </div>
  </div>, document.body);
}
