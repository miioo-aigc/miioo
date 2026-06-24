import { useState, useRef, memo } from 'react';
import { FONT } from '../utils/fonts';
import CardActionBtn from './CardActionBtn';
import ConfirmDialog from './ConfirmDialog';

function AudioResultCard({ status, audioUrl, prompt, model, createdAt, onDelete, batchMode = false, isSelected = false, onToggleSelect }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const audioRef = useRef(null);

  const isDone = status === 'done' && audioUrl;

  function togglePlay(e) {
    e.stopPropagation();
    if (!audioRef.current || !isDone) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  }

  return (
    <>
      <div
        style={{
          width: '100%', height: '44px', borderRadius: '8px', display: 'flex', alignItems: 'center',
          padding: '0 12px', boxSizing: 'border-box', gap: '10px',
          backgroundColor: hovered ? '#343434' : '#272727', transition: 'background-color 0.15s',
          outline: isSelected ? '2px solid #2DC3E1' : 'none', outlineOffset: '-2px', cursor: 'pointer',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { if (batchMode) { onToggleSelect?.(); return; } }}
      >
        {isDone ? (
          <>
            <button type="button" onClick={togglePlay}
              style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? '#FFFFFF1F' : '#FFFFFF14', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s' }}>
              {playing ? (
                <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><rect x="0.5" y="0.5" width="3" height="11" rx="1.5" fill="#FFFFFF" /><rect x="6.5" y="0.5" width="3" height="11" rx="1.5" fill="#FFFFFF" /></svg>
              ) : (
                <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M2 1L9 6L2 11V1Z" fill="#FFFFFF" stroke="#FFFFFF" strokeLinejoin="round" /></svg>
              )}
            </button>
            <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prompt || '配音片段'}</span>
              <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '12px', color: '#FFFFFF66' }}>{model || ''}</span>
            </div>
            {hovered && !batchMode && (
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <CardActionBtn tooltip="删除" onClick={() => setConfirmDelete(true)}
                  icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF" strokeLinejoin="round" /><path d="M6.667 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.333 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.333 3.333H14.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF" strokeLinejoin="round" /></svg>} />
              </div>
            )}
            {batchMode && (
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', zIndex: 1, border: isSelected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)', backgroundColor: isSelected ? '#2DC3E1' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isSelected && (<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
              </div>
            )}
          </>
        ) : status === 'loading' ? (
          <div className="creation-shimmer" style={{ width: '100%', height: '100%' }} />
        ) : (
          <span style={{ color: '#FFFFFF33', fontSize: '12px', fontFamily: FONT }}>生成失败</span>
        )}
      </div>
      {confirmDelete && (
        <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除此音频吗？" confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />
      )}
    </>
  );
}

export default memo(AudioResultCard);
