/**
 * @file CreationAudioResultCard.jsx
 * @structure-index
 *
 * ─── 状态层 ─────────────────────────────────────────────────────
 *   hovered / playing / starAnim / confirmDelete                 悬停、播放、收藏动画和删除确认状态
 *   activeAudioKey                                               共享播放器当前播放卡片
 *
 * ─── 展示层 ────────────────────────────────────────────────────
 *   CreationAudioResultCard                                      配音结果卡、波形、收藏、批量选择和媒体操作
 *   CreationCardActionButton                                    下载/删除悬浮操作及提示
 *
 * ─── 副作用 ────────────────────────────────────────────────────
 *   共享播放器                                                     卡片间单例播放和状态同步
 *
 * ─── 依赖边界 ──────────────────────────────────────────────────
 *   只通过 props 接收配音数据和下载/删除/批量选择回调；不读取 CreationPage 闭包变量
 *
 * ─── 更新记录 ──────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离配音结果卡；页面通过显式 props 注入业务回调
 *   2026-07-16  复用 utils/creationFilename.js；下载副作用仍保留在结果卡
 *   2026-08-07  配音结果卡统一使用 16:9 尺寸，并在左上角展示提示词前 10 个字
 *                 卡片尺寸由 CreationResultState 的 240px 最小列宽网格控制，宽度随结果容器适配
 *   2026-08-10  配音卡内部改为提示词顶部、播放控制底部的样式；播放结束自动恢复三角形
 *   2026-08-10  恢复播放时波形动画，悬停操作按钮与播放按钮垂直对齐
 *   2026-08-14  新增右上角悬停收藏按钮，与图片/视频卡片位置和交互统一
 *   2026-08-17  下载统一透传页面正式下载回调，结果卡不再回退短时媒体链接
 *   2026-08-20  支持资产选择模式在左上角展示复选框，并保持播放按钮独立交互
 *   2026-08-20  资产选择模式复用组件系统 Checkbox，移除卡片内手写复选框样式
 *   2026-08-21  创作历史配音台词复用提示词预览，展示停顿、语气词和情绪高亮
 *   2026-08-25  创作历史占位卡复用 LoadingAnimation，宽度 88px、高度按比例自适应
 *   2026-08-31  配音结果卡接入共享播放器，保证同时只播放一段音频
 *   2026-09-04  导出 StarIcon，供配音详情弹窗复用统一收藏图标
 */

import { useEffect, useState } from 'react';
import Checkbox from '../Checkbox';
import ConfirmDialog from '../ConfirmDialog';
import LoadingAnimation from '../LoadingAnimation';
import CreationCardActionButton from './CreationCardActionButton';
import CreationDubbingPromptPreview from './CreationDubbingPromptPreview';
import {
  getActiveVoicePreviewKey,
  stopVoicePreview,
  subscribeVoicePreview,
  toggleVoicePreview,
} from '../../utils/voicePreviewPlayer';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const WAVEFORM_HEIGHTS = [
  14, 20, 11, 18, 24, 16, 22, 10, 19, 15,
  23, 12, 17, 21, 13, 18, 11, 20, 15, 22,
  13, 18, 10, 21, 16, 23, 12, 19, 14, 20,
  11, 22, 17, 15, 24, 13, 18, 10, 21, 16,
];

export function StarIcon({ filled = false, strokeColor = '#FFFFFF' }) {
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

export default function CreationAudioResultCard({
  id = '',
  audioId = '',
  playbackKey = '',
  status,
  audioUrl,
  prompt,
  advancedEnabled = false,
  onDownload,
  onDelete,
  onCardClick,
  batchMode = false,
  isSelected = false,
  onToggleSelect,
  selectionDisabled = false,
  selectionCheckboxPosition = 'right',
  favorited = false,
  onToggleFavorite,
}) {
  const [hovered, setHovered] = useState(false);
  const [activeAudioKey, setActiveAudioKey] = useState(() => getActiveVoicePreviewKey());
  const [starAnim, setStarAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDone = status === 'done' && audioUrl;
  const audioKey = String(playbackKey || audioId || id || `${audioUrl}:${prompt || ''}`);
  const playing = activeAudioKey === audioKey;

  function handleStarClick(e) {
    e.stopPropagation();
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  }

  useEffect(() => subscribeVoicePreview(setActiveAudioKey), []);

  useEffect(() => () => stopVoicePreview(audioKey), [audioKey]);

  async function handlePlayClick(event) {
    event.stopPropagation();
    if (!isDone) return;

    try {
      await toggleVoicePreview({ key: audioKey, url: audioUrl });
    } catch {
      // 播放失败时由共享播放器清理播放状态。
    }
  }

  return (
    <>
      <div
        style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', backgroundColor: hovered ? '#242424' : '#1A1A1A', transition: 'background-color 0.15s', position: 'relative', cursor: isDone && !selectionDisabled ? 'pointer' : 'default', outline: isSelected ? '2px solid #2DC3E1' : 'none', outlineOffset: '-2px', opacity: selectionDisabled ? 0.6 : 1 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (batchMode && isDone && !selectionDisabled) onToggleSelect?.();
          if (!batchMode && isDone) onCardClick?.();
        }}
      >
        {status === 'loading' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingAnimation width={88} />
          </div>
        ) : isDone ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', padding: batchMode && selectionCheckboxPosition === 'left' ? '36px 16px 16px' : '16px', boxSizing: 'border-box' }}>
            <CreationDubbingPromptPreview
              prompt={prompt}
              advancedEnabled={advancedEnabled}
              title={prompt || ''}
              style={{ width: '100%', minHeight: 0, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, fontSize: '14px', lineHeight: '150%', color: '#FFFFFF99' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', paddingRight: hovered ? '56px' : 0, boxSizing: 'border-box', flexShrink: 0 }}>
              <button
                type="button"
                aria-label={playing ? '暂停播放' : '播放配音'}
                onClick={handlePlayClick}
                style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#2DC3E1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}
              >
                {playing ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="6" y="4" width="3" height="12" rx="1" fill="#FFFFFF" /><rect x="11" y="4" width="3" height="12" rx="1" fill="#FFFFFF" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 4L16 10L7 16V4Z" fill="#FFFFFF" /></svg>
                )}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '2px', height: '24px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                {WAVEFORM_HEIGHTS.map((height, i) => (
                  <div
                    key={i}
                    style={{
                      width: '3px',
                      flexShrink: 0,
                      borderRadius: '2px',
                      backgroundColor: '#2DC3E180',
                      opacity: 0.4,
                      height: `${height}px`,
                      transformOrigin: 'center',
                      animationName: playing ? 'creation-audio-waveform' : 'none',
                      animationDuration: '0.8s',
                      animationTimingFunction: 'ease-in-out',
                      animationIterationCount: 'infinite',
                      animationDelay: playing ? `${(i % 6) * 0.08}s` : '0s',
                      transition: 'opacity 0.2s',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#FFFFFF33', fontSize: '12px', fontFamily: FONT }}>生成失败</span>
          </div>
        )}

        {batchMode && isDone && (
          <div style={{ position: 'absolute', top: '8px', [selectionCheckboxPosition === 'left' ? 'left' : 'right']: '8px', zIndex: 1 }}>
            <Checkbox checked={isSelected} hovered={hovered} disabled={selectionDisabled} />
          </div>
        )}

        {isDone && !batchMode && (hovered || favorited) && (
          <button
            type="button"
            onClick={handleStarClick}
            aria-label={favorited ? '取消收藏' : '收藏配音'}
            style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000080', border: 'none', cursor: 'pointer', transform: starAnim ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 1 }}
          >
            <StarIcon filled={favorited} />
          </button>
        )}

        {hovered && isDone && !batchMode && (
          <>
            <div style={{ position: 'absolute', bottom: '20px', right: '8px', display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
              <CreationCardActionButton
                tooltip="下载"
                onClick={onDownload}
                icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.003 11.3V2" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 14H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              />
              <CreationCardActionButton
                tooltip="删除"
                onClick={() => setConfirmDelete(true)}
                icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF" strokeLinejoin="round" /><path d="M6.667 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.333 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.333 3.333H14.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF" strokeLinejoin="round" /></svg>}
              />
            </div>
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="确认删除"
          description="删除后无法恢复，确定要删除这段配音吗？"
          confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
          onCancel={() => setConfirmDelete(false)}
          zIndex={1100}
        />
      )}
    </>
  );
}
