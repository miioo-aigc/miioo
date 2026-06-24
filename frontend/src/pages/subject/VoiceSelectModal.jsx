 import { useState, useRef, useMemo, useEffect } from "react";
 import { apiGetVoiceLibrary } from '../../api/voices';
import { FONT, FONT_MEDIUM } from "../../utils/fonts";
const GENDER_OPTIONS = ['不限', '男', '女'];
const AGE_OPTIONS = ['不限', '幼年', '青年', '中年', '老年'];
import DotsLoading from '../../components/DotsLoading';
import SelectField from './SelectField';
import VoiceCard from './VoiceCard';

export default 
function VoiceSelectModal({ open, onClose, onConfirm, currentVoice, onVoicesLoaded, preloadedVoices }) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(currentVoice || '');
  const [gender, setGender] = useState('不限');
  const [age, setAge] = useState('不限');

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!open) { fetchedRef.current = false; return; }
    if (fetchedRef.current && voices.length > 0) return;
    setLoading(true);
    apiGetVoiceLibrary({ provider: 'miioo', skipCache: true })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.voices ?? [];
        setVoices(list);
        onVoicesLoaded?.(list);
        fetchedRef.current = true;
      })
      .catch(() => setVoices([]))
      .finally(() => setLoading(false));
  }, [open]);


  const filteredVoices = useMemo(() => {
    return voices.filter((v) => {
      if (gender !== '不限' && v.gender !== gender) return false;
      if (age !== '不限' && v.age_group !== age) return false;
      if (v.language !== '中文' && v.language !== 'zh') return false;
      return true;
    });
  }, [voices, gender, age]);

  if (!open) return null;

  const rows = [];
  for (let i = 0; i < filteredVoices.length; i += 4) {
    rows.push(filteredVoices.slice(i, i + 4));
  }

  const handleConfirm = () => {
    onConfirm?.(selected);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '800px', height: '600px', background: '#161616',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#161616', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', flex: 1 }}>
            选择音色
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* filters — 性别/年龄/情感 一行 */}
        <div style={{ display: 'flex', gap: '16px', padding: '8px 24px', background: '#161616', flexShrink: 0 }}>
          <SelectField label="性别" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
          <SelectField label="年龄" value={age} options={AGE_OPTIONS} onChange={setAge} />
        </div>

        {/* voice grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px 16px', background: '#161616', flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <DotsLoading size={6} color="#2DC3E1" gap={4} />
            </div>
          )}
          {!loading && filteredVoices.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF66' }}>暂无匹配音色</span>
            </div>
          )}
          {!loading && rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: '14px' }}>
              {row.map((v) => (
                <VoiceCard key={v.voice_id} label={v.name} active={selected === v.voice_id} onClick={() => setSelected(v.voice_id)} previewUrl={v.preview_url} />
              ))}
            </div>
          ))}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px', background: '#161616', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '36px', borderRadius: '8px', padding: '0 16px',
              background: '#161616', border: '1px solid #FFFFFF0D',
              boxShadow: '#00000066 3px 3px 8px', outline: '1px solid #00000080',
              cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99',
            }}
          >
            取消
          </button>
          <div
            style={{
              height: '36px', borderRadius: '8px', padding: '1px',
              backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
              boxShadow: '#00000066 3px 3px 8px', outline: '1px solid #00000080',
              cursor: 'pointer', display: 'flex',
            }}
            onClick={handleConfirm}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, borderRadius: '7px', padding: '0 15px', background: '#161616' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>确认</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
