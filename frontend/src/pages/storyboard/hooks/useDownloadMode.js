import { useState, useCallback } from 'react';
import { apiBatchDownloadStoryboardImages, apiBatchDownloadStoryboardVideos } from '../../../api/storyboard';
import { triggerDownload } from '../../../utils/download';

export function useDownloadMode({ shots, projectId, showToast }) {
  const [downloadMode, setDownloadMode] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState(new Set());
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const enterDownloadMode = useCallback(() => {
    setDownloadMode(true);
    setSelectedShotIds(new Set());
  }, []);

  const exitDownloadMode = useCallback(() => {
    setDownloadMode(false);
    setSelectedShotIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedShotIds((prev) => {
      if (prev.size === shots.length) return new Set();
      return new Set(shots.map((s) => s.id));
    });
  }, [shots]);

  const toggleShotSelection = useCallback((id) => {
    setSelectedShotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleDownloadImages = useCallback(async () => {
    const ids = [...selectedShotIds];
    if (ids.length === 0) { showToast('暂无可下载的分镜图', 'warning'); return; }
    try {
      const blob = await apiBatchDownloadStoryboardImages(projectId, ids);
      triggerDownload(blob, 'storyboard-images.zip');
      showToast(`已下载 ${ids.length} 个分镜图`, 'success');
    } catch (err) {
      console.error('批量下载图片失败:', err);
      showToast('批量下载图片失败', 'error');
    }
  }, [selectedShotIds, projectId, showToast]);

  const handleDownloadVideos = useCallback(async () => {
    const ids = [...selectedShotIds];
    if (ids.length === 0) { showToast('暂无可下载的分镜视频', 'warning'); return; }
    try {
      const blob = await apiBatchDownloadStoryboardVideos(projectId, ids);
      triggerDownload(blob, 'storyboard-videos.zip');
      showToast(`已下载 ${ids.length} 个分镜视频`, 'success');
    } catch (err) {
      console.error('批量下载视频失败:', err);
      showToast('批量下载视频失败', 'error');
    }
  }, [selectedShotIds, projectId, showToast]);

  const handleBatchDownload = useCallback(() => {
    const assets = shots.flatMap((s) => {
      const items = [];
      if (s.storyboardImage?.url) items.push({ url: s.storyboardImage.url, name: `shot-${s.number}-image.jpg` });
      if (s.storyboardVideo?.url) items.push({ url: s.storyboardVideo.url, name: `shot-${s.number}-video.mp4` });
      return items;
    });
    if (assets.length === 0) { showToast('暂无可下载的素材', 'warning'); return; }
    assets.forEach(({ url, name }) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    showToast(`已下载 ${assets.length} 个素材`, 'success');
  }, [shots, showToast]);

  return {
    downloadMode,
    selectedShotIds,
    showDownloadModal,
    setShowDownloadModal,
    enterDownloadMode,
    exitDownloadMode,
    toggleSelectAll,
    toggleShotSelection,
    handleDownloadImages,
    handleDownloadVideos,
    handleBatchDownload,
  };
}
