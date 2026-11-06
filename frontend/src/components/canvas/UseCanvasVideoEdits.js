import { useCallback, useEffect, useRef, useState } from 'react';
import { runVideoEdit } from '../../stores/videoEditStore';
import { showGlobalToast } from '../../stores/toastStore';
import { appendCanvasMediaEdit, beginCanvasMediaEdit, finishCanvasMediaEdit } from './CanvasImageEdits';
import { getCanvasOperationLocks } from './CanvasOperationGuards.js';
import { prepareCanvasMediaAsset } from './CanvasMediaSize';
import { getCanvasPermanentAssetId, isCanvasOutputProtected } from './CanvasAssets.js';

export function useCanvasVideoEdits({ nodes, setNodes, canvasId, cancelPendingClicks }) {
  const [editor, setEditor] = useState(null);
  const currentCanvas = useRef(null);
  const latestNodes = useRef(nodes);
  useEffect(() => { latestNodes.current = nodes; }, [nodes]);
  useEffect(() => {
    currentCanvas.current = canvasId;
    return () => { currentCanvas.current = null; };
  }, [canvasId]);
  const open = useCallback((nodeId, mode) => {
    const source = nodes.find((node) => node.id === nodeId);
    const asset = source?.data?.asset;
    if (source?.type !== 'video' || !asset?.url || asset.asset_type !== 'video'
      || !getCanvasPermanentAssetId(asset) || isCanvasOutputProtected(source)
      || getCanvasOperationLocks(nodes).upstreamProtected.has(nodeId)) return;
    cancelPendingClicks();
    const originalUrl = asset.originalUrl || asset.original_url || asset.download_url || asset.downloadUrl || asset.url;
    const submit = async (sourceAsset, options, onStarted) => {
      const live = latestNodes.current.find((node) => node.id === nodeId);
      if (currentCanvas.current !== canvasId || !live || isCanvasOutputProtected(live)
        || getCanvasPermanentAssetId(live.data.asset) !== getCanvasPermanentAssetId(asset)
        || live.data.nodeResults?.currentResultId !== source.data.nodeResults?.currentResultId) {
        throw new Error('源节点已删除、结果已变化或受到任务保护，请重新打开编辑');
      }
      const operation = crypto.randomUUID();
      let started = false;
      setNodes((current) => {
        const next = beginCanvasMediaEdit(current, source, operation);
        started = next !== current;
        return next;
      }, { origin: 'system', record: false });
      if (!started) throw new Error('源节点受到任务保护，请重新打开编辑');
      try {
      const result = await runVideoEdit(sourceAsset, { ...options, persistToCreation: false, suppressSuccessToast: true }, onStarted);
      if (!result) return;
      const type = options.mode === 'frame_extract' ? 'image' : 'video';
      const url = type === 'image' ? result.original_url || result.image_url : result.video_url;
      const prepared = await prepareCanvasMediaAsset({ ...result, asset_type: type, url, originalUrl: url, name: result.name || (type === 'image' ? '视频选帧' : '编辑视频') });
      if (currentCanvas.current === canvasId) {
        let committed = false;
        const accepted = setNodes((current) => {
          const next = appendCanvasMediaEdit(current, source, prepared, `canvas-video-edit:${nodeId}:${result.id}`, type, operation);
          committed = next !== current;
          return next;
        }, { origin: type === 'image' ? 'user-add' : 'system' });
        if (!committed || accepted === false) {
          showGlobalToast('编辑结果未写回：源节点已删除、结果已变化或受到任务保护', 'error');
          return;
        }
        showGlobalToast(type === 'image' ? '选帧图片已保存' : '编辑视频已保存', 'success');
      }
      return result;
      } finally {
        if (currentCanvas.current === canvasId) setNodes((current) => finishCanvasMediaEdit(current, nodeId, operation), { origin: 'system', record: false });
      }
    };
    setEditor({ canvasId, mode, submit, sourceAsset: { ...asset, canvasEditScope: `${canvasId}:${nodeId}`, originalUrl, videoUrl: originalUrl }, videoUrl: originalUrl, originalVideoUrl: originalUrl, posterUrl: asset.posterUrl });
  }, [nodes, setNodes, canvasId, cancelPendingClicks]);
  return { editor: editor?.canvasId === canvasId ? editor : null, open, close: () => setEditor(null) };
}
