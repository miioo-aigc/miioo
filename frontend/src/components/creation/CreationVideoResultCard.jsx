/**
 * @file CreationVideoResultCard.jsx
 * @structure-index
 *
 * ─── 状态层 ─────────────────────────────────────────────────────
 *   hovered / starAnim / confirmDelete                         卡片悬停、收藏动画和删除确认状态
 *   videoRef                                                    悬停播放的视频引用
 *
 * ─── 展示层 ────────────────────────────────────────────────────
 *   视频预览、加载/失败状态和批量选择标记
 *   收藏、重新编辑、尾帧转首帧、下载和删除操作
 *
 * ─── 副作用 ────────────────────────────────────────────────────
 *   hovered + isDone                                            悬停播放/离开重置视频
 *   下载                                                        fetch/blob/浏览器回退打开
 *
 * ─── 更新记录 ──────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离视频结果卡片；页面通过显式 props 注入业务回调
 *   2026-07-16  复用 utils/creationFilename.js；下载副作用仍保留在结果卡
 */

import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import DotsLoading from '../DotsLoading';
import CreationCardActionButton from './CreationCardActionButton';
import { filenameFromPrompt } from '../../utils/creationFilename';
import { downloadMediaUrl } from '../../utils/downloadMediaUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

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

export default function CreationVideoResultCard({ status, videoUrl, prompt, onReEdit, onUseAsFirstFrame, onDelete, onCardClick, batchMode = false, isSelected = false, onToggleSelect, favorited = false, onToggleFavorite }) {

  const [hovered, setHovered] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const videoRef = useRef(null);
  

  const isDone = status === 'done' && videoUrl;

  // 悬停时自动播放视频
  useEffect(() => {
    if (!videoRef.current) return;
    if (hovered && isDone) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [hovered, isDone]);

  function handleStarClick(e) {
    e.stopPropagation();
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  }

  return (
    <>
      <div
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: hovered ? '#343434' : '#272727',
          transition: 'background-color 0.15s',
          position: 'relative',
          cursor: isDone ? 'pointer' : 'default',
          outline: isSelected ? '2px solid #2DC3E1' : 'none',
          outlineOffset: '-2px',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (batchMode && isDone) { onToggleSelect?.(); return; }
          if (!batchMode && isDone) { onCardClick?.(); }
        }}
      >
        {status === 'loading' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DotsLoading size={5} color="#2DC3E1" gap={4} />
          </div>
        ) : isDone ? (
          <video
            ref={videoRef}
            src={videoUrl}
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#FFFFFF33', fontSize: '12px', fontFamily: FONT }}>生成失败</span>
          </div>
        )}

        {/* Batch mode: checkbox overlay */}
        {batchMode && isDone && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '18px', height: '18px', borderRadius: '4px', zIndex: 1,
            border: isSelected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)',
            backgroundColor: isSelected ? '#2DC3E1' : 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {isSelected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        )}

        {/* Hover overlays */}
        {hovered && isDone && !batchMode && (
          <>
            {/* Top-right: favorite */}
            <button
              type="button"
              onClick={handleStarClick}
              style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '24px', height: '24px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#00000080', border: 'none', cursor: 'pointer',
                transform: starAnim ? 'scale(1.4)' : 'scale(1)',
                transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <StarIcon filled={favorited} />
            </button>

            {/* Bottom-right: action buttons */}
            <div
              style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <CreationCardActionButton
                tooltip="重新编辑"
                onClick={() => onReEdit?.()}
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2.333 14H14.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3.667 8.907V11.333H6.106L13 4.436L10.565 2L3.667 8.907Z" stroke="#FFFFFF" strokeLinejoin="round" />
                  </svg>
                }
              />
             <CreationCardActionButton
               tooltip="尾帧用作首帧参考"
               onClick={() => onUseAsFirstFrame?.()}
               icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', overflow: 'visible' }}>
                    <path d="M9.446 1.733C9.888 1.733 10.246 2.092 10.246 2.533V21.855C10.246 22.297 9.888 22.655 9.447 22.655C9.005 22.655 8.646 22.297 8.646 21.855V2.533C8.646 2.092 9.005 1.733 9.447 1.733H9.446Z" fill="#FFFFFF" />
                    <path d="M9.194 3.483V5.083H4.706C4.411 5.083 4.172 5.322 4.172 5.617V18.946C4.172 19.241 4.411 19.479 4.706 19.479H9.194V21.079H4.706C3.527 21.079 2.572 20.124 2.572 18.946V5.617C2.572 4.438 3.527 3.483 4.706 3.483H9.194Z" fill="#FFFFFF" />
                    <path d="M14.957 3.483V5.083H19.446C19.74 5.083 19.979 5.322 19.979 5.617V18.946C19.979 19.241 19.74 19.479 19.446 19.479H14.957V21.079H19.446C20.624 21.079 21.579 20.124 21.579 18.946V5.617C21.579 4.438 20.624 3.483 19.446 3.483H14.957Z" fill="#FFFFFF66" />
                    <path d="M20.339 8.787H14.707V7.187H20.339V8.787ZM20.339 17.402H14.707V15.802H20.339V17.402Z" fill="#FFFFFF66" />
                    <path d="M 3 9.1 L 8.632 9.1 L 8.632 7.5 L 3 7.5 L 3 9.1 Z M 3 17.715 L 8.632 17.715 L 8.632 16.115 L 3 16.115 L 3 17.715 Z" fill="#FFFFFF" />
                    <path d="M 14.3 22.422 C 14.742 22.422 15.1 22.064 15.1 21.622 L 15.1 2.3 C 15.1 1.859 14.742 1.5 14.3 1.5 C 13.858 1.5 13.5 1.859 13.5 2.3 L 13.5 21.622 C 13.5 22.064 13.858 22.422 14.3 22.422 Z" fill="#FFFFFF66" />
                  </svg>
               }
             />
              <CreationCardActionButton
                tooltip="下载"
                onClick={() => downloadMediaUrl(videoUrl, filenameFromPrompt(prompt, 'mp4'))}
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8.003 11.3V2" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 14H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              />
              <CreationCardActionButton
                tooltip="删除"
                onClick={() => setConfirmDelete(true)}
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF" strokeLinejoin="round" />
                    <path d="M6.667 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.333 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M1.333 3.333H14.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
                  </svg>
                }
              />
            </div>
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="确认删除"
          description="删除后无法恢复，确定要删除这张图片吗？"
          confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
          onCancel={() => setConfirmDelete(false)}
          zIndex={1100}
        />
      )}
    </>
  );
}
