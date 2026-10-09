/** 视频直连素材、能力校验和结果节点快照；不复用创作页的模式推断。 */
import { appendCanvasNode, createCanvasNode } from './canvasNodeUtils.js';
import { getCanvasAbsolutePosition, setCanvasSelection } from './CanvasGroups.js';
import { isCanvasSeedanceVideoEdit } from './CanvasVideoModels.js';

const TYPES = ['text', 'image', 'video', 'audio'];
const MEDIA_TYPES = ['image', 'video', 'audio'];
const TYPE_LABELS = { image: '图片', video: '视频', audio: '音频' };
const find = (nodes, id) => nodes.find((node) => node.id === id);
const limit = (value) => Number.isInteger(value) && value >= 0 ? value : 0;

function getCanvasVideoLimits(capabilities = {}, mode) {
  const limits = {
    image: limit(capabilities.max_reference_images),
    video: limit(capabilities.max_reference_videos),
    audio: limit(capabilities.max_reference_audios),
  };
  if (['text_to_video', 'first_frame', 'last_frame', 'start_end'].includes(mode)) {
    limits.image = ['first_frame', 'last_frame'].includes(mode) ? 1 : mode === 'start_end' ? 2 : 0;
    limits.video = 0;
    limits.audio = 0;
  }
  return limits;
}

function getCanvasVideoMediaRule(capabilities = {}, model = '', mode) {
  return {
    limits: getCanvasVideoLimits(capabilities, mode),
    totalLimit: Number.isInteger(capabilities.max_total_attachments) && capabilities.max_total_attachments >= 0
      ? capabilities.max_total_attachments : Infinity,
    requiredImages: ['first_frame', 'last_frame'].includes(mode) ? 1 : mode === 'start_end' ? 2 : 0,
    requiredVideos: /^happyhorse-1\.[01]-video-edit$/i.test(model) && ['video_ref', 'video_edit'].includes(mode) ? 1 : 0,
    audioNeedsCompanion: /^doubao-seedance-2(?:\.0|-0-(?:fast|mini))/.test(model)
      && ['full', 'video_ref', 'video_edit'].includes(mode),
  };
}

function countCanvasVideoMedia(types, rule) {
  const counts = { image: 0, video: 0, audio: 0 };
  let total = 0;
  let overflowType = '';
  for (const type of types) {
    if (!MEDIA_TYPES.includes(type)) continue;
    counts[type] += 1;
    total += 1;
    if (!overflowType && (counts[type] > rule.limits[type] || total > rule.totalLimit)) overflowType = type;
  }
  return { counts, total, overflowType };
}

export function validateCanvasVideoMedia(types, capabilities, model, mode, { final = false } = {}) {
  const rule = getCanvasVideoMediaRule(capabilities, model, mode);
  const status = countCanvasVideoMedia(types, rule);
  if (status.overflowType) {
    const type = status.overflowType;
    const max = rule.limits[type];
    return { allowed: false, message: max === 0
      ? `当前参考模式不支持${TYPE_LABELS[type]}素材`
      : `当前参考模式最多支持${max}${type === 'image' ? '张' : '条'}${TYPE_LABELS[type]}素材` };
  }
  if (final && rule.requiredImages && status.counts.image !== rule.requiredImages) {
    return { allowed: false, message: `当前参考模式需要${rule.requiredImages}张图片素材` };
  }
  if (final && rule.requiredVideos && status.counts.video !== rule.requiredVideos) {
    return { allowed: false, message: `当前参考模式需要${rule.requiredVideos}条视频素材` };
  }
  if (final && rule.audioNeedsCompanion && status.counts.audio > 0
    && status.counts.image + status.counts.video === 0) {
    return { allowed: false, message: '音频不可作为唯一参考素材' };
  }
  return { allowed: true, message: '' };
}

export function validateCanvasVideoReferenceAddition(nodes, targetId, asset) {
  const target = find(nodes, targetId);
  if (target?.type !== 'video' || !MEDIA_TYPES.includes(asset?.asset_type)) return { allowed: false, message: '请选择有效的参考素材' };
  const existingTypes = getCanvasVideoSourceIds(target).map((id) => {
    const source = find(nodes, id);
    return source?.data.asset?.asset_type || source?.type;
  }).filter((type) => MEDIA_TYPES.includes(type));
  if (target.data.asset?.url) existingTypes.push(target.data.asset.asset_type || 'video');
  return validateCanvasVideoMedia([...existingTypes, asset.asset_type], target.data.videoCapabilities, target.data.model, target.data.generationMode);
}

export function getCanvasVideoSourceIds(target) {
  return [...new Set([
    ...(target?.data.videoSourceIds || []),
    ...(target?.data.textSourceIds || []),
    ...(target?.data.referenceInputs || []).sort((a, b) => a.slot - b.slot).map((input) => input.sourceId),
  ])];
}

export function isCanvasVideoConnection(nodes, connection) {
  const source = find(nodes, connection.source);
  const target = find(nodes, connection.target);
  return TYPES.includes(source?.type) && target?.type === 'video' && source.id !== target.id
    && (!connection.sourceHandle || connection.sourceHandle === `${source.type}-output`)
    && (!connection.targetHandle || connection.targetHandle === 'video-input');
}

export function getCanvasVideoReferenceStatus(nodes, targetId, capabilities, sourceIds) {
  const target = find(nodes, targetId);
  const caps = capabilities || target?.data.videoCapabilities || {};
  const mode = caps.selectedGenerationMode || target?.data.generationMode;
  const rule = getCanvasVideoMediaRule(caps, target?.data.model, mode);
  const counts = { image: 0, video: 0, audio: 0 };
  const mediaSourceIds = [];
  const overflowSourceIds = [];
  for (const id of sourceIds || getCanvasVideoSourceIds(target)) {
    const source = find(nodes, id);
    const type = source?.data.asset?.asset_type || source?.type;
    if (!Object.hasOwn(counts, type)) continue;
    mediaSourceIds.push(id);
    counts[type] += 1;
    if (counts[type] > rule.limits[type] || mediaSourceIds.length > rule.totalLimit) overflowSourceIds.push(id);
  }
  return { mediaSourceIds, overflowSourceIds, canGenerate: overflowSourceIds.length === 0 };
}

export function canConnectCanvasVideo(nodes, connection) {
  return isCanvasVideoConnection(nodes, connection);
}

export function connectCanvasVideo(nodes, connection, capabilities) {
  if (!canConnectCanvasVideo(nodes, connection, capabilities)) return nodes;
  return setCanvasSelection(nodes.map((node) => node.id === connection.target ? {
    ...node, data: { ...node.data, videoSourceIds: [...new Set([...getCanvasVideoSourceIds(node), connection.source])], persistenceState: 'draft' },
  } : node), [connection.target], true);
}

export function disconnectCanvasVideo(nodes, targetId, sourceId) {
  return nodes.map((node) => node.id === targetId ? { ...node, data: { ...node.data,
    videoSourceIds: (node.data.videoSourceIds || []).filter((id) => id !== sourceId),
    textSourceIds: (node.data.textSourceIds || []).filter((id) => id !== sourceId),
    referenceInputs: (node.data.referenceInputs || []).filter((input) => input.sourceId !== sourceId),
  } } : node);
}

export function getCanvasVideoEdges(nodes) {
  return nodes.filter((node) => node.type === 'video').flatMap((target) => {
    const status = getCanvasVideoReferenceStatus(nodes, target.id);
    return getCanvasVideoSourceIds(target).filter((id) => TYPES.includes(find(nodes, id)?.type)).map((id) => {
      const overflow = status.overflowSourceIds.includes(id);
      return { id: `video-material:${id}:${target.id}`, source: id, target: target.id,
        sourceHandle: `${find(nodes, id).type}-output`, targetHandle: 'video-input', data: { overflow },
        className: overflow ? 'canvas-edge--overflow' : undefined,
        style: { stroke: overflow ? 'var(--color-text-danger)' : 'var(--color-stroke-accent)', strokeWidth: 2 } };
    });
  });
}

export function getCanvasVideoRequestModes(capabilities, mode) {
  if (!capabilities?.supported_generation_modes?.includes(mode)
    || !Object.hasOwn(capabilities?.generation_reference_mode_map || {}, mode)) throw new Error('当前视频模式缺少后端映射，请刷新模型列表');
  return { generation_mode: mode, reference_mode: capabilities.generation_reference_mode_map[mode] };
}

export function planCanvasVideoGeneration(nodes, nodeId, prompt, model, params = {}) {
  const target = find(nodes, nodeId);
  if (target?.type !== 'video') throw new Error('视频节点已不存在');
  if (!prompt?.trim()) throw new Error('请输入创作提示词');
  if (!model) throw new Error('请选择可用的视频模型');
  const capabilities = params.capabilities || target.data.videoCapabilities || {};
  const mode = params.generationMode || target.data.generationMode;
  // 请求快照同样兜底，避免快速切换或旧参数绕过编辑模式约束。
  const effectiveParams = isCanvasSeedanceVideoEdit(model, mode)
    ? { ...params, ratio: 'adaptive', duration: '-1' } : params;
  const modes = getCanvasVideoRequestModes(capabilities, mode);
  const ids = getCanvasVideoSourceIds(target);
  if (target.data.asset?.url) ids.push(target.id);
  const sources = ids.map((id) => find(nodes, id)).filter((source) => TYPES.includes(source?.type)).map((source) => ({
    id: source.id, type: source.type === 'text' ? 'text' : source.data.asset?.asset_type || source.type,
    label: source.data.label, content: source.type === 'text' ? source.data.content : undefined, asset: source.data.asset || undefined,
  }));
  const images = sources.filter((source) => source.type === 'image' && source.asset?.url);
  const mediaValidation = validateCanvasVideoMedia(
    sources.filter((source) => MEDIA_TYPES.includes(source.type) && source.asset?.url).map((source) => source.type),
    capabilities, model, mode, { final: true },
  );
  if (!mediaValidation.allowed) throw new Error(mediaValidation.message);
  const createsResult = Boolean(target.data.asset?.url);
  return { nodeId, prompt, model, sources, capabilities, generationMode: mode,
    params: { ...effectiveParams, ...modes, videoCapabilities: capabilities, supportedGenerationModes: capabilities.supported_generation_modes, videoDuration: effectiveParams.duration,
      firstFrameUrl: ['first_frame', 'start_end'].includes(mode) ? images[0]?.asset.url : undefined,
      lastFrameUrl: mode === 'start_end' ? images[1]?.asset.url : undefined },
    requestId: crypto.randomUUID(), createsResult, resultId: createsResult ? `canvas-video-${crypto.randomUUID()}` : nodeId };
}

export function beginCanvasVideoGeneration(nodes, plan) {
  const target = find(nodes, plan.nodeId);
  if (!target) return nodes;
  const pending = nodes.map((node) => node.id === plan.nodeId ? { ...node, data: { ...node.data, creationPanelOpen: false,
    generating: !plan.createsResult, generationRequestId: plan.createsResult ? undefined : plan.requestId, generationError: '' } } : node);
  if (!plan.createsResult) return pending;
  const position = getCanvasAbsolutePosition(nodes, target);
  const result = createCanvasNode('video', { x: position.x + 320, y: position.y }, plan.resultId);
  while (nodes.some((node) => { const p = getCanvasAbsolutePosition(nodes, node); return Math.abs(p.x - result.position.x) < 260 && Math.abs(p.y - result.position.y) < 280; })) result.position.y += 300;
  result.data = { ...result.data, model: plan.model, prompt: plan.prompt, videoCapabilities: plan.capabilities, generationMode: plan.generationMode,
    generating: true, generationRequestId: plan.requestId, videoSourceIds: plan.sources.map((source) => source.id) };
  return setCanvasSelection(appendCanvasNode(pending, result), [result.id], false);
}

export function recoverCanvasVideoGenerationFailure(nodes, plan) {
  return nodes.map((node) => node.id === plan.resultId && node.data.generationRequestId === plan.requestId
    ? { ...node, data: { ...node.data, generating: false, generationError: '', generationRequestId: undefined } } : node);
}

export function applyCanvasVideoResult(nodes, plan, asset) {
  if (!nodes.some((node) => node.id === plan.resultId && node.data.generationRequestId === plan.requestId)) return nodes;
  return recoverCanvasVideoGenerationFailure(nodes, plan).map((node) => node.id === plan.resultId && !node.data.asset?.url ? { ...node, data: { ...node.data, asset } } : node);
}
