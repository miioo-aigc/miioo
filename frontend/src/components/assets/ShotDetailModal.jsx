/**
 * @file ShotDetailModal.jsx
 * @structure-index
 *
 * ─── 依赖与默认数据 ─────────────── L18–L38
 *   useModalSize / placeholder / ConfirmDialog / FONT  弹窗基础依赖
 *   MOCK_SHOT_DETAIL                              无数据时的默认展示值
 *
 * ─── 分镜图片详情弹窗 ───────────── L41–L334
 *   [状态] 当前图片、关闭/下载/删除/复制提示悬浮态、删除确认
 *   [交互] 缩略图切换、提示词复制、删除确认、下载和关闭
 *   [回调] 通过 props 接收 onClose / onDownload / onDelete / onShowToast
 *
 * ─── 更新记录 ─────────────────────
 *   2026-07-16  从 AssetsPage 抽离；API、删除和 Toast 副作用通过显式 props 注入
 *   2026-08-06  详情弹窗统一使用 3:2、90% 视口和 1200×800 最小尺寸，并整体等比缩放
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../../utils/useModalSize';
import placeholderFlowers from '../../assets/placeholder-flowers.webp';
import ConfirmDialog from '../ConfirmDialog';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const MOCK_SHOT_DETAIL = {
  shotNumber: '01',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  resolution: '1920 × 1080',
  generatedAt: '2026-04-21 15:30:09',
  images: [
    { id: 's1', src: placeholderFlowers, finalized: true },
    { id: 's2', src: placeholderFlowers, finalized: false },
    { id: 's3', src: placeholderFlowers, finalized: false },
  ],
};

// Props: shotNumber, prompt, model, resolution, images (array of {id, src, finalized})
export default function ShotDetailModal({ onClose, onDownload, onDelete, onShowToast, shotNumber, prompt, model, resolution, generatedAt, images, refImages }) {
  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const imgs = images ?? MOCK_SHOT_DETAIL.images;
  const defaultIdx = imgs.findIndex((img) => img.finalized);
  const [activeImg, setActiveImg] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);
  const [hovDelete, setHovDelete] = useState(false);
  const [pressDelete, setPressDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef(null);

  const currentImg = imgs[activeImg];
  const isFinalized = currentImg?.finalized ?? false;
  const refImgs = refImages ?? [];
  const currentPrompt = (currentImg?.input_prompt ?? currentImg?.prompt ?? prompt) ?? MOCK_SHOT_DETAIL.prompt;

  function handleCopyPrompt() {
    navigator.clipboard.writeText(currentPrompt);
    clearTimeout(copyToastTimer.current);
    setCopyToast(true);
    copyToastTimer.current = setTimeout(() => setCopyToast(false), 2000);
  }

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
          height: `${modalH}px`,
          transform: `scale(${modalScale})`,
          transformOrigin: 'center center',
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
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative', backgroundColor: '#0A0A0A' }}>
              <img
                src={currentImg?.src ?? placeholderFlowers}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', padding: '16px', boxSizing: 'border-box', transition: 'opacity 0.15s' }}
              />
            </div>
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
                      {img.finalized && (
                        <div style={{
                          position: 'absolute', top: '4px', left: '4px',
                          paddingLeft: '4px', paddingRight: '4px',
                          borderRadius: '2px', backgroundColor: '#4AC981',
                          boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
                          height: '18px', display: 'flex', alignItems: 'center',
                        }}>
                          <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: info panel — scrollable content + sticky actions */}
          <div style={{
            width: '280px', display: 'flex', flexDirection: 'column',
            height: `${modalH - 60}px`, flexShrink: 0,
            backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
          }}>
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>是否定稿</span>
                {isFinalized ? (
                  <div style={{
                    paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px',
                    borderRadius: '2px', backgroundColor: '#4AC981',
                    boxShadow: '#FFFFFF14 0px 0px 0px 1px inset', height: '18px', display: 'flex', alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>否</span>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分镜编号</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{shotNumber ?? MOCK_SHOT_DETAIL.shotNumber}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {currentPrompt && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>提示词</span>
                      <button
                        type="button"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.6, transition: 'opacity 0.12s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                        onClick={handleCopyPrompt}
                        title="复制提示词"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                          <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="white" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="white" strokeOpacity="0.6" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{currentPrompt}</p>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {refImgs.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>参考图</span>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
                      {refImgs.map((ref, idx) => (
                        <div
                          key={ref.id ?? idx}
                          style={{ borderRadius: '4px', overflow: 'hidden', width: '80px', height: '56px', flexShrink: 0, backgroundColor: '#FFFFFF14', border: '1px solid #FFFFFF33', backgroundImage: `url(${ref.url})`, backgroundSize: 'cover', backgroundPosition: '50%' }}
                          title={ref.title}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '12px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</span>
                {[
                  { label: '模型', value: (currentImg?.model || model) ?? MOCK_SHOT_DETAIL.model },
                  { label: '分辨率', value: (currentImg?.resolution || resolution) ?? MOCK_SHOT_DETAIL.resolution },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF66' }}>{(currentImg?.generatedAt || generatedAt) ?? MOCK_SHOT_DETAIL.generatedAt}</span>
              </div>
            </div>

            <div style={{ flexShrink: 0, paddingTop: '12px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A', display: 'flex', gap: '8px' }}>
              {onDelete && (
                <button
                  type="button"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, height: '40px', borderRadius: '8px', gap: '8px', backgroundColor: pressDelete ? '#FFFFFF26' : hovDelete ? '#FFFFFF1F' : '#FFFFFF14', border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s', opacity: pressDelete ? 0.8 : 1 }}
                  onMouseEnter={() => setHovDelete(true)}
                  onMouseLeave={() => { setHovDelete(false); setPressDelete(false); }}
                  onMouseDown={() => setPressDelete(true)}
                  onMouseUp={() => setPressDelete(false)}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2.333 3.667V12.333C2.333 12.784 2.716 13.167 3.167 13.167H10.833C11.284 13.167 11.667 12.784 11.667 12.333V3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                    <path d="M5.333 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M8.667 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M1 3.667H13" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M4.333 3.667L5.15 1.333H8.85L9.667 3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FF6B6B' }}>删除</span>
                </button>
              )}
              <button
                type="button"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, height: '40px', borderRadius: '8px', gap: '8px', backgroundColor: hovDownload ? '#FFFFFF1F' : '#FFFFFF14', border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s' }}
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

            {showDeleteConfirm && (
              <ConfirmDialog
                title="确定要删除吗？"
                description="删除后，该资产将被清除且不可恢复。"
                confirmText="删除"
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={() => { setShowDeleteConfirm(false); onShowToast?.('删除成功', 'success'); onDelete?.(); }}
                zIndex={300}
              />
            )}
          </div>
        </div>
      </div>
      {copyToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: FONT }}>提示词复制成功</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
