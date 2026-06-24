import { useState, useRef } from "react";
import { FONT, FONT_MEDIUM } from "../../utils/fonts";
import DotsLoading from '../../components/DotsLoading';
import HeadphoneIcon from '../../components/HeadphoneIcon';
import MoreMenu from './MoreMenu';
import PlayingWaveIcon from '../../components/PlayingWaveIcon';

export default 
function CharCard({ name, desc, imageUrl, voice, voiceName, voicePreviewUrl, onVoiceClick, onClick, onDownloadImage, onDeleteSubject, cardPlaceholder, loading = false, selected = false }) {
  const [hovered, setHovered] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const voiceAudioRef = useRef(null);

  const handleVoicePlay = (e) => {
    e.stopPropagation();
    if (voicePlaying) {
      voiceAudioRef.current?.pause();
      voiceAudioRef.current = null;
      setVoicePlaying(false);
      return;
    }
    if (voicePreviewUrl) {
      const audio = new Audio(voicePreviewUrl);
      voiceAudioRef.current = audio;
      audio.play().catch(() => setVoicePlaying(false));
      audio.onended = () => { voiceAudioRef.current = null; setVoicePlaying(false); };
      audio.onerror = () => { voiceAudioRef.current = null; setVoicePlaying(false); };
      setVoicePlaying(true);
    } else {
      setVoicePlaying(true);
      setTimeout(() => setVoicePlaying(false), 1500);
    }
  };

  return (
    <div
      className="[font-synthesis:none] flex flex-col rounded-xl overflow-clip relative bg-[#1A1A1A] antialiased cursor-pointer"
      style={{
        aspectRatio: '200/246',
        outline: selected
          ? '1px solid rgba(45,195,225,0.6)'
          : hovered
          ? '1px solid rgba(255,255,255,0.15)'
          : '1px solid rgba(255,255,255,0.08)',
        transition: 'outline-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* image area */}
      <div
        className="flex-1 self-stretch relative"
        style={{
          minHeight: '148px',
          backgroundImage: `url(${imageUrl || cardPlaceholder})`,
          backgroundSize: 'cover',
          backgroundPosition: '50%',
        }}
      >
        {/* 加载遮罩 */}
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', paddingBottom: '10%' }}
          >
            <DotsLoading size={6} color="#2DC3E1" gap={4} />
          </div>
        )}

        {/* 右上角操作 — 加载中隐藏 */}
        <div
          className="absolute flex gap-[4px]"
          style={{ top: '8px', right: '8px', opacity: hovered && !loading ? 1 : 0, transition: 'opacity 0.15s' }}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreMenu onDownload={() => onDownloadImage?.()} onDelete={() => onDeleteSubject?.()} />
        </div>
      </div>

      {/* info overlay */}
      <div
        className="flex flex-col gap-1.5 absolute -inset-x-px -bottom-px bg-[#161616F2] p-3"
      >
        <div
          className="inline-block font-medium text-[#FFFFFFE6] text-sm/5"
          style={{ fontFamily: FONT_MEDIUM }}
        >
          {name}
        </div>
        <div
          className="text-[#FFFFFF66] line-clamp-2"
          style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '17px' }}
        >
          {desc}
        </div>
        {/* 音色行 — 仅角色 */}
        {onVoiceClick !== undefined && (
          <div
            className="flex items-center justify-between"
            style={{ gap: '6px' }}
            onClick={(e) => { e.stopPropagation(); onVoiceClick?.(); }}
          >
            <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '17px', color: '#FFFFFFCC', flexShrink: 0 }}>
              选择音色：
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onVoiceClick?.(); }}
                style={{
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                  maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: FONT, fontSize: '12px', lineHeight: '17px',
                  color: voice ? '#2DC3E1' : '#FFFFFFCC',
                }}
              >
                {voiceName || voice || '未选择'}
              </button>
              <button
                type="button"
                title={!voice ? '请先选择音色' : '试听'}
                disabled={!voice}
                onClick={handleVoicePlay}
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: voice ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                {voicePlaying
                  ? <PlayingWaveIcon color="#2DC3E1" size={16} />
                  : <HeadphoneIcon color={voice ? '#2DC3E1' : '#FFFFFF66'} />
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
