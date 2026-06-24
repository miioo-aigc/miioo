import { useState, useRef, useEffect } from 'react';
import HeadphoneIcon from '../../components/HeadphoneIcon';
import PlayingWaveIcon from '../../components/PlayingWaveIcon';
import { FONT } from '../../utils/fonts';

export default function VoiceCard({ label, active, onClick, previewUrl }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlay = (e) => {
    e.stopPropagation();
    if (!previewUrl) return;
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
    } else {
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      audio.play().catch(() => setPlaying(false));
      audio.onended = () => { audioRef.current = null; setPlaying(false); };
      audio.onerror = () => { audioRef.current = null; setPlaying(false); };
      setPlaying(true);
    }
  };
  return (
    <div
      onClick={onClick}
      style={{
        flex: '0 0 23.4%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '6px', borderRadius: '8px', padding: '8px', cursor: 'pointer',
        background: '#1D1E1E',
        border: `1px solid ${active ? '#2DC3E1' : '#FFFFFF14'}`,
        transition: 'border-color 0.12s',
      }}
    >
      <button
        type="button"
        onClick={handlePlay}
        disabled={!previewUrl}
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: previewUrl ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: previewUrl ? 1 : 0.3 }}
      >
        {playing
          ? <PlayingWaveIcon color="#2DC3E1" size={16} />
          : <HeadphoneIcon color={previewUrl ? '#2DC3E1' : '#FFFFFF99'} />
        }
      </button>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '17px', color: active ? '#2DC3E1' : '#FFFFFF99', textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}
