/**
 * @file CreationImageResultCard.jsx
 * @structure-index
 *
 * ─── 状态层 ─────────────────────────────────────────────────────
 *   hovered / detailOpen / starAnim / confirmDelete              卡片悬停、详情、收藏和删除确认状态
 *
 * ─── 展示层 ────────────────────────────────────────────────────
 *   CreationImageResultCard                                      图片结果卡片、批量选择和媒体操作
 *   ImageDetailModal                                             共享图片详情弹窗
 *
 * ─── 依赖边界 ──────────────────────────────────────────────────
 *   只通过 props 接收图片数据和业务回调；不读取 CreationPage 闭包变量
 *   图片下载通过 onDownload 回调回到页面；详情弹窗由共享组件负责
 *
 * ─── 更新记录 ──────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离图片结果卡片及图片详情弹窗；页面通过显式 props 注入业务回调
 *   2026-08-17  下载统一透传页面正式下载回调，详情弹窗不再请求短时媒体链接
 *   2026-08-18  详情参考图改用固定加载槽，加载或失败均不影响字段显示
 *   2026-08-25  创作历史占位卡复用 LoadingAnimation，宽度 88px、高度按比例自适应
 *   2026-09-04  图片详情统一复用共享 ImageDetailModal
 *   2026-09-08  显式透传多机位创作回调，结果仍由来源列表管理
 */

import { useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import LoadingAnimation from '../LoadingAnimation';
import CreationCardActionButton from './CreationCardActionButton';
import ImageDetailModal from '../ImageDetailModal';
import { DeleteIcon, FavoriteIcon } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function CreationImageResultCard({ status, imageUrl, originalUrl, prompt, promptHTML, model, ratio, resolution, refImages, createdAt, onReEdit, onUseAsRef, onDownload, onDelete, batchMode = false, isSelected = false, onToggleSelect, favorited = false, onToggleFavorite, onGenerateImage }) {
  const [hovered, setHovered] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDone = status === 'done' && imageUrl;

  function handleStarClick(event) {
    event.stopPropagation();
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  }

  return (
    <>
      <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', backgroundColor: hovered ? '#343434' : '#272727', transition: 'background-color 0.15s', position: 'relative', cursor: isDone ? 'pointer' : 'default', outline: isSelected ? '2px solid #2DC3E1' : 'none', outlineOffset: '-2px' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => { if (batchMode && isDone) { onToggleSelect?.(); return; } if (isDone) setDetailOpen(true); }}>
        {status === 'loading' ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingAnimation width={88} /></div> : isDone ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#FFFFFF33', fontSize: '12px', fontFamily: FONT }}>生成失败</span></div>}

        {batchMode && isDone && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '18px', height: '18px', borderRadius: '4px', zIndex: 1, border: isSelected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)', backgroundColor: isSelected ? '#2DC3E1' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>}

        {hovered && isDone && !batchMode && <>
          <button type="button" aria-label="收藏" onClick={handleStarClick} style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000080', border: 'none', cursor: 'pointer', transform: starAnim ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' }}><FavoriteIcon filled={favorited} /></button>
          <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px' }} onClick={(event) => event.stopPropagation()}>
            <CreationCardActionButton tooltip="重新编辑" onClick={() => onReEdit?.()} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.333 14H14.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.667 8.907V11.333H6.106L13 4.436L10.565 2L3.667 8.907Z" stroke="#FFFFFF" strokeLinejoin="round" /></svg>} />
            <CreationCardActionButton tooltip="用作参考图" onClick={() => onUseAsRef?.()} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12.667 7V13.333C12.667 13.702 12.368 14 12 14H2.667C2.298 14 2 13.702 2 13.333V4C2 3.632 2.298 3.333 2.667 3.333H8.788" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 10.344L6 7.667L7 8.667L8.167 6.833L10.667 10.344H4Z" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" /><path d="M11.334 3.333H14.001M12.664 1.932V4.598" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
            <CreationCardActionButton tooltip="下载" onClick={onDownload} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.003 11.3V2" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 14H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
            <CreationCardActionButton tooltip="删除" onClick={() => setConfirmDelete(true)} icon={<DeleteIcon size={16} color="#FFFFFF" />} />
          </div>
        </>}
      </div>

      {confirmDelete && <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这张图片吗？" confirmText="删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />}
      {detailOpen && <ImageDetailModal card={{ imageUrl, originalUrl, prompt, promptHTML, model, ratio, resolution, refImages, createdAt }} onGenerateImage={onGenerateImage} onClose={() => setDetailOpen(false)} onDelete={onDelete} onDownload={onDownload} favorited={favorited} onToggleFavorite={() => onToggleFavorite?.()} />}
    </>
  );
}
