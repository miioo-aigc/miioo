/**
 * @file VideoResultsPanel.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   视频上传卡片       支持本地上传和从资产库选择视频
 *   视频结果列表       展示生成/上传的视频并维护列表状态
 *   视频结果操作       暴露查看、定稿和下载事件，不持有页面任务状态
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   通过 props 接收镜头、项目、结果列表、UI 按钮和业务回调；
 *   不读取 GenerateVideoPanel 或 StoryboardPage 的闭包变量。
 */

import { useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import Checkbox from '../Checkbox';
import DotsLoading from '../DotsLoading';
import { apiUploadStoryboardVideo } from '../../api/storyboard';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ImgUploadBtn, ImgIconBtn } from './StoryboardImageUpload';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function VideoResultsPanel({
  shot,
  projectId,
  generatedVideos = [],
  onSetGeneratedVideos,
  onSettleVideo,
  onShowToast,
  onViewVideo,
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
      <VideoUploadCard
        projectId={projectId}
        shotId={shot?.id}
        onSetGeneratedVideos={onSetGeneratedVideos}
        onSettleVideo={onSettleVideo}
        onShowToast={onShowToast}
      />
      {generatedVideos.map((video, index) => (
        <VideoItem
          key={video.id || video.url || index}
          videoUrl={video.url}
          settled={video.settled}
          onSettledChange={(newSettled) => {
            onSetGeneratedVideos?.((prev) =>
              prev.map((item, itemIndex) => itemIndex === index
                ? { ...item, settled: newSettled }
                : { ...item, settled: newSettled ? false : item.settled })
            );
            if (newSettled && video.url) onSettleVideo?.(video.url);
          }}
          onView={() => onViewVideo?.(video, index)}
        />
      ))}
    </div>
  );
}

// 视频上传占位卡
function VideoUploadCard({
  onSetGeneratedVideos,
  onSettleVideo,
  onShowToast,
  projectId,
  shotId,
}) {
  const [hovered, setHovered] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const fileInputRef = useRef(null);

  async function handleUpload(file) {
    try {
      const result = await apiUploadStoryboardVideo(projectId, shotId, file);
      const videoUrl = result.video_url || result.videoUrl;
      if (videoUrl) {
        const normalizedUrl = normalizeImageUrl(videoUrl);
        onSetGeneratedVideos?.((prev) => [{ url: normalizedUrl, settled: false, id: result.id || normalizedUrl }, ...prev]);
        onSettleVideo?.(normalizedUrl, null);
      }
    } catch {
      onShowToast?.('视频上传失败，请重试', 'error');
    }
  }

  function handleAssetSelect(assets) {
    const newItems = (assets || []).map((asset) => {
      const url = normalizeImageUrl(asset.fileUrl || asset.originalUrl || asset.original_url || asset.thumbnailUrl || asset.thumbnail_url || asset.file_url || asset.url);
      return url ? { url, settled: false, id: asset.id || asset.asset_id || url } : null;
    }).filter(Boolean);
    onSetGeneratedVideos?.((prev) => [...newItems, ...prev]);
  }

  return (
    <>
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
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(event) => {
            if (event.target.files?.[0]) handleUpload(event.target.files[0]);
            event.target.value = '';
          }}
        />
        <ImgUploadBtn label="本地上传" onClick={() => fileInputRef.current?.click()} />
        <ImgUploadBtn label="从资产库选择" onClick={() => setAssetPickerOpen(true)} />
      </div>
      <AssetPickerModal
        accept="video"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        projectId={projectId}
        onConfirm={(assets) => {
          handleAssetSelect(assets);
          setAssetPickerOpen(false);
        }}
      />
    </>
  );
}

// 已生成视频卡
function VideoItem({ settled, videoUrl, onSettledChange, onView }) {
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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {videoUrl
          ? <video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
          : <DotsLoading size={4} color="#2DC3E1" gap={3} />}
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Checkbox checked={settled} onChange={(event) => { event.stopPropagation(); onSettledChange?.(!settled); }} />
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF', fontWeight: settled ? 600 : 500 }}>定稿</span>
      </div>
      {hovered && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          {videoUrl && (
            <ImgIconBtn onClick={(event) => { event.stopPropagation(); onView?.(videoUrl); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ImgIconBtn>
          )}
          <ImgIconBtn onClick={(event) => {
            event.stopPropagation();
            if (videoUrl) {
              const link = document.createElement('a');
              link.href = videoUrl;
              link.download = videoUrl.split('/').pop() || 'video.mp4';
              link.click();
            }
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ImgIconBtn>
        </div>
      )}
    </div>
  );
}
