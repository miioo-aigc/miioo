/** 拖线新建保留媒体关系；能力未加载返回 null，加载完成后返回校验原因。 */
import { disconnectCanvasImage, getCanvasImageConnectionError } from './CanvasImageGeneration.js';
import { disconnectCanvasVideo, getCanvasVideoSourceIds, validateCanvasVideoReferenceAddition } from './CanvasVideoGeneration.js';

export function getCanvasNewConnectionError(nodes, connection) {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target || source.type === 'text') return '';
  if (target.type === 'image') {
    if (!target.data.imageSourceIds?.includes(source.id)) return '';
    if (!Number.isInteger(target.data.imageReferenceLimit)) return null;
    return getCanvasImageConnectionError(disconnectCanvasImage(nodes, target.id, source.id), connection);
  }
  if (target.type === 'video') {
    if (!getCanvasVideoSourceIds(target).includes(source.id)) return '';
    if (!target.data.videoCapabilities) return null;
    const candidates = disconnectCanvasVideo(nodes, target.id, source.id);
    return validateCanvasVideoReferenceAddition(candidates, target.id, {
      asset_type: source.data.asset?.asset_type || source.type,
    }).message;
  }
  return '';
}
