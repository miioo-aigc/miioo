/**
 * @file CreationImageResultCard.jsx
 * @structure-index
 *
 * ─── 状态层 ─────────────────────────────────────────────────────
 *   hovered / detailOpen / starAnim / confirmDelete              卡片悬停、详情、收藏和删除确认状态
 *   ImageDetailModal 内部状态                                      详情弹窗收藏、关闭、删除和复制提示状态
 *
 * ─── 展示层 ────────────────────────────────────────────────────
 *   CreationImageResultCard                                      图片结果卡片、批量选择和媒体操作
 *   ImageDetailModal                                             原图预览、提示词、参考图、参数和操作
 *
 * ─── 依赖边界 ──────────────────────────────────────────────────
 *   只通过 props 接收图片数据和业务回调；不读取 CreationPage 闭包变量
 *   图片下载通过 onDownload 回调回到页面；详情展示和确认弹窗不调用业务 API
 *
 * ─── 更新记录 ──────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离图片结果卡片及图片详情弹窗；页面通过显式 props 注入业务回调
 *   2026-08-17  下载统一透传页面正式下载回调，详情弹窗不再请求短时媒体链接
 */

import { useModalSize } from '../../utils/useModalSize';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import DotsLoading from '../DotsLoading';
import CreationCardActionButton from './CreationCardActionButton';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function StarIcon({ filled = false, strokeColor = '#FFFFFF' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z"
        fill={filled ? '#F0B429' : 'none'}
        stroke={filled ? '#F0B429' : strokeColor}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyPromptButton({ text, onCopy }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const color = pressed ? '#FFFFFF99' : hovered ? '#FFFFFFCC' : '#FFFFFF66';
  return (
    <button
      type="button"
      style={{ padding: 0, margin: 0, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color, transition: 'color 120ms ease', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={() => {
        navigator.clipboard.writeText(text || '');
        onCopy?.();
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="currentColor" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function formatCreationDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ModalActionBtn({ icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ flex: 1, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: '8px', border: '1px solid #FFFFFF1F', backgroundColor: hovered ? '#FFFFFF1F' : '#FFFFFF14', cursor: 'pointer', transition: 'background-color 0.15s' }}
    >
      {icon}
      <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
    </button>
  );
}

const DETAIL_PANEL_DIVIDER = (
  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px', flexShrink: 0 }} />
);

function ImageDetailModal({ card, onClose, onDelete, onDownload, favorited, onToggleFavorite }) {
  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const [starAnim, setStarAnim] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  function handleStarClick() {
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  }

  function handleCopyPrompt() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  return (
    <>
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={onClose}>
          <div style={{ width: `${modalW}px`, height: `${modalH}px`, transform: `scale(${modalScale})`, transformOrigin: 'center center', borderRadius: '16px', border: '1px solid #FFFFFF14', backgroundColor: '#161616', boxShadow: '#00000099 -10px 24px 64px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', backgroundColor: '#161616', flexShrink: 0 }}>
              <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', fontWeight: 500, lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHovered ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }} onClick={onClose} onMouseEnter={() => setCloseHovered(true)} onMouseLeave={() => setCloseHovered(false)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke={closeHovered ? '#FFFFFF' : '#FFFFFF99'} strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
            </div>

            <div style={{ display: 'flex', height: `${modalH - 60}px` }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', position: 'relative', overflow: 'hidden' }}>
                {card.imageUrl && <img src={card.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />}
              </div>

              <div style={{ width: '280px', flexShrink: 0, backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F', display: 'flex', flexDirection: 'column', height: `${modalH - 60}px`, position: 'relative' }}>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '76px' }}>
                  {DETAIL_PANEL_DIVIDER}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 20px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>提示词</div>
                      <CopyPromptButton text={card.prompt} onCopy={handleCopyPrompt} />
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.promptHTML ? <span dangerouslySetInnerHTML={{ __html: card.promptHTML }} /> : (card.prompt || '—')}</div>
                  </div>

                  {card.refImages && card.refImages.length > 0 && (
                    <>
                      {DETAIL_PANEL_DIVIDER}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}>
                        <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>参考图</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>{card.refImages.map((img, i) => { const imgUrl = img.url || img.previewUrl || ''; return <div key={i} style={{ width: 'calc(50% - 6px)', height: '84px', borderRadius: '6px', border: '1px solid #FFFFFF14', backgroundColor: '#FFFFFF14', overflow: 'hidden', flexShrink: 0, backgroundImage: imgUrl ? `url(${imgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />; })}</div>
                      </div>
                    </>
                  )}

                  {DETAIL_PANEL_DIVIDER}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>生成参数</div>
                    {card.model && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: 'rgba(255,255,255,0.6)' }}>模型</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.model}</span></div>}
                    {card.ratio && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>画面比例</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.ratio}</span></div>}
                    {card.resolution && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分辨率</span><span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.resolution}</span></div>}
                  </div>

                  {DETAIL_PANEL_DIVIDER}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px 20px', flexShrink: 0 }}><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.66px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>AI 生成时间</div><div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.12px', color: 'rgba(255,255,255,0.8)' }}>{formatCreationDate(card.createdAt)}</div></div>
                  {DETAIL_PANEL_DIVIDER}
                </div>

                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '280px', display: 'flex', gap: '8px', padding: '16px 20px 20px', flexShrink: 0, backgroundColor: '#161616' }}>
                  <ModalActionBtn label="收藏" onClick={handleStarClick} icon={<div style={{ transform: starAnim ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex' }}><StarIcon filled={favorited} strokeColor="rgba(255,255,255,0.6)" /></div>} />
                  <ModalActionBtn label="下载" onClick={onDownload} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.003 11.3V2" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 14H12" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
                  <ModalActionBtn label="删除" onClick={() => setConfirmDelete(true)} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF99" strokeLinejoin="round" /><path d="M6.667 6.667V11" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.333 6.667V11" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.333 3.333H14.667" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF99" strokeLinejoin="round" /></svg>} />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {confirmDelete && <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这张图片吗？" confirmText="删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />}
      {toastVisible && createPortal(<div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}><div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]" style={{ whiteSpace: 'nowrap', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}><path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" /><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>您已复制提示词</span></div></div>, document.body)}
    </>
  );
}

export default function CreationImageResultCard({ status, imageUrl, originalUrl, prompt, promptHTML, model, ratio, resolution, refImages, createdAt, onReEdit, onUseAsRef, onDownload, onDelete, batchMode = false, isSelected = false, onToggleSelect, favorited = false, onToggleFavorite }) {
  // 下载和详情弹窗使用原图；缩略图仅用于卡片显示
  const [hovered, setHovered] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDone = status === 'done' && imageUrl;

  function handleStarClick(e) {
    e.stopPropagation();
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  }

  return (
    <>
      <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', backgroundColor: hovered ? '#343434' : '#272727', transition: 'background-color 0.15s', position: 'relative', cursor: isDone ? 'pointer' : 'default', outline: isSelected ? '2px solid #2DC3E1' : 'none', outlineOffset: '-2px' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => { if (batchMode && isDone) { onToggleSelect?.(); return; } if (isDone) setDetailOpen(true); }}>
        {status === 'loading' ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DotsLoading size={5} color="#2DC3E1" gap={4} /></div> : isDone ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#FFFFFF33', fontSize: '12px', fontFamily: FONT }}>生成失败</span></div>}

        {batchMode && isDone && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '18px', height: '18px', borderRadius: '4px', zIndex: 1, border: isSelected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)', backgroundColor: isSelected ? '#2DC3E1' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>}

        {hovered && isDone && !batchMode && <>
          <button type="button" onClick={handleStarClick} style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000080', border: 'none', cursor: 'pointer', transform: starAnim ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' }}><StarIcon filled={favorited} /></button>
          <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
            <CreationCardActionButton tooltip="重新编辑" onClick={() => onReEdit?.()} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.333 14H14.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.667 8.907V11.333H6.106L13 4.436L10.565 2L3.667 8.907Z" stroke="#FFFFFF" strokeLinejoin="round" /></svg>} />
            <CreationCardActionButton tooltip="用作参考图" onClick={() => onUseAsRef?.()} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12.667 7V13.333C12.667 13.702 12.368 14 12 14H2.667C2.298 14 2 13.702 2 13.333V4C2 3.632 2.298 3.333 2.667 3.333H8.788" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 10.344L6 7.667L7 8.667L8.167 6.833L10.667 10.344H4Z" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" /><path d="M11.334 3.333H14.001M12.664 1.932V4.598" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
            <CreationCardActionButton tooltip="下载" onClick={onDownload} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.003 11.3V2" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 14H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
            <CreationCardActionButton tooltip="删除" onClick={() => setConfirmDelete(true)} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF" strokeLinejoin="round" /><path d="M6.667 6.667V11M9.333 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.333 3.333H14.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF" strokeLinejoin="round" /></svg>} />
          </div>
        </>}
      </div>

      {confirmDelete && <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这张图片吗？" confirmText="删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />}
      {detailOpen && <ImageDetailModal card={{ imageUrl, originalUrl, prompt, promptHTML, model, ratio, resolution, refImages, createdAt }} onClose={() => setDetailOpen(false)} onDelete={onDelete} onDownload={onDownload} favorited={favorited} onToggleFavorite={() => onToggleFavorite?.()} />}
    </>
  );
}
