/**
 * @file SubjectVoiceSelectModal.jsx
 * @structure-index
 *
 * ─── 状态层 ────────────────────────────────────────────────────────
 *   voices / loading / selected / gender / age                    L139–L143
 *   fetchedRef                                                     L144
 *
 * ─── 组件结构 ─────────────────────────────────────────────────────
 *   CloseIcon / HeadphoneIcon / PlayingWaveIcon                    L41 / L50 / L59
 *   VoiceCard                                                       L80
 *   SubjectVoiceSelectModal                                        L138
 *     ├─ 标题与关闭动作
 *     ├─ 性别、年龄筛选（复用 components/ui/Select）
 *     ├─ 音色加载态、空态和四列网格
 *     └─ 取消、确认动作
 *
 * ─── 数据流与副作用 ───────────────────────────────────────────────
 *   打开弹窗时加载中文音色库，并通过 onVoicesLoaded 通知页面       L146+
 *   音色卡片内部负责试听音频的创建、停止和卸载清理               L84+
 *   页面负责主体音色保存 API、主体列表状态和 Toast
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   允许引用主体业务 API 和通用 UI
 *   不读取页面、Store，不直接保存主体或处理业务 Toast
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体音色选择弹窗
 *   2026-07-15  性别、年龄筛选器复用 components/ui/Select
 *   2026-07-31  音色卡片支持再次点击取消选择
 *   2026-07-31  增加音色卡片悬停态，无预览链接的音色不可选择
 *   2026-07-31  按系统音色库分页契约加载完整列表，兼容 zh-CN 和缺失语言字段
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import DotsLoading from '../DotsLoading';
import { Button, IconButton, Select } from '../ui';
import { apiGetVoiceLibrary } from '../../api/voices';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const GENDER_OPTIONS = ['不限', '男', '女'];
const AGE_OPTIONS = ['不限', '幼年', '青年', '中年', '老年'];

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2.667 2.667L13.333 13.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeadphoneIcon({ color = '#2DC3E1' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M3.333 12V8C3.333 5.423 5.423 3.333 8 3.333C10.577 3.333 12.667 5.423 12.667 8V12M3.333 8.667H2C1.632 8.667 1.333 8.965 1.333 9.333V12C1.333 12.368 1.632 12.667 2 12.667H3.333V8.667ZM12.667 8.667H14C14.368 8.667 14.667 8.965 14.667 9.333V12C14.667 12.368 14.368 12.667 14 12.667H12.667V8.667Z" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 10.667H6.667L7.333 8.667L8.667 12.667L9.333 10.667H10.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayingWaveIcon({ color = '#2DC3E1', size = 16 }) {
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flexShrink: 0 }} aria-hidden="true">
      {[
        { anim: 'voice-bar-1 0.8s ease-in-out infinite', h: 4 },
        { anim: 'voice-bar-2 0.8s ease-in-out infinite 0.15s', h: 8 },
        { anim: 'voice-bar-3 0.8s ease-in-out infinite 0.3s', h: 5 },
        { anim: 'voice-bar-4 0.8s ease-in-out infinite 0.45s', h: 10 },
      ].map((bar, index) => (
        <div
          key={index}
          style={{
            width: '2px', height: `${bar.h}px`, borderRadius: '1px',
            backgroundColor: color, animation: bar.anim,
          }}
        />
      ))}
    </div>
  );
}

function VoiceCard({ label, active, onClick, previewUrl }) {
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const audioRef = useRef(null);
  const selectable = Boolean(previewUrl);

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  function handlePlay(event) {
    event.stopPropagation();
    if (!previewUrl) return;
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }

    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    audio.play().catch(() => setPlaying(false));
    audio.onended = () => { audioRef.current = null; setPlaying(false); };
    audio.onerror = () => { audioRef.current = null; setPlaying(false); };
    setPlaying(true);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (selectable) onClick?.(); }}
      style={{
        flex: '0 0 23.4%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '6px', borderRadius: '8px', padding: '8px',
        cursor: selectable ? 'pointer' : 'not-allowed',
        opacity: selectable ? 1 : 0.45,
        background: selectable && hovered ? '#252727' : '#1D1E1E',
        border: `1px solid ${active && selectable ? '#2DC3E1' : selectable && hovered ? '#FFFFFF33' : '#FFFFFF14'}`,
        transition: 'background-color 0.12s, border-color 0.12s, opacity 0.12s',
      }}
    >
      <button
        type="button"
        onClick={handlePlay}
        disabled={!previewUrl}
        aria-label={playing ? `停止试听${label}` : `试听${label}`}
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: selectable ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {playing
          ? <PlayingWaveIcon color="#2DC3E1" size={16} />
          : <HeadphoneIcon color={previewUrl ? '#2DC3E1' : '#FFFFFF99'} />}
      </button>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '17px', color: active ? '#2DC3E1' : '#FFFFFF99', textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}

export default function SubjectVoiceSelectModal({ open, onClose, onConfirm, currentVoice, onVoicesLoaded }) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(currentVoice || '');
  const [gender, setGender] = useState('不限');
  const [age, setAge] = useState('不限');
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      fetchedRef.current = false;
      return undefined;
    }
    if (fetchedRef.current) return undefined;

    fetchedRef.current = true;
    setLoading(true);
    apiGetVoiceLibrary({ provider: 'miioo', page: 1, pageSize: 20, skipCache: true })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.list ?? data?.items ?? data?.voices ?? [];
        setVoices(list);
        onVoicesLoaded?.(list);
      })
      .catch(() => setVoices([]))
      .finally(() => setLoading(false));

    return undefined;
  }, [open, onVoicesLoaded]);

  const filteredVoices = useMemo(() => voices.filter((voice) => {
    if (gender !== '不限' && voice.gender !== gender) return false;
    if (age !== '不限' && voice.age_group !== age) return false;
    // 系统音色库部分历史数据没有 language，不能因此把可用音色误过滤掉。
    // 明确标记为其它语言的音色仍不展示在主体中文音色选择器中。
    if (!voice.language) return true;
    const language = String(voice.language).toLowerCase();
    return voice.language === '中文' || language === 'zh' || language.startsWith('zh-') || language.startsWith('zh_');
  }), [voices, gender, age]);

  if (!open) return null;

  const rows = [];
  for (let index = 0; index < filteredVoices.length; index += 4) {
    rows.push(filteredVoices.slice(index, index + 4));
  }

  function handleConfirm() {
    onConfirm?.(selected);
    onClose?.();
  }

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
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#161616', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', flex: 1 }}>
            选择音色
          </span>
          <IconButton
            type="button"
            variant="secondary"
            size="small"
            aria-label="关闭音色选择弹窗"
            icon={<CloseIcon />}
            onClick={onClose}
            className="!size-[28px] !rounded-[6px] !border-0 !bg-transparent !shadow-none hover:!bg-white/10 active:!bg-white/10"
            contentClassName="!text-white/40 hover:!text-white/80"
          />
        </div>

        <div style={{ display: 'flex', gap: '16px', padding: '8px 24px', background: '#161616', flexShrink: 0 }}>
          <div style={{ flex: '0 0 23.4%' }}>
            <Select label="性别" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
          </div>
          <div style={{ flex: '0 0 23.4%' }}>
            <Select label="年龄" value={age} options={AGE_OPTIONS} onChange={setAge} />
          </div>
        </div>

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
          {!loading && rows.map((row, rowIndex) => (
            <div key={rowIndex} style={{ display: 'flex', gap: '14px' }}>
              {row.map((voice) => (
                <VoiceCard
                  key={voice.voice_id}
                  label={voice.name}
                  active={selected === voice.voice_id}
                  onClick={() => setSelected((current) => current === voice.voice_id ? '' : voice.voice_id)}
                  previewUrl={voice.preview_url}
                />
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px', background: '#161616', flexShrink: 0 }}>
          <Button
            variant="secondary"
            size="large"
            onClick={onClose}
            className="!bg-[#161616] !border-[#FFFFFF0D] !text-white/60 hover:!bg-white/10"
          >
            取消
          </Button>
          <Button variant="primary" size="large" onClick={handleConfirm}>
            确认
          </Button>
        </div>
      </div>
    </div>
  );
}
