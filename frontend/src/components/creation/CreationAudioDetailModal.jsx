/**
 * @file CreationAudioDetailModal.jsx
 * @structure-index
 *
 * 独立负责配音结果详情展示、音频播放、波形进度和媒体动作；页面只注入数据与回调。
 * 音色名称以后端返回的音色名称为准。
 */

import { useEffect, useRef, useState } from 'react';
import { useModalSize } from '../../utils/useModalSize';
import ConfirmDialog from '../ConfirmDialog';
import CreationDubbingPromptPreview from './CreationDubbingPromptPreview';
import { stopVoicePreview } from '../../utils/voicePreviewPlayer';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const WAVEFORM = [14, 22, 11, 18, 28, 16, 24, 10, 19, 26, 13, 21, 30, 15, 23, 12, 20, 27, 14, 22, 10, 18, 26, 16, 24, 12, 20, 29, 15, 23, 11, 19, 27, 14, 22, 10, 18, 25, 13, 21, 29, 16, 24, 12, 20, 28, 15, 23];

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function ValueRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontFamily: FONT, fontSize: '12px', lineHeight: '16px' }}>
      <span style={{ color: '#FFFFFF99', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#FFFFFFCC', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '暂无'}</span>
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
  const [copyPromptState, setCopyPromptState] = useState('default');
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

  async function handleCopyPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      clearTimeout(copyPromptTimerRef.current);
      copyPromptTimerRef.current = setTimeout(() => setPromptCopied(false), 1600);
    } catch (error) {
      console.warn('[CreationAudioDetailModal] 复制提示词失败:', error);
    }
  }

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
            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 0, background: '#161616', borderLeft: '1px solid #FFFFFF0F', color: '#FFFFFF' }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px' }}>
                <section style={{ paddingBottom: '16px', borderBottom: '1px solid #FFFFFF0A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '10px' }}>
                    <div style={{ color: '#FFFFFF99', fontFamily: FONT, fontSize: '11px', lineHeight: '14px' }}>提示词</div>
                    <button
                      type="button"
                      aria-label="复制提示词"
                      title={promptCopied ? '已复制' : '复制提示词'}
                      disabled={!prompt}
                      onClick={handleCopyPrompt}
                      onMouseEnter={() => setCopyPromptState('hover')}
                      onMouseLeave={() => setCopyPromptState('default')}
                      onMouseDown={() => setCopyPromptState('pressed')}
                      onMouseUp={() => setCopyPromptState('hover')}
                      style={{
                        padding: 0,
                        margin: 0,
                        border: 0,
                        background: 'transparent',
                        cursor: prompt ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        color: !prompt ? '#FFFFFF1F' : copyPromptState === 'pressed' ? '#2DC3E1' : copyPromptState === 'hover' ? '#FFFFFF99' : '#FFFFFF66',
                        transition: 'color 120ms',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="currentColor" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <CreationDubbingPromptPreview prompt={prompt} advancedEnabled={advancedEnabled} />
                </section>
                <section style={{ padding: '16px 0', borderBottom: '1px solid #FFFFFF0A' }}><div style={{ color: '#FFFFFF99', fontFamily: FONT, fontSize: '11px', marginBottom: '12px' }}>音色参考</div><div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}><ValueRow label="音色名称" value={voiceDisplayName} /><ValueRow label="音色来源" value={voiceOriginDisplayName} /></div></section>
                <section style={{ padding: '16px 0', borderBottom: '1px solid #FFFFFF0A' }}><div style={{ color: '#FFFFFF99', fontFamily: FONT, fontSize: '11px', marginBottom: '12px' }}>生成参数</div><div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}><ValueRow label="模型" value={model} /><ValueRow label="语速" value={speed == null ? '' : `${Number(speed).toFixed(2)}x`} /><ValueRow label="声调" value={pitch == null ? '' : String(Math.round(pitch))} /><ValueRow label="音量" value={volume == null ? '' : Number(volume).toFixed(2)} /><ValueRow label="高级模式" value={advancedEnabled ? '已开启' : '未开启'} /><ValueRow label="音频时长" value={formatDuration(audioDuration)} /></div></section>
                <section style={{ paddingTop: '16px' }}><div style={{ color: '#FFFFFF99', fontFamily: FONT, fontSize: '11px', marginBottom: '8px' }}>创作时间</div><div style={{ color: '#FFFFFF66', fontFamily: FONT, fontSize: '12px' }}>{formatCreatedAt(createdAt)}</div></section>
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '16px 20px 20px', borderTop: '1px solid #FFFFFF0A', flexShrink: 0 }}>
                <button type="button" onClick={() => { setStarAnim(true); setTimeout(() => setStarAnim(false), 300); onFavorite?.(); }} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #FFFFFF1F', background: '#FFFFFF14', color: favorited ? '#F0B429' : '#FFFFFF99', cursor: 'pointer', transform: starAnim ? 'scale(1.08)' : 'none' }}>☆ 收藏</button>
                <button type="button" onClick={onDownload} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #FFFFFF1F', background: '#FFFFFF14', color: '#FFFFFF99', cursor: 'pointer' }}>↓ 下载</button>
                <button type="button" onClick={() => setConfirmDelete(true)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #FFFFFF1F', background: '#FFFFFF14', color: '#FFFFFF99', cursor: 'pointer' }}>删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirmDelete && <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这段配音吗？" confirmText="确认删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />}
    </>
  );
}
