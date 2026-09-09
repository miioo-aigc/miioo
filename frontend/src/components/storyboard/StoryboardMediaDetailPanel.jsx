import { useContext, useState } from 'react';
import { VideoEditContext } from '../video-edit/VideoEditContext';
import { ImageEditContext } from '../image-edit/ImageEditContext';
import ConfirmDialog from '../ConfirmDialog';
import CopyPromptButton from '../ui/CopyPromptButton';
import { FavoriteIcon, DeleteIcon } from '../ui';

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
  const openVideoEdit = useContext(VideoEditContext);
  const edit = useContext(ImageEditContext);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={edit ? () => edit(label) : ['智能超清', '去字幕', '剪辑', '选帧'].includes(label) && openVideoEdit ? () => openVideoEdit(label) : undefined}
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

function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.506 11.439C14.601 10.668 15.071 9.277 14.667 8C14.262 6.723 13.024 6.024 11.684 6.025H10.911C10.405 4.054 8.736 2.599 6.715 2.366C4.693 2.133 2.737 3.171 1.796 4.975C0.856 6.78 1.125 8.977 2.474 10.501" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.003 13.667L8 7.667M10.121 11.545L8 13.667L5.879 11.545" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
  return <><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}><EditTool label="多机位" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="9" height="8" rx="1.5" stroke="#FFFFFFCC" /><path d="M10 6.5L14.5 4.5V11.5L10 9.5V6.5Z" stroke="#FFFFFFCC" strokeLinejoin="round" /></svg>} /><EditTool label="局部重绘" icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ height: '16px', width: '16px', flexShrink: 0 }}><path d="M392.704 165.952a401.92 401.92 0 0 1 148.16 1.856 32 32 0 1 0 12.608-62.72 464.832 464.832 0 0 0-171.776-2.176 32 32 0 1 0 11.008 63.04z m-129.28 47.488a32 32 0 1 0-32.64-55.104 419.52 419.52 0 0 0-120.832 107.072 32 32 0 0 0 50.944 38.656c27.264-35.84 62.08-66.752 102.464-90.624z m458.88-36.16a32 32 0 0 0-36.928 52.288c21.76 15.36 41.472 32.768 58.88 52.032a32 32 0 1 0 47.488-42.88 419.968 419.968 0 0 0-69.44-61.44z m-618.88 249.344a32 32 0 1 0-62.4-14.08 371.264 371.264 0 0 0-4.096 141.952 32 32 0 1 0 63.168-10.432 307.968 307.968 0 0 1 3.392-117.44z m28.8 212.352a32 32 0 1 0-56.64 29.888 399.36 399.36 0 0 0 71.68 96.448 32 32 0 0 0 45.12-45.44 335.168 335.168 0 0 1-60.16-80.896z m141.696 141.696a32 32 0 1 0-30.72 56.128c17.28 9.472 35.456 17.92 54.208 25.088a32 32 0 1 0 22.912-59.776 379.52 379.52 0 0 1-46.4-21.44z m496.512-52.096a64 64 0 0 1-91.008 30.592l-40.704-23.488a64 64 0 0 1-19.008-94.08l248.32-328.064a36.224 36.224 0 0 1 62.336 35.968l-160 379.072z m-281.984 131.2c34.048-123.52 92.736-121.152 151.488-91.776 53.312 21.312 64 96 0 160-66.176 66.176-193.408 24.96-187.904-9.984 1.92-11.904 10.176-21.248 18.432-30.72 7.552-8.448 15.104-17.024 17.984-27.52z" fill="#FFFFFFCC" /></svg>} /><EditTool label="智能超清" icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ width: '16px', height: '16px', flexShrink: 0 }}><path d="M456.615 96.598a47.501 46.176 90 0 1 0 95.001H265.465c-42.64 0-77.116 35.465-77.116 79.329l0.105 109.123c339.504 33.271 512.818 192.409 519.994 477.412h50.127c40.247 0 73.267-31.614 76.803-72.107l0.312-7.222V524.585a47.393 46.071 90 0 1 92.247 0v253.55c0 96.285-75.815 174.329-169.466 174.329h-493.006A174.276 169.414 90 0 1 95.947 778.134v-507.152A174.382 169.518 90 0 1 265.413 96.598H456.616z m-132.288 516.194a28.779 27.976 90 0 0-27.975 28.779v57.61H240.349v-57.61a28.779 27.976 90 0 0-56.003 0v172.831a28.779 27.976 90 0 0 56.003 0V756.791h56.003v57.611a28.779 27.976 90 0 0 56.004 0v-172.778a28.779 27.976 90 0 0 -28.028-28.832z m140.036 0H408.359a28.779 27.976 90 0 0-27.872 25.837l-0.155 2.942v172.831c0 15.94 12.531 28.832 28.027 28.832h56.004a86.389 83.979 90 0 0 83.979-86.442v-57.611c0-47.715-37.595-86.389-83.979-86.389z m0 57.61c15.444 0 27.975 12.892 27.975 28.779V756.791a28.779 27.976 90 0 1-27.975 28.832h-28.028V670.402zM771.834 56.48a20.327 19.76 90 0 1 18.357 12.838l9.827 24.606c16.64 41.509 48.048 74.835 87.88 93.183l27.976 12.837a21.182 20.592 90 0 1 0 38.515l-29.64 13.587A175.078 170.194 90 0 0 799.654 342.445l-9.672 22.52a20.327 19.76 90 0 1-36.4 0l-9.568-22.627A174.918 170.039 90 0 0 657.436 252.045l-29.588-13.587a21.29 20.696 90 0 1 0-38.514l27.925-12.837a175.078 170.194 90 0 0 87.774-93.236l9.881-24.553A20.327 19.76 90 0 1 771.835 56.48z" fill="#FFFFFFCC" /></svg>} /><EditTool label="消除笔" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.5 3L13 6.5L6.5 13H3V9.5L9.5 3Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M7 5.5L10.5 9M3 13H13" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}><EditTool label="扩图" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="3.5" width="9" height="9" stroke="#FFFFFFCC" strokeDasharray="2 1.5" /><path d="M1.5 1.5L3.5 3.5M14.5 1.5L12.5 3.5M1.5 14.5L3.5 12.5M14.5 14.5L12.5 12.5" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} /><EditTool label="裁剪" icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ width: '16px', height: '16px', flexShrink: 0 }}><path d="M902.978 735.755 794.79 735.786 794.79 290.533C794.79 245.399 759.3 208.812 715.52 208.812L688.78 208.812C687.994 208.763 687.203 208.73 686.404 208.73L392.766 208.812 291.611 208.812 291.611 208.84 284.461 208.842 284.461 130.017 284.311 130.017 284.302 96.557C284.297 74.645 267.064 56.885 245.808 56.889 224.554 56.894 207.326 74.66 207.33 96.572L207.339 130.017 207.33 130.017 207.33 208.864 99.126 208.894C77.872 208.899 60.645 226.665 60.648 248.578 60.653 270.489 77.886 288.25 99.142 288.246L207.33 288.216 207.33 733.467C207.33 778.601 242.82 815.188 286.6 815.188L313.34 815.188C314.126 815.237 314.917 815.27 315.716 815.27L609.354 815.188 710.509 815.188 710.509 815.16 717.659 815.158 717.659 893.983 717.809 893.983 717.818 927.443C717.823 949.355 735.056 967.115 756.312 967.111 777.566 967.106 794.794 949.34 794.79 927.428L794.781 893.983 794.79 893.983 794.79 815.136 902.994 815.106C924.248 815.101 941.475 797.335 941.472 775.422 941.468 753.511 924.234 735.752 902.978 735.755L902.978 735.755ZM609.209 735.838 325.382 735.838C304.639 735.838 284.462 714.872 284.462 693.488L284.462 288.193 392.913 288.162 676.741 288.162C697.483 288.162 717.66 309.128 717.66 330.512L717.66 735.807 609.209 735.838 609.209 735.838Z" fill="#FFFFFFCC" /></svg>} /><EditTool label="翻转" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V14" stroke="#FFFFFFCC" strokeLinecap="round" strokeDasharray="2 1.5" /><path d="M2 5L5.5 8L2 11V5ZM14 5L10.5 8L14 11V5Z" fill="#FFFFFFCC" /></svg>} /></div></>;
}

function VideoEditTools() {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}><EditTool label="智能超清" icon={<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', flexShrink: 0 }}><path d="M447.849 45.176a53.489 53.489 0 0 1 0 106.978H226.424c-49.393 0-89.33 39.936-89.33 89.33l0.121 122.88c393.276 37.466 594.04 216.666 602.353 537.6h58.067c46.622 0 84.871-35.6 88.967-81.198l0.362-8.132V527.12a53.368 53.368 0 0 1 106.857 0v285.515c0 108.424-87.823 196.307-196.307 196.307h-571.09A196.247 196.247 0 0 1 30.057 812.634v-571.09A196.367 196.367 0 0 1 226.363 45.176H447.85z m-153.24 581.271a32.407 32.407 0 0 0-32.406 32.407v64.873H197.33v-64.873a32.407 32.407 0 0 0-64.873 0v194.62a32.407 32.407 0 0 0 64.873 0V788.6h64.873v64.874a32.407 32.407 0 0 0 64.874 0v-194.56a32.407 32.407 0 0 0-32.467-32.467z m162.215 0H391.95a32.407 32.407 0 0 0-32.286 29.094l-0.18 3.313v194.62c0 17.95 14.516 32.467 32.466 32.467h64.874a97.28 97.28 0 0 0 97.28-97.34v-64.874c0-53.73-43.55-97.28-97.28-97.28z m0 64.873c17.89 0 32.406 14.517 32.406 32.407V788.6a32.407 32.407 0 0 1-32.406 32.467h-32.467V691.32zM812.994 0a22.89 22.89 0 0 1 21.264 14.456l11.384 27.709c19.276 46.742 55.658 84.269 101.798 104.93l32.407 14.456a23.853 23.853 0 0 1 0 43.37l-34.334 15.3A197.15 197.15 0 0 0 845.22 322.017l-11.204 25.359a22.89 22.89 0 0 1-42.165 0l-11.083-25.48A196.97 196.97 0 0 0 680.477 220.22l-34.274-15.3a23.974 23.974 0 0 1 0-43.369l32.347-14.456a197.15 197.15 0 0 0 101.677-104.99l11.445-27.649A22.89 22.89 0 0 1 812.995 0z" fill="#FFFFFF99" /></svg>} /><EditTool label="去字幕" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11V13C2 13.552 2.448 14 3 14H5M11 14H13C13.552 14 14 13.552 14 13V11M14 5V3C14 2.448 13.552 2 13 2H11M2 5V3C2 2.448 2.448 2 3 2H5M8 5V11.667M5.667 5H10.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>} /><EditTool label="选帧" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path opacity="0.6" d="M8.381 12.382L2.512 13.629L.641 4.826l3.668-.78" stroke="currentColor" strokeLinejoin="round" /><path opacity="0.8" d="M7.5 12h-3V3h6v.793" stroke="currentColor" strokeLinejoin="round" /><rect x="9.781" y="3.274" width="6" height="9" transform="rotate(18 9.781 3.274)" stroke="currentColor" strokeLinejoin="round" /></svg>} /><EditTool label="剪辑" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14.333 5.667V3h-3v2.667H10m4.333 0v4.666m0 0V13h-3v-2.667H10M1.667 5.667V3h3v2.667H6m-4.333 0v4.666m0 0V13h3v-2.667H6M4.667 3H6m-1.333 10H6M11.333 3H10m1.333 10H10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 2.333v1.334M8 5.667V7M8 9v1.333M8 12.333v1.334" stroke="currentColor" strokeLinecap="round" /></svg>} /></div>;
}

export default function StoryboardMediaDetailPanel({ video, media, prompt, frameReferenceMode, referenceGroups, parameterEntries, createdAt, onDownload, onDelete, onFavorite }) {
  const [favorited, setFavorited] = useState(Boolean(media?.favorited || media?.is_favorited || media?.isFavorited));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const imageReferences = [...referenceGroups.subjects, ...referenceGroups.references];

  return <><aside style={{ width: '340px', flex: '0 0 340px', minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #FFFFFF0F', background: '#161616' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #FFFFFF0A' }}><div style={{ display: 'flex', gap: '8px' }}><PanelAction label="收藏" active={favorited} onClick={() => { const next = !favorited; setFavorited(next); onFavorite?.(media, next); }} icon={<FavoriteIcon filled={favorited} />} /><PanelAction label="下载" onClick={() => onDownload?.(media)} icon={<DownloadIcon />} /></div><PanelAction label="删除" onClick={() => setConfirmDelete(true)} icon={<DeleteIcon size={14} />} /></div><div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{DIVIDER}<section style={{ display: 'flex', flexDirection: 'column', gap: video ? '10px' : '8px', padding: video ? '16px 20px' : '12px 20px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ color: '#FFFFFF99', font: `${video ? '11px' : '12px'}/14px ${FONT}`, letterSpacing: '0.06em' }}>提示词</span><CopyPromptButton prompt={prompt} /></div><p style={{ margin: 0, color: '#FFFFFFCC', font: `12px/20px ${FONT}`, letterSpacing: '0.01em', wordBreak: 'break-word' }}>{prompt || (video ? '无' : '—')}</p></section>{video ? frameReferenceMode ? <FrameReferenceGrid firstFrame={referenceGroups.firstFrames[0]} lastFrame={referenceGroups.lastFrames[0]} /> : <><ReferenceImageGrid title="参考图" items={imageReferences} /><ReferenceVideoGrid items={referenceGroups.videos} /><ReferenceAudioGrid items={referenceGroups.audios} /></> : <ReferenceImageGrid title="参考图" items={[...imageReferences, ...referenceGroups.firstFrames, ...referenceGroups.lastFrames]} />}{DIVIDER}<section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: video ? '16px 20px' : '12px 20px' }}><span style={{ color: '#FFFFFF99', font: `${video ? '11px' : '12px'}/14px ${FONT}`, letterSpacing: '0.06em' }}>生成参数</span>{parameterEntries.map((entry) => <div key={entry.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>{entry.label}</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}`, textAlign: 'right', wordBreak: 'break-word' }}>{entry.value}</span></div>)}</section>{createdAt && <>{DIVIDER}<div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '16px 20px' }}><span style={{ flex: 1, color: '#FFFFFF99', font: `12px/14px ${FONT}`, letterSpacing: '0.06em' }}>AI 生成时间</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}`, letterSpacing: '0.01em' }}>{createdAt}</span></div></>}{DIVIDER}</div><div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, padding: '16px 20px 16px', borderTop: '1px solid #FFFFFF0D' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}`, letterSpacing: '0.06em' }}>{video ? '视频编辑' : '图片编辑'}</span>{video ? <VideoEditTools /> : <ImageEditTools />}</div></aside>{confirmDelete && <ConfirmDialog title="确认删除" description={`删除后无法恢复，确定要删除这${video ? '个视频' : '张图片'}吗？`} confirmText="删除" onConfirm={() => { setConfirmDelete(false); onDelete?.(media); }} onCancel={() => setConfirmDelete(false)} zIndex={1300} />}</>;
}
