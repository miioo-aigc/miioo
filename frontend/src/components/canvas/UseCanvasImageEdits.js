/** 复用云端图片编辑保存与任务轮询；画布只负责接收新结果，不修改源节点。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { savePendingImage } from '../../stores/LocalImageEdits';
import { prepareCanvasMediaAsset } from './CanvasMediaSize';
import { appendCanvasImageEdit, canvasImageEditCard } from './CanvasImageEdits';

export function useCanvasImageEdits({ nodes, setNodes, canvasId, cancelPendingClicks }) {
  const [editor, setEditor] = useState(null);
  const currentCanvas = useRef(null);
  useEffect(() => {
    currentCanvas.current = canvasId;
    return () => { currentCanvas.current = null; };
  }, [canvasId]);
  const open = useCallback((nodeId, mode) => {
    const source = nodes.find((node) => node.id === nodeId);
    if (!source?.data?.asset?.url) return;
    cancelPendingClicks();
    const card = canvasImageEditCard(source.data.asset);
    // 继续使用源资产的真实创作归属，不把画布编号伪装成创作会话。
    const scope = `creation:${card.creationAssetId || card.asset_id || card.assetId || card.backendId || nodeId}`;
    const onSave = Object.assign(() => {}, {
      scope,
      pending: async (pending) => {
        const image = await savePendingImage(scope, pending);
        const asset = await prepareCanvasMediaAsset({ ...image, asset_type: 'image', url: image.originalUrl || image.remoteUrl });
        if (currentCanvas.current === canvasId) {
          setNodes((current) => appendCanvasImageEdit(current, source, asset, `canvas-edit:${nodeId}:${image.id}`));
        }
        return image;
      },
    });
    setEditor({ canvasId, mode, card, onSave });
  }, [nodes, setNodes, canvasId, cancelPendingClicks]);
  return { editor: editor?.canvasId === canvasId ? editor : null, open, close: () => setEditor(null) };
}
