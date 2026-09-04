/**
 * @file VoiceDubModal.jsx
 * @structure-index
 *
 * 台词分配弹窗：编辑配音角色、全局默认音色和台词内容。
 * 语速、音量已从台词分配数据模型中移除；音色选择复用创作域二级弹窗。
 * 更新记录：2026-09-04 移除语速/音量和旧保存按钮，新增选择/重选音色及确定/取消流程；
 *               未选择角色时提示先选角色并打开角色菜单，避免空角色触发全局音色保存异常；
 *               重选按钮改用 secondary 变体，移除 primary 双层内层结构，还原设计稿尺寸；
 *               选择音色输入框补齐悬停态，并支持通过耳机图标试听当前音色；
 *               拆分耳机图标和音色名称的悬停状态，保证两者各自可触发高亮且耳机可点击试听。
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DubbingVoiceModal } from '../creation';
import { showGlobalToast } from '../../stores/toastStore';
import { Button } from '../ui/Button';
import { Select } from '../ui';
import TextField from '../ui/TextField';
import { getActiveVoicePreviewKey, subscribeVoicePreview, toggleVoicePreview, stopVoicePreview } from '../../utils/voicePreviewPlayer';
import { PlayingWaveIcon } from '../subject/SubjectVoiceSelectModal';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function normalizeVoice(voice) {
  if (!voice) return null;
  const voiceId = voice.voice_id || voice.voiceId || voice.id;
  if (!voiceId) return null;
  return {
    voice_id: voiceId,
    voice_name: voice.voice_name || voice.voiceName || voice.name || voiceId,
    voice_preview_url: voice.voice_preview_url || voice.voicePreviewUrl || voice.preview_url || voice.previewUrl || voice.audioUrl || null,
  };
}

function HeadsetIcon({ color = 'var(--color-white-100)' }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.333 12V8C3.333 5.423 5.423 3.333 8 3.333C10.577 3.333 12.667 5.423 12.667 8V12M3.333 8.667H2C1.632 8.667 1.333 8.965 1.333 9.333V12C1.333 12.368 1.632 12.667 2 12.667H3.333V8.667ZM12.667 8.667H14C14.368 8.667 14.667 8.965 14.667 9.333V12C14.667 12.368 14.368 12.667 14 12.667H12.667V8.667Z" stroke={color} strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 10.667H6.667L7.333 8.667L8.667 12.667L9.333 10.667H10.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function VoiceField({ voice, onClick }) {
  const selected = normalizeVoice(voice);
  const [hovered, setHovered] = useState(false);
  const [headsetHovered, setHeadsetHovered] = useState(false);
  const [nameHovered, setNameHovered] = useState(false);
  const [activePreviewKey, setActivePreviewKey] = useState(() => getActiveVoicePreviewKey());
  const previewUrl = selected?.voice_preview_url;
  const previewKey = selected ? `storyboard-voice-field:${selected.voice_id}:${previewUrl || ''}` : '';
  const playing = Boolean(previewKey) && activePreviewKey === previewKey;
  const buttonClassName = selected
    ? '!box-border !h-[24px] !min-h-[24px] !px-[8px] !rounded-[6px] !gap-[4px]'
    : '!box-border !h-[24px] !min-h-[24px] !px-[0px] !rounded-[6px]';
  const buttonContentClassName = selected ? '!text-[12px] !leading-[16px]' : '!h-[22px] !min-h-[22px] !px-[7px] !rounded-[5px] !text-[12px] !leading-[16px]';

  useEffect(() => subscribeVoicePreview(setActivePreviewKey), []);

  useEffect(() => () => {
    if (previewKey) stopVoicePreview(previewKey);
  }, [previewKey]);

  const handlePreviewClick = async (event) => {
    event.stopPropagation();
    if (!previewUrl) return;

    try {
      await toggleVoicePreview({ key: previewKey, url: previewUrl });
    } catch {
      // 播放失败时由全局播放器清理播放状态。
    }
  };

  const inputBackground = hovered ? '#222222' : '#1D1E1E';
  const inputBorder = hovered ? '#FFFFFF33' : '#FFFFFF14';
  const voiceHighlighted = headsetHovered || nameHovered || playing;
  const voiceColor = voiceHighlighted ? '#2DC3E1' : 'var(--color-text-primary)';

  return <div className="flex flex-col gap-[8px] self-stretch" style={{ fontFamily: FONT }}>
    <span className="text-[13px] leading-[18px] text-[#FFFFFF99]">选择音色</span>
    <div
      className="flex h-[36px] shrink-0 items-center justify-between gap-[8px] rounded-medium border border-solid pl-[12px] pr-[6px] [outline:1px_solid_#00000080]"
      style={{ backgroundColor: inputBackground, borderColor: inputBorder, transition: 'background-color 120ms, border-color 120ms' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-[4px]">
        {selected && (
          <button
            type="button"
            aria-label={playing ? '暂停音色试听' : '播放音色试听'}
            title={previewUrl ? (playing ? '暂停试听' : '试听音色') : '暂无试听音频'}
            disabled={!previewUrl}
            onClick={handlePreviewClick}
            onMouseEnter={() => setHeadsetHovered(true)}
            onMouseLeave={() => setHeadsetHovered(false)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', padding: 0, flexShrink: 0, border: 0, background: 'transparent', cursor: previewUrl ? 'pointer' : 'default' }}
          >
            {playing ? <PlayingWaveIcon color="#2DC3E1" size={16} /> : <HeadsetIcon color={voiceColor} />}
          </button>
        )}
        <span
          className={`min-w-0 truncate text-[14px] leading-[18px] ${selected ? '[color:var(--color-text-primary)]' : 'text-[#FFFFFF66]'}`}
          style={selected ? { flex: '0 1 auto', maxWidth: '100%', color: voiceColor, transition: 'color 120ms' } : { flex: 1 }}
          onMouseEnter={() => selected && setNameHovered(true)}
          onMouseLeave={() => selected && setNameHovered(false)}
        >
          {selected?.voice_name || '请选择音色'}
        </span>
      </div>
      <Button
        variant={selected ? 'secondary' : 'accent'}
        size="small"
        className={buttonClassName}
        contentClassName={buttonContentClassName}
        onClick={onClick}
      >
        {selected ? '重选' : '选择'}
      </Button>
    </div>
  </div>;
}

function VoiceDubModal({ open, onClose, chars = [], initialData = {}, globalVoices = {}, onVoiceChange, onConfirm }) {
  const [role, setRole] = useState(initialData.role ?? '旁白');
  const [voice, setVoice] = useState(normalizeVoice(initialData.voice));
  const [lines, setLines] = useState(initialData.lines ?? '');
  const [roleOpen, setRoleOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const initializedOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initializedOpenRef.current = false;
      return undefined;
    }
    if (initializedOpenRef.current) return undefined;
    initializedOpenRef.current = true;
    const frameId = requestAnimationFrame(() => {
      setRole(initialData.role ?? '旁白');
      setVoice(normalizeVoice(initialData.voice) || normalizeVoice(globalVoices[initialData.role ?? '']));
      setLines(initialData.lines ?? '');
      setRoleOpen(false);
      setVoiceModalOpen(false);
    });
    return () => cancelAnimationFrame(frameId);
  }, [open, initialData.role, initialData.voice, initialData.lines, globalVoices]);

  if (!open) return null;

  const selectedCharacter = chars.find((item) => item.name === role);
  const currentVoiceId = voice?.voice_id || null;
  const handleVoiceFieldClick = () => {
    if (!role.trim()) {
      showGlobalToast('请先选择配音角色', 'warning');
      setRoleOpen(true);
      return;
    }
    setVoiceModalOpen(true);
  };

  function handleRoleChange(nextRole) {
    setRole(nextRole);
    setVoice(normalizeVoice(globalVoices[nextRole]));
    setRoleOpen(false);
  }

  const roleOptions = [
    { value: '旁白', label: '旁白' },
    ...chars.map((character) => ({ value: character.name, label: character.name })),
  ];

  const handleVoiceConfirm = async (voiceId, voiceName, _activeTab, _source, selectedVoice) => {
    if (!role.trim()) {
      showGlobalToast('请先选择配音角色', 'warning');
      return false;
    }
    const nextVoice = normalizeVoice({ voice_id: voiceId, voice_name: voiceName, voice_preview_url: selectedVoice?.audioUrl });
    const result = await onVoiceChange?.(role, nextVoice, selectedCharacter || null);
    if (result === false) return false;
    setVoice(nextVoice);
    setVoiceModalOpen(false);
    return true;
  };
  const handleConfirm = async () => {
    const result = await onConfirm?.({ role, voice, lines });
    if (result !== false) onClose?.();
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div style={{ width: '400px', borderRadius: '16px', overflow: 'visible', display: 'flex', flexDirection: 'column', background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(event) => event.stopPropagation()}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', background: '#161616', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>台词分配</h2>
          <button type="button" aria-label="关闭台词分配弹窗" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', color: '#FFFFFF66' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </header>
        <main style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px', background: '#161616' }}>
          <Select
            label="配音角色"
            value={role}
            displayValue={role || '请选择角色'}
            displayTextStyle={{ color: role ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.25)' }}
            options={roleOptions}
            width="100%"
            menuMaxHeight="300px"
            open={roleOpen}
            onOpenChange={setRoleOpen}
            onChange={handleRoleChange}
          />
          <VoiceField voice={voice} onClick={handleVoiceFieldClick} />
          <TextField label="台词" value={lines} multiline height="100px" placeholder="输入台词内容…" onChange={(event) => setLines(event.target.value)} />
        </main>
        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', background: '#161616' }}>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={handleConfirm}>确定</Button>
        </footer>
      </div>
      <DubbingVoiceModal open={voiceModalOpen} currentVoice={currentVoiceId} zIndex={1300} onClose={() => setVoiceModalOpen(false)} onConfirm={handleVoiceConfirm} />
    </div>,
    document.body,
  );
}

export default VoiceDubModal;
