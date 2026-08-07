/**
 * @file VideoResultsPanel.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   视频上传/结果接线   连接上传卡片和视频结果展示卡
 *   视频结果列表       展示生成/上传的视频并维护列表状态
 *   视频结果操作       暴露查看、定稿和下载事件，不持有页面任务状态
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   通过 props 接收镜头、项目、结果列表、UI 按钮和业务回调；
 *   不读取 GenerateVideoPanel 或 StoryboardPage 的闭包变量。
 */

import { apiUploadStoryboardVideo } from '../../api/storyboard';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { mergeStoryboardMediaItems } from '../../utils/storyboardMediaDedup';
import VideoResultCard from './VideoResultCard';
import VideoUploadCard from './VideoUploadCard';

export default function VideoResultsPanel({
  shot,
  projectId,
  generatedVideos = [],
  onSetGeneratedVideos,
  onSettleVideo,
  onShowToast,
  onViewVideo,
  onCandidateMedia,
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
      <VideoUploadCard
        projectId={projectId}
        onUpload={(file) => handleVideoUpload(file, {
          projectId,
          shotId: shot?.id,
          onSetGeneratedVideos,
          onSettleVideo,
          onShowToast,
          onCandidateMedia,
        })}
        onAssetsSelected={(assets) => handleVideoAssetsSelected(assets, onSetGeneratedVideos, onCandidateMedia)}
      />
      {generatedVideos.map((video, index) => (
        <VideoResultCard
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
          onDownload={handleVideoDownload}
        />
      ))}
    </div>
  );
}

// 下载属于浏览器副作用，仍由业务结果面板统一编排。
function handleVideoDownload(videoUrl) {
  if (!videoUrl) return;
  const link = document.createElement('a');
  link.href = videoUrl;
  link.download = videoUrl.split('/').pop() || 'video.mp4';
  link.click();
}

// 上传 API、资产格式转换和结果写回仍由结果面板负责。
async function handleVideoUpload(file, { projectId, shotId, onSetGeneratedVideos, onSettleVideo, onShowToast, onCandidateMedia }) {
  try {
    const result = await apiUploadStoryboardVideo(projectId, shotId, file);
    const videoUrl = result.video_url || result.videoUrl;
    if (videoUrl) {
      const normalizedUrl = normalizeImageUrl(videoUrl);
      const candidate = { url: normalizedUrl, settled: false, id: result.id || normalizedUrl, asset_id: result.asset_id || result.assetId || null, media_type: 'video', source: 'local-upload' };
      onSetGeneratedVideos?.((prev) => mergeStoryboardMediaItems(prev, [candidate]));
      onCandidateMedia?.(candidate);
      onSettleVideo?.(normalizedUrl, null);
    }
  } catch {
    onShowToast?.('视频上传失败，请重试', 'error');
  }
}

function handleVideoAssetsSelected(assets, onSetGeneratedVideos, onCandidateMedia) {
  const newItems = (assets || []).map((asset) => {
    const url = normalizeImageUrl(asset.fileUrl || asset.originalUrl || asset.original_url || asset.thumbnailUrl || asset.thumbnail_url || asset.file_url || asset.url);
    return url ? { url, settled: false, id: asset.id || asset.asset_id || url, media_type: 'video', source: 'asset-library' } : null;
  }).filter(Boolean);
  onSetGeneratedVideos?.((prev) => mergeStoryboardMediaItems(prev, newItems));
  newItems.forEach((item) => onCandidateMedia?.(item));
}
