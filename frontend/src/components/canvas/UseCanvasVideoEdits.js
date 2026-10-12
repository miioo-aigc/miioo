import { useCallback, useEffect, useRef, useState } from 'react';
import { runVideoEdit } from '../../stores/videoEditStore';
import { showGlobalToast } from '../../stores/toastStore';
import { appendCanvasMediaEdit } from './CanvasImageEdits';
import { prepareCanvasMediaAsset } from './CanvasMediaSize';

export function useCanvasVideoEdits({ nodes, setNodes, canvasId, cancelPendingClicks }) {
  const [editor, setEditor] = useState(null);
  const currentCanvas = useRef(null);
  useEffect(() => {
    currentCanvas.current = canvasId;
    return () => { currentCanvas.current = null; };
  }, [canvasId]);
  const open = useCallback((nodeId, mode) => {
    const source = nodes.find((node) => node.id === nodeId);
    const asset = source?.data?.asset;
    if (!asset?.url || asset.asset_type !== 'video') return;
    cancelPendingClicks();
    const originalUrl = asset.originalUrl || asset.original_url || asset.download_url || asset.downloadUrl || asset.url;
    const submit = async (sourceAsset, options, onStarted) => {
      const result = await runVideoEdit(sourceAsset, { ...options, persistToCreation: false, suppressSuccessToast: true }, onStarted);
      if (!result) return;
      const type = options.mode === 'frame_extract' ? 'image' : 'video';
      const url = type === 'image' ? result.original_url || result.image_url : result.video_url;
      const prepared = await prepareCanvasMediaAsset({ ...result, asset_type: type, url, originalUrl: url, name: result.name || (type === 'image' ? '视频选帧' : '编辑视频') });
      if (currentCanvas.current === canvasId) {
        setNodes((current) => appendCanvasMediaEdit(current, source, prepared, `canvas-video-edit:${nodeId}:${result.id}`, type));
        showGlobalToast(type === 'image' ? '已新增选帧图片节点' : '已新增视频节点', 'success');
      }
      return result;
    };
    setEditor({ canvasId, mode, submit, sourceAsset: { ...asset, canvasEditScope: `${canvasId}:${nodeId}`, originalUrl, videoUrl: originalUrl }, videoUrl: originalUrl, originalVideoUrl: originalUrl, posterUrl: asset.posterUrl });
  }, [nodes, setNodes, canvasId, cancelPendingClicks]);
  return { editor: editor?.canvasId === canvasId ? editor : null, open, close: () => setEditor(null) };
}
