/**
 * @file CurrentShotImagePickerPopover.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   CurrentShotImagePickerPopover  当前分镜图片悬浮窗
 *   固定布局                3 列 120px 卡片、24px 内边距和独立滚动区域
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   仅接收图片列表与选择/关闭回调，不读取页面状态、不调用接口。
 */
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { MediaContent } from './StoryboardMediaPrimitives';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function CurrentShotImagePickerPopover({ open, images = [], onClose, onSelect }) {
  if (!open) return null;

  return createPortal(
    <div
      aria-label="从当前分镜中选取"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, pointerEvents: 'none',
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: '432px', maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          backgroundColor: '#161616', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', lineHeight: '22px', color: 'rgba(255,255,255,0.90)', fontFamily: FONT }}>从当前分镜中选取</span>
          <button type="button" aria-label="关闭" onClick={onClose} style={{ width: '28px', height: '28px', border: 0, borderRadius: '6px', background: 'transparent', color: '#FFF', fontSize: '22px', lineHeight: '22px', cursor: 'pointer' }}>×</button>
        </header>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 120px)', gap: '12px' }}>
            {images.map((image, index) => (
              <ImagePickerCard
                key={`${image.id || image.url || 'shot-image'}-${index}`}
                image={image}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ImagePickerCard({ image, onSelect }) {
  const [state, setState] = useState('default');
  const hovered = state === 'hovered';
  const pressed = state === 'pressed';

  return (
    <button
      type="button"
      aria-label={image.name || '当前分镜图片'}
      onClick={() => onSelect?.(image)}
      onMouseEnter={() => setState('hovered')}
      onMouseLeave={() => setState('default')}
      onMouseDown={() => setState('pressed')}
      onMouseUp={() => setState('hovered')}
      style={{
        width: '120px', height: '120px', padding: 0, overflow: 'hidden',
        border: `1px solid ${hovered || pressed ? 'rgba(45,195,225,0.72)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '6px', backgroundColor: '#1D1E1E', cursor: 'pointer',
        transform: pressed ? 'scale(0.96)' : hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered || pressed ? '0 0 0 2px rgba(45,195,225,0.16), 0 6px 16px rgba(0,0,0,0.36)' : 'none',
        transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
      }}
    >
      <MediaContent media={image} style={{ opacity: hovered || pressed ? 1 : 0.86, transition: 'opacity 120ms ease' }} />
    </button>
  );
}
