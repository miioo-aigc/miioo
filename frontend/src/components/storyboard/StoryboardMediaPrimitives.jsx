/**
 * @file StoryboardMediaPrimitives.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   MediaRemoveButton      媒体卡片删除按钮
 *   MediaContent           图片、视频和音频媒体内容展示
 *   ShortcutMediaCard      首尾帧快捷参考卡片
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收媒体数据和显式交互回调，不调用上传 API、不读取 Store
 */
import { useState } from 'react';
import { normalizeImageUrl } from '../../utils/imageUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function MediaRemoveButton({ onClick }) {
  return (
    <button type="button" aria-label="删除媒体" onClick={onClick} style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', border: 0, borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" /></svg>
    </button>
  );
}

export function MediaContent({ media, className, style }) {
  const url = normalizeImageUrl(media?.url) || null;
  const contentStyle = { width: '100%', height: '100%', objectFit: 'cover', ...style };
  if (media?.type?.startsWith('video')) return <video className={className} src={url} style={contentStyle} muted playsInline />;
  if (media?.type?.startsWith('audio')) {
    return <div className={className} style={{ width: '100%', height: '100%', backgroundColor: '#1D1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" /><circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" /></svg>
    </div>;
  }
  return <img className={className} src={url} alt="" style={contentStyle} />;
}

export function ShortcutMediaCard({ image, label, tooltip, onSelect, enabled = Boolean(image), stretch = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => enabled && onSelect?.(image)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ width: stretch ? '100%' : '120px', aspectRatio: '1', borderRadius: '6px', flexShrink: 0, border: `1px dashed ${hovered && enabled ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`, backgroundColor: '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: enabled ? 'pointer' : 'default', transition: 'border-color 0.12s', padding: '8px', boxSizing: 'border-box' }}>
        {image ? (
          <>
            <div style={{ width: '72px', height: '40px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)', opacity: hovered ? 1 : 0.6, transition: 'opacity 0.12s' }}>
              <MediaContent media={image} />
            </div>
            <span style={{ fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, textAlign: 'center', whiteSpace: 'pre-line' }}>{label}</span>
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2" y="4" width="16" height="12" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" /><circle cx="7" cy="8.5" r="1.5" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" /><path d="M2 13l4-3 3 2.5 3-4 4 4.5" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontSize: '11px', lineHeight: '14px', color: 'rgba(255,255,255,0.20)', fontFamily: FONT, textAlign: 'center', whiteSpace: 'pre-line' }}>{label}</span>
          </>
        )}
      </div>
      {!image && tooltip && hovered && <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#2A2B2B', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '6px 10px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999, fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, boxShadow: '0 4px 12px rgba(0,0,0,0.40)' }}>
        {tooltip}<div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #2A2B2B' }} />
      </div>}
    </div>
  );
}
