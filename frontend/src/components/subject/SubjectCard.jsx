/**
 * @file SubjectCard.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectMoreMenu      主体卡片更多操作菜单与删除确认
 *   SubjectCard           角色/场景/道具主体卡片及角色音色试听
 *   AddSubjectCard        主体列表新增卡片
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅依赖主体域展示所需的 DotsLoading、ConfirmDialog 和基础 IconButton
 *   不引用页面、业务 API、Store 或路由；下载、删除、音色选择通过回调交给页面
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体卡片、更多菜单和新增卡片
 *   2026-07-31  音色文本悬停时显示关闭按钮，支持直接清除已添加音色
 */
import { useEffect, useRef, useState } from 'react';
import DotsLoading from '../DotsLoading';
import ConfirmDialog from '../ConfirmDialog';
import { IconButton } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 5C8.552 5 9 4.552 9 4C9 3.448 8.552 3 8 3C7.448 3 7 3.448 7 4C7 4.552 7.448 5 8 5Z" fill="#FFFFFF" />
      <path d="M8 9C8.552 9 9 8.552 9 8C9 7.448 8.552 7 8 7C7.448 7 7 7.448 7 8C7 8.552 7.448 9 8 9Z" fill="#FFFFFF" />
      <path d="M8 12.667C8.552 12.667 9 12.219 9 11.667C9 11.114 8.552 10.667 8 10.667C7.448 10.667 7 11.114 7 11.667C7 12.219 7.448 12.667 8 12.667Z" fill="#FFFFFF" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M2.667 11.333V13.333H13.333V11.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2.667V10.667" stroke="currentColor" strokeLinecap="round" />
      <path d="M5 7.667L8 10.667L11 7.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M3 3.333V14.667H13V3.333H3Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M6.667 6.667V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.333 6.667V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.333 3.333H14.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="currentColor" strokeLinejoin="round" />
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

function CloseIcon({ color = '#FFFFFFCC' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3.333 3.333L12.667 12.667M12.667 3.333L3.333 12.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayingWaveIcon({ color = '#2DC3E1', size = 16 }) {
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flexShrink: 0 }} aria-hidden="true">
      {[4, 8, 5, 10].map((height, index) => (
        <div key={height} style={{ width: '2px', height: `${height}px`, borderRadius: '1px', backgroundColor: color, animation: `voice-bar-${index + 1} 0.8s ease-in-out infinite ${index * 0.15}s` }} />
      ))}
    </div>
  );
}

function SubjectMoreMenu({ onDownload, onDelete }) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const items = [
    { label: '下载', icon: <DownloadIcon />, action: () => { onDownload?.(); setOpen(false); } },
    { label: '删除', icon: <DeleteIcon />, danger: true, action: () => { setOpen(false); setShowConfirm(true); } },
  ];

  return (
    <>
      <div ref={menuRef} style={{ position: 'relative' }}>
        <IconButton
          type="button"
          size="small"
          variant="secondary"
          icon={<MoreIcon />}
          aria-label="主体更多操作"
          className="!h-[24px] !w-[24px] !rounded-[6px] !border-0 !p-[0px] !shadow-none"
          style={{ backgroundColor: open ? 'rgba(0,0,0,0.75)' : '#00000080', transition: 'background-color 0.12s' }}
          onMouseEnter={(event) => { if (!open) event.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
          onMouseLeave={(event) => { if (!open) event.currentTarget.style.backgroundColor = '#00000080'; }}
          onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
        />
        {open && (
          <div className="absolute z-50 flex flex-col rounded-medium bg-select-bg border border-select-border" style={{ top: 'calc(100% + 4px)', right: 0, minWidth: '100px', padding: '4px', boxShadow: '0px 4px 16px var(--color-select-shadow)' }}>
            {items.map((item, index) => (
              <button
                key={item.label}
                type="button"
                className="flex items-center gap-[4px] px-[12px] rounded-md shrink-0 cursor-pointer border-0 text-left"
                style={{ height: '36px', color: item.danger ? (hoveredIndex === index ? '#F75F5F' : '#FF7A7A99') : (hoveredIndex === index ? 'var(--color-select-item-text-hover)' : 'var(--color-select-item-text-normal)'), backgroundColor: hoveredIndex === index ? 'var(--color-select-item-bg-hover)' : 'transparent', transition: 'background-color 0.1s, color 0.1s' }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={(event) => { event.stopPropagation(); item.action(); }}
              >
                {item.icon}
                <span className="w-fit shrink-0 text-font-size-14 font-font-weight-regular" style={{ fontFamily: FONT }}>{item.label}</span>
              </button>
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

export function SubjectCard({ name, desc, imageUrl, voice, voiceName, voicePreviewUrl, onVoiceClick, onVoiceRemove, onClick, onDownloadImage, onDeleteSubject, loading = false, selected = false, emptyIcon }) {
  const [hovered, setHovered] = useState(false);
  const [voiceHovered, setVoiceHovered] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const voiceAudioRef = useRef(null);

  const handleVoicePlay = (event) => {
    event.stopPropagation();
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
      return;
    }
    setVoicePlaying(true);
    setTimeout(() => setVoicePlaying(false), 1500);
  };

  return (
    <div className="[font-synthesis:none] flex flex-col rounded-xl overflow-clip relative bg-[#1A1A1A] antialiased cursor-pointer" style={{ aspectRatio: '200/246', outline: selected ? '1px solid rgba(45,195,225,0.6)' : hovered ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)', transition: 'outline-color 0.15s' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onClick}>
      <div className="self-stretch relative shrink-0" style={{ flex: '1', background: imageUrl ? `url(${imageUrl}) 50% / cover no-repeat` : '#0D0D0D' }}>
        {!imageUrl && emptyIcon && <div className="absolute inset-0 flex items-center justify-center">{emptyIcon}</div>}
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)', paddingBottom: '10%' }}><DotsLoading size={6} color="#2DC3E1" gap={4} /></div>}
        <div className="absolute flex gap-[4px]" style={{ top: '8px', right: '8px', opacity: hovered && !loading ? 1 : 0, transition: 'opacity 0.15s' }} onClick={(event) => event.stopPropagation()}>
          <SubjectMoreMenu onDownload={onDownloadImage} onDelete={onDeleteSubject} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 self-stretch shrink-0 bg-[#1A1A1A] p-3">
        <div className="inline-block font-medium text-[#FFFFFFE6] text-sm/5 truncate max-w-full" style={{ fontFamily: FONT_MEDIUM, height: '20px' }}>{name}</div>
        <div className="text-[#FFFFFF66] line-clamp-2" style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '17px', flex: '0 1 auto', height: '34px' }}>{desc}</div>
        {onVoiceClick !== undefined && (
          <div
            className="flex items-center justify-between"
            style={{ gap: '6px' }}
            onMouseEnter={() => setVoiceHovered(true)}
            onMouseLeave={() => setVoiceHovered(false)}
            onClick={(event) => { event.stopPropagation(); onVoiceClick?.(); }}
          >
            <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '17px', color: '#FFFFFFCC', flexShrink: 0 }}>选择音色：</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button type="button" onClick={(event) => { event.stopPropagation(); onVoiceClick?.(); }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT, fontSize: '12px', lineHeight: '17px', color: voice ? '#2DC3E1' : '#FFFFFFCC' }}>{voiceName || voice || '未选择'}</button>
              <button type="button" title={!voice ? '请先选择音色' : '试听'} disabled={!voice} onClick={handleVoicePlay} style={{ background: 'transparent', border: 'none', padding: 0, cursor: voice ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {voicePlaying ? <PlayingWaveIcon color="#2DC3E1" size={16} /> : <HeadphoneIcon color={voice ? '#2DC3E1' : '#FFFFFF66'} />}
              </button>
              {voice && (
                <button
                  type="button"
                  aria-label="取消已添加音色"
                  title="取消音色"
                  onClick={(event) => { event.stopPropagation(); onVoiceRemove?.(); }}
                  style={{
                    width: voiceHovered ? '14px' : '0px',
                    opacity: voiceHovered ? 1 : 0,
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'width 0.15s ease, opacity 0.12s ease',
                  }}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AddSubjectCard({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="[font-synthesis:none] flex flex-col items-center justify-center rounded-xl cursor-pointer border border-dashed" style={{ aspectRatio: '200/246', borderColor: hovered ? '#FFFFFF40' : '#FFFFFF26', backgroundColor: hovered ? '#FFFFFF05' : 'transparent', gap: '6px', transition: 'border-color 0.15s, background-color 0.15s' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true"><path d="M10 4V16M4 10H16" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 0.15s' }} /></svg>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: hovered ? '#FFFFFF66' : '#FFFFFF33', transition: 'color 0.15s' }}>新增</span>
    </div>
  );
}

export default SubjectCard;
