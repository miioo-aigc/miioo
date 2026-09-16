import { cloneElement, useRef, useState } from 'react';
import { useModalSize } from '../utils/useModalSize';
import ImageEditChrome, { ImageEditFooter } from './image-edit/ImageEditChrome';
import { CropIcon, RotateCounterClockwiseIcon, RotateClockwiseIcon, FlipHorizontalIcon, FlipVerticalIcon, OriginalRatioIcon, CustomRatioIcon, RatioIcon } from './ui';
import { showGlobalToast } from '../stores/toastStore';
import ImageCropEditor from './ImageCropEditor';
import { renderImageCropBlob } from '../utils/imageCrop';
import { buildImageEditRequest } from '../utils/MediaEditRequest';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const RATIOS = [
  { label: '原比例', value: null, icon: <OriginalRatioIcon /> },
  { label: '自定义', value: 'custom', icon: <CustomRatioIcon /> },
  { label: '16:9', value: 16 / 9, icon: <RatioIcon rw={16} rh={9} /> },
  { label: '9:16', value: 9 / 16, icon: <RatioIcon rw={9} rh={16} /> },
  { label: '4:3', value: 4 / 3, icon: <RatioIcon rw={4} rh={3} /> },
  { label: '3:4', value: 3 / 4, icon: <RatioIcon rw={3} rh={4} /> },
  { label: '1:1', value: 1, icon: <RatioIcon rw={1} rh={1} /> },
];

function ToolButton({ label, icon, disabled, onClick, selected }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = selected || hovered || pressed;
  return <button type="button" aria-label={label} aria-pressed={selected} title={label} disabled={disabled} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false); }} onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} style={{ width: '32px', height: '32px', padding: 0, border: 0, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: disabled ? '#FFFFFF33' : active ? '#FFFFFF' : '#FFFFFFCC', background: disabled ? 'transparent' : pressed || selected ? '#FFFFFF1A' : hovered ? '#FFFFFF0D' : 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background-color 120ms ease, color 120ms ease' }}>{cloneElement(icon, { color: disabled ? '#FFFFFF33' : active ? '#FFFFFF' : '#FFFFFFCC' })}</button>;
}

export default function ImageCropModal({ imageUrl, sourceAsset, onPrepare, onClose }) {
  const { width: modalW, height: modalH } = useModalSize();
  const editorRef = useRef(null);
  const [editState, setEditState] = useState({ imageSize: { width: 0, height: 0 }, crop: { x: 0, y: 0, width: 1, height: 1 }, zoom: 1, panX: 0, panY: 0 });
  const [ratio, setRatio] = useState(null);
  const [cropEnabled, setCropEnabled] = useState(true);
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
      const request = buildImageEditRequest(sourceAsset, {
        mode: 'crop',
        file: new File([blob], '图片裁剪.png', { type: 'image/png' }),
      });
      await onPrepare?.(request);
      showGlobalToast('已生成裁剪图片并准备保存参数，等待后端保存接口接入', 'info');
    } catch (error) {
      console.error('[ImageCropModal] 生成裁剪图片失败:', error);
      showGlobalToast(error.message || '裁剪参数准备失败，请重试', 'error');
    } finally { setSaving(false); }
  };

  const stageMaxWidth = modalW - 48;
  const stageMaxHeight = modalH - (cropEnabled ? 288 : 196);
  const sourceRatio = editState.imageSize.width && editState.imageSize.height ? editState.imageSize.width / editState.imageSize.height : 1;
  const isQuarterTurn = Math.abs(rotation) % 180 === 90;
  const stageRatio = isQuarterTurn ? 1 / sourceRatio : sourceRatio;
  const stageWidth = Math.min(stageMaxWidth, stageMaxHeight * stageRatio);

  return <ImageEditChrome title="图片裁剪" onClose={onClose} busy={saving} footer={<ImageEditFooter onReset={reset} onClose={onClose} onSubmit={handleSave} busy={saving} disabled={!editState.imageSize.width} />}>
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
      <div style={{ height: '64px', padding: '16px 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090909', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ToolButton label="裁剪" icon={<CropIcon size={16} />} selected={cropEnabled} onClick={() => { setCropEnabled((value) => !value); setHoveredRatio(undefined); }} />
          <ToolButton label="向左旋转" icon={<RotateCounterClockwiseIcon size={16} />} onClick={() => setRotation((value) => value - 90)} />
          <ToolButton label="向右旋转" icon={<RotateClockwiseIcon size={16} />} onClick={() => setRotation((value) => value + 90)} />
          <ToolButton label="水平翻转" icon={<FlipHorizontalIcon size={16} />} onClick={() => setFlipX((value) => !value)} />
          <ToolButton label="垂直翻转" icon={<FlipVerticalIcon size={16} />} onClick={() => setFlipY((value) => !value)} />
        </div>
        <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF99' }}>{cropEnabled ? '裁剪区域大小' : '图片大小'}：{editState.imageSize.width ? `${Math.round((isQuarterTurn ? editState.imageSize.height : editState.imageSize.width) * (cropEnabled ? editState.crop.width : 1))} × ${Math.round((isQuarterTurn ? editState.imageSize.width : editState.imageSize.height) * (cropEnabled ? editState.crop.height : 1))}` : '—'}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0 24px' }}>
        <div style={{ width: `${stageWidth}px`, aspectRatio: stageRatio, transition: 'width 240ms ease', position: 'relative', flexShrink: 0 }}>
          <ImageCropEditor ref={editorRef} imageUrl={imageUrl} cropEnabled={cropEnabled} ratio={ratio} rotation={rotation} flipX={flipX} flipY={flipY} onRatioChange={handleRatio} onChange={setEditState} />
        </div>
      </div>
      <div aria-hidden={!cropEnabled} inert={!cropEnabled} style={{ height: cropEnabled ? '92px' : '0px', flexShrink: 0, overflow: 'hidden', opacity: cropEnabled ? 1 : 0, transition: 'height 240ms ease, opacity 240ms ease', background: '#090909' }}>
        <div style={{ height: '92px', padding: '16px 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>{RATIOS.map((item) => { const selected = ratio === item.value; const active = selected || hoveredRatio === item.value; return <button key={item.label} type="button" onClick={() => handleRatio(item.value)} onMouseEnter={() => setHoveredRatio(item.value)} onMouseLeave={() => setHoveredRatio(undefined)} style={{ width: '60px', height: '61px', padding: 0, border: 0, borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center', background: active ? '#FFFFFF1A' : '#FFFFFF0D', color: active ? '#FFFFFF' : '#FFFFFFCC', cursor: 'pointer' }}>{cloneElement(item.icon, { color: active ? '#FFFFFF' : '#FFFFFFCC', selected })}<span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: active ? '#FFFFFF' : '#FFFFFFCC' }}>{item.label}</span></button>; })}</div>
      </div>
    </div>
  </ImageEditChrome>;
}
