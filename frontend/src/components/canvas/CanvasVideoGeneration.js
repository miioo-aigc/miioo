/** 视频直连素材、能力校验和结果节点快照；不复用创作页的模式推断。 */
import { setCanvasSelection } from './CanvasGroups.js';
import { commitCanvasNodeOutput } from './CanvasResultMutations.js';
import { isCanvasSeedanceVideoEdit } from './CanvasVideoModels.js';

const TYPES = ['text', 'image', 'video', 'audio'];
const MEDIA_TYPES = ['image', 'video', 'audio'];
const TYPE_LABELS = { image: '图片', video: '视频', audio: '音频' };
const find = (nodes, id) => nodes.find((node) => node.id === id);
const limit = (value) => Number.isInteger(value) && value >= 0 ? value : 0;
const assetIdentity = (asset) => asset?.asset_id || asset?.assetId || asset?.backendId || asset?.url || null;

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
  return validateVideoAddition(existingTypes, asset.asset_type, target.data.videoCapabilities, target.data.model, target.data.generationMode);
}

// 新增只检查候选类型及总名额，不因其他类型已有超限而拒绝。
function validateVideoAddition(types, type, capabilities, model, mode) {
  const rule = getCanvasVideoMediaRule(capabilities, model, mode);
  const count = types.filter((existing) => existing === type).length;
  if (count >= rule.limits[type]) return { allowed: false, message: rule.limits[type] === 0
    ? `当前参考模式不支持${TYPE_LABELS[type]}素材`
    : `当前参考模式最多支持${rule.limits[type]}${type === 'image' ? '张' : '条'}${TYPE_LABELS[type]}素材` };
  if (types.length >= rule.totalLimit) return { allowed: false, message: '参考素材总数已达到当前模型上限' };
  return { allowed: true, message: '' };
}

export function getCanvasVideoSourceIds(target) {
  return [...new Set([
    ...(target?.data.videoSourceIds || []),
    ...(target?.data.textSourceIds || []),
    ...(target?.data.referenceInputs || []).sort((a, b) => a.slot - b.slot).map((input) => input.sourceId),
  ])].filter((id) => id !== target?.id);
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

export function canConnectCanvasVideo(nodes, connection, capabilities) {
  if (!isCanvasVideoConnection(nodes, connection)) return false;
  const target = find(nodes, connection.target);
  const source = find(nodes, connection.source);
  if (source.type === 'text' || getCanvasVideoSourceIds(target).includes(source.id)) return true;
  const caps = capabilities || target.data.videoCapabilities || {};
  const types = getCanvasVideoSourceIds(target).map((id) => {
    const item = find(nodes, id);
    return item?.data.asset?.asset_type || item?.type;
  }).filter((type) => MEDIA_TYPES.includes(type));
  return validateVideoAddition(types, source.data.asset?.asset_type || source.type, caps,
    target.data.model, caps.selectedGenerationMode || target.data.generationMode).allowed;
}

export function connectCanvasVideo(nodes, connection, capabilities, { retainInvalid = false } = {}) {
  if (!isCanvasVideoConnection(nodes, connection)
    || (!retainInvalid && !canConnectCanvasVideo(nodes, connection, capabilities))) return nodes;
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
  if (nodes.find(node => node.id === nodeId)?.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading') throw new Error('素材正在替换上传，请稍后再试');
  const target = find(nodes, nodeId);
  if (target?.type !== 'video') throw new Error('视频节点已不存在');
  if (target.data.generating || target.data.submissionLocked || target.data.editing || target.data.upstreamProtected) throw new Error('当前节点正在执行或受到任务保护');
  if (!model) throw new Error('请选择可用的视频模型');
  const capabilities = params.capabilities || target.data.videoCapabilities || {};
  const mode = params.generationMode || target.data.generationMode;
  // 请求快照同样兜底，避免快速切换或旧参数绕过编辑模式约束。
  const effectiveParams = isCanvasSeedanceVideoEdit(model, mode)
    ? { ...params, ratio: 'adaptive', duration: '-1' } : params;
  const modes = getCanvasVideoRequestModes(capabilities, mode);
  const ids = getCanvasVideoSourceIds(target);
  const upstream = ids.map((id) => find(nodes, id));
  if (upstream.some((source) => source?.data.generating || source?.data.submissionLocked || source?.data.editing)) throw new Error('直接上游正在提交或生成');
  if (upstream.some((source) => !TYPES.includes(source?.type))) throw new Error('直接上游素材已不存在');
  const sources = upstream.map((source) => ({
    id: source.id, type: source.type === 'text' ? 'text' : source.data.asset?.asset_type || source.type,
    label: source.data.label, content: source.type === 'text' ? source.data.content : undefined,
    asset: source.type === 'text' ? undefined : structuredClone(source.data.asset),
  }));
  const images = sources.filter((source) => source.type === 'image' && source.asset?.url);
  const occupancy = validateCanvasVideoMedia(sources.filter((source) => MEDIA_TYPES.includes(source.type)).map((source) => source.type),
    capabilities, model, mode);
  if (!occupancy.allowed) throw new Error(occupancy.message);
  if (sources.some((source) => source.type === 'text' ? !source.content?.trim()
    : !source.asset?.url || ['missing', 'forbidden'].includes(source.asset.availability))) throw new Error('直接上游缺少有效结果');
  const mediaValidation = validateCanvasVideoMedia(
    sources.filter((source) => MEDIA_TYPES.includes(source.type) && source.asset?.url).map((source) => source.type),
    capabilities, model, mode, { final: true },
  );
  if (!mediaValidation.allowed) throw new Error(mediaValidation.message);
  const instruction = prompt?.trim() ? prompt : sources.filter((source) => source.type === 'text').map((source) => source.content).join('\n\n');
  if (!instruction?.trim()) throw new Error('请输入创作提示词');
  const snapshotParams = JSON.parse(JSON.stringify({
    ...effectiveParams,
    generation_mode: modes.generation_mode,
    reference_mode: modes.reference_mode,
    capabilities: undefined,
    generationMode: undefined,
  }));
  const snapshot = { prompt: instruction, model, generationMode: mode, params: snapshotParams,
    inputs: sources.map((source) => source.type === 'text' ? { nodeId: source.id, content: source.content }
      : { nodeId: source.id, type: source.type, assetId: source.asset.asset_id || source.asset.assetId || source.asset.backendId || null }) };
  return { nodeId, prompt: instruction, model, sources, capabilities, generationMode: mode,
    referenceMaterials: prompt?.trim() ? sources.filter((source) => source.type === 'text') : [],
    snapshot, submittedAt: Date.now(), taskIds: [], originalAssetId: assetIdentity(target.data.asset),
    params: { ...effectiveParams, ...modes, videoCapabilities: capabilities, supportedGenerationModes: capabilities.supported_generation_modes, videoDuration: effectiveParams.duration,
      firstFrameUrl: ['first_frame', 'start_end'].includes(mode) ? images[0]?.asset.url : undefined,
      lastFrameUrl: mode === 'start_end' ? images[1]?.asset.url : undefined },
    requestId: crypto.randomUUID(), createsResult: false, resultId: nodeId };
}

export function beginCanvasVideoGeneration(nodes, plan) {
  if (nodes.find(node => node.id === plan.nodeId)?.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading') throw new Error('素材正在替换上传，请稍后再试');
  const target = find(nodes, plan.nodeId);
  if (!target) throw new Error('视频节点已不存在，已取消本次创作');
  if (target.data.generating || target.data.submissionLocked) throw new Error('当前视频节点正在提交或生成，已取消本次创作');
  const protectedBy = nodes.find((node) => node.id !== target.id && node.data.submissionLocked
    && Array.isArray(node.data.executionSourceIds) && node.data.executionSourceIds.includes(target.id));
  if (protectedBy) throw new Error('当前视频节点已被其他任务作为上游保护，已取消本次创作');
  return nodes.map((node) => node.id === plan.nodeId ? { ...node, data: { ...node.data, creationPanelOpen: false,
    generating: true, generationRequestId: plan.requestId, generationError: '', submissionLocked: true,
    executionSourceIds: plan.sources.map((source) => source.id), generationTaskIds: [] } } : node);
}

export function acceptCanvasVideoSubmission(nodes, plan, { taskId, taskIds } = {}) {
  const ids = Array.isArray(taskIds) && taskIds.length ? taskIds : [taskId];
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) throw new Error('视频任务缺少真实服务端编号');
  plan.taskIds = [...new Set([...(plan.taskIds || []), ...ids])];
  return nodes.map((node) => node.id === plan.nodeId && node.data.generationRequestId === plan.requestId
    ? { ...node, data: { ...node.data, submissionLocked: false, generationTaskIds: [...plan.taskIds] } } : node);
}

export function recoverCanvasVideoGenerationFailure(nodes, plan) {
  return nodes.map((node) => node.id === plan.resultId && node.data.generationRequestId === plan.requestId
    ? { ...node, data: { ...node.data, generating: false, generationError: '', generationRequestId: undefined,
      submissionLocked: false, executionSourceIds: undefined, generationTaskIds: undefined } } : node);
}

export function applyCanvasVideoResult(nodes, plan, asset) {
  if (!nodes.some((node) => node.id === plan.resultId && node.data.generationRequestId === plan.requestId)) return nodes;
  const completedAt = Date.now();
  const committed = nodes.map((node) => {
    if (node.id !== plan.resultId || node.data.generationRequestId !== plan.requestId) return node;
    if (assetIdentity(node.data.asset) !== plan.originalAssetId) return node;
    return commitCanvasNodeOutput(node, { id: plan.requestId, batchId: plan.requestId, source: 'generation', requestedCount: 1,
      results: [{ id: `result-${plan.requestId}`, index: 0, type: 'video', assetId: asset.asset_id }],
      submittedAt: plan.submittedAt, completedAt, snapshot: plan.snapshot, taskIds: plan.taskIds }, { [asset.asset_id]: asset });
  });
  return recoverCanvasVideoGenerationFailure(committed, plan);
}

/** 只接受接口明确透传的资产编号，绝不以任务编号、卡片编号或地址代替。 */
export function getCanvasGeneratedVideoAsset(result) {
  const url = result?.videos?.[0] || result?.videoUrl || result?.url;
  const assetId = result?.videoAssetIds?.[0];
  if (!url) throw new Error('视频生成未返回有效结果');
  if (typeof assetId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) {
    throw new Error('视频生成未返回永久资产编号，已保留旧结果');
  }
  return { url, asset_id: assetId, asset_type: 'video', source: 'ai-generated', ...(result.posterUrl ? { posterUrl: result.posterUrl } : {}) };
}
