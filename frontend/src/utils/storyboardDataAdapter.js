/**
 * Storyboard 前后端数据映射与主体参考图补全。
 * 仅处理纯数据，不读取 React 状态，也不执行 API 或缓存副作用。
 *
 * 更新记录：2026-08-17 刷新恢复创作面板参考主体时保留项目资产与 Seedance 素材的预览、身份和服务商引用，
 *              并以主体列表补全缺失的认证身份；
 *              2026-08-06 主体参考刷新时按显式主体 ID 过滤旧 subject_references/mainRefs，并增加最新快照保护；
 *              2026-08-05 普通参考图序列化时保留 asset_id，统一本地上传与资产库选择的持久化身份；
 *              2026-08-05 视频提示词绑定恢复时按 subject_id 去重，避免历史重复记录继续进入表单；
 *              2026-08-03 创作结果同时返回主体 ID 和 video-reference-images 副本时，
 *                只保留主体引用，避免主体参考图在分镜列表中重复展示。
 *              2026-07-30 刷新恢复主体引用时，主体引用优先于同图普通参考资源，按主体/资产身份和图片路径去重。
 */

import { normalizeImageUrl } from './imageUrl';
import {
  getStoryboardSeedanceMaterialFields,
  mergeStoryboardReferenceWithSubject,
} from './storyboardReferenceAdapter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORYBOARD_SUBJECT_SNAPSHOT_KEY = 'miioo_storyboard_subject_snapshots';

function storyboardSubjectSnapshotKey(projectId, storyboardId) {
  return `${String(projectId ?? '')}:${String(storyboardId ?? '')}`;
}

function readStoryboardSubjectSnapshots() {
  try {
    const raw = localStorage.getItem(STORYBOARD_SUBJECT_SNAPSHOT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function setStoryboardSubjectSnapshot(projectId, storyboardId, mainRefs = []) {
  if (projectId == null || storyboardId == null) return;
  try {
    const snapshots = readStoryboardSubjectSnapshots();
    snapshots[storyboardSubjectSnapshotKey(projectId, storyboardId)] = Array.isArray(mainRefs)
      ? mainRefs.map((ref) => ({ ...ref }))
      : [];
    localStorage.setItem(STORYBOARD_SUBJECT_SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // 本地存储不可用时不阻塞接口保存，服务端数据仍是最终来源。
  }
}

function getStoryboardSubjectSnapshot(projectId, storyboardId) {
  if (projectId == null || storyboardId == null) return null;
  const snapshot = readStoryboardSubjectSnapshots()[storyboardSubjectSnapshotKey(projectId, storyboardId)];
  return Array.isArray(snapshot) ? snapshot : null;
}

function clearStoryboardSubjectSnapshot(projectId, storyboardId) {
  if (projectId == null || storyboardId == null) return;
  try {
    const snapshots = readStoryboardSubjectSnapshots();
    delete snapshots[storyboardSubjectSnapshotKey(projectId, storyboardId)];
    localStorage.setItem(STORYBOARD_SUBJECT_SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // 忽略本地存储清理失败。
  }
}

function storyboardReferenceIdentity(ref) {
  return String(
    ref?.subjectId
      || ref?.subject_id
      || ref?.assetId
      || ref?.asset_id
      || ref?.id
      || ref?.url
      || '',
  );
}

function storyboardReferenceSignature(refs = []) {
  return (Array.isArray(refs) ? refs : []).map(storyboardReferenceIdentity).join('|');
}

function getReferencePreviewUrl(item) {
  const values = [
    item?.previewUrl,
    item?.preview_url,
    item?.thumbnailUrl,
    item?.thumbnail_url,
    item?.sourceUrl,
    item?.source_url,
    item?.fileUrl,
    item?.file_url,
    item?.imageUrl,
    item?.image_url,
    item?.originalUrl,
    item?.original_url,
    item?.url,
  ];
  // asset:// 是 Seedance 的生成身份，不是浏览器可加载的媒体地址。
  return values.find((value) => value && !String(value).startsWith('asset://')) ?? null;
}

/**
 * 将不同来源的参考素材还原为可在创作面板展示的统一条目。
 * assetRefUrl 是 Seedance 生成专用的 asset:// 引用，不能用于浏览器预览。
 */
function normalizeStoryboardReferenceItem(item) {
  if (!item || typeof item !== 'object') return null;
  const rawUrl = getReferencePreviewUrl(item);
  const subjectId = item.subjectId ?? item.subject_id ?? null;
  const assetId = item.assetId ?? item.asset_id ?? (subjectId ? null : item.id) ?? null;
  const seedanceFields = getStoryboardSeedanceMaterialFields(item);
  const isSeedanceMaterial = seedanceFields.isLiveMaterial
    || seedanceFields.isAigcMaterial
    || seedanceFields.isSeedanceMaterial
    || seedanceFields.isSeedanceCertifiedMaterial
    || seedanceFields.assetRefUrl;
  // 历史数据可能只保存了 Seedance 素材 ID 和 asset://。保留该条目，
  // 页面加载后会按资产 ID 重新取得带鉴权的预览图，不能在适配阶段丢掉它。
  if (!rawUrl && !(isSeedanceMaterial && assetId)) return null;
  const url = rawUrl ? normalizeImageUrl(rawUrl) : null;
  const fallbackName = rawUrl
    ? String(rawUrl).split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '')
    : '参考图';
  return {
    ...item,
    id: subjectId || assetId || item.id || url,
    subjectId,
    assetId,
    url,
    name: item.name || fallbackName,
    type: item.type || item.category || (subjectId ? 'char' : 'image'),
    ...seedanceFields,
  };
}

/**
 * 为后端 reference_images 提供可恢复的轻量结构。
 * 普通资产保持原字段；Seedance 素材额外保留生成所需身份与 asset:// 引用。
 */
export function serializeStoryboardReferenceItem(item) {
  const normalized = normalizeStoryboardReferenceItem(item);
  if (!normalized) return null;
  const isSeedanceMaterial = normalized.isLiveMaterial
    || normalized.isAigcMaterial
    || normalized.isSeedanceMaterial
    || normalized.isSeedanceCertifiedMaterial
    || normalized.assetRefUrl;
  // Blob URL 仅存在于当前浏览器会话，不能写进分镜快照。
  const persistableUrl = normalized.url && !String(normalized.url).startsWith('blob:')
    ? normalized.url
    : null;
  return {
    ...(normalized.assetId ? { asset_id: normalized.assetId } : {}),
    ...(normalized.subjectId ? { subject_id: normalized.subjectId } : {}),
    ...(persistableUrl ? { url: persistableUrl } : {}),
    name: normalized.name,
    type: normalized.type,
    ...(isSeedanceMaterial
      ? {
          is_live_material: normalized.isLiveMaterial,
          is_aigc_material: normalized.isAigcMaterial,
          is_seedance_material: normalized.isSeedanceMaterial,
          is_seedance_certified_material: normalized.isSeedanceCertifiedMaterial,
          group_id: normalized.groupId,
          group_type: normalized.groupType,
          asset_ref_url: normalized.assetRefUrl,
        }
      : {}),
  };
}

function hasSeedanceMaterialIdentity(item) {
  const fields = getStoryboardSeedanceMaterialFields(item);
  return Boolean(
    fields.isLiveMaterial
    || fields.isAigcMaterial
    || fields.isSeedanceMaterial
    || fields.isSeedanceCertifiedMaterial
    || fields.groupId
    || fields.assetRefUrl,
  );
}

function mergeStoryboardReferenceIdentity(existing, candidate) {
  if (!hasSeedanceMaterialIdentity(candidate)) return existing;
  const fields = getStoryboardSeedanceMaterialFields(candidate);
  // character_ids 等顶层字段先构造出简化主体引用，creation_form.video.refSubjects
  // 随后才提供同一 subjectId 的完整 Seedance 身份。不能因去重把认证字段丢掉。
  // 预览 URL 仍优先保留当前主体图，避免短时签名 URL 被写回常规展示链路。
  return {
    ...existing,
    ...(fields.isLiveMaterial !== undefined ? { isLiveMaterial: fields.isLiveMaterial } : {}),
    ...(fields.isAigcMaterial !== undefined ? { isAigcMaterial: fields.isAigcMaterial } : {}),
    ...(fields.isSeedanceMaterial !== undefined ? { isSeedanceMaterial: fields.isSeedanceMaterial } : {}),
    ...(fields.isSeedanceCertifiedMaterial !== undefined
      ? { isSeedanceCertifiedMaterial: fields.isSeedanceCertifiedMaterial }
      : {}),
    ...(fields.groupId !== undefined ? { groupId: fields.groupId } : {}),
    ...(fields.groupType !== undefined ? { groupType: fields.groupType } : {}),
    ...(fields.assetRefUrl !== undefined ? { assetRefUrl: fields.assetRefUrl } : {}),
    // 对 Seedance 认证主体，必须使用认证实体的资产 ID；简化主体图 assetId
    // 只适用于普通图片附件，不能随虚拟人像进入 reference_image_asset_ids。
    ...(candidate.assetId !== undefined || candidate.asset_id !== undefined
      ? { assetId: candidate.assetId ?? candidate.asset_id }
      : {}),
  };
}

function mergeStoryboardReferences(...groups) {
  const references = [];
  const indexByKey = new Map();
  groups.flat().filter(Boolean).forEach((item) => {
    // 同一主体的常规图片引用与认证素材引用可能拥有不同的 asset://，
    // 但仍是同一个主体；subjectId 必须优先作为合并键。
    const key = item.subjectId || item.subject_id || item.assetRefUrl || item.assetId || item.id || item.url;
    if (!key) return;
    const existingIndex = indexByKey.get(String(key));
    if (existingIndex === undefined) {
      indexByKey.set(String(key), references.length);
      references.push(item);
      return;
    }
    references[existingIndex] = mergeStoryboardReferenceIdentity(references[existingIndex], item);
  });
  return references;
}

export function applyStoryboardSubjectSnapshot(shot, projectId) {
  if (!shot || projectId == null) return shot;
  const snapshot = getStoryboardSubjectSnapshot(projectId, shot.backendId || shot.id);
  if (!snapshot) return shot;
  if (storyboardReferenceSignature(shot.mainRefs) === storyboardReferenceSignature(snapshot)) {
    clearStoryboardSubjectSnapshot(projectId, shot.backendId || shot.id);
    return shot;
  }
  return {
    ...shot,
    mainRefs: snapshot,
    creationForm: shot.creationForm
      ? {
          ...shot.creationForm,
          video: shot.creationForm.video
            ? { ...shot.creationForm.video, refSubjects: snapshot }
            : shot.creationForm.video,
        }
      : shot.creationForm,
  };
}

export function isBackendStoryboardId(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function makeStoryboardShot(number, overrides = {}) {
  return {
    id: `shot-${number}-${Date.now()}-${Math.random()}`,
    number,
    description: '',
    params: { framing: '全景', cameraMotion: '固定机位', angle: '平视拍摄', composition: '三分法构图', duration: '3s' },
    lightShadow: '',
    ambientSound: '',
    narration: { segments: [] },
    mainRefs: [],
    storyboardImage: null,
    storyboardVideo: null,
    ...overrides,
  };
}

/**
 * 后端 StoryboardResponse (snake_case flat) → 前端 shot 模型 (camelCase nested)
 */
export function normalizeStoryboard(be, fallbackContext = {}) {
  if (!be || typeof be !== 'object') return be;
  const parseObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };
  const genParams = parseObject(be.gen_params ?? be.genParams);
  const hasNarrationSegments = (value) => (
    Array.isArray(value) && value.some((segment) => (
      segment && typeof segment === 'object' && String(segment.lines ?? '').trim()
    ))
  );
  const structuredNarrationSegments = hasNarrationSegments(be.dialogues_json)
    ? be.dialogues_json
    : (hasNarrationSegments(be.narration?.segments)
      ? be.narration.segments
      : (hasNarrationSegments(genParams.narration_segments)
        ? genParams.narration_segments
        : null));
  const subjectRefs = parseObject(be.subject_refs_json ?? be.subjectRefsJson);
  const generationRefs = parseObject(be.generation_refs_json ?? be.generationRefsJson);
  const hasDirectSubjectFields = Array.isArray(be.character_ids)
    || Array.isArray(be.character_subject_ids)
    || Array.isArray(be.prop_subject_ids)
    || Array.isArray(be.prop_ids)
    || Object.prototype.hasOwnProperty.call(be, 'scene_id')
    || Object.prototype.hasOwnProperty.call(be, 'scene_subject_id');
  const directSubjectIds = new Set([
    ...(Array.isArray(be.character_ids) ? be.character_ids : []),
    ...(Array.isArray(be.character_subject_ids) ? be.character_subject_ids : []),
    ...(Array.isArray(be.prop_subject_ids) ? be.prop_subject_ids : []),
    ...(Array.isArray(be.prop_ids) ? be.prop_ids : []),
    ...(be.scene_id ? [be.scene_id] : []),
    ...(be.scene_subject_id ? [be.scene_subject_id] : []),
  ].map((item) => {
    if (item && typeof item === 'object') return item.subject_id ?? item.subjectId ?? item.id;
    return item;
  }).filter(Boolean).map(String));
  const subjectReferences = Array.isArray(be.subject_references)
    ? be.subject_references
    : (Array.isArray(be.subjectReferences) ? be.subjectReferences : []);
  const normalizedSubjectReferences = subjectReferences.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const subjectId = item.subject_id ?? item.subjectId ?? item.id;
    if (!subjectId) return null;
    const rawType = String(item.subject_type ?? item.subjectType ?? item.type ?? '').toLowerCase();
    const type = rawType === 'character' || rawType === 'char'
      ? 'char'
      : rawType === 'scene'
        ? 'scene'
        : rawType === 'prop' || rawType === 'object'
          ? 'prop'
          : rawType || 'char';
    const rawUrl = item.image_url
      ?? item.imageUrl
      ?? item.preview_url
      ?? item.previewUrl
      ?? item.thumbnail_url
      ?? item.thumbnailUrl;
    return {
      ...item,
      id: subjectId,
      subjectId,
      type,
      url: rawUrl ? normalizeImageUrl(rawUrl) : undefined,
      name: item.name || '主体参考',
      assetId: item.asset_id ?? item.assetId,
    };
  }).filter(Boolean).filter((item) => (
    !hasDirectSubjectFields || directSubjectIds.has(String(item.subjectId))
  ));
  const persistedSubjectIds = new Set([
    ...(Array.isArray(be.character_ids) ? be.character_ids : []),
    ...(Array.isArray(be.character_subject_ids) ? be.character_subject_ids : []),
    ...(Array.isArray(be.prop_subject_ids) ? be.prop_subject_ids : []),
    ...(be.scene_subject_id ? [be.scene_subject_id] : []),
    ...normalizedSubjectReferences.map((item) => item.subjectId),
    ...(Array.isArray(subjectRefs.characters) ? subjectRefs.characters : []),
    ...(Array.isArray(subjectRefs.props) ? subjectRefs.props : []),
    ...(subjectRefs.scene ? [subjectRefs.scene] : []),
    ...(Array.isArray(generationRefs.character_subject_ids) ? generationRefs.character_subject_ids : []),
    ...(Array.isArray(generationRefs.prop_subject_ids) ? generationRefs.prop_subject_ids : []),
    ...(generationRefs.scene_subject_id ? [generationRefs.scene_subject_id] : []),
  ].map((item) => {
    if (item && typeof item === 'object') return item.subject_id ?? item.subjectId ?? item.id;
    return item;
  }).filter(Boolean).map(String));
  const persistedCreationForm = genParams.creation_form || genParams.creationForm;
  const persistedVideoSubjects = Array.isArray(persistedCreationForm?.video?.refSubjects)
    ? persistedCreationForm.video.refSubjects
      .map(normalizeStoryboardReferenceItem)
      .filter(Boolean)
    : [];
  const generatedImages = Array.isArray(be.generated_images)
    ? be.generated_images
    : (Array.isArray(be.generatedImages) ? be.generatedImages : []);
  const generatedImage = generatedImages[0] || {};
  const imageUrl = be.image_url ?? be.imageUrl ?? generatedImage.url ?? generatedImage.image_url ?? generatedImage.imageUrl;
  const imagePreviewUrl = be.preview_url
    ?? be.previewUrl
    ?? generatedImage.preview_url
    ?? generatedImage.previewUrl
    ?? be.thumbnail_url
    ?? be.thumbnailUrl
    ?? generatedImage.thumbnail_url
    ?? generatedImage.thumbnailUrl;
  const imageThumbnailUrl = be.thumbnail_url
    ?? be.thumbnailUrl
    ?? generatedImage.thumbnail_url
    ?? generatedImage.thumbnailUrl;
  const videoThumbnailUrl = be.video_thumbnail_url
    ?? be.videoThumbnailUrl
    ?? be.poster_url
    ?? be.posterUrl;
  const videoPreviewUrl = be.preview_video_url
    ?? be.previewVideoUrl;
  // 部分生成中的视频只有预览地址，正式 video_url 仍为空；预览地址同样可以作为列表候选播放。
  const videoUrl = be.video_url ?? be.videoUrl ?? videoPreviewUrl;
  const hasTopLevelVideoMentions = Array.isArray(be.video_prompt_mentions)
    || Array.isArray(be.videoPromptMentions);
  const rawVideoMentions = Array.isArray(be.video_prompt_mentions)
    ? be.video_prompt_mentions
    : (Array.isArray(be.videoPromptMentions) ? be.videoPromptMentions : []);
  const nestedVideoMentions = Array.isArray(persistedCreationForm?.video?.video_prompt_mentions)
    ? persistedCreationForm.video.video_prompt_mentions
    : [];
  const videoMentions = hasTopLevelVideoMentions ? rawVideoMentions : nestedVideoMentions;
  const persistedVideoMentions = videoMentions.filter((mention, index, list) => {
    const subjectId = mention?.subject_id ?? mention?.subjectId ?? mention?.id;
    if (!subjectId) return false;
    return list.findIndex((item) => String(item?.subject_id ?? item?.subjectId ?? item?.id) === String(subjectId)) === index;
  });
  const topLevelReferenceImages = (() => {
    const nestedReferenceImages = Array.isArray(genParams.reference_images) && genParams.reference_images.length > 0
      ? genParams.reference_images
      : (Array.isArray(genParams.reference_image_urls)
        ? genParams.reference_image_urls.map((url) => ({ url }))
        : []);
    const rawList = Array.isArray(be.reference_images) && be.reference_images.length > 0
      ? be.reference_images
      : (Array.isArray(be.reference_image_urls) && be.reference_image_urls.length > 0
        ? be.reference_image_urls.map((url) => ({ url }))
        : nestedReferenceImages);
    return rawList
      .map((item) => (typeof item === 'string' ? { url: item } : item))
      .filter((item) => item?.url)
      .filter((item) => !item.subjectId && !item.subject_id)
      .filter((item) => !['char', 'scene', 'prop', 'character', 'object'].includes(String(item.type || item.subject_type || '').toLowerCase()))
      .map(normalizeStoryboardReferenceItem)
      .filter(Boolean);
  })();
  const withFallbackReferenceImages = (form) => {
    if (!form || typeof form !== 'object') return form;
    // 空数组是用户主动清空的结果，不能被顶层旧字段重新填回。
    if (Array.isArray(form.refImages)) return form;
    return { ...form, refImages: topLevelReferenceImages };
  };
  const creationForm = {
    image: persistedCreationForm?.image && typeof persistedCreationForm.image === 'object'
      ? withFallbackReferenceImages(persistedCreationForm.image)
      : (be.image_prompt != null ? { prompt: be.image_prompt, refImages: topLevelReferenceImages } : undefined),
    video: persistedCreationForm?.video && typeof persistedCreationForm.video === 'object'
      ? {
          ...withFallbackReferenceImages(persistedCreationForm.video),
          // 首尾帧提示词优先读后端顶层字段，回退旧版内嵌 frame_prompt，兼容两种存储形态。
          frame_prompt: be.video_frame_prompt ?? be.videoFramePrompt ?? persistedCreationForm.video.frame_prompt,
          video_prompt_generation: persistedCreationForm.video.video_prompt_generation
            ?? be.video_prompt_generation,
          video_prompt_mentions: persistedVideoMentions,
        }
      : ((be.video_prompt ?? be.video_prompt_generation) != null
        ? {
            prompt: be.video_prompt ?? be.video_prompt_generation,
            frame_prompt: be.video_frame_prompt ?? be.videoFramePrompt,
            refImages: topLevelReferenceImages,
            // video_prompt 是弹窗当前展示文本；video_prompt_generation 保留完整一致性字段，
            // 供页面加载阶段恢复缺失的主体绑定。
            video_prompt_generation: be.video_prompt_generation,
            video_prompt_mentions: persistedVideoMentions,
          }
        : undefined),
  };
  const hasCreationForm = Boolean(creationForm.image || creationForm.video);
  const fallbackNumber = Number.isInteger(fallbackContext.index) ? fallbackContext.index + 1 : 0;
  const shotNumber = be.shot_number ?? be.number ?? fallbackNumber;
  const episodeId = be.episode_id ?? be.episodeId ?? fallbackContext.episodeId;
  const rawStoryboardId = be.id
    ?? be.storyboard_id
    ?? be.storyboardId
    ?? be.uuid;
  const hasBackendId = isBackendStoryboardId(rawStoryboardId);
  const storyboardId = hasBackendId
    ? rawStoryboardId
    : ((episodeId || shotNumber) ? `storyboard-${episodeId || 'episode'}-shot-${shotNumber}` : null);
  return {
    id: storyboardId,
    // id 可能是前端为了渲染生成的稳定兜底值；backendId 才是可以传给后端接口的真实 ID。
    backendId: hasBackendId ? storyboardId : null,
    isSyntheticId: !hasBackendId,
    number: shotNumber,
    description: be.content ?? be.description ?? '',
    params: {
      framing: be.shot_type ?? be.params?.framing ?? '全景',
      cameraMotion: be.camera ?? be.params?.cameraMotion ?? '固定机位',
      angle: be.camera_angle ?? be.params?.angle ?? '平视拍摄',
      composition: be.composition ?? be.params?.composition ?? '三分法构图',
      duration: be.duration != null
        ? (typeof be.duration === 'string' ? be.duration : `${be.duration}s`)
        : (be.params?.duration ?? '3s'),
    },
    lightShadow: be.lighting ?? be.lightShadow ?? '',
    ambientSound: be.ambient_sound ?? be.ambientSound ?? '',
    genParams,
    creationForm: hasCreationForm ? creationForm : null,
    // 有效结构化台词优先；后端默认返回的空 dialogues_json 不得覆盖已有兼容台词。
    narration: structuredNarrationSegments
      ? { segments: structuredNarrationSegments }
      : (be.voiceover
        ? {
            segments: be.voiceover.split('\n').filter(Boolean).map((line) => {
              const idx = line.indexOf('：');
              if (idx > 0) return { role: line.slice(0, idx), lines: line.slice(idx + 1) };
              return { role: '', lines: line };
            }),
          }
        : { segments: [] }),
    mainRefs: Array.isArray(be.mainRefs)
      ? mergeStoryboardReferences(
        be.mainRefs.filter((ref) => {
          if (!hasDirectSubjectFields || !isStoryboardSubjectReference(ref)) return true;
          const refId = ref?.subjectId || ref?.subject_id || ref?.id;
          return refId && directSubjectIds.has(String(refId));
        }).map((ref) => normalizeStoryboardReferenceItem(ref) || ref),
        persistedVideoSubjects,
      )
      : (
      mergeStoryboardReferences(
        [
        // 新版接口直接返回完整主体引用，场景和道具不能只依赖 character_ids 补全。
        ...normalizedSubjectReferences,
        ...(be.character_ids || []).map(cid =>
          typeof cid === 'string' ? { id: cid, type: 'char' } : cid
        ),
        ...(be.scene_id ? [{ id: be.scene_id, type: 'scene' }] : []),
        ...(Array.isArray(be.prop_ids) ? be.prop_ids : []).map(pid =>
          typeof pid === 'string' ? { id: pid, type: 'prop' } : pid
        ),
        // 参考图：优先读带名称的新字段 reference_images，回退到旧的纯 URL 数组 reference_image_urls
        ...(() => {
          const imgPathKey = imageUrl ? urlPathKey(normalizeImageUrl(imageUrl)) : null;
          // 归一为 { url, name? } 列表：新字段直接用；旧字段无名称，name 留空由下方兜底
          const rawList = Array.isArray(be.reference_images) && be.reference_images.length > 0
            ? be.reference_images.map(item => (typeof item === 'string' ? { url: item } : item))
            : (be.reference_image_urls || []).map(url => ({ url }));
          return rawList
            .filter(item => item?.url)
            // 创作接口会把主体图片复制到 video-reference-images；主体 ID 已经在
            // character_ids 等字段中表达，这些副本不能再次作为主体参考图展示。
            .filter(item => {
              const url = String(item.url);
              const isGeneratedReferenceCopy = /\/video-reference-images\//i.test(url);
              if (!isGeneratedReferenceCopy || persistedSubjectIds.size === 0) return true;
              return false;
            })
            // 排除与分镜图相同的 URL，避免分镜图出现在主体参考列（用路径键兼容绝对/相对 URL）
            .filter(item => !imgPathKey || urlPathKey(normalizeImageUrl(item.url)) !== imgPathKey)
            .map(normalizeStoryboardReferenceItem)
            .filter(Boolean);
        })(),
        // 创作表单保存的是参考主体的完整快照。它优先于为兼容准备的顶层简化字段，
        // 这样项目资产和 Seedance 素材刷新后都能恢复为可展示、可生成的条目。
          ...persistedVideoSubjects,
        ],
      )
      ),
    storyboardImage: be.storyboardImage ?? (
      imageUrl
        ? { id: `${storyboardId}_img`, url: normalizeImageUrl(imageUrl), preview_url: imagePreviewUrl ? normalizeImageUrl(imagePreviewUrl) : undefined, thumbnail_url: imageThumbnailUrl ? normalizeImageUrl(imageThumbnailUrl) : undefined, name: '分镜图', type: 'image/jpeg',
            source: (be.image_prompt || be.gen_params) ? 'ai-generated' : 'local-upload' }
        : null
    ),
    storyboardVideo: be.storyboardVideo ?? (
      videoUrl
        ? {
            id: `${storyboardId}_vid`,
            url: normalizeImageUrl(videoUrl),
            name: '分镜视频',
            type: 'video/mp4',
            model: be.video_model,
            resolution: be.video_resolution,
            duration: be.video_duration,
            thumbnail: videoThumbnailUrl ? normalizeImageUrl(videoThumbnailUrl) : undefined,
            video_thumbnail_url: videoThumbnailUrl ? normalizeImageUrl(videoThumbnailUrl) : undefined,
            preview_video_url: videoPreviewUrl ? normalizeImageUrl(videoPreviewUrl) : undefined,
            previewVideoUrl: videoPreviewUrl ? normalizeImageUrl(videoPreviewUrl) : undefined,
            finalized: true,
          }
        : null
    ),
  };
}

/**
 * 批量归一化分镜并补全主体参考图；不执行请求或状态写回。
 */
export function normalizeStoryboardList(data, chars = [], numberOffset = 0, projectId = null) {
  if (!Array.isArray(data)) return [];
  return data.map((shot, index) => {
    const normalized = enrichMainRefs(normalizeStoryboard(shot, {
      index,
      episodeId: shot?.episode_id ?? shot?.episodeId,
    }), chars);
    return applyStoryboardSubjectSnapshot(
      { ...normalized, number: numberOffset + index + 1 },
      projectId,
    );
  });
}

export function isStoryboardSubjectReference(ref) {
  if (!ref || typeof ref !== 'object') return false;
  const type = String(ref.type || ref.subject_type || '').toLowerCase();
  return Boolean(
    ref.subjectId
      || ref.subject_id
      || ['char', 'character', 'scene', 'prop', 'object'].includes(type),
  );
}

export function buildStoryboardSubjectFields(mainRefs = []) {
  const subjectRefs = (Array.isArray(mainRefs) ? mainRefs : []).filter(isStoryboardSubjectReference);
  const getId = (ref) => ref?.subjectId || ref?.subject_id || ref?.id || null;
  const getType = (ref) => String(ref?.type || ref?.subject_type || '').toLowerCase();
  const uniqueIds = (refs) => [...new Set(refs.map(getId).filter(Boolean))];
  const sceneRef = subjectRefs.find((ref) => getType(ref) === 'scene');

  return {
    // character_ids 是历史兼容主字段，继续提交三类主体的完整集合。
    character_ids: uniqueIds(subjectRefs),
    scene_id: getId(sceneRef),
    prop_ids: uniqueIds(subjectRefs.filter((ref) => ['prop', 'object'].includes(getType(ref)))),
  };
}

/**
 * 前端 shot 模型 → 后端 StoryboardCreate / StoryboardUpdate (snake_case flat)
 */
export function toBackendStoryboard(shot) {
  const genParams = shot.genParams && typeof shot.genParams === 'object' ? shot.genParams : {};
  const narrationSegments = Array.isArray(shot.narration?.segments)
    ? shot.narration.segments.map((segment) => ({
        role: segment?.role ?? '',
        lines: segment?.lines ?? '',
      }))
    : [];
  // 主体引用是覆盖语义，显式提交空数组/null，不能让后端沿用旧快照。
  const subjectFields = buildStoryboardSubjectFields(shot.mainRefs);
  const creationForm = shot.creationForm
    ? {
        ...shot.creationForm,
        ...(shot.creationForm.video
          ? {
              video: {
                ...shot.creationForm.video,
                // 当前镜头 mainRefs 是唯一权威主体集合，旧表单快照不得继续保留已删除主体。
                refSubjects: Array.isArray(shot.mainRefs) ? shot.mainRefs : [],
              },
            }
          : {}),
      }
    : null;
  const creationFormReferenceItems = [
    ...(creationForm?.image?.refImages || []),
    ...(creationForm?.video?.refImages || []),
  ];
  return {
    shot_number: shot.number,
    content: shot.description || undefined,
    shot_type: shot.params?.framing || undefined,
    camera: shot.params?.cameraMotion || undefined,
    camera_angle: shot.params?.angle || undefined,
    composition: shot.params?.composition || undefined,
   duration: shot.params?.duration ? parseFloat(shot.params.duration) : undefined,
   // 这两个字段为空表示用户删除内容，必须显式传空字符串，不能省略后让后端保留旧值。
   lighting: shot.lightShadow ?? '',
   ambient_sound: shot.ambientSound ?? '',
   voiceover: narrationSegments.length
     ? narrationSegments.map(s => s.role ? `${s.role}：${s.lines}` : s.lines).join('\n')
     : '',
    // dialogues_json 是后端正式结构化字段；兼容快照同步写入 gen_params，
    // 新增、编辑和删除都必须完整提交，不能只在删除时传空数组。
    dialogues_json: narrationSegments,
    // 首尾帧提示词随完整快照写回；后端暂未支持时忽略，不影响现有保存。
    video_frame_prompt: creationForm?.video?.frame_prompt ?? null,
    gen_params: {
      ...genParams,
      ...subjectFields,
      narration_segments: narrationSegments,
      ...(creationForm ? { creation_form: creationForm } : {}),
    },
    ...subjectFields,
    // 参考图（非主体）条目：先筛出有效项，再派生新旧两个字段
    ...(() => {
      const refItems = [...(shot.mainRefs || []), ...creationFormReferenceItems]
        .map((ref) => {
          if (!ref || typeof ref !== 'object') return null;
          const url = ref.url || ref.fileUrl || ref.previewUrl || ref.preview_url;
          return url ? { ...ref, url } : null;
        })
        .filter(Boolean)
        .filter(ref => !ref.uploading)
        .filter(ref => !isStoryboardSubjectReference(ref))
        .filter(ref => !shot.storyboardImage?.url || urlPathKey(ref.url) !== urlPathKey(shot.storyboardImage.url))
        .filter((ref, index, list) => {
          const key = ref.assetId || ref.asset_id || ref.id || urlPathKey(ref.url);
          return list.findIndex((candidate) => (
            (candidate.assetId || candidate.asset_id || candidate.id || urlPathKey(candidate.url)) === key
          )) === index;
        });
      return {
        // 旧字段：纯 URL 数组，保留以向后兼容
        reference_image_urls: refItems.map(ref => ref.url).filter(Boolean),
        // 新字段：带名称，让名称随数据持久化（后端支持后刷新仍可区分不同参考图）
        reference_images: refItems
          .map(serializeStoryboardReferenceItem)
          .filter(Boolean),
      };
    })(),
    image_url: shot.storyboardImage?.url || undefined,
    video_url: shot.storyboardVideo?.url || undefined,
  };
}

/**
 * 将 URL 规范化为路径键，用于跨协议/域名的去重比较。
 * 绝对 URL 取 pathname，相对路径直接使用。
 * 例：
 *   "https://api.example.com/uploads/char_A.jpg" → "/uploads/char_A.jpg"
 *   "/uploads/char_A.jpg"                        → "/uploads/char_A.jpg"
 */
function urlPathKey(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    // 非绝对 URL，直接用原值（已是相对路径）
    return url.startsWith('/') ? url : `/${url}`;
  }
}

/**
 * 为从 character_ids 构造的 mainRefs 补上 url（normalizeStoryboard 里只有 id+type）
 * 同时去重：如果 reference_image_urls 里有与某个角色图片相同的条目（路径一致即视为相同），
 * 则跳过该 reference_image_urls 条目，避免刷新后出现重复主体。
 */
export function enrichMainRefs(shot, chars) {
  if (!shot?.mainRefs) return shot;

  // Pass 1: enrich all subject-type entries (char/scene/prop) that don't have a URL,
  // collecting their URL path keys for dedup regardless of entry order
  const usedPathKeys = new Set();
  const enrichedById = {};
  for (const ref of shot.mainRefs) {
    // 主体引用识别键：优先 subjectId（从资产库选中的主体图携带），
    // 兼容旧数据用 type=char/scene/prop 时的 ref.id
    const sid = ref.subjectId
      || ((ref.type === 'char' || ref.type === 'scene' || ref.type === 'prop') ? ref.id : null);
    if (sid) {
      const ch = (chars || []).find(c => c.id === sid);
      if (ch?.imageUrl) {
        const url = normalizeImageUrl(ch.imageUrl);
        const pathKey = urlPathKey(url);
        if (pathKey) usedPathKeys.add(pathKey);
        // 无论之前有无 url，都用最新 chars 里的 imageUrl 更新（主体换定稿图后自动同步）
        enrichedById[ref.id] = {
          ...mergeStoryboardReferenceWithSubject(ref, ch),
          url,
          name: ch.name,
        };
      }
    }
  }

  const subjectRefKey = (ref) => {
    if (!ref) return null;
    const subjectId = ref.subjectId
      || ref.subject_id
      || ((ref.type === 'char' || ref.type === 'scene' || ref.type === 'prop') ? ref.id : null);
    return subjectId ? `subject:${subjectId}` : null;
  };

  // Pass 2: build result, deduplicating by subject/asset identity and URL path.
  // 主体引用优先于普通参考图：刷新后后端可能同时返回 character_ids 和
  // reference_images，二者指向同一主体时只保留主体引用，避免列表出现重复图。
  const result = [];
  const usedSubjectKeys = new Set();
  const usedAssetKeys = new Set();
  const prioritySubjectPaths = new Set();
  for (const ref of shot.mainRefs) {
    const enriched = enrichedById[ref.id] || ref;
    if (!subjectRefKey(enriched) || !enriched.url) continue;
    const pathKey = urlPathKey(normalizeImageUrl(enriched.url));
    if (pathKey) prioritySubjectPaths.add(pathKey);
  }
  for (const ref of shot.mainRefs) {
    const enriched = enrichedById[ref.id] || ref;
    const isSubject = Boolean(subjectRefKey(enriched));
    const subjectKey = subjectRefKey(enriched);
    const assetKey = enriched.assetId || enriched.asset_id;
    const pathKey = enriched.url ? urlPathKey(normalizeImageUrl(enriched.url)) : null;

    if (isSubject) {
      if (usedSubjectKeys.has(subjectKey)) continue;
      usedSubjectKeys.add(subjectKey);
      if (assetKey) usedAssetKeys.add(`asset:${assetKey}`);
      if (pathKey) usedPathKeys.add(pathKey);
      result.push(enriched);
      continue;
    }

    if (assetKey && usedAssetKeys.has(`asset:${assetKey}`)) continue;
    if (pathKey && prioritySubjectPaths.has(pathKey)) continue;
    if (pathKey && usedPathKeys.has(pathKey)) continue;
    if (assetKey) usedAssetKeys.add(`asset:${assetKey}`);
    if (pathKey) usedPathKeys.add(pathKey);
    result.push(enriched);
  }

  shot.mainRefs = result;
  return shot;
}

/**
 * 从资产库选中的资产构造 mainRefs 条目。
 * 关键点：如果资产带 subject_id（即某主体的图片），则建立「主体引用」而非普通参考图：
 *   - id 用 subjectId → 经 toBackendStoryboard 落到 character_ids，后端持久化主体关联；
 *     刷新后仍是主体引用，且随主体定稿图变化自动同步（enrichMainRefs）。
 *   - 同一主体只对应一个 id → 天然去重，避免同一主体被添加多遍。
 * 普通图片资产（无 subject_id）保持原有的图片引用行为。
 */
// ─────────────────────────────────────────────────────────────────────────────
