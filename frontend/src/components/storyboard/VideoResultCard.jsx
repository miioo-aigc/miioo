/**
 * @file VideoResultCard.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   视频结果展示       展示视频、加载态和定稿状态
 *   结果卡片交互       透传定稿、查看和下载回调
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   只接收视频 URL、定稿状态和显式回调；不写入结果列表、不调用 API，
 *   不直接创建下载链接或维护页面级状态。
 */

import { useState } from 'react';
import Checkbox from '../Checkbox';
import DotsLoading from '../DotsLoading';
import { ImgIconBtn } from './StoryboardImageUpload';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function VideoResultCard({
  settled,
  videoUrl,
  onSettledChange,
  onView,
  onDownload,
}) {
  const [hovered, setHovered] = useState(false);
  const borderColor = settled ? '#2DC3E1' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSettledChange?.(!settled)}
      style={{
        height: '144px', borderRadius: '6px', flexShrink: 0,
        border: `1px solid ${borderColor}`,
        background: '#FFFFFF14', overflow: 'clip', position: 'relative', cursor: 'pointer',
        transition: 'border-color 120ms',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {videoUrl
          ? <video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
          : <DotsLoading size={4} color="#2DC3E1" gap={3} />}
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Checkbox checked={settled} onChange={(event) => { event.stopPropagation(); onSettledChange?.(!settled); }} />
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF', fontWeight: settled ? 600 : 500 }}>定稿</span>
      </div>
      {hovered && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          {videoUrl && (
            <ImgIconBtn onClick={(event) => { event.stopPropagation(); onView?.(videoUrl); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ImgIconBtn>
          )}
          <ImgIconBtn onClick={(event) => { event.stopPropagation(); onDownload?.(videoUrl); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ImgIconBtn>
        </div>
      )}
    </div>
  );
}
