import { useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const DIVIDER = <div style={{ height: '1px', margin: '0 20px', flexShrink: 0, background: '#FFFFFF0A' }} />;

function PanelAction({ icon, label, active = false, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', minWidth: '24px', height: '24px',
        padding: 0, border: 0, borderRadius: '7px', background: hovered ? '#FFFFFF14' : '#161616', cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  );
}

function EditTool({ label, icon }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', minWidth: 0, height: '64px', padding: '12px 8px', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '8px', border: 0, borderRadius: '6px', background: hovered ? '#FFFFFF14' : '#FFFFFF0D',
        color: '#FFFFFFCC', cursor: 'pointer',
      }}
    >
      {icon}
      <span style={{ maxWidth: '100%', overflow: 'hidden', color: '#FFFFFFCC', font: `12px/16px ${FONT}`, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  );
}

function StarIcon({ filled }) {
  return <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z" fill={filled ? '#F0B429' : 'none'} stroke={filled ? '#F0B429' : '#FFFFFFCC'} strokeWidth="1.1" strokeLinejoin="round" /></svg>;
}

function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.506 11.439C14.601 10.668 15.071 9.277 14.667 8C14.262 6.723 13.024 6.024 11.684 6.025H10.911C10.405 4.054 8.736 2.599 6.715 2.366C4.693 2.133 2.737 3.171 1.796 4.975C0.856 6.78 1.125 8.977 2.474 10.501" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.003 13.667L8 7.667M10.121 11.545L8 13.667L5.879 11.545" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DeleteIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.625 2.916V12.834H11.375V2.916H2.625Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M5.834 5.834V9.625M8.166 5.834V9.625M1.166 2.916H12.834M4.666 2.916L5.626 1.166H8.393L9.334 2.916H4.666Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CopyIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.333 4.144V2.604c0-.518.42-.937.938-.937h8.125c.518 0 .937.419.937.937v8.125c0 .518-.419.938-.937.938h-1.557" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.729 4.333H2.604a.938.938 0 0 0-.937.938v8.125c0 .518.419.937.937.937h8.125c.518 0 .938-.419.938-.937V5.271a.938.938 0 0 0-.938-.938Z" stroke="currentColor" strokeLinejoin="round" /></svg>;
}

function CopyPromptButton({ prompt }) {
  return <button type="button" aria-label="复制提示词" title="复制提示词" onClick={() => navigator.clipboard.writeText(prompt || '')} style={{ display: 'flex', padding: 0, border: 0, background: 'transparent', color: '#FFFFFF66', cursor: 'pointer' }}><CopyIcon /></button>;
}

function ReferenceImageGrid({ title, items = [] }) {
  if (!items.length) return null;
  return <>{DIVIDER}<section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}><span style={{ color: '#FFFFFF99', font: `12px/14px ${FONT}`, letterSpacing: '0.06em' }}>{title}</span><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>{items.map((item, index) => <div key={`${item.url}-${index}`} style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', borderRadius: '6px', border: '1px solid #FFFFFF14', background: '#FFFFFF14' }}><img src={item.url} alt={item.name || title} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} /></div>)}</div></section></>;
}

function FrameReferenceGrid({ firstFrame, lastFrame }) {
  if (!firstFrame && !lastFrame) return null;
  return <>{DIVIDER}<section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', padding: '16px 20px' }}>{[['首帧', firstFrame], ['尾帧', lastFrame]].map(([title, item]) => <div key={title} style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: '12px' }}><span style={{ color: '#FFFFFF99', font: `11px/14px ${FONT}`, letterSpacing: '0.06em' }}>{title}</span><div style={{ width: '100%', height: '84px', overflow: 'hidden', borderRadius: '6px', border: '1px solid #FFFFFF14', background: '#FFFFFF14' }}>{item ? <img src={item.url} alt={title} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} /> : null}</div></div>)}</section></>;
}

function ReferenceVideoGrid({ items = [] }) {
  if (!items.length) return null;
  return <>{DIVIDER}<section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}><span style={{ color: '#FFFFFF99', font: `12px/14px ${FONT}`, letterSpacing: '0.06em' }}>参考视频</span><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>{items.map((item, index) => <video key={`${item.url}-${index}`} src={item.url} muted playsInline preload="metadata" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', border: '1px solid #FFFFFF14', background: '#1D1E1E' }} />)}</div></section></>;
}

function ReferenceAudioGrid({ items = [] }) {
  if (!items.length) return null;
  return <>{DIVIDER}<section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}><span style={{ color: '#FFFFFF99', font: `12px/14px ${FONT}`, letterSpacing: '0.06em' }}>参考音频</span><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>{items.map((item, index) => <div key={`${item.url}-${index}`} style={{ display: 'flex', width: '100%', aspectRatio: '1', padding: '6px 8px', boxSizing: 'border-box', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', borderRadius: '8px', border: '1px solid #FFFFFF14', background: '#1D1E1E' }}><span style={{ overflow: 'hidden', color: '#FFFFFF', font: `12px/18px ${FONT}`, wordBreak: 'break-all' }}>{item.name || 'audio.mp3'}</span><span style={{ color: '#FFFFFF66', font: `12px/18px ${FONT}` }}>{item.size || ''}</span></div>)}</div></section></>;
}

function ImageEditTools() {
  return <><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}><EditTool label="多机位" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="9" height="8" rx="1.5" stroke="#FFFFFFCC" /><path d="M10 6.5L14.5 4.5V11.5L10 9.5V6.5Z" stroke="#FFFFFFCC" strokeLinejoin="round" /></svg>} /><EditTool label="局部重绘" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13L10.8 5.2L13 7.4L5.2 15.2H3V13Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M9.5 6.5L11.5 8.5M3 15H13" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /><EditTool label="智能超清" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6V3H6M10 3H13V6M13 10V13H10M6 13H3V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 4.5V11.5M4.5 8H11.5" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /><EditTool label="消除笔" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.5 3L13 6.5L6.5 13H3V9.5L9.5 3Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M7 5.5L10.5 9M3 13H13" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}><EditTool label="扩图" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="3.5" width="9" height="9" stroke="#FFFFFFCC" strokeDasharray="2 1.5" /><path d="M1.5 1.5L3.5 3.5M14.5 1.5L12.5 3.5M1.5 14.5L3.5 12.5M14.5 14.5L12.5 12.5" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /><EditTool label="裁剪" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3V13H13M5 5H11V11H5V5Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>} /><EditTool label="翻转" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V14" stroke="#FFFFFFCC" strokeLinecap="round" strokeDasharray="2 1.5" /><path d="M2 5L5.5 8L2 11V5ZM14 5L10.5 8L14 11V5Z" fill="#FFFFFFCC" fillOpacity="0.6" /></svg>} /></div></>;
}

function VideoEditTools() {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}><EditTool label="智能超清" icon={<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', flexShrink: 0 }}><path d="M447.849 45.176a53.489 53.489 0 0 1 0 106.978H226.424c-49.393 0-89.33 39.936-89.33 89.33l0.121 122.88c393.276 37.466 594.04 216.666 602.353 537.6h58.067c46.622 0 84.871-35.6 88.967-81.198l0.362-8.132V527.12a53.368 53.368 0 0 1 106.857 0v285.515c0 108.424-87.823 196.307-196.307 196.307h-571.09A196.247 196.247 0 0 1 30.057 812.634v-571.09A196.367 196.367 0 0 1 226.363 45.176H447.85z m-153.24 581.271a32.407 32.407 0 0 0-32.406 32.407v64.873H197.33v-64.873a32.407 32.407 0 0 0-64.873 0v194.62a32.407 32.407 0 0 0 64.873 0V788.6h64.873v64.874a32.407 32.407 0 0 0 64.874 0v-194.56a32.407 32.407 0 0 0-32.467-32.467z m162.215 0H391.95a32.407 32.407 0 0 0-32.286 29.094l-0.18 3.313v194.62c0 17.95 14.516 32.467 32.466 32.467h64.874a97.28 97.28 0 0 0 97.28-97.34v-64.874c0-53.73-43.55-97.28-97.28-97.28z m0 64.873c17.89 0 32.406 14.517 32.406 32.407V788.6a32.407 32.407 0 0 1-32.406 32.467h-32.467V691.32zM812.994 0a22.89 22.89 0 0 1 21.264 14.456l11.384 27.709c19.276 46.742 55.658 84.269 101.798 104.93l32.407 14.456a23.853 23.853 0 0 1 0 43.37l-34.334 15.3A197.15 197.15 0 0 0 845.22 322.017l-11.204 25.359a22.89 22.89 0 0 1-42.165 0l-11.083-25.48A196.97 196.97 0 0 0 680.477 220.22l-34.274-15.3a23.974 23.974 0 0 1 0-43.369l32.347-14.456a197.15 197.15 0 0 0 101.677-104.99l11.445-27.649A22.89 22.89 0 0 1 812.995 0z" fill="#FFFFFF99" /></svg>} /><EditTool label="去字幕" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11V13C2 13.552 2.448 14 3 14H5M11 14H13C13.552 14 14 13.552 14 13V11M14 5V3C14 2.448 13.552 2 13 2H11M2 5V3C2 2.448 2.448 2 3 2H5M8 5V11.667M5.667 5H10.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>} /><EditTool label="选帧" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path opacity="0.6" d="M8.381 12.382L2.512 13.629L.641 4.826l3.668-.78" stroke="currentColor" strokeLinejoin="round" /><path opacity="0.8" d="M7.5 12h-3V3h6v.793" stroke="currentColor" strokeLinejoin="round" /><rect x="9.781" y="3.274" width="6" height="9" transform="rotate(18 9.781 3.274)" stroke="currentColor" strokeLinejoin="round" /></svg>} /><EditTool label="剪辑" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14.333 5.667V3h-3v2.667H10m4.333 0v4.666m0 0V13h-3v-2.667H10M1.667 5.667V3h3v2.667H6m-4.333 0v4.666m0 0V13h3v-2.667H6M4.667 3H6m-1.333 10H6M11.333 3H10m1.333 10H10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 2.333v1.334M8 5.667V7M8 9v1.333M8 12.333v1.334" stroke="currentColor" strokeLinecap="round" /></svg>} /></div>;
}

export default function StoryboardMediaDetailPanel({ video, media, prompt, frameReferenceMode, referenceGroups, parameterEntries, createdAt, onDownload, onDelete, onFavorite }) {
  const [favorited, setFavorited] = useState(Boolean(media?.favorited || media?.is_favorited || media?.isFavorited));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const imageReferences = [...referenceGroups.subjects, ...referenceGroups.references];

  return <><aside style={{ width: '340px', flex: '0 0 340px', minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #FFFFFF0F', background: '#161616' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #FFFFFF0A' }}><div style={{ display: 'flex', gap: '8px' }}><PanelAction label="收藏" active={favorited} onClick={() => { const next = !favorited; setFavorited(next); onFavorite?.(media, next); }} icon={<StarIcon filled={favorited} />} /><PanelAction label="下载" onClick={() => onDownload?.(media)} icon={<DownloadIcon />} /></div><PanelAction label="删除" onClick={() => setConfirmDelete(true)} icon={<DeleteIcon />} /></div><div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{DIVIDER}<section style={{ display: 'flex', flexDirection: 'column', gap: video ? '10px' : '8px', padding: video ? '16px 20px' : '12px 20px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ color: '#FFFFFF99', font: `${video ? '11px' : '12px'}/14px ${FONT}`, letterSpacing: '0.06em' }}>提示词</span><CopyPromptButton prompt={prompt} /></div><p style={{ margin: 0, color: '#FFFFFFCC', font: `12px/20px ${FONT}`, letterSpacing: '0.01em', wordBreak: 'break-word' }}>{prompt || (video ? '无' : '—')}</p></section>{video ? frameReferenceMode ? <FrameReferenceGrid firstFrame={referenceGroups.firstFrames[0]} lastFrame={referenceGroups.lastFrames[0]} /> : <><ReferenceImageGrid title="参考图" items={imageReferences} /><ReferenceVideoGrid items={referenceGroups.videos} /><ReferenceAudioGrid items={referenceGroups.audios} /></> : <ReferenceImageGrid title="参考图" items={[...imageReferences, ...referenceGroups.firstFrames, ...referenceGroups.lastFrames]} />}{DIVIDER}<section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: video ? '16px 20px' : '12px 20px' }}><span style={{ color: '#FFFFFF99', font: `${video ? '11px' : '12px'}/14px ${FONT}`, letterSpacing: '0.06em' }}>生成参数</span>{parameterEntries.map((entry) => <div key={entry.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>{entry.label}</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}`, textAlign: 'right', wordBreak: 'break-word' }}>{entry.value}</span></div>)}</section>{createdAt && <>{DIVIDER}<div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '16px 20px' }}><span style={{ flex: 1, color: '#FFFFFF99', font: `12px/14px ${FONT}`, letterSpacing: '0.06em' }}>AI 生成时间</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}`, letterSpacing: '0.01em' }}>{createdAt}</span></div></>}{DIVIDER}</div><div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, padding: '16px 20px 16px', borderTop: '1px solid #FFFFFF0D' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}`, letterSpacing: '0.06em' }}>{video ? '视频编辑' : '图片编辑'}</span>{video ? <VideoEditTools /> : <ImageEditTools />}</div></aside>{confirmDelete && <ConfirmDialog title="确认删除" description={`删除后无法恢复，确定要删除这${video ? '个视频' : '张图片'}吗？`} confirmText="删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(media); }} onCancel={() => setConfirmDelete(false)} zIndex={1300} />}</>;
}
