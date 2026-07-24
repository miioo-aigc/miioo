/**
 * Storyboard 前后端数据映射与主体参考图补全。
 * 仅处理纯数据，不读取 React 状态，也不执行 API 或缓存副作用。
 */

import { normalizeImageUrl } from './imageUrl';

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
export function normalizeStoryboard(be) {
  if (!be || typeof be !== 'object') return be;
  const genParams = be.gen_params && typeof be.gen_params === 'object' ? be.gen_params : {};
  const persistedCreationForm = genParams.creation_form || genParams.creationForm;
  const creationForm = {
    image: persistedCreationForm?.image && typeof persistedCreationForm.image === 'object'
      ? persistedCreationForm.image
      : (be.image_prompt != null ? { prompt: be.image_prompt } : undefined),
    video: persistedCreationForm?.video && typeof persistedCreationForm.video === 'object'
      ? persistedCreationForm.video
      : (be.video_prompt != null ? { prompt: be.video_prompt } : undefined),
  };
  const hasCreationForm = Boolean(creationForm.image || creationForm.video);
  return {
    id: be.id,
    number: be.shot_number ?? be.number ?? 0,
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
          const imgPathKey = be.image_url ? urlPathKey(normalizeImageUrl(be.image_url)) : null;
          // 归一为 { url, name? } 列表：新字段直接用；旧字段无名称，name 留空由下方兜底
          const rawList = Array.isArray(be.reference_images) && be.reference_images.length > 0
            ? be.reference_images.map(item => (typeof item === 'string' ? { url: item } : item))
            : (be.reference_image_urls || []).map(url => ({ url }));
          return rawList
            .filter(item => item?.url)
            // 排除与分镜图相同的 URL，避免分镜图出现在主体参考列（用路径键兼容绝对/相对 URL）
            .filter(item => !imgPathKey || urlPathKey(normalizeImageUrl(item.url)) !== imgPathKey)
            .map(item => {
              const n = normalizeImageUrl(item.url);
              // 有持久化名称就用；没有（旧数据）时用文件名兜底，至少让不同参考图各不相同
              const fallbackName = n?.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图';
              return { id: n, url: n, name: item.name || fallbackName, type: "image/jpeg" };
            });
        })(),
      ]
    ),
    storyboardImage: be.storyboardImage ?? (
      be.image_url
        ? { id: `${be.id}_img`, url: normalizeImageUrl(be.image_url), name: '分镜图', type: 'image/jpeg',
            source: (be.image_prompt || be.gen_params) ? 'ai-generated' : 'local-upload' }
        : null
    ),
    storyboardVideo: be.storyboardVideo ?? (
      be.video_url
        ? {
            id: `${be.id}_vid`,
            url: normalizeImageUrl(be.video_url),
            name: '分镜视频',
            type: 'video/mp4',
            model: be.video_model,
            resolution: be.video_resolution,
            duration: be.video_duration,
            thumbnail: be.video_thumbnail_url ? normalizeImageUrl(be.video_thumbnail_url) : undefined,
            finalized: true,
          }
        : null
    ),
  };
}

/**
 * 批量归一化分镜并补全主体参考图；不执行请求或状态写回。
 */
export function normalizeStoryboardList(data, chars = []) {
  if (!Array.isArray(data)) return [];
  return data.map((shot) => enrichMainRefs(normalizeStoryboard(shot), chars));
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

  // Pass 2: build result, deduplicating by URL path
  // - Use enriched versions for subject entries that were enriched
  // - Skip non-subject entries whose URL path matches an already-used subject URL
  const result = [];
  for (const ref of shot.mainRefs) {
    if (enrichedById[ref.id]) {
      result.push(enrichedById[ref.id]);
      continue;
    }
    // Dedup by URL path — handles absolute vs relative URL mismatch
    if (ref.url) {
      const pathKey = urlPathKey(normalizeImageUrl(ref.url));
      if (pathKey && usedPathKeys.has(pathKey)) continue;
      if (pathKey) usedPathKeys.add(pathKey);
    }
    result.push(ref);
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
