/**
 * Storyboard 前后端数据映射与主体参考图补全。
 * 仅处理纯数据，不读取 React 状态，也不执行 API 或缓存副作用。
 *
 * 更新记录：2026-08-03 创作结果同时返回主体 ID 和 video-reference-images 副本时，
 *                只保留主体引用，避免主体参考图在分镜列表中重复展示。
 *              2026-07-30 刷新恢复主体引用时，主体引用优先于同图普通参考资源，按主体/资产身份和图片路径去重。
 */

import { normalizeImageUrl } from './imageUrl';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const subjectRefs = parseObject(be.subject_refs_json ?? be.subjectRefsJson);
  const generationRefs = parseObject(be.generation_refs_json ?? be.generationRefsJson);
  const persistedSubjectIds = new Set([
    ...(Array.isArray(be.character_ids) ? be.character_ids : []),
    ...(Array.isArray(be.character_subject_ids) ? be.character_subject_ids : []),
    ...(Array.isArray(be.prop_subject_ids) ? be.prop_subject_ids : []),
    ...(be.scene_subject_id ? [be.scene_subject_id] : []),
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
  const videoUrl = be.video_url ?? be.videoUrl;
  const videoThumbnailUrl = be.video_thumbnail_url
    ?? be.videoThumbnailUrl
    ?? be.poster_url
    ?? be.posterUrl;
  const videoPreviewUrl = be.preview_video_url
    ?? be.previewVideoUrl;
  const creationForm = {
    image: persistedCreationForm?.image && typeof persistedCreationForm.image === 'object'
      ? persistedCreationForm.image
      : (be.image_prompt != null ? { prompt: be.image_prompt } : undefined),
    video: persistedCreationForm?.video && typeof persistedCreationForm.video === 'object'
      ? persistedCreationForm.video
      : (be.video_prompt != null ? { prompt: be.video_prompt } : undefined),
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
    narration: be.narration ?? (
      be.voiceover
        ? {
            segments: be.voiceover.split('\n').filter(Boolean).map((line) => {
              const idx = line.indexOf('：');
              if (idx > 0) return { role: line.slice(0, idx), lines: line.slice(idx + 1) };
              return { role: '', lines: line };
            }),
          }
        : { segments: [] }
    ),
    mainRefs: be.mainRefs ?? (
      [
        ...(be.character_ids || []).map(cid =>
          typeof cid === 'string' ? { id: cid, type: 'char' } : cid
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
            .map(item => {
              const n = normalizeImageUrl(item.url);
              // 有持久化名称就用；没有（旧数据）时用文件名兜底，至少让不同参考图各不相同
              const fallbackName = n?.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图';
              const subjectId = item.subject_id ?? item.subjectId ?? null;
              const assetId = item.asset_id ?? item.assetId ?? item.id ?? null;
              const type = item.type || item.category || (subjectId ? 'char' : 'image');
              return {
                ...item,
                id: subjectId || assetId || n,
                subjectId,
                assetId,
                url: n,
                name: item.name || fallbackName,
                type,
              };
            });
        })(),
      ]
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
export function normalizeStoryboardList(data, chars = [], numberOffset = 0) {
  if (!Array.isArray(data)) return [];
  return data.map((shot, index) => {
    const normalized = enrichMainRefs(normalizeStoryboard(shot, {
      index,
      episodeId: shot?.episode_id ?? shot?.episodeId,
    }), chars);
    return { ...normalized, number: numberOffset + index + 1 };
  });
}

/**
 * 前端 shot 模型 → 后端 StoryboardCreate / StoryboardUpdate (snake_case flat)
 */
export function toBackendStoryboard(shot) {
  const genParams = shot.genParams && typeof shot.genParams === 'object' ? shot.genParams : {};
  return {
    shot_number: shot.number,
    content: shot.description || undefined,
    shot_type: shot.params?.framing || undefined,
    camera: shot.params?.cameraMotion || undefined,
    camera_angle: shot.params?.angle || undefined,
    composition: shot.params?.composition || undefined,
   duration: shot.params?.duration ? parseFloat(shot.params.duration) : undefined,
   lighting: shot.lightShadow || undefined,
   ambient_sound: shot.ambientSound || undefined,
   voiceover: shot.narration?.segments?.length
     ? shot.narration.segments.map(s => s.role ? `${s.role}：${s.lines}` : s.lines).join('\n')
     : '',
    // 台词全部删除时显式清空后端结构化台词字段（narration_segments），
    // 否则 PATCH 不包含该字段 → 后端保留旧值 → 刷新后 normalizeStoryboard 从 be.narration 恢复旧数据
    gen_params: {
      ...genParams,
      ...(shot.narration?.segments?.length === 0 ? { narration_segments: [] } : {}),
      ...(shot.creationForm ? { creation_form: shot.creationForm } : {}),
    },
   character_ids: (shot.mainRefs || [])
     .filter(ref => ref?.type === 'char' || ref?.type === 'scene' || ref?.type === 'prop')
     .map(ref => ref?.id).filter(Boolean),
    // 参考图（非主体）条目：先筛出有效项，再派生新旧两个字段
    ...(() => {
      const refItems = (shot.mainRefs || [])
        .filter(ref => ref?.url && !ref.uploading)
        .filter(ref => ref?.type !== 'char' && ref?.type !== 'scene' && ref?.type !== 'prop')
        .filter(ref => !shot.storyboardImage?.url || ref.url !== shot.storyboardImage.url);
      return {
        // 旧字段：纯 URL 数组，保留以向后兼容
        reference_image_urls: refItems.map(ref => ref.url).filter(Boolean),
        // 新字段：带名称，让名称随数据持久化（后端支持后刷新仍可区分不同参考图）
        reference_images: refItems
          .filter(ref => ref.url)
          .map(ref => ({ url: ref.url, name: ref.name || '参考图' })),
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
        enrichedById[ref.id] = { ...ref, url, name: ch.name };
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
