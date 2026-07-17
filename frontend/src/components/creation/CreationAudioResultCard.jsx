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
 */

import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import DotsLoading from '../DotsLoading';
import CreationCardActionButton from './CreationCardActionButton';
import { filenameFromPrompt } from '../../utils/creationFilename';
import { downloadMediaUrl } from '../../utils/downloadMediaUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const WAVEFORM_HEIGHTS = [14, 20, 11, 18, 24, 16, 22, 10, 19, 15, 23, 12, 17, 21, 13, 18, 11, 20, 15, 22];

export default function CreationAudioResultCard({ status, audioUrl, prompt, onDelete, batchMode = false, isSelected = false, onToggleSelect }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const audioRef = useRef(null);

  const isDone = status === 'done' && audioUrl;

  useEffect(() => {
    if (!audioRef.current) return;
    if (playing && isDone) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [playing, isDone]);

  return (
    <>
      <div
        style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1A1A1A', position: 'relative', cursor: isDone ? 'pointer' : 'default', outline: isSelected ? '2px solid #2DC3E1' : 'none', outlineOffset: '-2px' }}
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
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}
              style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', backgroundColor: '#2DC3E1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s', transform: hovered ? 'scale(1.1)' : 'scale(1)' }}
            >
              {playing ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="6" y="4" width="3" height="12" rx="1" fill="#FFFFFF" /><rect x="11" y="4" width="3" height="12" rx="1" fill="#FFFFFF" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 4L16 10L7 16V4Z" fill="#FFFFFF" /></svg>
              )}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '24px' }}>
              {WAVEFORM_HEIGHTS.map((height, i) => (
                <div key={i} style={{ width: '3px', borderRadius: '2px', backgroundColor: '#2DC3E1', opacity: playing ? 0.8 : 0.4, height: `${height}px`, transition: 'height 0.2s' }} />
              ))}
            </div>
            <audio ref={audioRef} src={audioUrl} preload="metadata" style={{ display: 'none' }} />
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
          <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
            <CreationCardActionButton
              tooltip="下载"
              onClick={() => downloadMediaUrl(audioUrl, filenameFromPrompt(prompt, 'mp3'))}
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
