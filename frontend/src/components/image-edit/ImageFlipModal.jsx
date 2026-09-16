import { cloneElement, useRef, useState } from 'react';
import { useModalSize } from '../../utils/useModalSize';
import ImageEditChrome, { ImageEditFooter } from './ImageEditChrome';
import ImageCropEditor from '../ImageCropEditor';
import { FlipHorizontalIcon, FlipVerticalIcon, RotateClockwiseIcon, RotateCounterClockwiseIcon } from '../ui';
import { renderImageCropBlob } from '../../utils/imageCrop';
import { showGlobalToast } from '../../stores/toastStore';
import { buildImageEditRequest } from '../../utils/MediaEditRequest';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function ToolButton({ label, icon, onClick, selected }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = selected || hovered || pressed;
  return <button
    type="button"
    aria-label={label}
    aria-pressed={selected}
    title={label}
    onClick={onClick}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => { setHovered(false); setPressed(false); }}
    onMouseDown={() => setPressed(true)}
    onMouseUp={() => setPressed(false)}
    style={{ width: '32px', height: '32px', padding: 0, border: 0, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#FFFFFF' : '#FFFFFFCC', background: pressed || selected ? '#FFFFFF1A' : hovered ? '#FFFFFF0D' : 'transparent', cursor: 'pointer', transition: 'background-color 120ms ease, color 120ms ease' }}
  >{cloneElement(icon, { color: active ? '#FFFFFF' : '#FFFFFFCC' })}</button>;
}

export default function ImageFlipModal({ imageUrl, sourceAsset, onPrepare, onClose }) {
  const { width: modalW, height: modalH } = useModalSize();
  const editorRef = useRef(null);
  const [editState, setEditState] = useState({ imageSize: { width: 0, height: 0 } });
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    editorRef.current?.reset();
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
  };

  const handleSave = async () => {
    if (!imageUrl || !editState.imageSize.width || saving) return;
    setSaving(true);
    try {
      const { image, imageSize, crop, zoom, panX, panY } = editorRef.current.getEditState();
      const blob = await renderImageCropBlob({ image, crop, rotation, flipX, flipY, zoom, panX, panY, imageWidth: imageSize.width, imageHeight: imageSize.height });
      if (!blob) throw new Error('翻转结果生成失败');
      const request = buildImageEditRequest(sourceAsset, {
        mode: 'flip',
        file: new File([blob], '图片翻转.png', { type: 'image/png' }),
      });
      await onPrepare?.(request);
      showGlobalToast('已生成翻转图片并准备保存参数，等待后端保存接口接入', 'info');
    } catch (error) {
      console.error('[ImageFlipModal] 生成翻转图片失败:', error);
      showGlobalToast(error.message || '翻转参数准备失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const stageMaxWidth = modalW - 48;
  const stageMaxHeight = modalH - 196;
  const sourceRatio = editState.imageSize.width && editState.imageSize.height
    ? editState.imageSize.width / editState.imageSize.height
    : 1;
  const stageRatio = Math.abs(rotation) % 180 === 90 ? 1 / sourceRatio : sourceRatio;
  const stageWidth = Math.min(stageMaxWidth, stageMaxHeight * stageRatio);

  return <ImageEditChrome
    title="图片翻转"
    onClose={onClose}
    busy={saving}
    footer={<ImageEditFooter onReset={reset} onClose={onClose} onSubmit={handleSave} busy={saving} disabled={!editState.imageSize.width} />}
  >
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
      <div style={{ height: '64px', padding: '16px 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090909', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ToolButton label="向左旋转" icon={<RotateCounterClockwiseIcon size={16} />} onClick={() => setRotation((value) => value - 90)} />
          <ToolButton label="向右旋转" icon={<RotateClockwiseIcon size={16} />} onClick={() => setRotation((value) => value + 90)} />
          <ToolButton label="水平翻转" icon={<FlipHorizontalIcon size={16} />} selected={flipX} onClick={() => setFlipX((value) => !value)} />
          <ToolButton label="垂直翻转" icon={<FlipVerticalIcon size={16} />} selected={flipY} onClick={() => setFlipY((value) => !value)} />
        </div>
        <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF99' }}>
          图片大小：{editState.imageSize.width ? `${Math.round((Math.abs(rotation) % 180 === 90 ? editState.imageSize.height : editState.imageSize.width))} × ${Math.round((Math.abs(rotation) % 180 === 90 ? editState.imageSize.width : editState.imageSize.height))}` : '—'}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0 24px' }}>
        <div style={{ width: `${stageWidth}px`, aspectRatio: stageRatio, transition: 'width 240ms ease', position: 'relative', flexShrink: 0 }}>
          <ImageCropEditor ref={editorRef} imageUrl={imageUrl} cropEnabled={false} rotation={rotation} flipX={flipX} flipY={flipY} imageAlt="待翻转图片" onChange={setEditState} />
        </div>
      </div>
    </div>
  </ImageEditChrome>;
}
