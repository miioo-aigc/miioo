/**
 * @file CreationAudioResultCard.jsx
 * @structure-index
 *
 * ─── 状态层 ─────────────────────────────────────────────────────
 *   hovered / playing / confirmDelete                            悬停、播放和删除确认状态
 *   audioRef                                                     音频播放引用
 *
 * ─── 展示层 ────────────────────────────────────────────────────
 *   CreationAudioResultCard                                      配音结果卡、波形、批量选择和媒体操作
 *   CreationCardActionButton                                    下载/删除悬浮操作及提示
 *
 * ─── 副作用 ────────────────────────────────────────────────────
 *   playing + isDone                                             播放、暂停并重置音频
 *   下载                                                         fetch/blob/浏览器回退打开
 *
 * ─── 依赖边界 ──────────────────────────────────────────────────
 *   只通过 props 接收配音数据和删除/批量选择回调；不读取 CreationPage 闭包变量
 *
 * ─── 更新记录 ──────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离配音结果卡；页面通过显式 props 注入业务回调
 *   2026-07-16  复用 utils/creationFilename.js；下载副作用仍保留在结果卡
 *   2026-08-07  配音结果卡统一使用 16:9 尺寸，并在左上角展示提示词前 10 个字
 *                 卡片尺寸由 CreationResultState 的 240px 最小列宽网格控制，宽度随结果容器适配
 *   2026-08-10  配音卡内部改为提示词顶部、播放控制底部的样式；播放结束自动恢复三角形
 *   2026-08-10  恢复播放时波形动画，悬停操作按钮与播放按钮垂直对齐
 */

import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import DotsLoading from '../DotsLoading';
import CreationCardActionButton from './CreationCardActionButton';
import { filenameFromPrompt } from '../../utils/creationFilename';
import { downloadMediaUrl } from '../../utils/downloadMediaUrl';
import { apiDownloadCreationAudio } from '../../api/creation';
import { downloadBlob } from '../../utils/downloadBlob';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const WAVEFORM_HEIGHTS = [
  14, 20, 11, 18, 24, 16, 22, 10, 19, 15,
  23, 12, 17, 21, 13, 18, 11, 20, 15, 22,
  13, 18, 10, 21, 16, 23, 12, 19, 14, 20,
  11, 22, 17, 15, 24, 13, 18, 10, 21, 16,
];

export default function CreationAudioResultCard({ status, audioUrl, audioId, prompt, onDelete, batchMode = false, isSelected = false, onToggleSelect }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const audioRef = useRef(null);

  const isDone = status === 'done' && audioUrl;

  const handleDownload = async () => {
    if (audioId) {
      try {
        const blob = await apiDownloadCreationAudio(audioId);
        downloadBlob(blob, filenameFromPrompt(prompt, 'mp3'));
        return;
      } catch {
        // 鉴权下载失败时回退到结果地址，避免已可播放的音频无法下载。
      }
    }
    await downloadMediaUrl(audioUrl, filenameFromPrompt(prompt, 'mp3'));
  };

  useEffect(() => {
    if (!audioRef.current) return;
    if (playing && isDone) {
      audioRef.current.play().catch(() => setPlaying(false));
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [playing, isDone]);

  return (
    <>
      <div
        style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', backgroundColor: hovered ? '#242424' : '#1A1A1A', transition: 'background-color 0.15s', position: 'relative', cursor: isDone ? 'pointer' : 'default', outline: isSelected ? '2px solid #2DC3E1' : 'none', outlineOffset: '-2px' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (batchMode && isDone) onToggleSelect?.();
        }}
      >
        {status === 'loading' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DotsLoading size={5} color="#2DC3E1" gap={4} />
          </div>
        ) : isDone ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', padding: '16px', boxSizing: 'border-box' }}>
            <div
              style={{ width: '100%', minHeight: 0, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, fontFamily: FONT, fontSize: '14px', lineHeight: '150%', color: '#FFFFFF99', wordBreak: 'break-word' }}
              title={prompt || ''}
            >
              {prompt || ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', paddingRight: hovered ? '56px' : 0, boxSizing: 'border-box', flexShrink: 0 }}>
              <button
                type="button"
                aria-label={playing ? '暂停播放' : '播放配音'}
                onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}
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
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="metadata"
              onEnded={() => setPlaying(false)}
              onError={() => setPlaying(false)}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#FFFFFF33', fontSize: '12px', fontFamily: FONT }}>生成失败</span>
          </div>
        )}

        {batchMode && isDone && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', width: '18px', height: '18px', borderRadius: '4px', zIndex: 1, border: isSelected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)', backgroundColor: isSelected ? '#2DC3E1' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
        )}

        {hovered && isDone && !batchMode && (
          <div style={{ position: 'absolute', bottom: '20px', right: '8px', display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
            <CreationCardActionButton
              tooltip="下载"
              onClick={handleDownload}
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.003 11.3V2" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 14H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            />
            <CreationCardActionButton
              tooltip="删除"
              onClick={() => setConfirmDelete(true)}
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF" strokeLinejoin="round" /><path d="M6.667 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.333 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.333 3.333H14.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF" strokeLinejoin="round" /></svg>}
            />
          </div>
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
