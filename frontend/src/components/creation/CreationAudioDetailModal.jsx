/**
 * @file CreationAudioDetailModal.jsx
 * @structure-index
 *
 * 独立负责配音结果详情展示、音频播放、波形进度和媒体动作；页面只注入数据与回调。
 * 音色名称以后端返回的音色名称为准。
 * 右侧信息区完整对齐图片详情弹窗，保留配音业务字段和高级提示词预览。
 */

import { useEffect, useRef, useState } from 'react';
import { useModalSize } from '../../utils/useModalSize';
import ConfirmDialog from '../ConfirmDialog';
import CreationDubbingPromptPreview from './CreationDubbingPromptPreview';
import { DeleteIcon, FavoriteIcon } from '../ui';
import { stopVoicePreview } from '../../utils/voicePreviewPlayer';
import CopyPromptButton from '../ui/CopyPromptButton';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const WAVEFORM = [14, 22, 11, 18, 28, 16, 24, 10, 19, 26, 13, 21, 30, 15, 23, 12, 20, 27, 14, 22, 10, 18, 26, 16, 24, 12, 20, 29, 15, 23, 11, 19, 27, 14, 22, 10, 18, 25, 13, 21, 29, 16, 24, 12, 20, 28, 15, 23];
const DETAIL_PANEL_DIVIDER = <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px', flexShrink: 0 }} />;

function PanelAction({ icon, label, onClick, active = false }) {
  const [hovered, setHovered] = useState(false);
  return <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', minWidth: '24px', height: '24px', padding: 0, border: 0, borderRadius: '7px', backgroundColor: hovered ? '#FFFFFF14' : '#161616', cursor: 'pointer', transition: 'background-color 0.12s' }}>{icon}</button>;
}

function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M13.506 11.439C14.601 10.668 15.071 9.277 14.667 8C14.262 6.723 13.024 6.024 11.684 6.025H10.911C10.405 4.054 8.736 2.599 6.715 2.366C4.693 2.133 2.737 3.171 1.796 4.975C0.856 6.78 1.125 8.977 2.474 10.501" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.003 13.667L8 7.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.121 11.545L8 13.667L5.879 11.545" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

function formatDuration(value) {
  if (!Number.isFinite(value) || value <= 0) return '暂无';
  if (value < 60) return `${Math.round(value)}s`;
  return `${Math.floor(value / 60)}m ${String(Math.round(value % 60)).padStart(2, '0')}s`;
}

function formatCreatedAt(value) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function ValueRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
      <span style={{ minWidth: 0, fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '暂无'}</span>
    </div>
  );
}

export default function CreationAudioDetailModal({
  onClose,
  audioUrl,
  prompt = '',
  model = '',
  speed,
  pitch,
  volume,
  advancedEnabled = false,
  voiceName = '',
  voiceId = '',
  voiceOriginLabel = '',
  createdAt = '',
  onDownload,
  onDelete,
  favorited = false,
  onFavorite,
}) {
  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackVolume, setPlaybackVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const copyPromptTimerRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onLoaded = () => setAudioDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      setIsPlaying(false);
      return undefined;
    }

    // 详情弹窗使用独立 audio 实例，开始播放前先停止结果卡的全局试听。
    stopVoicePreview();
    setCurrentTime(0);
    setAudioDuration(0);

    const playAudio = () => {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };

    if (audio.readyState >= 1) playAudio();
    else audio.addEventListener('loadedmetadata', playAudio, { once: true });

    return () => {
      audio.removeEventListener('loadedmetadata', playAudio);
      audio.pause();
      setIsPlaying(false);
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return undefined;
    audio.volume = playbackVolume;
    audio.muted = muted;
    return undefined;
  }, [playbackVolume, muted, audioUrl]);

  useEffect(() => () => clearTimeout(copyPromptTimerRef.current), []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      stopVoicePreview();
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function seek(event) {
    const audio = audioRef.current;
    const track = waveformRef.current;
    if (!audio || !track || !Number.isFinite(audio.duration)) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setCurrentTime(audio.currentTime);
  }

  function handleVolume(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setPlaybackVolume(next);
    setMuted(next === 0);
  }

  const progress = audioDuration > 0 ? Math.min(1, currentTime / audioDuration) : 0;
  const voiceDisplayName = voiceName || voiceId || '未命名音色';
  const voiceOriginDisplayName = voiceOriginLabel || 'MiniMax';
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
        <div style={{ width: modalW, height: modalH, transform: `scale(${modalScale})`, transformOrigin: 'center', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px', background: '#161616', border: '1px solid #FFFFFF14', boxShadow: '#00000099 -10px 24px 64px' }} onClick={(event) => event.stopPropagation()}>
          <div style={{ height: '64px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, fontFamily: FONT, color: '#FFFFFF', fontSize: '16px' }}>
            查看音频详情
            <button type="button" aria-label="关闭" onClick={onClose} style={{ width: '28px', height: '28px', padding: 0, border: 0, borderRadius: '6px', background: 'transparent', color: '#FFFFFF99', fontSize: '20px', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, background: '#0D0D0D' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0, padding: '32px' }}>
                <div ref={waveformRef} role="slider" aria-label="音频进度" aria-valuemin="0" aria-valuemax={audioDuration || 0} aria-valuenow={currentTime} tabIndex={0} onClick={seek} style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '0 16px', cursor: audioDuration ? 'pointer' : 'default', borderRadius: '12px', background: '#FFFFFF08' }}>
                  {WAVEFORM.map((height, index) => {
                    const active = index / WAVEFORM.length <= progress;
                    const pulse = isPlaying ? 0.8 + Math.abs(Math.sin(currentTime * 8 + index * 0.7)) * 0.45 : 1;
                    return <div key={index} style={{ width: '5px', height: `${height}px`, borderRadius: '3px', background: active ? '#2DC3E1' : '#FFFFFF33', transform: `scaleY(${pulse})`, transition: 'background 160ms, transform 120ms linear' }} />;
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 16px 16px', background: '#111111', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button type="button" aria-label={isPlaying ? '暂停播放' : '播放'} onClick={togglePlay} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #FFFFFF26', background: '#FFFFFF1A', color: '#FFFFFF', cursor: 'pointer', padding: 0 }}>{isPlaying ? 'Ⅱ' : '▶'}</button>
                  <span style={{ width: '36px', color: '#FFFFFF99', fontFamily: FONT, fontSize: '12px' }}>{formatTime(currentTime)}</span>
                  <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: '#FFFFFF1F', overflow: 'hidden' }}><div style={{ width: `${progress * 100}%`, height: '100%', background: '#FFFFFFB3' }} /></div>
                  <span style={{ width: '36px', color: '#FFFFFF66', fontFamily: FONT, fontSize: '12px', textAlign: 'right' }}>{formatTime(audioDuration)}</span>
                  <button type="button" aria-label={muted ? '取消静音' : '静音'} onClick={() => setMuted((value) => !value)} style={{ padding: 0, border: 0, background: 'transparent', color: '#FFFFFF99', cursor: 'pointer', display: 'flex' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 6H1V10H3L7 13V3L3 6Z" fill="currentColor" />{muted ? <path d="M10 6L14 10M14 6L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /> : <path d="M10 5C11.1 6.1 11.1 9.9 10 11M12.5 3C14.7 5.2 14.7 10.8 12.5 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}</svg>
                  </button>
                  <div role="slider" aria-label="音量" onClick={handleVolume} style={{ width: '60px', height: '3px', borderRadius: '2px', background: '#FFFFFF1F', cursor: 'pointer' }}><div style={{ width: `${muted ? 0 : playbackVolume * 100}%`, height: '100%', background: '#FFFFFF99' }} /></div>
                </div>
              </div>
              <audio ref={audioRef} src={audioUrl} preload="metadata" />
            </div>
            <div style={{ width: '340px', display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 0, background: '#161616', borderLeft: '1px solid #FFFFFF0F', color: '#FFFFFF', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #FFFFFF0A', backgroundColor: '#161616' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PanelAction
                    label="收藏"
                    active={favorited}
                    onClick={() => { setStarAnim(true); setTimeout(() => setStarAnim(false), 300); onFavorite?.(); }}
                    icon={<div style={{ transform: starAnim ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex' }}><FavoriteIcon filled={favorited} color="rgba(255,255,255,0.8)" /></div>}
                  />
                  <PanelAction label="下载" onClick={onDownload} icon={<DownloadIcon />} />
                </div>
                <PanelAction label="删除" onClick={() => setConfirmDelete(true)} icon={<DeleteIcon size={14} />} />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {DETAIL_PANEL_DIVIDER}
                <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 20px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>提示词</div>
                    <CopyPromptButton
                      text={prompt}
                      disabled={!prompt}
                      title={promptCopied ? '已复制' : '复制提示词'}
                      onCopy={() => {
                        setPromptCopied(true);
                        clearTimeout(copyPromptTimerRef.current);
                        copyPromptTimerRef.current = setTimeout(() => setPromptCopied(false), 1600);
                      }}
                      onError={(error) => console.warn('[CreationAudioDetailModal] 复制提示词失败:', error)}
                    />
                  </div>
                  <CreationDubbingPromptPreview prompt={prompt} advancedEnabled={advancedEnabled} style={{ lineHeight: '20px', letterSpacing: '0.01em' }} />
                </section>
                {DETAIL_PANEL_DIVIDER}
                <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 20px', flexShrink: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>音色参考</div>
                  <ValueRow label="音色名称" value={voiceDisplayName} />
                  <ValueRow label="音色来源" value={voiceOriginDisplayName} />
                </section>
                {DETAIL_PANEL_DIVIDER}
                <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 20px', flexShrink: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>生成参数</div>
                  <ValueRow label="模型" value={model} />
                  <ValueRow label="语速" value={speed == null ? '' : `${Number(speed).toFixed(2)}x`} />
                  <ValueRow label="声调" value={pitch == null ? '' : String(Math.round(pitch))} />
                  <ValueRow label="音量" value={volume == null ? '' : Number(volume).toFixed(2)} />
                  <ValueRow label="高级模式" value={advancedEnabled ? '已开启' : '未开启'} />
                  <ValueRow label="音频时长" value={formatDuration(audioDuration)} />
                </section>
                {DETAIL_PANEL_DIVIDER}
                <section style={{ display: 'flex', flexDirection: 'row', gap: '4px', padding: '16px 20px', justifyContent: 'flex-start', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ flex: '1 1 0px', fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>创作时间</span>
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{formatCreatedAt(createdAt)}</span>
                </section>
                {DETAIL_PANEL_DIVIDER}
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirmDelete && <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这段配音吗？" confirmText="确认删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />}
    </>
  );
}
