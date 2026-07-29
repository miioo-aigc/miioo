import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Toggle from '../Toggle';
import { useModalSize } from '../../utils/useModalSize';
import { normalizeImageUrl } from '../../utils/imageUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function isVideoMedia(media) {
  return media?.media_type === 'video' || media?.type?.startsWith('video');
}

function mediaPreviewUrl(media) {
  return normalizeImageUrl(media?.poster_url || media?.thumbnail_url || media?.preview_url || media?.large_url || media?.url || '');
}

function mediaImageUrl(media) {
  return normalizeImageUrl(media?.large_url || media?.preview_url || media?.url || '');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false });
}

function CloseButton({ onClick }) {
  return (
    <button type="button" aria-label="关闭" onClick={onClick} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: '6px', padding: 0, background: 'transparent', cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function CandidateThumbnail({ media, active, onClick }) {
  const video = isVideoMedia(media);
  const thumb = mediaPreviewUrl(media);
  return (
    <button type="button" onClick={onClick} aria-label={`查看${video ? '视频' : '图片'}`} style={{ width: '100px', height: '76px', position: 'relative', flexShrink: 0, overflow: 'hidden', padding: 0, borderRadius: '6px', border: `1px solid ${active ? '#2DC3E1' : '#FFFFFF1F'}`, background: '#1D1E1E', cursor: 'pointer', boxShadow: active ? '0 0 0 1px #2DC3E166' : 'none' }}>
      {video ? <video src={normalizeImageUrl(media?.url || media?.preview_video_url)} poster={thumb} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <span style={{ position: 'absolute', top: '4px', right: '4px', padding: '1px 4px', borderRadius: '2px', background: '#00000099', color: '#FFFFFFCC', font: `10px/14px ${FONT}` }}>{video ? '视频' : '图片'}</span>
      {media?.is_finalized && <span style={{ position: 'absolute', top: '4px', left: '4px', padding: '1px 4px', borderRadius: '2px', background: '#2DC3E1', color: '#090909', font: `10px/14px ${FONT}` }}>定稿</span>}
    </button>
  );
}

export default function StoryboardMediaDetailModal({ shot, candidates = [], media, onClose, onFinalizeChange, onDownload }) {
  const { width: modalW, height: modalH } = useModalSize();
  const items = useMemo(() => {
    const source = candidates.length ? candidates : media ? [media] : [];
    return source.filter((item, index, list) => item && (item.id || item.url) && list.findIndex((candidate) => (candidate.id || candidate.url) === (item.id || item.url)) === index);
  }, [candidates, media]);
  const initial = media?.id || media?.url;
  const [activeKey, setActiveKey] = useState(initial);
  const activeMedia = items.find((item) => (item.id || item.url) === activeKey) || items[0] || media;
  const video = isVideoMedia(activeMedia);
  const finalized = !!activeMedia?.is_finalized;

  if (!activeMedia) return null;

  const label = `分镜${String(shot?.number ?? '').padStart(2, '0')}`;
  const sourceLabel = activeMedia.source === 'local-upload' ? '本地上传' : activeMedia.source === 'asset-library' ? '资产库' : activeMedia.source ? 'AI生成' : '';
  const prompt = activeMedia.input_prompt || activeMedia.prompt || shot?.image_prompt || shot?.video_prompt;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(12px)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div style={{ width: `${modalW}px`, height: `${modalH}px`, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px', background: '#161616', border: '1px solid #FFFFFF14', boxShadow: '-10px 24px 64px #00000099' }} onMouseDown={(event) => event.stopPropagation()}>
        <header style={{ height: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#161616' }}>
          <span style={{ color: '#FFFFFF', font: `500 16px/20px ${FONT_MEDIUM}` }}>查看详情</span>
          <CloseButton onClick={onClose} />
        </header>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0D0D0D' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#0A0A0A' }}>
              {video ? <video key={activeMedia.id || activeMedia.url} src={normalizeImageUrl(activeMedia.url || activeMedia.preview_video_url)} poster={normalizeImageUrl(activeMedia.poster_url || activeMedia.thumbnail_url)} controls autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <img src={mediaImageUrl(activeMedia)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
            </div>
            <div style={{ flexShrink: 0, minHeight: '108px', padding: '16px', display: 'flex', gap: '12px', overflowX: 'auto', borderTop: '1px solid #FFFFFF0F', background: '#161616' }}>
              {items.map((item) => <CandidateThumbnail key={item.id || item.url} media={item} active={(item.id || item.url) === (activeMedia.id || activeMedia.url)} onClick={() => setActiveKey(item.id || item.url)} />)}
            </div>
          </div>
          <aside style={{ width: '280px', flex: '0 0 280px', minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #FFFFFF0F', background: '#161616' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>是否定稿</span><Toggle value={finalized} onChange={(value) => onFinalizeChange?.(activeMedia, value)} /></div>
              <div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>分镜编号</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}` }}>{label}</span></div>
              <div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} />
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>内容类型</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}` }}>{video ? '视频' : '图片'}</span></div>
              {sourceLabel && <><div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} /><div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>来源</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}` }}>{sourceLabel}</span></div></>}
              {prompt && <><div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} /><div style={{ padding: '16px 20px' }}><span style={{ display: 'block', marginBottom: '8px', color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>提示词</span><p style={{ margin: 0, color: '#FFFFFFCC', font: `12px/20px ${FONT}`, wordBreak: 'break-word' }}>{prompt}</p></div></>}
              {activeMedia.created_at && <><div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} /><div style={{ padding: '16px 20px' }}><span style={{ display: 'block', marginBottom: '8px', color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>生成时间</span><span style={{ color: '#FFFFFF66', font: `12px/16px ${FONT}` }}>{formatDate(activeMedia.created_at)}</span></div></>}
            </div>
            <div style={{ flexShrink: 0, padding: '12px 20px 20px', borderTop: '1px solid #FFFFFF0A' }}><button type="button" onClick={() => onDownload?.(activeMedia)} style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #FFFFFF1F', background: '#FFFFFF14', color: '#FFFFFF99', cursor: 'pointer', font: `13px/16px ${FONT}` }}>下载</button></div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
