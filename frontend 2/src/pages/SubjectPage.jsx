import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import DotsLoading from '../components/DotsLoading';
import BatchGenerateModal from '../components/BatchGenerateModal';
import AssetPickerModal from '../components/AssetPickerModal';
import { apiCreateSubject, apiUpdateSubject, apiDeleteSubject, apiGenerateSubjectImage, apiGetSubjects, apiBatchGenerateStream, apiGetSubjectDetail, apiGetSubjectImages, apiBindSubjectReferenceImages, apiUploadSubjectReferenceImage, apiDownloadSubjectImage, apiSetPrimarySubjectImage } from '../api/subject';
// 模型能力直接从后端 capabilities 获取
import { apiGetProjects } from '../api/project';
import { apiGetAssets } from '../api/assets';
import { apiListModels } from '../api/config';
import { apiGetVoices, apiGetVoiceLibrary } from '../api/voices';
import placeholderImg from '../assets/placeholder-img.webp';
import scenePlaceholderImg from '../assets/Mountain landscape.avif';
import propPlaceholderImg from '../assets/Tool box silhouette.avif';
import { normalizeImageUrl } from '../utils/imageUrl';
import { subscribe } from '../utils/cache';
import { K } from '../utils/cacheKeys';
import ConfirmDialog from '../components/ConfirmDialog';
import Checkbox from '../components/Checkbox';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// ── 工具：触发浏览器下载 Blob ──────────────────────────────────────────
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Ghost button (添加角色 / 批量生成角色) ─────────────────────────────────

function GhostButton({ icon, label, fontSize = 14, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex flex-col shrink-0 rounded-[8px] cursor-pointer"
      style={{
        height: '36px',
        padding: '1px',
        backgroundImage: hovered
          ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)'
          : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
        boxShadow: '#00000066 3px 3px 8px',
        outline: '1px solid #00000080',
        transition: 'background-image 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div
        className="flex items-center flex-1 self-stretch rounded-[7px] gap-[4px] px-[15px]"
        style={{ backgroundColor: hovered ? '#1C1C1C' : '#161616' }}
      >
        {icon}
        <span
          className="inline-block w-max shrink-0 text-white"
          style={{ fontFamily: FONT, fontSize: `${fontSize}px`, lineHeight: '18px' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Primary button (开始智能分镜) ──────────────────────────────────────────

function PrimaryButton({ icon, label, onClick, disabled = false, loading = false }) {
  const dimmed = disabled || loading;
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const interactive = !dimmed;

  const getOpacity = () => {
    if (dimmed) return 0.45;
    if (pressed) return 0.75;
    if (hovered) return 0.88;
    return 1;
  };

  return (
    <div
      className="flex items-center shrink-0 rounded-[8px] gap-[4px] px-[16px] border border-solid border-[#FFFFFF33] bg-origin-border [outline:1px_solid_#00000080]"
      style={{
        height: '36px',
        backgroundColor: '#2DC3E1',
        backgroundImage: 'linear-gradient(in oklab 107.51deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
        opacity: getOpacity(),
        transform: dimmed ? 'none' : pressed ? 'scale(0.97)' : 'scale(1)',
        cursor: interactive ? 'pointer' : 'not-allowed',
        transition: 'opacity 0.15s, transform 0.1s',
      }}
      onMouseEnter={() => { if (interactive) setHovered(true); }}
      onMouseLeave={() => { if (interactive) { setHovered(false); setPressed(false); } }}
      onMouseDown={() => { if (interactive) setPressed(true); }}
      onMouseUp={() => { if (interactive) setPressed(false); }}
      onClick={interactive ? onClick : undefined}
    >
      {loading ? <DotsLoading size={3} color="#090909" gap={3} /> : icon}
      <span
        className="inline-block w-max shrink-0 font-medium"
        style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '18px', color: '#090909' }}
      >
        {loading ? '生成中…' : label}
      </span>
    </div>
  );
}

// ── Confirm storyboard modal (二次确认弹窗) ────────────────────────────────

function ConfirmStoryboardModal({ onConfirm, onCancel }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '360px', background: '#161616', borderRadius: '16px',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px',
          boxShadow: '#00000099 0px 8px 32px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
              确定要重新生成分镜吗？
            </span>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)' }}>
              本次智能分镜会覆盖之前的分镜内容，一旦生成不可撤销，请谨慎操作！
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: 0, flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '36px', flexShrink: 0, borderRadius: '8px',
              paddingLeft: '16px', paddingRight: '16px',
              boxShadow: '#00000066 3px 3px 8px',
              backgroundColor: '#161616', border: '1px solid #FFFFFF14',
              outline: '1px solid #00000080', cursor: 'pointer',
              fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '36px', flexShrink: 0, borderRadius: '8px',
              paddingLeft: '16px', paddingRight: '16px',
              backgroundColor: '#E87B35', border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '18px',
              color: '#FFFFFF', fontWeight: 500,
            }}
          >
            确认重新生成
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Toolbar({ projectName, onBack, onAddChar, onBatchGen, onStartStoryboard, addLabel = '添加角色', tabLabel = '角色' }) {
  const [arrowHovered, setArrowHovered] = useState(false);
  return (
    <div className="flex items-center justify-between self-stretch shrink-0">
      {/* breadcrumb */}
      <div className="flex items-center gap-[6px]">
        <svg
          width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, cursor: 'pointer', opacity: arrowHovered ? 1 : 0.7, transition: 'opacity 0.15s' }}
          onMouseEnter={() => setArrowHovered(true)}
          onMouseLeave={() => setArrowHovered(false)}
          onClick={onBack}
        >
          <path d="M15 5L9 12L15 19" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '22px', color: '#FFFFFF', fontWeight: 500 }}>
          {projectName}
        </span>
      </div>

      {/* actions */}
      <div className="flex items-center gap-[8px]">
        <GhostButton
          label={addLabel}
          onClick={onAddChar}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 3v10M3 8h10" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
        <GhostButton
          label={`批量生成${tabLabel}`}
          fontSize={13}
          onClick={onBatchGen}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <rect x="2" y="3" width="4" height="5" rx="1" stroke="#FFFFFF" strokeWidth="1.2" />
              <rect x="8" y="3" width="4" height="5" rx="1" stroke="#FFFFFF" strokeWidth="1.2" />
              <path d="M2 10.5H12" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          }
        />
        <PrimaryButton
          label="开始智能分镜"
          onClick={onStartStoryboard}
          disabled={false}
          loading={false}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#090909" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#090909" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#090909" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#090909" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11.333 8C11.333 6.159 9.841 4.667 8 4.667C6.159 4.667 4.667 6.159 4.667 8C4.667 9.841 6.159 11.333 8 11.333C9.841 11.333 11.333 9.841 11.333 8Z" stroke="#090909" strokeWidth="1.3" />
              <path d="M8 9C7.448 9 7 8.552 7 8C7 7.448 7.448 7 8 7C8.552 7 9 7.448 9 8C9 8.552 8.552 9 8 9Z" fill="#090909" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

// ── Tab nav ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'char', label: '角色' },
  { key: 'scene', label: '场景' },
  { key: 'prop', label: '道具' },
];

function TabNav({ activeTab, counts, onChange }) {
  return (
    <div className="flex items-center self-stretch shrink-0" style={{ marginTop: '16px', marginBottom: '4px' }}>
      <div className="flex items-start gap-[24px]">
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <div
              key={key}
              className="flex flex-col items-center gap-[4px] cursor-pointer"
              onClick={() => onChange(key)}
            >
              <div className="flex items-center gap-[4px]">
                <span
                  style={{
                    fontFamily: isActive ? FONT_MEDIUM : FONT,
                    fontWeight: isActive ? 500 : 400,
                    fontSize: '14px',
                    lineHeight: '18px',
                    color: isActive ? '#FFFFFF' : '#FFFFFF99',
                    width: 'fit-content',
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    minWidth: '18px',
                    width: '16px',
                    height: '16px',
                    borderRadius: 'calc(infinity * 1px)',
                    paddingInline: '5px',
                    backgroundColor: isActive ? '#2DC3E1' : '#FFFFFF1A',
                  }}
                >
                  <span
                    style={{
                      fontFamily: isActive ? 'AlibabaPuHuiTi_2_65_Medium, "Alibaba PuHuiTi 2.0", system-ui, sans-serif' : 'AlibabaPuHuiTi_2_55_Regular, "Alibaba PuHuiTi 2.0", system-ui, sans-serif',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: '12px',
                      lineHeight: '100%',
                      color: isActive ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.6)',
                    }}
                  >
                    {counts[key] ?? 0}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Voice select modal ─────────────────────────────────────────────────────

const GENDER_OPTIONS = ['不限', '男', '女'];
const AGE_OPTIONS = ['不限', '幼年', '青年', '中年', '老年'];

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
  </svg>
);

const HeadphoneIcon = ({ color = '#2DC3E1' }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M3.333 12V8C3.333 5.423 5.423 3.333 8 3.333C10.577 3.333 12.667 5.423 12.667 8V12M3.333 8.667H2C1.632 8.667 1.333 8.965 1.333 9.333V12C1.333 12.368 1.632 12.667 2 12.667H3.333V8.667ZM12.667 8.667H14C14.368 8.667 14.667 8.965 14.667 9.333V12C14.667 12.368 14.368 12.667 14 12.667H12.667V8.667Z" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.333 10.667H6.667L7.333 8.667L8.667 12.667L9.333 10.667H10.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlayingWaveIcon = ({ color = '#2DC3E1', size = 16 }) => (
  <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flexShrink: 0 }}>
    {[
      { anim: 'voice-bar-1 0.8s ease-in-out infinite', h: 4 },
      { anim: 'voice-bar-2 0.8s ease-in-out infinite 0.15s', h: 8 },
      { anim: 'voice-bar-3 0.8s ease-in-out infinite 0.3s', h: 5 },
      { anim: 'voice-bar-4 0.8s ease-in-out infinite 0.45s', h: 10 },
    ].map((bar, i) => (
      <div
        key={i}
        style={{
          width: '2px', height: `${bar.h}px`, borderRadius: '1px',
          backgroundColor: color, animation: bar.anim,
        }}
      />
    ))}
  </div>
);

function SelectField({ label, value, options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasOptions = options.length > 0;

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 23.4%', position: 'relative' }}>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>{label}</span>
      <button
        type="button"
        onClick={() => hasOptions && setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', height: '36px', width: '100%',
          borderRadius: '8px', padding: '0 12px', gap: '8px',
          background: open ? '#252525' : '#1D1E1E',
          border: `1px solid ${open ? '#FFFFFF33' : '#FFFFFF14'}`,
          outline: `1px solid ${open ? '#2DC3E180' : '#00000080'}`,
          cursor: hasOptions ? 'pointer' : 'default',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', textAlign: 'left' }}>{value}</span>
        <ChevronDownIcon />
      </button>
      {open && hasOptions && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60,
            width: '100%', borderRadius: '8px', padding: '4px',
            background: '#1D1E1E', border: '1px solid #FFFFFF14',
            outline: '1px solid #00000080',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.6)',
          }}
        >
          {options.map((opt) => {
            const isSelected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange?.(opt); setOpen(false); }}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center',
                  borderRadius: '6px', padding: '8px 12px',
                  textAlign: 'left', border: 'none',
                  background: isSelected ? '#FFFFFF14' : 'transparent',
                  color: isSelected ? '#FFFFFF' : '#FFFFFFCC',
                  fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                  cursor: 'pointer',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
function VoiceCard({ label, active, onClick, previewUrl }) {
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

// ── Delete confirm modal ───────────────────────────────────────────────────

// DeleteConfirmModal 已迁移至 ConfirmDialog 共享组件

// ── Character card ─────────────────────────────────────────────────────────

function MoreMenu({ onDownload, onDelete }) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hovIdx, setHovIdx] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const items = [
    {
      label: '下载',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M2.667 11.333V13.333H13.333V11.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 2.667V10.667" stroke="currentColor" strokeLinecap="round" />
          <path d="M5 7.667L8 10.667L11 7.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      action: () => { onDownload?.(); setOpen(false); },
      danger: false,
    },
    {
      label: '删除',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M3 3.333V14.667H13V3.333H3Z" stroke="currentColor" strokeLinejoin="round" />
          <path d="M6.667 6.667V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.333 6.667V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1.333 3.333H14.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="currentColor" strokeLinejoin="round" />
        </svg>
      ),
      action: () => { setOpen(false); setShowConfirm(true); },
      danger: true,
    },
  ];

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          className="flex items-center justify-center shrink-0 rounded-md cursor-pointer border-0"
          style={{
            width: '24px',
            height: '24px',
            backgroundColor: open ? 'rgba(0,0,0,0.75)' : '#00000080',
            transition: 'background-color 0.12s',
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.backgroundColor = '#00000080'; }}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M8 5C8.552 5 9 4.552 9 4C9 3.448 8.552 3 8 3C7.448 3 7 3.448 7 4C7 4.552 7.448 5 8 5Z" fill="#FFFFFF" />
            <path d="M8 9C8.552 9 9 8.552 9 8C9 7.448 8.552 7 8 7C7.448 7 7 7.448 7 8C7 8.552 7.448 9 8 9Z" fill="#FFFFFF" />
            <path d="M8 12.667C8.552 12.667 9 12.219 9 11.667C9 11.114 8.552 10.667 8 10.667C7.448 10.667 7 11.114 7 11.667C7 12.219 7.448 12.667 8 12.667Z" fill="#FFFFFF" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute z-50 flex flex-col rounded-medium bg-select-bg border border-select-border"
            style={{
              top: 'calc(100% + 4px)',
              right: 0,
              minWidth: '100px',
              padding: '4px',
              boxShadow: '0px 4px 16px var(--color-select-shadow)',
            }}
          >
            {items.map((item, i) => (
              <div
                key={item.label}
                className="flex items-center gap-[4px] px-[12px] rounded-md shrink-0 cursor-pointer"
                style={{
                  height: '36px',
                  color: item.danger
                    ? (hovIdx === i ? '#F75F5F' : '#FF7A7A99')
                    : (hovIdx === i ? 'var(--color-select-item-text-hover)' : 'var(--color-select-item-text-normal)'),
                  backgroundColor: hovIdx === i ? 'var(--color-select-item-bg-hover)' : 'transparent',
                  transition: 'background-color 0.1s, color 0.1s',
                }}
                onMouseEnter={() => setHovIdx(i)}
                onMouseLeave={() => setHovIdx(null)}
                onClick={(e) => { e.stopPropagation(); item.action?.(); }}
              >
                {item.icon}
                <span
                  className="w-fit shrink-0 text-font-size-14 font-font-weight-regular"
                  style={{ fontFamily: FONT }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description="删除后，该主体相关数据将被清除且不可恢复。"
          confirmText="删除"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); onDelete?.(); }}
          zIndex={100}
        />
      )}
    </>
  );
}

function CharCard({ name, desc, imageUrl, voice, voiceName, voicePreviewUrl, onVoiceClick, onClick, onDownloadImage, onDeleteSubject, placeholderImg: cardPlaceholder = placeholderImg, loading = false, selected = false }) {
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

function AddCard({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="[font-synthesis:none] flex flex-col items-center justify-center rounded-xl cursor-pointer border border-dashed"
      style={{
        aspectRatio: '200/246',
        borderColor: hovered ? '#FFFFFF40' : '#FFFFFF26',
        backgroundColor: hovered ? '#FFFFFF05' : 'transparent',
        gap: '6px',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M10 4V16M4 10H16" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 0.15s' }} />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: hovered ? '#FFFFFF66' : '#FFFFFF33', transition: 'color 0.15s' }}>
        新增
      </span>
    </div>
  );
}

// ── Mock data ──────────────────────────────────────────────────────────────

const INITIAL_CHARS = [
  { id: 1, name: '虎大', desc: '森林里最年长的老虎，性格沉稳，是两兄弟中的大哥，负责保护弟弟虎二。', imageUrl: null, voice: '霸气威武' },
  { id: 1, name: '虎大', desc: '森林里最年长的老虎，性格沉稳，是两兄弟中的大哥，负责保护弟弟虎二。', imageUrl: null, voice: null },
  { id: 2, name: '虎二', desc: '活泼好动的小老虎，总是惹麻烦，但心地善良，对哥哥虎大十分依赖。', imageUrl: null, voice: null },
  { id: 3, name: '狐狸阿九', desc: '狡猾却重情义的狐狸，表面上爱耍小聪明，关键时刻总会挺身而出。', imageUrl: null, voice: null },
  { id: 4, name: '老猫头鹰', desc: '森林里的智者，见过无数风雨，总在两只老虎迷路时给出关键指引。', imageUrl: null, voice: null },
  { id: 5, name: '小松鼠', desc: '话多又热心的小松鼠，是森林里的消息灵通人士，喜欢收集各种坚果和秘密。', imageUrl: null, voice: null },
  { id: 6, name: '大灰狼', desc: '看似凶猛的反派，实则只是想找人一起玩，孤独是他最大的秘密。', imageUrl: null, voice: null },
];

const MOCK_PROPS = [];

// Icon button with hover/press states for image overlays
function IconBtn({ children, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setHovered(true)}
      style={{
        width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        background: pressed ? 'rgba(255,255,255,0.18)' : hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
        transition: 'background 100ms',
      }}
    >
      {children}
    </div>
  );
}

// Upload button with hover/press states
function UploadBtn({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setHovered(true)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', padding: '0 6px', borderRadius: '6px', cursor: 'pointer',
        background: pressed ? '#222222' : hovered ? '#1A1A1A' : '#161616',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        outline: '1px solid #00000080',
        transition: 'background 100ms, border-color 100ms',
      }}
    >
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: hovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66' }}>{label}</span>
    </div>
  );
}

// Upload card — only item shown by default; hover state on card

function ImageItemUpload({ onUpload, projectId }) {
  const [hovered, setHovered] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  return (
    <>
      <AssetPickerModal
        accept="image"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onConfirm={(ids) => { if (ids.length > 0) onUpload?.(ids[0]); }}
        projectId={projectId}
      />
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          height: '144px', borderRadius: '6px', flexShrink: 0,
          border: `1px dashed ${hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
          background: hovered ? '#222222' : '#1D1E1E',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; } onUpload?.(file); } e.target.value = ''; }}
        />
        <UploadBtn label="本地上传" onClick={() => fileInputRef.current?.click()} />
        <UploadBtn label="从资产库选择" onClick={() => setAssetPickerOpen(true)} />
      </div>
    </>
  );
}

// Modal for viewing an uploaded image full-size
function ImageViewModal({ open, imageUrl, imageId, projectId, subjectId, onClose }) {
  const { width: modalW, height: modalH } = useModalSize();
  const [closeHovered, setCloseHovered] = useState(false);
  const [downloadHovered, setDownloadHovered] = useState(false);
  const [downloadPressed, setDownloadPressed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading || !projectId || !subjectId || !imageId) return;
    setDownloading(true);
    try {
      const blob = await apiDownloadSubjectImage(projectId, subjectId, imageId);
      triggerBlobDownload(blob, `subject-image-${imageId}.jpg`);
    } catch (err) {
      console.error('[ImageViewModal] 下载失败:', err);
    } finally {
      setDownloading(false);
    }
  }
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', width: `${modalW}px`, borderRadius: '16px', overflow: 'hidden', height: `${modalH}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#161616', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>查看</span>
          <div
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHovered ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }}
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4l8 8" stroke={closeHovered ? '#FFFFFF' : '#FFFFFFCC'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        {/* image area */}
        <div style={{ flex: 1, display: 'flex', padding: '8px 24px', overflow: 'hidden', gap: '12px', flexDirection: 'column', background: '#161616', minHeight: 0 }}>
          {imageUrl
            ? <img src={imageUrl} alt="" style={{ width: '100%', flex: 1, borderRadius: '8px', objectFit: 'contain', minHeight: 0 }} />
            : <div style={{ width: '100%', flex: 1, borderRadius: '8px', background: '#FFFFFF14' }} />
          }
        </div>
        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end', background: '#161616', borderRadius: '0 0 16px 16px', padding: '16px 24px', flexShrink: 0 }}>
          {/* 下载按钮 */}
          <div
            className="flex flex-col shrink-0 rounded-[8px] cursor-pointer"
            style={{ height: '36px', padding: '1px', backgroundImage: downloadHovered ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)' : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', boxShadow: '#00000066 3px 3px 8px', outline: '1px solid #00000080', transition: 'background-image 0.15s' }}
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            onMouseEnter={() => setDownloadHovered(true)}
            onMouseLeave={() => { setDownloadHovered(false); setDownloadPressed(false); }}
            onMouseDown={() => setDownloadPressed(true)}
            onMouseUp={() => setDownloadPressed(false)}
          >
            <div className="flex items-center flex-1 self-stretch rounded-[7px] gap-[4px] px-[15px]" style={{ backgroundColor: downloadPressed ? '#222222' : downloadHovered ? '#1C1C1C' : '#161616', transition: 'background-color 0.1s' }}>
              {downloading ? (
                <DotsLoading size={3} color="#FFFFFF" gap={2} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M8 2.667V10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.667 12H13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>下载</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Uploaded image card — interactive: hover highlights border, click toggles settled
function ImageItem({ settled, imageUrl, imageId, onView, onSettledChange, onDownload }) {
  const [hovered, setHovered] = useState(false);

  const borderColor = settled ? '#2DC3E1' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSettledChange?.(!settled)}
      style={{
        height: '144px', borderRadius: '6px', flexShrink: 0,
        border: `1px solid ${borderColor}`,
        background: '#FFFFFF14', overflow: 'clip', position: 'relative', cursor: 'pointer',
        transition: 'border-color 120ms',
      }}
    >
      {/* placeholder / real image */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imageUrl
          ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <DotsLoading size={4} color="#2DC3E1" gap={3} />
        }
      </div>

      {/* top overlay: settled checkbox */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Checkbox checked={settled} onChange={(e) => { e.stopPropagation(); onSettledChange?.(!settled); }} />
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF', fontWeight: settled ? 600 : 500 }}>定稿</span>
      </div>

      {/* bottom overlay: fullscreen + download — only on hover */}
      {hovered && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          <IconBtn onClick={(e) => { e.stopPropagation(); onView?.(imageUrl); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconBtn>
          <IconBtn onClick={(e) => { e.stopPropagation(); onDownload?.(); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconBtn>
        </div>
      )}
    </div>
  );
}

// Interactive radio option
function RadioOption({ label, checked, onChange }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
      onClick={onChange}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'relative', width: '16px', height: '16px', flexShrink: 0 }}>
        <div style={{
          borderRadius: '50%',
          background: checked ? '#2DC3E1' : hovered ? '#1A1A1A' : '#090909',
          border: `1px solid ${checked ? 'rgba(255,255,255,0.2)' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.2)'}`,
          outline: '1px solid #00000080',
          width: '16px', height: '16px',
          transition: 'background 100ms',
        }} />
        {checked && <div style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', borderRadius: '50%', background: '#0A0A0A', width: '6px', height: '6px' }} />}
      </div>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: checked ? '#FFFFFF' : hovered ? '#FFFFFFCC' : '#FFFFFF99', transition: 'color 100ms' }}>{label}</span>
    </div>
  );
}

// Per-model upload limits


function RefImageItem({ url, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const [previewPos, setPreviewPos] = useState(null);
  const hoverTimerRef = useRef(null);

  function handleMouseEnter(e) {
    setHovered(true);
    const { clientX, clientY } = e;
    hoverTimerRef.current = setTimeout(() => {
      setPreviewPos({ x: clientX, y: clientY });
    }, 500);
  }

  function handleMouseMove(e) {
    setPreviewPos(pos => pos ? { x: e.clientX, y: e.clientY } : pos);
  }

  function handleMouseLeave() {
    setHovered(false);
    clearTimeout(hoverTimerRef.current);
    setPreviewPos(null);
  }

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden', position: 'relative', flexShrink: 0,
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
          transition: 'border-color 120ms', cursor: 'pointer',
        }}
      >
        <img src={url} alt="参考图" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {hovered && (
          <div
            onClick={(e) => { e.stopPropagation(); clearTimeout(hoverTimerRef.current); setPreviewPos(null); onRemove(); }}
            style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </div>
        )}
      </div>
      {previewPos && url && createPortal(
        <SubjectRefHoverPreview url={url} mouseX={previewPos.x} mouseY={previewPos.y} />,
        document.body
      )}
    </>
  );
}

function SubjectRefHoverPreview({ url, mouseX, mouseY }) {
  const [size, setSize] = useState(null);
  const GAP = 16;

  useEffect(() => {
    setSize(null);
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  if (!size) return null;

  const maxW = window.innerWidth * 0.35;
  const maxH = window.innerHeight * 0.35;
  const ratio = size.w / size.h;

  let previewW, previewH;
  if (ratio >= 1) {
    previewW = maxW;
    previewH = previewW / ratio;
    if (previewH > maxH) { previewH = maxH; previewW = previewH * ratio; }
  } else {
    previewH = maxH;
    previewW = previewH * ratio;
    if (previewW > maxW) { previewW = maxW; previewH = previewW / ratio; }
  }

  let left = mouseX + GAP;
  let top = mouseY + GAP;
  if (left + previewW > window.innerWidth - GAP) left = mouseX - previewW - GAP;
  if (top + previewH > window.innerHeight - GAP) top = mouseY - previewH - GAP;
  left = Math.max(GAP, left);
  top = Math.max(GAP, top);

  return (
    <div
      style={{
        position: 'fixed', left, top,
        width: previewW, height: previewH,
        zIndex: 99999, pointerEvents: 'none',
        borderRadius: '8px', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.12)',
        backgroundColor: '#111',
      }}
    >
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}

function RefImageUploadCard({ onLocalUpload, onAssetPick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '120px', height: '120px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', borderRadius: '8px',
        background: hovered ? '#222222' : '#1D1E1E',
        border: `1px dashed ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        gap: '8px', transition: 'background 120ms, border-color 120ms',
      }}
    >
      <UploadBtn label="本地上传" onClick={onLocalUpload} />
      <UploadBtn label="从资产库选择" onClick={onAssetPick} />
    </div>
  );
}

function RefImageField({ maxImages = 3, projectId, subjectId, refImageIds = [], onRefImagesChange }) {
  const fileInputRef = useRef(null);
  const [refImages, setRefImages] = useState([]);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // 当外部 refImageIds 变化时，更新参考图列表
  // refImageIds 可以是：
  //   - { id, url }[]  — 从后端加载后的对象（新格式）
  //   - string[]       — 纯 asset_id（兼容旧调用路径）
  useEffect(() => {
    if (!refImageIds || refImageIds.length === 0) {
      setRefImages([]);
      return;
    }
    setRefImages(prev => {
      return refImageIds.map(item => {
        // 新格式：{ id, url }
        if (item && typeof item === 'object' && item.id) {
          const existing = prev.find(p => p?.id === item.id);
          return existing?.url ? existing : { id: item.id, url: item.url || null };
        }
        // 旧格式：纯字符串 id 或 URL
        const id = item;
        const existing = prev.find(p => p?.id === id);
        if (existing?.url) return existing;
        if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('blob'))) {
          return { url: id, id };
        }
        return { id, url: null };
      });
    });
  }, [JSON.stringify(refImageIds)]);

  const canAddMore = refImages.length < maxImages;

  const handleFile = (file) => {
    if (file.size > 20 * 1024 * 1024) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      return;
    }
    const url = URL.createObjectURL(file);
    const newList = [...refImages, { url, id: url }].slice(0, maxImages);
    setRefImages(newList);
    // 通知父组件：上传本地文件作为参考图
    if (onRefImagesChange) {
      onRefImagesChange(newList.map(r => r.url));
    }
  };

  const handleAssetConfirm = (selectedAssets) => {
    // 从资产库选择了资产，需要绑定到主体
    const assetIds = selectedAssets.map(a => a.id);
    const newList = [
      ...refImages,
      ...selectedAssets.map(a => ({ url: normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url), id: a.id, assetId: a.id })),
    ].slice(0, maxImages);
    setRefImages(newList);
    setAssetPickerOpen(false);

    // 调用后端绑定参考图接口
    if (projectId && subjectId && assetIds.length > 0) {
      setLoadingRefs(true);
      apiBindSubjectReferenceImages(projectId, subjectId, { asset_ids: assetIds })
        .then(() => {
          if (onRefImagesChange) {
            onRefImagesChange(newList.map(r => r.id));
          }
        })
        .catch((err) => {
          console.error('[SubjectPage] 绑定参考图失败:', err);
        })
        .finally(() => setLoadingRefs(false));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <AssetPickerModal
        accept="image"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onConfirm={handleAssetConfirm}
        projectId={projectId}
        preSelectedIds={refImages.map(img => img.assetId).filter(Boolean)}
        preSelectedUrls={refImages.map(img => img.url).filter(Boolean)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>参考图{loadingRefs ? '（绑定中…）' : ''}</span>
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66' }}>{refImages.length}/{maxImages}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
        {refImages.map((item, i) => (
          <RefImageItem
            key={item.id ?? item.url + i}
            url={item.url}
            onRemove={() => {
              const newList = refImages.filter((_, idx) => idx !== i);
              setRefImages(newList);
              if (onRefImagesChange) onRefImagesChange(newList.map(r => r.id));
            }}
          />
        ))}
        {canAddMore && (
          <RefImageUploadCard
            onLocalUpload={() => fileInputRef.current?.click()}
            onAssetPick={() => setAssetPickerOpen(true)}
          />
        )}
      </div>
    </div>
  );
}

// 模块级缓存：跨弹窗打开/关闭保留生成中的图片状态
// key: subjectId, value: { placeholderId, status: 'pending'|'done', imageUrl?, rawUrl? }
const pendingGenerations = new Map();

function EditSubjectPanel({ projectId, char, tabLabel = '角色', projectRatio, onClose, onCommit, onCoverChange, refreshToken, setBatchLoadingSubjects }) {
  // ── 从后端拉取模型列表，直接使用后端 capabilities ──────────────
  const [imageModels, setImageModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let merged;
      try {
        const data = await apiListModels({ category: 'image' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        merged = list.map((m) => {
          const modelId = m.model_id || m.id;
         const caps = m.capabilities || {};
          const resolutions = (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
          const resolutionSizeMap = caps.resolution_size_map || {};
          const ratios = caps.supported_aspect_ratios || [];
          return {
            value: modelId,
            label: m.name || modelId,
            resolutions,
            resolutionSizeMap,
            ratios,
            is_default: m.is_default,
            maxRefImages: caps.max_reference_images || 3,
          };
        });
        setImageModels(merged.length > 0 ? merged : getFallbackModels());
      } catch {
        setImageModels(getFallbackModels());
      } finally {
        setModelsLoading(false);
      }

      // 如果角色没有预设模型，加载完后自动选中默认模型
      if (merged.length > 0 && !char?.model && !char?.default_image_model) {
        const def = merged.find(m => m.is_default) || merged[0];
        if (def) setSelectedModel(def.value);
      }
    })();
  }, [projectId]);

  // 本地兜底（后端不可用时）
  function getFallbackModels() {
    return [
      { value: 'doubao-seedream-5.0-lite', label: 'Doubao-Seed-5.0-Lite', resolutions: ['2K','3K','4K'], resolutionSizeMap: {}, ratios: ['1:1','16:9','9:16','4:3','3:4'], maxRefImages: 3 },
      { value: 'doubao-seedream-4.5', label: 'Doubao-Seed-4.5', resolutions: ['2K','4K'], resolutionSizeMap: {}, ratios: ['1:1','16:9','9:16','4:3','3:4'], maxRefImages: 3 },
      { value: 'doubao-seedream-4.0', label: 'Doubao-Seed-4.0', resolutions: ['1K','2K','4K'], resolutionSizeMap: {}, ratios: ['1:1','16:9','9:16','4:3','3:4'], maxRefImages: 3 },
    ];
  }

  const [closeHovered, setCloseHovered] = useState(false);
  const [genHovered, setGenHovered] = useState(false);
  const [genPressed, setGenPressed] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const [promptHovered, setPromptHovered] = useState(false);
  // 提示词：优先从 char 对象取，再从后端拉取
  const [promptText, setPromptText] = useState(char?.prompt || char?.prompt_text || '');
  const [modelHovered, setModelHovered] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  // 模型：优先从 char 对象取，否则用默认
  const [selectedModel, setSelectedModel] = useState(char?.model || char?.default_image_model || imageModels[0]?.value || 'doubao-seedream-5.0-lite');
  const modelTriggerRef = useRef(null);
  const [ratioHovered, setRatioHovered] = useState(false);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState(char?.ratio || projectRatio || '16:9');
  const ratioTriggerRef = useRef(null);
  const [resolutionHovered, setResolutionHovered] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState(char?.resolution || '2K');
  const resolutionTriggerRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const ratioDropdownRef = useRef(null);
  const resolutionDropdownRef = useRef(null);
  const [genMode, setGenMode] = useState('main');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [refImageIds, setRefImageIds] = useState(Array.isArray(char?.reference_image_ids) ? char.reference_image_ids : []);
  const [viewImageUrl, setViewImageUrl] = useState(null);
  const [viewImageId, setViewImageId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const isMountedRef = useRef(true); // 跟踪组件是否已挂载，关闭弹窗后仍让请求跑完
  const [detailLoaded, setDetailLoaded] = useState(false);

  const [primaryImageUrl, setPrimaryImageUrl] = useState(null);
  const [primaryImageId, setPrimaryImageId] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── 从后端拉取主体详情和已生成图片 ─────────────────────────────
  useEffect(() => {
    if (!projectId || !char?.id) return;
    let cancelled = false;

    (async () => {
      // 只拉一次详情，SubjectDetailResponse 包含：
      //   subject (SubjectResponse)
      //   primary_image (SubjectImageResponse | null)
      //   candidate_images (SubjectImageResponse[])
      //   reference_images (SubjectReferenceImage[])
      //   latest_generate_config (SubjectGenerateConfig | null)
      const detailRes = await apiGetSubjectDetail(projectId, char.id).catch(() => null);
      if (cancelled) return;

      if (!detailRes) {
        if (!promptText) setPromptText(defaultPromptForTab(tabLabel));
        setDetailLoaded(true);
        return;
      }

      // ── 从 subject 字段读取基础信息 ──────────────────────────────
      const subject = detailRes.subject || detailRes;   // 兼容后端扁平返回
      const genCfg = detailRes.latest_generate_config || subject.gen_config || {};

      if (subject.prompt) setPromptText(subject.prompt);
      if (genCfg.model || subject.model) setSelectedModel(genCfg.model || subject.model);
      if (genCfg.ratio || subject.ratio) setSelectedRatio(genCfg.ratio || subject.ratio);
      if (genCfg.resolution || genCfg.size || subject.resolution) {
        setSelectedResolution(genCfg.resolution || genCfg.size || subject.resolution);
      }

      // ── 候选图列表（SubjectImageResponse[]） ─────────────────────
      // 字段：id, image_url, is_primary
      const candidateImgs = Array.isArray(detailRes.candidate_images) ? detailRes.candidate_images : [];
      const candidateMapped = candidateImgs.map((img) => ({
        id: img.id,
        rawUrl: img.image_url,
        url: normalizeImageUrl(img.image_url),
        settled: img.is_primary ?? false,
        isReference: false,
      }));

      // ── 手动上传的图（SubjectReferenceImage[]）也放入右侧列表 ────
      // 字段：asset_id, file_url, name, is_primary
      // 注意：不写入 refImageIds，参考图字段由用户在本次 session 手动选择，不从后端自动填充
      // settled 强制为 false：这类图片是用户手动上传的素材，不继承原资产的定稿状态
      const refImgs = Array.isArray(detailRes.reference_images) ? detailRes.reference_images : [];
      const refMapped = refImgs.map((img) => ({
        id: img.asset_id,
        rawUrl: img.file_url,
        url: normalizeImageUrl(img.file_url),
        settled: false,   // 手动上传的图永远不预设为定稿
        isReference: true,
      }));

      // 合并，候选图在前，手动上传在后，去重
      const seen = new Set();
      let finalImages = [...candidateMapped, ...refMapped].filter((img) => {
        if (!img.id || seen.has(img.id)) return false;
        seen.add(img.id);
        return true;
      });

      // 检查是否有进行中/已完成的跨弹窗生成
      const pending = pendingGenerations.get(char.id);
      if (pending?.status === 'pending') {
        finalImages.unshift({ url: null, settled: false, id: pending.placeholderId, isReference: false });
      } else if (pending?.status === 'done') {
        finalImages.unshift({
          rawUrl: pending.rawUrl,
          url: normalizeImageUrl(pending.rawUrl),
          settled: false,
          id: pending.placeholderId,
          isReference: false,
        });
        pendingGenerations.delete(char.id);
      }

      if (finalImages.length > 0) {
        setGeneratedImages(finalImages);
      } else if (char?.imageUrl) {
        // 兜底用 char 的封面图
        setGeneratedImages([{ rawUrl: char.imageUrl, url: normalizeImageUrl(char.imageUrl), settled: true, id: char.imageUrl, isReference: false }]);
      } else {
        setGeneratedImages([]);
      }

      setDetailLoaded(true);

      // 将后端返回的定稿图同步到卡片封面
      const _settledImg = finalImages.find((img) => img.settled && img.rawUrl);
      if (_settledImg) {
        setPrimaryImageUrl(_settledImg.rawUrl);
        setPrimaryImageId(_settledImg.id);
        onCoverChange?.(_settledImg.rawUrl);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, char?.id, refreshToken]);

  // ── 默认提示词 ────────────────────────────────────────────────
  function defaultPromptForTab(tab) {
    const defaults = {
      '角色': '一只雄性成年角色，站姿平稳，角色设定图。',
      '场景': '一个场景环境，宽阔视野，场景设定图。',
      '道具': '一个道具，细节清晰，道具设定图。',
    };
    return defaults[tab] || '高质量设定图，细节清晰。';
  }

  // 获取当前模型的能力配置（直接从后端 capabilities 读取）
  const currentModel = imageModels.find(m => m.value === selectedModel) || {};
  // 比例根据当前选中的分辨率动态获取，不同分辨率可能支持不同比例
  const availableRatios = useMemo(() => {
    const resRatios = currentModel.resolutionSizeMap?.[selectedResolution];
    if (resRatios) return Object.keys(resRatios);
    return currentModel.ratios || [];
  }, [currentModel, selectedResolution]);
  const availableResolutions = currentModel.resolutions || [];
  const maxRefImages = currentModel.maxRefImages || 3;

  // 当模型切换时（非首次加载），保留当前比例/分辨率（若新模型支持）
  const prevModelRef = useRef(selectedModel);
  useEffect(() => {
    // 跳过首次渲染（初始化）
    if (!detailLoaded) {
      prevModelRef.current = selectedModel;
      return;
    }
    // 只有用户主动切换模型时才处理
    if (prevModelRef.current === selectedModel) return;
    prevModelRef.current = selectedModel;

    const newModel = imageModels.find(m => m.value === selectedModel);
    const resList = newModel?.resolutions || [];
    if (resList.length > 0) {
      // 若新模型支持当前分辨率则保留，否则回退到第一个
      const currentResSupported = resList.includes(selectedResolution);
      const newRes = currentResSupported ? selectedResolution : resList[0];
      setSelectedResolution(newRes);
      // 若新模型在该分辨率下支持当前比例则保留
      const resRatios = newModel?.resolutionSizeMap?.[newRes];
      if (resRatios) {
        const ratioKeys = Object.keys(resRatios);
        if (currentResSupported && ratioKeys.includes(selectedRatio)) {
          setSelectedRatio(selectedRatio);
        } else {
          setSelectedRatio(ratioKeys[0] || '16:9');
        }
      }
    } else {
      setSelectedResolution('');
      setSelectedRatio('16:9');
    }
  }, [selectedModel, detailLoaded, imageModels]);

  // 当选中的分辨率/比例不在当前模型支持列表中时，自动修正到第一个可用值
  useEffect(() => {
    if (!availableResolutions.includes(selectedResolution)) {
      setSelectedResolution(availableResolutions[0]);
    }
  }, [availableResolutions, selectedResolution]);
  useEffect(() => {
    if (!availableRatios.includes(selectedRatio)) {
      setSelectedRatio(availableRatios[0]);
    }
  }, [availableRatios, selectedRatio]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(e) {
      if (modelOpen && modelTriggerRef.current && !modelTriggerRef.current.contains(e.target) && modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setModelOpen(false);
      }
      if (ratioOpen && ratioTriggerRef.current && !ratioTriggerRef.current.contains(e.target) && ratioDropdownRef.current && !ratioDropdownRef.current.contains(e.target)) {
        setRatioOpen(false);
      }
      if (resolutionOpen && resolutionTriggerRef.current && !resolutionTriggerRef.current.contains(e.target) && resolutionDropdownRef.current && !resolutionDropdownRef.current.contains(e.target)) {
        setResolutionOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelOpen, ratioOpen, resolutionOpen]);

  function showToast(msg, type = 'success') {
    clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }
  const [charName, setCharName] = useState(char?.name ?? '');
  const [charDesc, setCharDesc] = useState(char?.desc ?? '');
  const [nameFocused, setNameFocused] = useState(false);
  const [nameHovered, setNameHovered] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [descHovered, setDescHovered] = useState(false);

  if (!char) return null;

  const selectStyle = (hovered) => ({
    display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', padding: '0 12px', gap: '8px',
    background: hovered ? '#222222' : '#1D1E1E',
    border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
    outline: '1px solid #00000080', cursor: 'pointer',
    transition: 'background 100ms, border-color 100ms',
  });

  return (
    <>
    {/* 点击遮罩层关闭弹窗 */}
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 49,
        background: 'transparent',
      }}
    />
    <div
      style={{
        position: 'fixed', top: '60px', right: '24px', bottom: '24px',
        width: '600px', zIndex: 50,
        display: 'flex', flexDirection: 'column',
        background: '#161616', border: '1px solid #FFFFFF14',
        borderRadius: '16px', boxShadow: '#00000099 0px 24px 64px',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBlock: '20px', paddingInline: '24px', background: '#161616', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>编辑{tabLabel}</span>
        <button
          type="button"
          onClick={onClose}
          onMouseEnter={() => setCloseHovered(true)}
          onMouseLeave={() => setCloseHovered(false)}
          style={{
            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: closeHovered ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, borderRadius: '6px',
            transition: 'background 100ms',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="2" y1="2" x2="14" y2="14" stroke={closeHovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66'} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="2" x2="2" y2="14" stroke={closeHovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66'} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* two-column body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', overflow: 'hidden' }}>
        {/* left: form */}
        <div style={{ width: 'round(70%, 1px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '24px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '80px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
          {/* name + desc — editable */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>角色名称</span>
            <div
              onMouseEnter={() => setNameHovered(true)}
              onMouseLeave={() => setNameHovered(false)}
              style={{
                display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', padding: '0 12px',
                background: nameFocused ? 'rgba(45,195,225,0.04)' : nameHovered ? '#222222' : '#1D1E1E',
                border: `1px solid ${nameFocused ? 'rgba(45,195,225,0.6)' : nameHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                outline: nameFocused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
                transition: 'border-color 120ms, background 120ms',
              }}
            >
              <input
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => { setNameFocused(false); onCommit?.(charName, charDesc); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>描述</span>
            <div
              onMouseEnter={() => setDescHovered(true)}
              onMouseLeave={() => setDescHovered(false)}
              style={{
                display: 'flex', flexDirection: 'column', height: '120px', borderRadius: '8px', padding: '9px 12px',
                background: descFocused ? 'rgba(45,195,225,0.04)' : descHovered ? '#222222' : '#1D1E1E',
                border: `1px solid ${descFocused ? 'rgba(45,195,225,0.6)' : descHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                outline: descFocused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
                transition: 'border-color 120ms, background 120ms',
              }}
            >
              <textarea
                value={charDesc}
                onChange={(e) => setCharDesc(e.target.value)}
                onFocus={() => setDescFocused(true)}
                onBlur={() => { setDescFocused(false); onCommit?.(charName, charDesc); }}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '150%', color: '#FFFFFF' }}
              />
            </div>
          </div>

          {/* prompt textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>提示词</span>
            <div
              onMouseEnter={() => setPromptHovered(true)}
              onMouseLeave={() => setPromptHovered(false)}
              style={{
                display: 'flex', flexDirection: 'column', height: '120px', borderRadius: '8px', padding: '9px 12px',
                background: promptFocused ? 'rgba(45,195,225,0.04)' : promptHovered ? '#222222' : '#1D1E1E',
                border: `1px solid ${promptFocused ? 'rgba(45,195,225,0.6)' : promptHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                outline: promptFocused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
                transition: 'border-color 120ms, background 120ms',
              }}
            >
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onFocus={() => setPromptFocused(true)}
                onBlur={() => setPromptFocused(false)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '150%', color: '#FFFFFF' }}
              />
            </div>
          </div>

          {/* model select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>选择模型</span>
            <div
              ref={modelTriggerRef}
              style={{ ...selectStyle(modelHovered || modelOpen), border: `1px solid ${modelOpen ? 'rgba(45,195,225,0.6)' : modelHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}` }}
              onMouseEnter={() => setModelHovered(true)}
              onMouseLeave={() => setModelHovered(false)}
              onClick={() => {
                console.log('[SubjectPage] 点击模型选择器，当前状态:', modelOpen);
                setModelOpen((v) => !v);
              }}
            >
              <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: modelsLoading ? '#FFFFFF66' : '#FFFFFF' }}>
                {modelsLoading ? '加载模型中…' : (imageModels.find(m => m.value === selectedModel)?.label || selectedModel)}
              </span>
              <ChevronDownIcon />
            </div>
            {modelOpen && createPortal(
              <div
                ref={modelDropdownRef}
                style={{
                  position: 'fixed',
                  top: `${(modelTriggerRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
                  left: `${modelTriggerRef.current?.getBoundingClientRect().left || 0}px`,
                  width: `${modelTriggerRef.current?.getBoundingClientRect().width || 200}px`,
                  zIndex: 9999,
                  background: '#1D1E1E',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {console.log('[SubjectPage] 渲染模型下拉菜单，选项数量:', imageModels.length)}
                {imageModels.map((model) => (
                  <div
                    key={model.value}
                    onClick={() => {
                      console.log('[SubjectPage] 点击模型选项:', model.value);
                      setSelectedModel(model.value);
                      setModelOpen(false);
                    }}
                    style={{
                      padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                      color: selectedModel === model.value ? '#2DC3E1' : '#FFFFFFCC',
                      background: selectedModel === model.value ? 'rgba(45,195,225,0.08)' : 'transparent',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => { if (selectedModel !== model.value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = selectedModel === model.value ? 'rgba(45,195,225,0.08)' : 'transparent'; }}
                  >
                    {model.label}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* ratio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>选择画面比例</span>
            <div
              ref={ratioTriggerRef}
              style={{ ...selectStyle(ratioHovered || ratioOpen), border: `1px solid ${ratioOpen ? 'rgba(45,195,225,0.6)' : ratioHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}` }}
              onMouseEnter={() => setRatioHovered(true)}
              onMouseLeave={() => setRatioHovered(false)}
              onClick={() => {
                console.log('[SubjectPage] 点击画面比例选择器，当前状态:', ratioOpen);
                setRatioOpen((v) => !v);
              }}
            >
              <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>{selectedRatio}</span>
              <ChevronDownIcon />
            </div>
            {ratioOpen && createPortal(
              <div
                ref={ratioDropdownRef}
                style={{
                  position: 'fixed',
                  top: `${(ratioTriggerRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
                  left: `${ratioTriggerRef.current?.getBoundingClientRect().left || 0}px`,
                  width: `${ratioTriggerRef.current?.getBoundingClientRect().width || 200}px`,
                  zIndex: 9999,
                  background: '#1D1E1E',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {console.log('[SubjectPage] 渲染画面比例下拉菜单，选项:', availableRatios)}
                {availableRatios.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => {
                      console.log('[SubjectPage] 点击画面比例选项:', opt);
                      setSelectedRatio(opt);
                      setRatioOpen(false);
                    }}
                    style={{
                      padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                      color: selectedRatio === opt ? '#2DC3E1' : '#FFFFFFCC',
                      background: selectedRatio === opt ? 'rgba(45,195,225,0.08)' : 'transparent',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => { if (selectedRatio !== opt) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = selectedRatio === opt ? 'rgba(45,195,225,0.08)' : 'transparent'; }}
                  >
                    {opt}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* quality */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>分辨率</span>
            <div
              ref={resolutionTriggerRef}
              style={{ ...selectStyle(resolutionHovered || resolutionOpen), border: `1px solid ${resolutionOpen ? 'rgba(45,195,225,0.6)' : resolutionHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}` }}
              onMouseEnter={() => setResolutionHovered(true)}
              onMouseLeave={() => setResolutionHovered(false)}
              onClick={() => {
                console.log('[SubjectPage] 点击分辨率选择器，当前状态:', resolutionOpen);
                setResolutionOpen((v) => !v);
              }}
            >
              <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>{selectedResolution}</span>
              <ChevronDownIcon />
            </div>
            {resolutionOpen && createPortal(
              <div
                ref={resolutionDropdownRef}
                style={{
                  position: 'fixed',
                  top: `${(resolutionTriggerRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
                  left: `${resolutionTriggerRef.current?.getBoundingClientRect().left || 0}px`,
                  width: `${resolutionTriggerRef.current?.getBoundingClientRect().width || 200}px`,
                  zIndex: 9999,
                  background: '#1D1E1E',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {console.log('[SubjectPage] 渲染分辨率下拉菜单，选项:', availableResolutions)}
                {availableResolutions.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => {
                      console.log('[SubjectPage] 点击分辨率选项:', opt);
                      setSelectedResolution(opt);
                      setResolutionOpen(false);
                    }}
                    style={{
                      padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                      color: selectedResolution === opt ? '#2DC3E1' : '#FFFFFFCC',
                      background: selectedResolution === opt ? 'rgba(45,195,225,0.08)' : 'transparent',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => { if (selectedResolution !== opt) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = selectedResolution === opt ? 'rgba(45,195,225,0.08)' : 'transparent'; }}
                  >
                    {opt}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* ref image */}
          <RefImageField
            maxImages={maxRefImages}
            projectId={projectId}
            subjectId={char?.id}
            refImageIds={refImageIds}
            onRefImagesChange={(ids) => setRefImageIds(ids)}
          />

          {/* generation mode radio — 仅角色 Tab 显示 */}
          {tabLabel === '角色' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>生成方式</span>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                {[{ key: 'main', label: '单视图' }, { key: 'three_view', label: '多视图' }].map(({ key, label }) => {
                  const active = genMode === key;
                  return (
                    <RadioOption key={key} label={label} checked={active} onChange={() => setGenMode(key)} />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* right: image list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
          <ImageViewModal open={!!viewImageUrl} imageUrl={viewImageUrl} imageId={viewImageId} projectId={projectId} subjectId={char?.id} onClose={() => { setViewImageUrl(null); setViewImageId(null); }} />
          {/* upload card always first */}
          <ImageItemUpload
            projectId={projectId}
            onUpload={(fileOrId) => {
              // 从资产库选择的资产对象（有 id 和 url 属性）
              if (fileOrId && typeof fileOrId === 'object' && fileOrId.id) {
                const raw = fileOrId.url || fileOrId.file_url || fileOrId.fileUrl;
                // 从资产库选择的图片，settled 强制为 false，不继承原资产的定稿状态
                setGeneratedImages((prev) => {
                  const hasSettled = prev.some((img) => img.settled && img.rawUrl);
                  const newImg = { rawUrl: raw, url: normalizeImageUrl(raw), settled: !hasSettled, id: fileOrId.id, isReference: true };
                  if (!hasSettled) {
                    setPrimaryImageUrl(raw);
                    setPrimaryImageId(fileOrId.id);
                    onCoverChange?.(raw);
                  }
                  return [newImg, ...prev];
                });
                // 绑定资产到主体
                if (projectId && char?.id) {
                  apiBindSubjectReferenceImages(projectId, char.id, { asset_ids: [fileOrId.id] }).catch((err) => {
                    console.error('[SubjectPage] 绑定资产到主体失败:', err);
                  });
                }
              } else if (fileOrId instanceof File) {
                // 本地上传：先用 blob URL 占位，上传完成后替换为真实 asset_id + file_url
                const blobUrl = URL.createObjectURL(fileOrId);
                const tempId = `upload-${Date.now()}`;
                setGeneratedImages((prev) => [{ rawUrl: blobUrl, url: blobUrl, settled: false, id: tempId, isReference: true }, ...prev]);
                // 上传到后端，返回 SubjectReferenceImage { asset_id, file_url, name }
                if (projectId && char?.id) {
                  apiUploadSubjectReferenceImage(projectId, char.id, fileOrId)
                    .then((res) => {
                      // res: SubjectReferenceImage
                      const realId = res?.asset_id;
                      const realUrl = res?.file_url;
                      setGeneratedImages((prev) => {
                        const hasSettled = prev.some((img) => img.settled && img.rawUrl);
                        const updated = prev.map((img) =>
                          img.id === tempId
                            ? { ...img, id: realId || tempId, rawUrl: realUrl || blobUrl, url: normalizeImageUrl(realUrl || blobUrl), settled: !hasSettled }
                            : img
                        );
                        if (!hasSettled && realUrl) {
                          setPrimaryImageUrl(realUrl);
                          setPrimaryImageId(realId);
                          onCoverChange?.(realUrl);
                        }
                        return updated;
                      });
                    })
                    .catch((err) => {
                      console.error('[SubjectPage] 上传参考图失败:', err);
                      // 上传失败时移除占位
                      setGeneratedImages((prev) => prev.filter((img) => img.id !== tempId));
                    });
                }
              }
            }}
          />
          {generatedImages.map((img, i) => (
            <ImageItem
              key={img.id ?? img.url + i}
              imageUrl={img.url}
              imageId={img.id}
              settled={img.settled}
              onView={(url) => { setViewImageUrl(url); setViewImageId(img.id); }}
              onDownload={async () => {
                try {
                  const blob = await apiDownloadSubjectImage(projectId, char.id, img.id);
                  triggerBlobDownload(blob, `subject-image-${img.id}.jpg`);
                  showToast('下载成功', 'success');
                } catch (err) {
                  console.error('[SubjectPage] 下载图片失败:', err);
                  showToast('下载失败', 'error');
                }
              }}
              onSettledChange={(newSettled) => {
                if (newSettled) {
                  onCoverChange?.(img?.rawUrl ?? img?.url ?? null);
                  // 只有真实 ID（非前端占位符）才调后端
                  if (img.id && !String(img.id).startsWith('generated-')) {
                    if (img.isReference) {
                      // 参考图：通过 bind 接口把该资产设为 primary
                      apiBindSubjectReferenceImages(projectId, char.id, {
                        asset_ids: [img.id],
                        primary_asset_id: img.id,
                      }).catch((err) => {
                        console.error('[SubjectPage] 设置参考图为定稿失败:', err);
                      });
                    } else {
                      // 候选图：set-primary 接口
                      apiSetPrimarySubjectImage(projectId, char.id, img.id).catch((err) => {
                        console.error('[SubjectPage] 设置定稿图失败:', err);
                      });
                    }
                  }
                }

                setGeneratedImages((prev) =>
                  prev.map((item, idx) =>
                    idx === i
                      ? { ...item, settled: newSettled }
                      : { ...item, settled: newSettled ? false : item.settled }
                  )
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* footer: 生成图片按钮 — 绝对定位于底部 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 'round(70%, 1px)',
          padding: '16px 24px',
          background: '#161616',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onMouseEnter={() => setGenHovered(true)}
          onMouseLeave={() => { setGenHovered(false); setGenPressed(false); }}
          onMouseDown={() => setGenPressed(true)}
          onMouseUp={() => setGenHovered(true)}
          onClick={async () => {
            if (!promptText.trim()) {
              showToast('请输入提示词', 'error');
              return;
            }

            // 防止同一主体重复点击生成
            const existing = pendingGenerations.get(char.id);
            if (existing && existing.status === 'pending') {
              showToast('该主体已有生成任务进行中', 'error');
              return;
            }

            const placeholder = `generated-${Date.now()}`;
            // 写入模块级缓存，跨弹窗打开/关闭保持
            pendingGenerations.set(char.id, { placeholderId: placeholder, status: 'pending' });
            setBatchLoadingSubjects((prev) => ({ ...prev, [char.id]: true }));
            setGeneratedImages((prev) => [{ url: null, settled: false, id: placeholder }, ...prev]);

            const genParams = {
              model: selectedModel,
              ratio: selectedRatio,
              resolution: selectedResolution,
              prompt: promptText,
              generation_mode: genMode,
            };
            if (Array.isArray(refImageIds) && refImageIds.length > 0) {
              genParams.reference_mode = 'subject';
            }

            // 使用 .then() 代替 await，使回调在组件卸载后仍能更新缓存
            apiGenerateSubjectImage(projectId, char.id, genParams)
              .then((result) => {
                const rawUrl = result.image_url || result.imageUrl || result.url || null;

                if (isMountedRef.current) {
                  // 弹窗仍打开：正常更新图片列表
                  const imageUrl = normalizeImageUrl(rawUrl);
                  const realImageId = result.id || result.image_id || null;
                  setGeneratedImages((prev) => {
                    // ① 占位图替换为真实数据
                    const updated = prev.map((img) =>
                      img.id === placeholder
                        ? { ...img, id: realImageId || placeholder, rawUrl, url: imageUrl, settled: false }
                        : img
                    );
                    // ② 如果没有任何定稿图，自动将新生成的图设为定稿并更新封面
                    const hasSettled = updated.some((img) => img.settled && img.rawUrl);
                    if (!hasSettled && rawUrl) {
                      updated[0] = { ...updated[0], settled: true };
                      setPrimaryImageUrl(rawUrl);
                      setPrimaryImageId(realImageId);
                      onCoverChange?.(rawUrl);
                    }
                    return updated;
                  });
                  setBatchLoadingSubjects((prev) => {
                    const next = { ...prev };
                    delete next[char.id];
                    return next;
                  });
                  showToast('图片生成成功', 'success');
                  pendingGenerations.delete(char.id);
                } else {
                  // 弹窗已关闭：缓存结果，下次打开弹窗时显示
                  pendingGenerations.set(char.id, {
                    placeholderId: placeholder,
                    status: 'done',
                    rawUrl,
                    imageUrl: result.image_url || result.imageUrl || result.url || null,
                  });
                  console.log('[SubjectPage] 弹窗已关闭，图片后台生成完成，结果已缓存');
                }
              })
              .catch((err) => {
                console.error('[SubjectPage] 生成图片失败:', err);
                pendingGenerations.delete(char.id);
                setBatchLoadingSubjects((prev) => {
                  const next = { ...prev };
                  delete next[char.id];
                  return next;
                });
                if (isMountedRef.current) {
                  setGeneratedImages((prev) => prev.filter((img) => img.id !== placeholder));
                }
                const errMsg = err?.message || '图片生成失败';
                showToast(errMsg, 'error');
              });
          }}
          style={{
            display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', padding: '0 16px', gap: '4px', cursor: 'pointer',
            backgroundColor: genPressed ? '#28AFCA' : genHovered ? '#35D4F5' : '#2DC3E1',
            border: '1px solid #FFFFFF33',
            outline: '1px solid #00000080',
            backgroundImage: 'linear-gradient(in oklab 107.51deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
            transition: 'background 100ms',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#090909" strokeLinejoin="round" />
            <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#090909" />
            <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '18px', color: '#090909', whiteSpace: 'nowrap' }}>生成图片</span>
        </button>
      </div>
    </div>
    {toast && createPortal(
      <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
        <div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]" style={{ whiteSpace: 'nowrap' }}>
          {toast.type === 'success' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {toast.type === 'warning' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#EB8B14" stroke="#EB8B14" strokeWidth="1.333" strokeLinejoin="round" />
              <path fillRule="evenodd" clipRule="evenodd" d="M8 12.333C8.46 12.333 8.833 11.96 8.833 11.5C8.833 11.04 8.46 10.667 8 10.667C7.54 10.667 7.167 11.04 7.167 11.5C7.167 11.96 7.54 12.333 8 12.333Z" fill="#FFFFFF" />
              <path d="M8 4V9.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
            </svg>
          )}
          <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>
            {toast.msg}
          </span>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function SubjectPage({ projectId, projectName = '两只老虎的奇遇', onBack, onUnlockStep, onStartStoryboard, onExtractSubjects, extractError = null, isStoryboardGenerated = false, initialTab = 'char', projectRatio, chars: externalChars, onCharsChange, scenes: externalScenes, onScenesChange, props: externalProps, onPropsChange, onLoadMoreChars, onLoadMoreScenes, onLoadMoreProps, hasMoreChars = false, hasMoreScenes = false, hasMoreProps = false }) {

  const [activeTab, setActiveTab] = useState(initialTab);
  const [batchGenOpen, setBatchGenOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const extractingRef = useRef(false);
  const subjectListRef = useRef(null);
  const subjectSentinelRef = useRef(null);

  // 仅从剧本页「开始提取主体」触发（Home.jsx 传入 onExtractSubjects 回调），
  // 浏览器刷新 / tab 切换等场景不触发提取
  useEffect(() => {
    if (!onExtractSubjects) return;
    if (extractingRef.current) return;
    extractingRef.current = true;
    setIsExtracting(true);
    onExtractSubjects().finally(() => {
      setIsExtracting(false);
      extractingRef.current = false;
    });
  }, [onExtractSubjects]);

  // 循环 loading 文案
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingTexts = ['正在抽取剧本灵魂', '正在抽取剧本主角', '正在抽取剧本配角', '正在抽取场景', '正在抽取道具'];

  useEffect(() => {
    if (!isExtracting) return;
    const timer = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % loadingTexts.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [isExtracting]);

  const [batchGeneratingByTab, setBatchGeneratingByTab] = useState({});
  const [batchToast, setBatchToast] = useState(null);
  const batchToastTimerRef = useRef(null);
  // 批量生成加载状态：{ [subjectId]: true }
  const [batchLoadingSubjects, setBatchLoadingSubjects] = useState({});
  // 批量生成前的封面 URL 快照
  const prevCoverUrlsRef = useRef({});
  // 批量生成 AbortController，组件卸载时取消
  const batchAbortRef = useRef(null);

  function showBatchToast(msg, type = 'success') {
    if (batchToastTimerRef.current) clearTimeout(batchToastTimerRef.current);
    setBatchToast({ msg, type });
    batchToastTimerRef.current = setTimeout(() => setBatchToast(null), 3000);
  }

  // 归一化后端返回的主体数据（对齐 Home.jsx 的 normalizeSubjects）
  function normalizeSubjectList(items) {
    const list = (items || []).map(item => ({
      ...item,
      desc: item.description ?? item.desc ?? '',
      imageUrl: normalizeImageUrl(item.primary_image_url ?? item.image_url ?? item.imageUrl),
    }));
    list.sort((a, b) => {
      const timeA = a.created_at || a.createdAt || a.create_time || '';
      const timeB = b.created_at || b.createdAt || b.create_time || '';
      if (timeA && timeB) return timeA.localeCompare(timeB);
      return (a.name || '').localeCompare(b.name || '');
    });
    return list;
  }

  const handleBatchGenerate = async (params) => {
    // 收集当前 tab 下的主体 ID 列表
    const currentSubjects = activeTab === 'char' ? chars : activeTab === 'scene' ? scenes : props;
    const subjectIds = (currentSubjects || []).map(s => s.id).filter(Boolean);
    if (subjectIds.length === 0) {
      showBatchToast('当前没有可生成的主体', 'error');
      return;
    }

    // 防止重复触发（已有加载中的主体）
    if (Object.keys(batchLoadingSubjects).length > 0) {
      showBatchToast('批量生成进行中，请等待当前任务完成', 'error');
      return;
    }

    // 关闭弹窗
    setBatchGenOpen(false);

    // 保存当前 tab 引用（stream 期间 tab 不会变）
    const captureTab = activeTab;
    // 根据 tab 确定 setter 函数
    const targetSetter =
      captureTab === 'char' ? setChars :
      captureTab === 'scene' ? setScenes :
      setProps;

    // 快照当前所有封面 URL
    prevCoverUrlsRef.current = {};
    (currentSubjects || []).forEach(s => {
      prevCoverUrlsRef.current[s.id] = s.imageUrl;
    });

    // 所有卡片进入 loading 状态
    const loadingMap = {};
    subjectIds.forEach(id => { loadingMap[id] = true; });
    setBatchLoadingSubjects(loadingMap);

    setBatchGeneratingByTab(prev => ({ ...prev, [captureTab]: true }));

    // 创建 AbortController，用于组件卸载时取消
    const controller = new AbortController();
    batchAbortRef.current = controller;

    // 统计成功/失败数
    let successCount = 0;
    let failCount = 0;

    try {
      await apiBatchGenerateStream(projectId, { model: params.model, ratio: params.ratio, resolution: params.resolution, generation_mode: params.mode, subject_ids: subjectIds }, {
        signal: controller.signal,
        onSubjectImage: (subjectId, imageUrl) => {
          successCount++;
          const fullUrl = normalizeImageUrl(imageUrl);
          // 更新对应 tab 的主体封面
          targetSetter(prev => prev.map(s =>
            s.id === subjectId ? { ...s, imageUrl: fullUrl } : s
          ));
          // 该主体退出 loading
          setBatchLoadingSubjects(prev => {
            const next = { ...prev };
            delete next[subjectId];
            return next;
          });
        },
        onSubjectError: (subjectId, errorMsg) => {
          failCount++;
          console.error(`[SubjectPage] 主体 ${subjectId} 批量生成失败:`, errorMsg);
          // Toast 提示单个失败
          const sub = (currentSubjects || []).find(s => s.id === subjectId);
          const label = sub?.name || subjectId;
          showBatchToast(`「${label}」生成失败: ${errorMsg || '未知错误'}`, 'error');
          // 该主体退出 loading（封面恢复为之前的图片或占位图）
          setBatchLoadingSubjects(prev => {
            const next = { ...prev };
            delete next[subjectId];
            return next;
          });
        },
       onComplete: () => {
         if (successCount > 0) {
           showBatchToast(successCount === subjectIds.length
             ? '批量生成全部完成'
             : `批量生成完成（成功 ${successCount}，失败 ${failCount}）`, 'success');
         }
          else if (failCount > 0) {
            showBatchToast('批量生成失败，可能是调用服务商模型失败了，请换个模型再试下', 'error');
          }
          else {
            showBatchToast('批量生成失败，未能接收到任何结果', 'error');
          }
       },
      });
    } catch (err) {
      // 忽略用户主动取消的错误
      if (err?.name === 'AbortError') return;

      console.error('[SubjectPage] 批量生成流失败:', err);
      // 网络断开或整体请求失败 — toast 后统一恢复
      const errMsg = err?.isNetworkError
        ? '网络连接失败，请检查网络后重试'
        : (err?.message || '批量生成失败，请重试');
      showBatchToast(errMsg, 'error');

      // 生图失败后重新从后端获取主体数据，恢复真实封面
      try {
        const _spAvailW = window.innerWidth - 48;
        const _spAvailH = window.innerHeight - 60 - 48;
        const _spCols = Math.max(1, Math.floor((_spAvailW + 16) / (200 + 16)));
        const _spRows = Math.max(1, Math.ceil(_spAvailH / (246 + 16))) + 1;
        const _spLimit = _spCols * _spRows;
        const [newChars, newScenes, newProps] = await Promise.all([
          apiGetSubjects(projectId, { type: 'character', limit: _spLimit }),
          apiGetSubjects(projectId, { type: 'scene', limit: _spLimit }),
          apiGetSubjects(projectId, { type: 'prop', limit: _spLimit }),
        ]);
        setChars(normalizeSubjectList(newChars));
        setScenes(normalizeSubjectList(newScenes));
        setProps(normalizeSubjectList(newProps));
      } catch (refetchErr) {
        console.error('[SubjectPage] 失败后刷新主体数据也失败:', refetchErr);
      }

      // 整体失败时，所有卡片的 loading 都会由于 finally 清除而消失，
      // 封面自然恢复为之前的图片（因为我们没有修改过 imageUrl）
    } finally {
      // 清空所有 loading 状态
      setBatchLoadingSubjects({});
      setBatchGeneratingByTab(prev => { const next = { ...prev }; delete next[captureTab]; return next; });
      batchAbortRef.current = null;
    }
  };

  const [confirmStoryboardOpen, setConfirmStoryboardOpen] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedProp, setSelectedProp] = useState(null);
  const [subjectDetailRefreshToken, setSubjectDetailRefreshToken] = useState(0);
  const [voiceModalChar, setVoiceModalChar] = useState(null);
  const [voiceList, setVoiceList] = useState([]);
  const [internalChars, setInternalChars] = useState(INITIAL_CHARS);
  const chars = (externalChars !== undefined && externalChars !== null) ? externalChars : internalChars;
  const hasExternalChars = externalChars !== undefined && externalChars !== null;
  function setChars(updater) {
    if (typeof updater === 'function') {
      if (hasExternalChars) {
        onCharsChange?.(updater);
      } else {
        setInternalChars(prev => {
          const next = updater(prev);
          onCharsChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalChars) {
        onCharsChange?.(updater);
      } else {
        setInternalChars(updater);
        onCharsChange?.(updater);
      }
    }
  }
  const [internalScenes, setInternalScenes] = useState([]);
  const scenes = (externalScenes !== undefined && externalScenes !== null) ? externalScenes : internalScenes;
  const hasExternalScenes = externalScenes !== undefined && externalScenes !== null;
  function setScenes(updater) {
    if (typeof updater === 'function') {
      if (hasExternalScenes) {
        onScenesChange?.(updater);
      } else {
        setInternalScenes(prev => {
          const next = updater(prev);
          onScenesChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalScenes) {
        onScenesChange?.(updater);
      } else {
        setInternalScenes(updater);
        onScenesChange?.(updater);
      }
    }
  }
  const [internalProps, setInternalProps] = useState([]);
  const props = (externalProps !== undefined && externalProps !== null) ? externalProps : internalProps;
  const hasExternalProps = externalProps !== undefined && externalProps !== null;
  function setProps(updater) {
    if (typeof updater === 'function') {
      if (hasExternalProps) {
        onPropsChange?.(updater);
      } else {
        setInternalProps(prev => {
          const next = updater(prev);
          onPropsChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalProps) {
        onPropsChange?.(updater);
      } else {
        setInternalProps(updater);
        onPropsChange?.(updater);
      }
    }
  }
  const [charVoices, setCharVoices] = useState(() =>
    Object.fromEntries(INITIAL_CHARS.map((c) => [c.id, c.voice]))
  );

  // 从后端数据同步 voice_id 到本地 charVoices（仅当本地无记录时）
  useEffect(() => {
    if (!externalChars || externalChars.length === 0) return;
    setCharVoices((prev) => {
      const next = { ...prev };
      let changed = false;
      externalChars.forEach((c) => {
        if (c.voice_id && prev[c.id] === undefined) {
          next[c.id] = c.voice_id;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [externalChars]);

  useEffect(() => {
    apiGetVoices({ tab: 'all' }).then((data) => {
      const list = Array.isArray(data) ? data : data?.items ?? data?.voices ?? [];
      setVoiceList(list);
    }).catch(() => {});
  }, []);

  // 组件卸载时取消进行中的批量生成流
  useEffect(() => {
    return () => {
      batchAbortRef.current?.abort();
    };
  }, []);

  // 初始化时把内部默认数据同步给父组件（仅当父组件尚未持有数据时）
  useEffect(() => {
    if (externalChars === null || externalChars === undefined) onCharsChange?.(INITIAL_CHARS);
    if (externalScenes === null || externalScenes === undefined) onScenesChange?.([]);
    if (externalProps === null || externalProps === undefined) onPropsChange?.([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 订阅主体数据后台更新（角色、场景、道具）
  useEffect(() => {
    if (!projectId) return;

    const unsubscribers = [];

    // 订阅角色缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'character'), (data) => {
      if (Array.isArray(data)) {
        const normalized = normalizeSubjectList(data);
        setChars(normalized);
      }
    }));

    // 订阅场景缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'scene'), (data) => {
      if (Array.isArray(data)) {
        const normalized = normalizeSubjectList(data);
        setScenes(normalized);
      }
    }));

    // 订阅道具缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'prop'), (data) => {
      if (Array.isArray(data)) {
        const normalized = normalizeSubjectList(data);
        setProps(normalized);
      }
    }));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [projectId]);

  // 监听资产库删除事件，刷新已打开的主体详情弹窗
  useEffect(() => {
    function handleAssetsDeleted(e) {
      if (e.detail?.projectId && e.detail.projectId !== projectId) return;
      setSubjectDetailRefreshToken(t => t + 1);
    }
    window.addEventListener('project-assets:deleted', handleAssetsDeleted);
    return () => window.removeEventListener('project-assets:deleted', handleAssetsDeleted);
  }, [projectId]);

  const counts = {
    char: chars.length,
    scene: scenes.length,
    prop: props.length,
  };

  const handleAdd = async () => {
    const type = activeTab; // 'char' | 'scene' | 'prop'
    const typeMap = { char: 'character', scene: 'scene', prop: 'prop' };
    const labelMap = { char: '角色', scene: '场景', prop: '道具' };
    const actualType = typeMap[type];
    const labelPrefix = labelMap[type];
    const num = counts[type] + 1;
    const defaultName = `${labelPrefix}${String(num).padStart(3, '0')}`;
    const defaultDesc = '自定义描述';

    const { id } = await apiCreateSubject(projectId, { type: actualType, name: defaultName, description: defaultDesc });
    if (activeTab === 'char') {
      setChars((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null, voice: null }]);
    } else if (activeTab === 'scene') {
      setScenes((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null }]);
    } else if (activeTab === 'prop') {
      setProps((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null }]);
    }
  };

  // ── 下载主体封面图 ────────────────────────────────────────────
  const handleDownloadSubjectImage = async (subjectId) => {
    try {
      // 获取主体图片列表，找到主图
      const imgRes = await apiGetSubjectImages(projectId, subjectId);
      const imgs = Array.isArray(imgRes) ? imgRes : (imgRes?.images || imgRes?.items || []);
      const primaryImg = imgs.find((img) => img.is_primary);
      const targetImg = primaryImg || imgs[0];
      if (!targetImg?.id) {
        console.warn('[SubjectPage] 没有可下载的图片');
        return;
      }
      // 调用下载 API
      const blob = await apiDownloadSubjectImage(projectId, subjectId, targetImg.id);
      triggerBlobDownload(blob, `subject-${subjectId}.jpg`);
    } catch (err) {
      console.error('[SubjectPage] 下载图片失败:', err);
    }
  };

  // ── 删除主体 ──────────────────────────────────────────────────
  const handleDeleteSubject = async (subjectId) => {
    try {
      await apiDeleteSubject(projectId, subjectId);
      setChars((prev) => prev.filter((c) => c.id !== subjectId));
      setScenes((prev) => prev.filter((s) => s.id !== subjectId));
      setProps((prev) => prev.filter((p) => p.id !== subjectId));
      setSelectedChar(null);
      setSelectedScene(null);
      setSelectedProp(null);
    } catch (err) {
      console.error('[SubjectPage] 删除主体失败:', err);
    }
  };

  useEffect(() => {
    if (chars.length > 0) onUnlockStep?.('subject');
  }, [chars.length]);

  // 滚动触底加载更多主体
  useEffect(() => {
    if (!subjectSentinelRef.current || !subjectListRef.current) return;
    const loadMore = () => {
      if (activeTab === 'char') onLoadMoreChars?.();
      else if (activeTab === 'scene') onLoadMoreScenes?.();
      else if (activeTab === 'prop') onLoadMoreProps?.();
    };
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { root: subjectListRef.current, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(subjectSentinelRef.current);
    return () => observer.disconnect();
  }, [activeTab, onLoadMoreChars, onLoadMoreScenes, onLoadMoreProps]);

  // 开始智能分镜：跳转到分镜页（由 Home 处理解锁和导航）
  const handleStartStoryboardRequest = () => {
    if (isStoryboardGenerated) {
      setConfirmStoryboardOpen(true);
      return;
    }
    onStartStoryboard?.();
  };

  // 判断是否显示 loading / 错误态
  const allEmpty = (!externalChars || externalChars.length === 0) && (!externalScenes || externalScenes.length === 0) && (!externalProps || externalProps.length === 0);
  const showLoading = isExtracting;
  const showError = !!extractError && allEmpty;

  if (showLoading) {
    return (
      <div
        style={{
          position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px',
          backgroundColor: '#161616', borderRadius: '16px',
          border: '1px solid #FFFFFF14',
        }}
      >
        <DotsLoading size={4} color="#2DC3E1" gap={4} />
        <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '12px', color: '#FFFFFF99' }}>
          {loadingTexts[loadingTextIndex]}
        </span>
      </div>
    );
  }

  if (showError) {
    return (
      <div
        style={{
          position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '24px',
          backgroundColor: '#161616', borderRadius: '16px',
          border: '1px solid #FFFFFF14',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="16" cy="16" r="15" stroke="#FFFFFF66" strokeWidth="1.5" />
          <circle cx="10" cy="13" r="2" fill="#FFFFFF66" />
          <circle cx="22" cy="13" r="2" fill="#FFFFFF66" />
          <path d="M10 23 Q16 19 22 23" stroke="#FFFFFF66" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '14px', color: '#FFFFFF99' }}>
          糟糕，提取主体失败了，待会儿再试试吧！
        </span>
        <button
          type="button"
          onClick={() => {
            setIsExtracting(true);
            onExtractSubjects?.().finally(() => setIsExtracting(false));
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '36px', borderRadius: '8px', paddingInline: '16px',
            backgroundColor: '#2DC3E1', border: '1px solid #FFFFFF33',
            cursor: 'pointer', outline: '1px solid #00000080',
            fontFamily: "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif",
            fontSize: '14px', lineHeight: '18px', color: '#090909',
          }}
        >
          重新提取主体
        </button>
      </div>
    );
  }

  return (
    <div
      className="bg-neutral-200 rounded-[16px] border border-solid border-[#FFFFFF14] overflow-hidden"
      style={{
        position: 'absolute',
        inset: 0,
        marginBottom: '24px',
        marginRight: '32px',
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Toolbar
        projectName={projectName}
        onBack={onBack}
        addLabel={`添加${TABS.find((t) => t.key === activeTab)?.label ?? '主体'}`}
        onAddChar={handleAdd}
        onBatchGen={() => setBatchGenOpen(true)}
        onStartStoryboard={handleStartStoryboardRequest}
        tabLabel={TABS.find((t) => t.key === activeTab)?.label ?? '主体'}
      />

      <TabNav
        activeTab={activeTab}
        counts={counts}
        onChange={(tab) => {
          setActiveTab(tab);
          setSelectedChar(null);
          setSelectedScene(null);
          setSelectedProp(null);
        }}
      />

      {/* card grid */}
      <div
        ref={subjectListRef}
        className="flex-1 self-stretch overflow-auto min-h-0"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', alignContent: 'flex-start', padding: '16px 2px 2px 2px' }}
      >
        {activeTab === 'char' && chars.map((char) => (
          <CharCard
            key={char.id}
            name={char.name}
            desc={char.desc}
            imageUrl={char.imageUrl}
            voice={charVoices[char.id]}
            voiceName={(() => { const v = voiceList.find(x => x.voice_id === charVoices[char.id]); return v ? v.name : undefined; })()}
            voicePreviewUrl={voiceList.find((v) => v.voice_id === charVoices[char.id])?.preview_url}
            onVoiceClick={() => setVoiceModalChar(char)}
            onClick={() => setSelectedChar(char)}
            onDownloadImage={() => handleDownloadSubjectImage(char.id)}
            onDeleteSubject={() => handleDeleteSubject(char.id)}
            loading={!!batchLoadingSubjects[char.id]}
            selected={selectedChar?.id === char.id}
          />
        ))}
        {activeTab === 'char' && <AddCard onClick={handleAdd} />}
        {activeTab === 'scene' && scenes.map((scene) => (
          <CharCard
            key={scene.id}
            name={scene.name}
            desc={scene.desc}
            imageUrl={scene.imageUrl}
            placeholderImg={scenePlaceholderImg}
            onClick={() => setSelectedScene(scene)}
            onDownloadImage={() => handleDownloadSubjectImage(scene.id)}
            onDeleteSubject={() => handleDeleteSubject(scene.id)}
            loading={!!batchLoadingSubjects[scene.id]}
            selected={selectedScene?.id === scene.id}
          />
        ))}
        {activeTab === 'scene' && <AddCard onClick={handleAdd} />}
        {activeTab === 'prop' && props.map((prop) => (
          <CharCard
            key={prop.id}
            name={prop.name}
            desc={prop.desc}
            imageUrl={prop.imageUrl}
            placeholderImg={propPlaceholderImg}
            onClick={() => setSelectedProp(prop)}
            onDownloadImage={() => handleDownloadSubjectImage(prop.id)}
            onDeleteSubject={() => handleDeleteSubject(prop.id)}
            loading={!!batchLoadingSubjects[prop.id]}
            selected={selectedProp?.id === prop.id}
          />
        ))}
        {activeTab === 'prop' && <AddCard onClick={handleAdd} />}
        {/* 滚动加载哨兵 */}
        <div ref={subjectSentinelRef} style={{ gridColumn: '1 / -1', height: '1px' }} />
        {((activeTab === 'char' && hasMoreChars) || (activeTab === 'scene' && hasMoreScenes) || (activeTab === 'prop' && hasMoreProps)) && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: '13px', color: '#FFFFFF40', fontFamily: "'AlibabaPuHuiTi_2_55_Regular',system-ui,sans-serif" }}>加载中…</span>
          </div>
        )}
      </div>

      {/* edit panel */}
      {selectedChar && (
        <EditSubjectPanel
          key={selectedChar.id}
          projectId={projectId}
          projectRatio={projectRatio}
          char={selectedChar}
          tabLabel="角色"
          refreshToken={subjectDetailRefreshToken}
          setBatchLoadingSubjects={setBatchLoadingSubjects}
          onClose={() => setSelectedChar(null)}
          onCommit={(name, desc) => {
            setChars((prev) => prev.map((c) => c.id === selectedChar.id ? { ...c, name, desc } : c));
            setSelectedChar((prev) => ({ ...prev, name, desc }));
            apiUpdateSubject(projectId, selectedChar.id, { name, description: desc });
          }}
          onCoverChange={(imageUrl) => {
            // imageUrl: 原始相对路径，用于 API；同时存储完整 URL 用于卡片展示
            const fullUrl = normalizeImageUrl(imageUrl);
            setChars((prev) => prev.map((c) => c.id === selectedChar.id ? { ...c, imageUrl: fullUrl } : c));
            apiUpdateSubject(projectId, selectedChar.id, { image_url: imageUrl });
          }}
        />
      )}
      {selectedScene && (
        <EditSubjectPanel
          key={selectedScene.id}
          projectId={projectId}
          projectRatio={projectRatio}
          char={selectedScene}
          tabLabel="场景"
          refreshToken={subjectDetailRefreshToken}
          setBatchLoadingSubjects={setBatchLoadingSubjects}
          onClose={() => setSelectedScene(null)}
          onCommit={(name, desc) => {
            setScenes((prev) => prev.map((s) => s.id === selectedScene.id ? { ...s, name, desc } : s));
            setSelectedScene((prev) => ({ ...prev, name, desc }));
            apiUpdateSubject(projectId, selectedScene.id, { name, description: desc });
          }}
          onCoverChange={(imageUrl) => {
            const fullUrl = normalizeImageUrl(imageUrl);
            setScenes((prev) => prev.map((s) => s.id === selectedScene.id ? { ...s, imageUrl: fullUrl } : s));
            apiUpdateSubject(projectId, selectedScene.id, { image_url: imageUrl });
          }}
        />
      )}
      {selectedProp && (
        <EditSubjectPanel
          key={selectedProp.id}
          projectId={projectId}
          projectRatio={projectRatio}
          char={selectedProp}
          tabLabel="道具"
          refreshToken={subjectDetailRefreshToken}
          setBatchLoadingSubjects={setBatchLoadingSubjects}
          onClose={() => setSelectedProp(null)}
          onCommit={(name, desc) => {
            setProps((prev) => prev.map((p) => p.id === selectedProp.id ? { ...p, name, desc } : p));
            setSelectedProp((prev) => ({ ...prev, name, desc }));
            apiUpdateSubject(projectId, selectedProp.id, { name, description: desc });
          }}
          onCoverChange={(imageUrl) => {
            const fullUrl = normalizeImageUrl(imageUrl);
            setProps((prev) => prev.map((p) => p.id === selectedProp.id ? { ...p, imageUrl: fullUrl } : p));
            apiUpdateSubject(projectId, selectedProp.id, { image_url: imageUrl });
          }}
        />
      )}

      {/* voice select modal */}
      {voiceModalChar && (
        <VoiceSelectModal preloadedVoices={voiceList}
          open
          currentVoice={charVoices[voiceModalChar.id]}
          onClose={() => setVoiceModalChar(null)}
          onVoicesLoaded={setVoiceList}
          onConfirm={async (voiceId) => {
            const normalizedVoiceId = voiceId || null;
            try {
              await apiUpdateSubject(projectId, voiceModalChar.id, { voice_id: normalizedVoiceId });
              setCharVoices((prev) => ({ ...prev, [voiceModalChar.id]: normalizedVoiceId }));
              setVoiceModalChar(null);
              showBatchToast('音色保存成功', 'success');
            } catch (err) {
              console.error('[SubjectPage] 更新主体音色失败:', err);
              showBatchToast(err?.message || '音色保存失败，请重试', 'error');
            }
          }}
        />
      )}

      <BatchGenerateModal
        projectRatio={projectRatio}
        open={batchGenOpen}
        onClose={() => { if (!batchGeneratingByTab[activeTab]) setBatchGenOpen(false); }}
        onConfirm={handleBatchGenerate}
        generating={!!batchGeneratingByTab[activeTab]}
        activeTab={activeTab}
      />

      {confirmStoryboardOpen && (
        <ConfirmStoryboardModal
          onConfirm={() => {
            setConfirmStoryboardOpen(false);
            onStartStoryboard?.();
          }}
          onCancel={() => setConfirmStoryboardOpen(false)}
        />
      )}

      {/* 批量生成 toast */}
      {batchToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
          <div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]" style={{ whiteSpace: 'nowrap' }}>
            {batchToast.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
                <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {batchToast.type === 'warning' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#EB8B14" stroke="#EB8B14" strokeWidth="1.333" strokeLinejoin="round" />
                <path fillRule="evenodd" clipRule="evenodd" d="M8 12.333C8.46 12.333 8.833 11.96 8.833 11.5C8.833 11.04 8.46 10.667 8 10.667C7.54 10.667 7.167 11.04 7.167 11.5C7.167 11.96 7.54 12.333 8 12.333Z" fill="#FFFFFF" />
                <path d="M8 4V9.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {batchToast.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round" />
                <path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
              </svg>
            )}
            <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>
              {batchToast.msg}
            </span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
