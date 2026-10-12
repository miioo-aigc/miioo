/** 批量参考素材先完整校验，再一次写入；拒绝时不留下部分节点。 */
import { toCanvasAsset } from './CanvasAssets.js';
import { preserveCanvasImportPanels } from './CanvasImportLayout.js';
import { addCanvasReference, getCanvasReferences } from './CanvasReferences.js';
import { getCanvasPromptReferences } from './CanvasPromptReferences.js';
import { validateCanvasVideoReferenceAddition } from './CanvasVideoGeneration.js';

export function planCanvasReferenceBatch(nodes, targetId, assets, mode) {
  let next = nodes;
  for (const selected of assets) {
    const target = next.find((node) => node.id === targetId);
    const asset = toCanvasAsset(selected, target?.type);
    if (!target || !asset) return { allowed: false, message: '请选择有效的参考素材', nodes };
    if (target.type === 'video') {
      const validation = validateCanvasVideoReferenceAddition(next, targetId, asset);
      if (!validation.allowed) return { ...validation, nodes };
    } else {
      const limit = target.data.imageReferenceLimit || 0;
      const count = getCanvasPromptReferences(next, targetId).filter((item) => item.asset.asset_type === 'image').length;
      if (count >= limit) return { allowed: false, message: `当前图片模型最多支持 ${limit} 张参考图`, nodes };
    }
    if (mode === 'frame' && asset.asset_type === 'image'
      && getCanvasReferences(next, targetId).filter((item) => item.slot < 2 && item.asset.asset_type === 'image').length >= 2) {
      return { allowed: false, message: '首尾帧已填满，请先移除需要替换的图片', nodes };
    }
    const previous = next;
    next = addCanvasReference(next, targetId, asset, mode);
    // 图片生成读取 imageSourceIds；让参考栏导入与手动连线保持一致。
    if (target.type === 'image') {
      const source = next.find((node) => !previous.some((old) => old.id === node.id));
      if (source) next = next.map((node) => node.id === targetId ? {
        ...node, data: { ...node.data, imageSourceIds: [...(node.data.imageSourceIds || []), source.id] },
      } : node);
    }
  }
  return { allowed: true, message: '', nodes: assets.length > 1 ? preserveCanvasImportPanels(nodes, next) : next };
}
