/** 复用云端图片编辑保存与任务轮询，同型结果提交到源节点。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { savePendingImage } from '../../stores/LocalImageEdits';
import { prepareCanvasMediaAsset } from './CanvasMediaSize';
import { appendCanvasImageEdit, beginCanvasMediaEdit, finishCanvasMediaEdit, canvasImageEditCard } from './CanvasImageEdits';
import { getCanvasOperationLocks } from './CanvasOperationGuards.js';
import { commitCanvasMediaOutput, finishCanvasPendingUpload, getCanvasPermanentAssetId, isCanvasOutputProtected } from './CanvasAssets.js';
import { uploadCanvasAsset } from '../../api/canvasAssets';
import { apiGetCanvasDocument } from '../../api/canvas';
import { getAuthSessionGeneration } from '../../api/request';
import { showGlobalToast } from '../../stores/toastStore';

export function useCanvasImageEdits({ nodes, setNodes, canvasId, cancelPendingClicks }) {
  const [editor, setEditor] = useState(null);
  const currentCanvas = useRef(null);
  const latestNodes = useRef(nodes);
  const uploads = useRef(new WeakSet());
  useEffect(() => { latestNodes.current = nodes; }, [nodes]);
  // 页面上传器直接写入成功资产，在此补交首次上传的永久结果。
  useEffect(() => {
    const needsCommit = (node) => ['image', 'video', 'audio'].includes(node.type) && !node.data.nodeResults
      && node.data.asset?.source === 'local-upload' && node.data.asset.uploadStatus === 'ready'
      && getCanvasPermanentAssetId(node.data.asset);
    if (nodes.some(needsCommit)) setNodes((current) => {
      const locks = getCanvasOperationLocks(current);
      const eligible = (node) => needsCommit(node) && !isCanvasOutputProtected(node) && !locks.upstreamProtected.has(node.id);
      if (!current.some(eligible)) return current;
      return current.map((node) => eligible(node)
        ? commitCanvasMediaOutput({ ...node, data: { ...node.data, asset: null } }, node.data.asset, 'upload') : node);
    }, { origin: 'system' });
  }, [nodes, setNodes]);
  useEffect(() => {
    for (const node of nodes) {
      const pending = node.data.pendingCanvasUpload;
      if (!pending || pending.owner === 'page-replace' || uploads.current.has(pending)
        || pending.asset.uploadStatus !== 'uploading') continue;
      uploads.current.add(pending);
      const session = getAuthSessionGeneration();
      const finish = (uploaded, error) => {
        if (currentCanvas.current !== canvasId || session !== getAuthSessionGeneration()) return;
        setNodes((current) => finishCanvasPendingUpload(current, node.id, pending, uploaded, error), { origin: 'system' });
        if (error) showGlobalToast(error.message || '替换上传失败，原结果已保留', 'error');
      };
      void (async () => {
        try {
          const canvas = await apiGetCanvasDocument(canvasId);
          if (currentCanvas.current !== canvasId || session !== getAuthSessionGeneration()) return;
          const uploaded = await uploadCanvasAsset(pending.asset.file, node.type, { projectId: canvas.project_id });
          finish(uploaded);
        } catch (error) { finish(null, error); }
      })();
    }
  }, [nodes, canvasId, setNodes]);
  useEffect(() => {
    currentCanvas.current = canvasId;
    return () => { currentCanvas.current = null; };
  }, [canvasId]);
  const open = useCallback((nodeId, mode) => {
    const source = nodes.find((node) => node.id === nodeId);
    if (source?.type !== 'image' || !source.data?.asset?.url || !getCanvasPermanentAssetId(source.data.asset)
      || isCanvasOutputProtected(source) || getCanvasOperationLocks(nodes).upstreamProtected.has(nodeId)) return;
    cancelPendingClicks();
    const card = canvasImageEditCard(source.data.asset);
    // 继续使用源资产的真实创作归属，不把画布编号伪装成创作会话。
    const scope = `creation:${card.creationAssetId || card.asset_id || card.assetId || card.backendId || nodeId}`;
    const onSave = Object.assign(() => {}, {
      scope,
      pending: async (pending) => {
        const live = latestNodes.current.find((node) => node.id === nodeId);
        if (currentCanvas.current !== canvasId || !live || isCanvasOutputProtected(live)
          || getCanvasPermanentAssetId(live.data.asset) !== getCanvasPermanentAssetId(source.data.asset)
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
        const image = await savePendingImage(scope, pending);
        if (!image) return image;
        const asset = await prepareCanvasMediaAsset({ ...image, asset_type: 'image', url: image.originalUrl || image.remoteUrl });
        if (currentCanvas.current === canvasId) {
          let committed = false;
          const accepted = setNodes((current) => {
            const next = appendCanvasImageEdit(current, source, asset, `canvas-edit:${nodeId}:${image.id}`, operation);
            committed = next !== current;
            return next;
          }, { origin: 'system' });
          if (!committed || accepted === false) throw new Error('编辑结果未写回：源节点已删除、结果已变化或受到任务保护');
        } else {
          throw new Error('画布已切换，编辑结果未写回');
        }
        return image;
        } finally {
          if (currentCanvas.current === canvasId) setNodes((current) => finishCanvasMediaEdit(current, nodeId, operation), { origin: 'system', record: false });
        }
      },
    });
    setEditor({ canvasId, mode, card, onSave });
  }, [nodes, setNodes, canvasId, cancelPendingClicks]);
  return { editor: editor?.canvasId === canvasId ? editor : null, open, close: () => setEditor(null) };
}
