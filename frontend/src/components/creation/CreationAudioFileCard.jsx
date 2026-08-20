import { useEffect, useMemo, useRef, useState } from 'react';
import { formatFileSize, truncateFileName } from './CreationFileUtils';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function CreationAudioFileCard({ file, onRemove, disabled = false, onInsert }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const generatedAudioUrl = useMemo(() => {
    if (file?.url || file?.previewUrl || file?._objectUrl || !(file instanceof File)) return null;
    return URL.createObjectURL(file);
  }, [file]);
  const audioUrl = file?.url || file?.previewUrl || file?._objectUrl || generatedAudioUrl;

  useEffect(() => () => {
    if (generatedAudioUrl) URL.revokeObjectURL(generatedAudioUrl);
  }, [generatedAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing && audioUrl) {
      audio.play().catch(() => setPlaying(false));
      return;
    }
    audio.pause();
  }, [audioUrl, playing]);

  const handlePlay = (event) => {
    event.stopPropagation();
    if (!disabled && audioUrl) setPlaying((current) => !current);
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: '6px 8px', borderRadius: '8px', width: '100px', height: '100px', justifyContent: 'space-between', flexShrink: 0, position: 'relative', boxSizing: 'border-box', background: '#1D1E1E', border: `1px solid ${hovered ? '#FFFFFF33' : '#FFFFFF14'}`, transition: 'border-color 0.15s', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!disabled) onInsert?.(); }}
    >
      <div style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '150%', alignSelf: 'stretch', flex: 1, overflow: 'hidden', color: '#FFFFFF', wordBreak: 'break-all' }}>
        {truncateFileName(file?.name || '音频文件')}
      </div>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT, fontSize: '12px', lineHeight: '18px', color: '#FFFFFF66' }}>
          {file?.isAsset ? '资产库' : formatFileSize(file?.size)}
        </span>
        <button
          type="button"
          aria-label={playing ? '暂停播放' : '播放音频'}
          disabled={disabled || !audioUrl}
          onClick={handlePlay}
          style={{ width: '24px', height: '24px', borderRadius: '50%', border: 'none', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', background: '#2DC3E1', cursor: disabled || !audioUrl ? 'not-allowed' : 'pointer', opacity: audioUrl ? 1 : 0.45 }}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="4" y="3" width="2" height="8" rx="0.5" fill="currentColor" /><rect x="8" y="3" width="2" height="8" rx="0.5" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 3.5L10.5 7L5 10.5V3.5Z" fill="currentColor" /></svg>
          )}
        </button>
      </div>
      {hovered && !disabled && (
        <button type="button" aria-label="移除音频" onClick={(event) => { event.stopPropagation(); setPlaying(false); onRemove?.(); }} style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', top: '-5px', right: '-5px', width: '16px', height: '16px', borderRadius: '9999px', background: '#505151', border: 'none', cursor: 'pointer', padding: 0, zIndex: 1 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" onEnded={() => setPlaying(false)} onError={() => setPlaying(false)} style={{ display: 'none' }} />
    </div>
  );
}
