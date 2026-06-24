import { normalizeImageUrl } from './imageUrl';

/**
 * 后端 StoryboardResponse (snake_case flat) → 前端 shot 模型 (camelCase nested)
 */
export function normalizeStoryboard(be) {
  if (!be || typeof be !== 'object') return be;
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
        ...(be.reference_image_urls || [])
          .filter(url => {
            const imgPathKey = be.image_url ? urlPathKey(normalizeImageUrl(be.image_url)) : null;
            return !imgPathKey || urlPathKey(normalizeImageUrl(url)) !== imgPathKey;
          })
          .map(url => {
            const n = normalizeImageUrl(url);
            return { id: n, url: n, name: "参考图", type: "image/jpeg" };
          }),
      ]
    ),
    storyboardImage: be.storyboardImage ?? (
      be.image_url
        ? { id: `${be.id}_img`, url: normalizeImageUrl(be.image_url), name: '分镜图', type: 'image/jpeg' }
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
 * 前端 shot 模型 → 后端 StoryboardCreate / StoryboardUpdate (snake_case flat)
 */
export function toBackendStoryboard(shot) {
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
      : undefined,
    character_ids: (shot.mainRefs || [])
      .filter(ref => ref?.type === 'char' || ref?.type === 'scene' || ref?.type === 'prop')
      .map(ref => ref?.id).filter(Boolean),
    reference_image_urls: (shot.mainRefs || [])
      .filter(ref => ref?.url && !ref.uploading)
      .filter(ref => ref?.type !== 'char' && ref?.type !== 'scene' && ref?.type !== 'prop')
      .filter(ref => !shot.storyboardImage?.url || ref.url !== shot.storyboardImage.url)
      .map(ref => ref.url)
      .filter(Boolean),
    image_url: shot.storyboardImage?.url || undefined,
    video_url: shot.storyboardVideo?.url || undefined,
  };
}

/**
 * 将 URL 规范化为路径键
 */
export function urlPathKey(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url.startsWith('/') ? url : `/${url}`;
  }
}

/**
 * 为从 character_ids 构造的 mainRefs 补上 url
 */
export function enrichMainRefs(shot, chars) {
  if (!shot?.mainRefs) return shot;
  const usedPathKeys = new Set();
  const enrichedById = {};
  for (const ref of shot.mainRefs) {
    if ((ref.type === 'char' || ref.type === 'scene' || ref.type === 'prop') && !ref.url) {
      const ch = (chars || []).find(c => c.id === ref.id);
      if (ch?.imageUrl) {
        const url = normalizeImageUrl(ch.imageUrl);
        const pathKey = urlPathKey(url);
        if (pathKey) usedPathKeys.add(pathKey);
        enrichedById[ref.id] = { ...ref, url, name: ch.name };
      }
    }
  }
  const result = [];
  for (const ref of shot.mainRefs) {
    if (enrichedById[ref.id]) {
      result.push(enrichedById[ref.id]);
      continue;
    }
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
 * 由分镜列表字段拼出提示词输入框的「初始内容」
 */
export function buildPromptFromShot(shot) {
  const lines = [];
  const paramParts = [
    shot?.params?.framing,
    shot?.params?.cameraMotion,
    shot?.params?.angle,
    shot?.params?.composition,
    shot?.params?.duration,
  ].filter(Boolean);
  if (paramParts.length) lines.push(paramParts.join('，'));
  const atmosphereParts = [
    shot?.lightShadow,
    shot?.ambientSound,
  ].filter(Boolean);
  if (atmosphereParts.length) lines.push(atmosphereParts.join('，'));
  const descParts = [];
  if (shot?.description) descParts.push(shot.description);
  if (descParts.length) lines.push(descParts.join(' '));
  if (shot?.narration?.segments?.length > 0) {
    const dialogues = shot.narration.segments
      .map(seg => `${seg.role}：${seg.lines}`)
      .join('，');
    lines.push(dialogues);
  }
  return lines.join('\n');
}
