/**
 * @file AssetDetailModal.jsx
 * @structure-index
 *
 * ─── 依赖与常量 ─────────────────── L8–L29
 *   useModalSize / placeholder / FONT / MOCK_DETAIL  详情弹窗基础依赖与默认数据
 *
 * ─── 图片资产详情弹窗 ───────────── L32–L251
 *   [状态] 当前图片、关闭按钮悬浮态、下载按钮悬浮态
 *   [交互] 缩略图切换、下载和关闭
 *   [回调] 通过 props 接收 onClose / onDownload
 *
 * ─── 更新记录 ─────────────────────
 *   2026-07-16  从 AssetsPage 抽离；页面级数据和动作通过显式 props 注入
 */

import { useState } from 'react';
import { useModalSize } from '../../utils/useModalSize';
import placeholderFlowers from '../../assets/placeholder-flowers.webp';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const MOCK_DETAIL = {
  name: '小虎',
  description: '一只雄性成年孟加拉虎，大型健壮体型，肩背宽厚，四肢粗壮，橘黄色短毛，黑色条纹较粗且分布稳定，右眼上方有一道浅色旧疤，颈部一圈深棕色较长鬃毛，头部较大，口鼻宽，尾巴中等长度，站姿平稳。',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  ratio: '16:9',
  resolution: '1920 × 1080',
  generatedAt: '2026-04-21 15:30:09',
  images: [
    { id: 'i1', src: placeholderFlowers, finalized: true },
    { id: 'i2', src: placeholderFlowers, finalized: false },
    { id: 'i3', src: placeholderFlowers, finalized: false },
  ],
};

// Props: name, description, prompt, model, ratio, resolution, images (array of {id, src, finalized})
// images[0] should be the finalized image; default activeImg = index of first finalized image
export default function AssetDetailModal({ onClose, onDownload, name, description, prompt, model, ratio, resolution, generatedAt, images }) {
  const { width: modalW, height: modalH } = useModalSize();
  const imgs = images ?? MOCK_DETAIL.images;
  const defaultIdx = imgs.findIndex((img) => img.finalized);
  const [activeImg, setActiveImg] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);

  const currentImg = imgs[activeImg];
  const isFinalized = currentImg?.finalized ?? false;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: `${modalW}px`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '#00000099 -10px 24px 64px',
          backgroundColor: '#161616',
          border: '1px solid #FFFFFF14',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          paddingTop: '20px',
          paddingBottom: '20px',
          paddingLeft: '24px',
          paddingRight: '24px',
          backgroundColor: '#161616',
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
          <button
            type="button"
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hovClose ? '#FFFFFF14' : 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '6px', padding: 0, flexShrink: 0, transition: 'background 0.12s',
            }}
            onMouseEnter={() => setHovClose(true)}
            onMouseLeave={() => setHovClose(false)}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', height: `${modalH - 60}px` }}>
          {/* Left: preview */}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 0, minHeight: 0, backgroundColor: '#0D0D0D' }}>
            {/* Main image */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative', backgroundColor: '#0A0A0A' }}>
              <img
                src={currentImg?.src ?? placeholderFlowers}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', padding: '16px', boxSizing: 'border-box', transition: 'opacity 0.15s' }}
              />
            </div>
            {/* Thumbnails strip */}
            <div style={{
              flexShrink: 0,
              paddingTop: '14px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
              backgroundColor: '#111111',
            }}>
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
                {imgs.map((img, idx) => {
                  const isActive = activeImg === idx;
                  return (
                    <div
                      key={img.id}
                      style={{
                        borderRadius: '6px', overflow: 'hidden',
                        width: '120px', height: '84px', flexShrink: 0,
                        boxShadow: isActive ? '#2DC3E166 0px 0px 10px 1px' : 'none',
                        backgroundColor: '#FFFFFF14',
                        border: isActive ? '1px solid #2DC3E1' : '1px solid #FFFFFF33',
                        cursor: 'pointer', position: 'relative',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onClick={() => setActiveImg(idx)}
                    >
                      <div style={{
                        width: '100%', height: '100%',
                        backgroundImage: `url(${img.src ?? placeholderFlowers})`,
                        backgroundSize: 'cover', backgroundPosition: '50%',
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: info panel — scrollable content + sticky download */}
          <div style={{
            width: '280px', display: 'flex', flexDirection: 'column',
            height: `${modalH - 60}px`, flexShrink: 0,
            backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
          }}>
            {/* Scrollable content */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
              {/* Finalized status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>是否定稿</span>
                {isFinalized ? (
                  <div style={{
                    paddingLeft: '8px', paddingRight: '8px', paddingTop: '2px', paddingBottom: '2px',
                    borderRadius: '4px', boxShadow: '#FFFFFF14 0px 0px 0px 1px inset', backgroundColor: '#7AE5B91A',
                  }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#7AE5B9' }}>定稿</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>否</span>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Name + description */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '8px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>{name ?? MOCK_DETAIL.name}</span>
                <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{description ?? MOCK_DETAIL.description}</p>
              </div>

              {/* Prompt */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>提示词</span>
                <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{prompt ?? MOCK_DETAIL.prompt}</p>
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Generation params */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '12px' }}>
                <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</span>
                {[
                  { label: '模型', value: model ?? MOCK_DETAIL.model },
                  { label: '画面比例', value: ratio ?? MOCK_DETAIL.ratio },
                  { label: '分辨率', value: resolution ?? MOCK_DETAIL.resolution },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* AI generated time */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF66' }}>{generatedAt ?? MOCK_DETAIL.generatedAt}</span>
              </div>
            </div>

            {/* Sticky download button */}
            <div style={{ flexShrink: 0, paddingTop: '12px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A' }}>
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '40px', borderRadius: '8px', gap: '8px',
                  backgroundColor: hovDownload ? '#FFFFFF1F' : '#FFFFFF14',
                  border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                }}
                onMouseEnter={() => setHovDownload(true)}
                onMouseLeave={() => setHovDownload(false)}
                onClick={onDownload}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke="#FFFFFF99" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>下载</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
