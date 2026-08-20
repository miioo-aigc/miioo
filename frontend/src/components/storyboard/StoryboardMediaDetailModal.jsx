import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Toggle from '../Toggle';
import { useModalSize } from '../../utils/useModalSize';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { formatReferenceMode } from '../../utils/referenceMode';

// 详情弹窗尺寸由 useModalSize 统一计算：基准 1200×800，内部内容整体等比缩放。

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function isVideoMedia(media) {
  return media?.media_type === 'video' || media?.type?.startsWith('video');
}

function mediaPreviewUrl(media) {
  if (isVideoMedia(media)) {
    return normalizeImageUrl(
      media?.poster_url
        || media?.posterUrl
        || media?.thumbnail_url
        || media?.thumbnailUrl
        || media?.video_thumbnail_url
        || media?.videoThumbnailUrl
        || media?.first_frame_url
        || media?.firstFrameUrl
        || '',
    );
  }
  return normalizeImageUrl(
    media?.thumbnail_url
      || media?.thumbnailUrl
      || media?.preview_url
      || media?.previewUrl
      || media?.large_url
      || media?.largeUrl
      || media?.url
      || '',
  );
}

function mediaImageUrl(media) {
  return normalizeImageUrl(media?.large_url || media?.preview_url || media?.url || '');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false });
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
    && !(Array.isArray(value) && value.length === 0);
}

function parseMetadata(media) {
  const raw = media?.metadata ?? media?.metadata_json ?? media?.metadataJson ?? {};
  if (typeof raw !== 'string') return raw && typeof raw === 'object' ? raw : {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseObjectValue(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function displayValue(value) {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).join('、');
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

// asset:// 引用无法直接作为图片地址展示（需经素材认证映射到真实 URL），展示层跳过。
function isUnresolvableAssetRef(value) {
  return /^asset:\/\//i.test(String(value || '').trim());
}

function firstResolvableUrl(...urls) {
  return urls.find((url) => url && !isUnresolvableAssetRef(url)) || '';
}

// 同一素材可能以绝对地址（https://host/uploads/...）与相对路径（/uploads/...）两种形态出现，
// 用规范化后的 pathname 作为去重键，避免因 URL 形态不同而重复展示。
function canonicalMediaKey(url) {
  if (!url) return '';
  const raw = String(url).trim();
  if (!raw) return '';
  if (isUnresolvableAssetRef(raw)) return `asset:${raw.replace(/^asset:\/\//i, '').toLowerCase()}`;
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
  try {
    const parsed = new URL(raw, 'http://__local__');
    return (parsed.pathname || raw).toLowerCase();
  } catch {
    return raw.split(/[?#]/)[0].toLowerCase();
  }
}

function normalizeReferenceImages(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return normalizeReferenceImages(JSON.parse(trimmed));
      } catch {
        // 非 JSON 字符串继续按单个 URL 处理。
      }
    }
  }
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => {
    const url = typeof item === 'string'
      ? item
      : item?.url || item?.fileUrl || item?.file_url || item?.image_url || item?.imageUrl || item?.path;
    if (!url) return null;
    return {
      ...((item && typeof item === 'object' && !Array.isArray(item)) ? item : {}),
      url: normalizeImageUrl(url),
    };
  }).filter((item) => item?.url);
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase().replace(/[_\s-]/g, '');
}

function isSubjectReferenceRole(value) {
  const role = normalizeRole(typeof value === 'string' ? value : value?.role || '');
  const name = normalizeRole(typeof value === 'string' ? '' : value?.name || '');
  const subjectType = normalizeRole(typeof value === 'string' ? '' : value?._type || value?.subject_type || '');
  return ['subject', 'subjectreference', 'mainsubject', 'subjectimage', 'subjectpicture', '主体', '参考主体']
    .includes(role)
    || ['主体', '参考主体'].includes(name)
    || ['char', 'character', 'scene', 'prop', 'person', 'role', 'subject', '主体'].includes(subjectType);
}

function isFirstFrameRole(value) {
  const role = normalizeRole(typeof value === 'string' ? value : value?.role || '');
  const name = normalizeRole(typeof value === 'string' ? '' : value?.name || '');
  return ['firstframe', 'first', 'firstimage', '首帧', '首帧图'].includes(role)
    || ['首帧', '首帧图', '首帧参考'].includes(name);
}

function isLastFrameRole(value) {
  const role = normalizeRole(typeof value === 'string' ? value : value?.role || '');
  const name = normalizeRole(typeof value === 'string' ? '' : value?.name || '');
  return ['lastframe', 'last', 'lastimage', '尾帧', '尾帧图'].includes(role)
    || ['尾帧', '尾帧图', '尾帧参考'].includes(name);
}

function collectAssetBindings(media, metadata, parameterContainers) {
  const rawLists = [
    media?.asset_bindings,
    media?.assetBindings,
    metadata?.asset_bindings,
    metadata?.assetBindings,
    ...parameterContainers.flatMap((container) => [
      container.asset_bindings,
      container.assetBindings,
    ]),
  ].filter(Array.isArray);
  return rawLists.flatMap((list) => list).filter((item) => item && typeof item === 'object');
}

function normalizeBindingImage(binding) {
  // asset_bindings 的 url 多为 asset:// 引用，无法直接展示，需靠素材认证映射到真实地址。
  const rawUrl = firstResolvableUrl(
    binding?.url,
    binding?.preview_url,
    binding?.previewUrl,
    binding?.file_url,
    binding?.fileUrl,
    binding?.image_url,
    binding?.imageUrl,
  );
  const url = normalizeImageUrl(rawUrl);
  if (!url) return null;
  return {
    url,
    name: binding?.asset_name || binding?.name || binding?.filename || '',
    role: binding?.role || binding?.media_role || binding?.asset_role || '',
  };
}

// 全能参考模式下，storyboard_asset_certification 是「真实图片地址 → 参考主体」的权威映射。
function collectSubjectCertifications(media, metadata, parameterContainers) {
  const containers = [
    media?.seedance_voice_video, media?.seedanceVoiceVideo,
    metadata?.seedance_voice_video, metadata?.seedanceVoiceVideo,
    ...parameterContainers.flatMap((container) => [container?.seedance_voice_video, container?.seedanceVoiceVideo]),
  ];
  const rawLists = containers
    .flatMap((container) => [container?.storyboard_asset_certification, container?.storyboardAssetCertification])
    .filter(Array.isArray);
  const map = new Map();
  rawLists.flat().forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const url = normalizeImageUrl(entry.url || entry.image_url || entry.imageUrl || '');
    if (!url) return;
    const key = canonicalMediaKey(url);
    if (!key || map.has(key)) return;
    map.set(key, {
      url,
      name: entry.subject_name || entry.subjectName || '',
      subjectType: entry.subject_type || entry.subjectType || '',
    });
  });
  return map;
}

function collectReferenceGroups(media, metadata, parameterContainers, extraValues = [], options = {}) {
  const { fullReferenceMode = false } = options;
  // 全能参考模式下，reference_images 承载的都是主体参考图，默认归入参考主体；
  // 其它模式仍按参考图处理，认证命中的图片始终提升为参考主体。
  const defaultImageGroup = fullReferenceMode ? 'subjects' : 'references';
  const certifications = collectSubjectCertifications(media, metadata, parameterContainers);
  const groups = {
    subjects: [],
    references: [],
    firstFrames: [],
    lastFrames: [],
    videos: [],
    audios: [],
  };
  const seen = new Map();
  const GROUP_PRIORITY = { firstFrames: 3, lastFrames: 3, subjects: 2, references: 1, videos: 1, audios: 1 };
  const push = (group, item) => {
    if (!item?.url) return;
    const key = canonicalMediaKey(item.url);
    // 认证映射优先：命中认证的图片一律归为参考主体，并补齐主体名称。
    const cert = certifications.get(key);
    let targetGroup = group;
    let entry = item;
    if (cert && (group === 'references' || group === 'subjects')) {
      targetGroup = 'subjects';
      entry = { ...item, name: item.name || cert.name };
    }
    const existing = seen.get(key);
    if (existing) {
      if (existing === targetGroup || GROUP_PRIORITY[targetGroup] <= GROUP_PRIORITY[existing]) return;
      const index = groups[existing].findIndex((value) => canonicalMediaKey(value.url) === key);
      if (index >= 0) groups[existing].splice(index, 1);
    }
    seen.set(key, targetGroup);
    groups[targetGroup].push(entry);
  };

  collectAssetBindings(media, metadata, parameterContainers).forEach((binding) => {
    const type = String(binding?.asset_type || binding?.media_type || binding?.type || '').toLowerCase();
    const item = normalizeBindingImage(binding);
    if (!item) return;
    if (type.startsWith('video')) push('videos', item);
    else if (type.startsWith('audio')) push('audios', item);
    // 全能参考模式下 asset_bindings 的 last_frame/reference_image 为历史遗留角色，不代表首尾帧，忽略其角色。
    else if (!fullReferenceMode && isFirstFrameRole(item)) push('firstFrames', item);
    else if (!fullReferenceMode && isLastFrameRole(item)) push('lastFrames', item);
    else if (isSubjectReferenceRole(item)) push('subjects', item);
    else push(defaultImageGroup, item);
  });

  const firstFrameUrls = [
    media?.first_frame_url, media?.firstFrameUrl,
    metadata?.first_frame_url, metadata?.firstFrameUrl,
    ...parameterContainers.flatMap((container) => [container.first_frame_url, container.firstFrameUrl]),
  ];
  if (groups.firstFrames.length === 0) firstFrameUrls.forEach((value) => {
    const url = normalizeImageUrl(typeof value === 'string' ? value : (value?.url || value?.fileUrl || ''));
    if (url) push('firstFrames', { url, name: '首帧', role: 'first_frame' });
  });
  const lastFrameUrls = [
    media?.last_frame_url, media?.lastFrameUrl,
    metadata?.last_frame_url, metadata?.lastFrameUrl,
    ...parameterContainers.flatMap((container) => [container.last_frame_url, container.lastFrameUrl]),
  ];
  if (groups.lastFrames.length === 0) lastFrameUrls.forEach((value) => {
    const url = normalizeImageUrl(typeof value === 'string' ? value : (value?.url || value?.fileUrl || ''));
    if (url) push('lastFrames', { url, name: '尾帧', role: 'last_frame' });
  });
  const referenceVideoUrls = [
    media?.reference_video_url, media?.referenceVideoUrl,
    metadata?.reference_video_url, metadata?.referenceVideoUrl,
    ...parameterContainers.flatMap((container) => [container.reference_video_url, container.referenceVideoUrl]),
  ];
  if (groups.videos.length === 0) referenceVideoUrls.forEach((value) => {
    const url = normalizeImageUrl(typeof value === 'string' ? value : (value?.url || value?.fileUrl || value?.preview_url || ''));
    if (url) push('videos', { url, name: '参考视频', role: 'reference_video' });
  });
  const referenceAudioUrls = [
    media?.reference_audio_url, media?.referenceAudioUrl,
    metadata?.reference_audio_url, metadata?.referenceAudioUrl,
    ...parameterContainers.flatMap((container) => [container.reference_audio_url, container.referenceAudioUrl]),
  ];
  if (groups.audios.length === 0) referenceAudioUrls.forEach((value) => {
    const url = normalizeImageUrl(typeof value === 'string' ? value : (value?.url || value?.fileUrl || ''));
    if (url) push('audios', { url, name: '参考音频', role: 'reference_audio' });
  });

  const values = [
    media?.reference_images, media?.referenceImages,
    media?.reference_image_urls, media?.referenceImageUrls,
    media?.ref_images, media?.refImages,
    metadata?.reference_images, metadata?.referenceImages,
    metadata?.reference_image_urls, metadata?.referenceImageUrls,
    metadata?.ref_images, metadata?.refImages,
    ...extraValues,
    ...parameterContainers.flatMap((container) => [
      container.reference_images, container.referenceImages,
      container.reference_image_urls, container.referenceImageUrls,
      container.ref_images, container.refImages,
    ]),
  ];
  values.flatMap((value) => normalizeReferenceImages(value)).forEach((item) => {
    if (!fullReferenceMode && isFirstFrameRole(item)) push('firstFrames', item);
    else if (!fullReferenceMode && isLastFrameRole(item)) push('lastFrames', item);
    else if (isSubjectReferenceRole(item)) push('subjects', item);
    else push(defaultImageGroup, item);
  });

  return groups;
}

function isFrameReferenceMode(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_\s-]/g, '');
  return ['frame', 'frameref', 'firstframe', 'lastframe', 'startend', 'startendframe'].includes(normalized);
}

function isFullReferenceMode(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_\s-]/g, '');
  // 后端非首尾帧模式会随模型能力扩展（如 video_ref），均按全能参考展示。
  return Boolean(normalized) && !isFrameReferenceMode(normalized);
}

function collectParameterEntries(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const label = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return collectParameterEntries(nested, label);
    }
    return hasValue(nested) ? [{ label, value: displayValue(nested) }] : [];
  });
}

function parameterLabel(key) {
  const labels = {
    model: '模型', resolution: '分辨率', duration: '时长', ratio: '比例', aspect_ratio: '画面比例',
    sound_effect: '音效', generate_audio: '生成音频', reference_images: '参考图', first_frame_url: '首帧',
    last_frame_url: '尾帧', reference_video_url: '参考视频', reference_audio_url: '参考音频', reference_mode: '参考模式', referenceMode: '参考模式',
  };
  return labels[key] || key;
}

function normalizeMediaSource(value) {
  const source = String(value || '').toLowerCase().replace(/_/g, '-');
  if (
    source === 'local'
    || source === 'upload'
    || source === 'uploaded'
    || source === 'local-upload'
    || source === 'manual-upload'
    || source === 'user-upload'
    || source === 'user-uploaded'
    || source.includes('local-upload')
    || source.includes('manual-upload')
    || source.includes('user-upload')
  ) return 'local-upload';
  if (
    source === 'asset'
    || source === 'asset-library'
    || source === 'library'
    || source === 'creation-shot-import'
    || source === 'asset-import'
    || source === 'imported-asset'
    || source.includes('asset-import')
    || source.includes('shot-import')
  ) return 'asset-library';
  if (
    source === 'storyboard-existing'
    || source === 'existing-storyboard'
    || source === 'existing-media'
    || source === 'storyboard-media'
    || source === 'existing'
    || source.includes('storyboard-existing')
    || source.includes('existing-storyboard')
  ) return 'storyboard-existing';
  if (source === 'ai' || source === 'ai-generated' || source === 'generated' || source.includes('ai') || source.includes('generated')) return 'ai-generated';
  return source;
}

const GENERATION_PARAMETER_KEYS = new Set([
  'model', 'resolution', 'size', 'duration', 'ratio', 'aspect_ratio', 'aspectRatio',
  'sound_effect', 'soundEffect', 'generate_audio', 'generateAudio', 'audio_setting', 'audioSetting',
  'reference_images', 'referenceImages', 'first_frame_url', 'firstFrameUrl',
  'reference_image_urls', 'referenceImageUrls', 'ref_images', 'refImages',
  'last_frame_url', 'lastFrameUrl', 'reference_video_url', 'referenceVideoUrl',
  'reference_audio_url', 'referenceAudioUrl', 'reference_mode', 'referenceMode',
  'reference_mode_label', 'referenceModeLabel',
  'generation_mode', 'generationMode', 'generate_mode', 'generateMode',
  'watermark', 'multi_shot', 'multiShot', 'expand_options', 'expandOptions',
  'subject_completion_options', 'subjectCompletionOptions', 'optimize_prompt', 'optimizePrompt',
  'sequential_image_generation', 'sequentialImageGeneration', 'prompt_raw', 'promptRaw',
  'prompt_resolved', 'promptResolved', 'provider_params', 'providerParams',
]);

function pickGenerationParameters(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, nested]) => {
    if (GENERATION_PARAMETER_KEYS.has(key)) return hasValue(nested);
    return false;
  }));
}

function getAssetGenerationParameters(media, metadata, extraContainers = []) {
  const nestedValues = [
    media?.params, media?.parameters, media?.generation, media?.options,
    media?.gen_params, media?.genParams, media?.generation_params, media?.generationParams,
    media?.provider_params, media?.providerParams,
    metadata?.params, metadata?.parameters, metadata?.generation, metadata?.options,
    metadata?.gen_params, metadata?.genParams, metadata?.generation_params, metadata?.generationParams,
    metadata?.provider_params, metadata?.providerParams,
    ...extraContainers,
  ].map(parseObjectValue);
  const nestedParams = nestedValues.reduce((result, value) => ({ ...result, ...pickGenerationParameters(value) }), {});
  const directParams = pickGenerationParameters({
    model: media?.model ?? metadata?.model,
    resolution: media?.resolution ?? media?.size ?? metadata?.resolution ?? metadata?.size,
    size: media?.size ?? metadata?.size,
    duration: media?.duration ?? metadata?.duration,
    ratio: media?.ratio ?? media?.aspect_ratio ?? media?.aspectRatio ?? metadata?.ratio ?? metadata?.aspect_ratio ?? metadata?.aspectRatio,
    reference_images: media?.reference_images ?? media?.referenceImages ?? metadata?.reference_images ?? metadata?.referenceImages,
    reference_image_urls: media?.reference_image_urls ?? media?.referenceImageUrls ?? metadata?.reference_image_urls ?? metadata?.referenceImageUrls,
    ref_images: media?.ref_images ?? media?.refImages ?? metadata?.ref_images ?? metadata?.refImages,
  });
  return { ...nestedParams, ...directParams };
}

function isLocalUploadMedia(media, metadata) {
  const source = normalizeMediaSource(
    media?.source
      || media?.source_type
      || media?.sourceType
      || metadata?.source
      || metadata?.source_type
      || metadata?.sourceType,
  );
  if (source === 'local-upload') return true;

  const origin = normalizeMediaSource(
    media?.origin
      || media?.upload_source
      || media?.uploadSource
      || metadata?.origin
      || metadata?.upload_source
      || metadata?.uploadSource,
  );
  return origin === 'local-upload';
}

function ReferenceImageSection({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <>
      <div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} />
      <div style={{ padding: '16px 20px' }}>
        <span style={{ display: 'block', marginBottom: '10px', color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>{title}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {items.map((item, index) => (
            <div key={`${item.url}-${index}`} style={{ width: 'calc((100% - 16px) / 3)', aspectRatio: '1', flexShrink: 0, boxSizing: 'border-box', overflow: 'hidden', borderRadius: '4px', border: '1px solid #FFFFFF33', background: '#FFFFFF14' }}>
              <img src={item.url} alt={item.name || title} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ReferenceMediaSection({ title, items = [], kind = 'video' }) {
  if (!items.length) return null;
  return (
    <>
      <div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} />
      <div style={{ padding: '16px 20px' }}>
        <span style={{ display: 'block', marginBottom: '10px', color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>{title}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item, index) => (
            kind === 'video'
              ? <video key={`${item.url}-${index}`} src={item.url} controls preload="metadata" style={{ width: '100%', maxHeight: '120px', borderRadius: '4px', background: '#0D0D0D', display: 'block' }} />
              : <audio key={`${item.url}-${index}`} src={item.url} controls preload="none" style={{ width: '100%', height: '36px', display: 'block' }} />
          ))}
        </div>
      </div>
    </>
  );
}

function CloseButton({ onClick }) {
  return (
    <button type="button" aria-label="关闭" onClick={onClick} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: '6px', padding: 0, background: 'transparent', cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function CopyPromptButton({ prompt }) {
  return (
    <button
      type="button"
      aria-label="复制提示词"
      title="复制提示词"
      onClick={() => navigator.clipboard.writeText(prompt)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0, borderRadius: '4px', border: 'none', padding: 0, background: 'none', color: '#FFFFFF99', cursor: 'pointer', transition: 'color 120ms ease' }}
      onMouseEnter={(event) => { event.currentTarget.style.color = '#FFFFFF'; }}
      onMouseLeave={(event) => { event.currentTarget.style.color = '#FFFFFF99'; }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function CandidateThumbnail({ media, active, onClick }) {
  const video = isVideoMedia(media);
  const thumb = mediaPreviewUrl(media);
  const [generatedThumb, setGeneratedThumb] = useState('');
  const videoUrl = normalizeImageUrl(media?.url || media?.preview_video_url || media?.previewVideoUrl || '');

  useEffect(() => {
    if (!video || thumb || !videoUrl) return undefined;

    let cancelled = false;
    const source = document.createElement('video');
    source.src = videoUrl;
    source.muted = true;
    source.playsInline = true;
    source.preload = 'auto';

    const captureFirstFrame = () => {
      if (cancelled || !source.videoWidth || !source.videoHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      try {
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        setGeneratedThumb(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        // 跨域媒体无法绘制到 canvas 时，保留 video 自身的浏览器首帧兜底。
      }
    };
    const seekToStart = () => {
      source.currentTime = 0;
      if (source.readyState >= 2) captureFirstFrame();
    };
    source.addEventListener('loadeddata', seekToStart);
    source.addEventListener('seeked', captureFirstFrame);
    source.load();

    return () => {
      cancelled = true;
      source.removeEventListener('loadeddata', seekToStart);
      source.removeEventListener('seeked', captureFirstFrame);
      source.removeAttribute('src');
      source.load();
    };
  }, [video, thumb, videoUrl]);

  const resolvedThumb = thumb || generatedThumb;
  return (
    <button type="button" onClick={onClick} aria-label={`查看${video ? '视频' : '图片'}`} style={{ width: '100px', height: '76px', position: 'relative', flexShrink: 0, overflow: 'hidden', padding: 0, borderRadius: '6px', border: `1px solid ${active ? '#2DC3E1' : '#FFFFFF1F'}`, background: '#1D1E1E', cursor: 'pointer', boxShadow: active ? '0 0 0 1px #2DC3E166' : 'none' }}>
      {video ? (resolvedThumb
        ? <img src={resolvedThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <video src={videoUrl} muted playsInline preload="auto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
        : <img src={resolvedThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <span style={{ position: 'absolute', top: '4px', right: '4px', padding: '1px 4px', borderRadius: '2px', background: '#00000099', color: '#FFFFFFCC', font: `10px/14px ${FONT}` }}>{video ? '视频' : '图片'}</span>
      {media?.is_finalized && <span style={{ position: 'absolute', top: '4px', left: '4px', padding: '1px 4px', borderRadius: '2px', background: '#2DC3E1', color: '#090909', font: `10px/14px ${FONT}` }}>定稿</span>}
    </button>
  );
}

export default function StoryboardMediaDetailModal({ shot, candidates = [], media, onClose, onFinalizeChange, onDownload, readOnlyFinalize = false }) {
  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const items = useMemo(() => {
    const source = candidates.length ? candidates : media ? [media] : [];
    return source.filter((item, index, list) => item && (item.id || item.url) && list.findIndex((candidate) => (candidate.id || candidate.url) === (item.id || item.url)) === index);
  }, [candidates, media]);
  const initial = media?.id || media?.url;
  const [activeKey, setActiveKey] = useState(initial);
  const activeMedia = items.find((item) => (item.id || item.url) === activeKey) || items[0] || media;
  const video = isVideoMedia(activeMedia);
  const activePoster = mediaPreviewUrl(activeMedia);
  const finalized = !!activeMedia?.is_finalized;

  if (!activeMedia) return null;

  const label = `分镜${String(shot?.number ?? '').padStart(2, '0')}`;
  const metadata = parseMetadata(activeMedia);
  const detailParameterContainers = [
    activeMedia?.params, activeMedia?.parameters, activeMedia?.generation, activeMedia?.options,
    activeMedia?.gen_params, activeMedia?.genParams, activeMedia?.generation_params, activeMedia?.generationParams,
    metadata?.params, metadata?.parameters, metadata?.generation, metadata?.options,
    metadata?.gen_params, metadata?.genParams, metadata?.generation_params, metadata?.generationParams,
  ].map(parseObjectValue);
  const sourceValue = activeMedia?.source
    || activeMedia?.source_type
    || activeMedia?.sourceType
    || activeMedia?.detailSource
    || activeMedia?.detail_source;
  const normalizedSource = normalizeMediaSource(sourceValue);
  const activeUrl = activeMedia?.url || activeMedia?.file_url || activeMedia?.fileUrl;
  const isShotMedia = [shot?.storyboardImage?.url, shot?.storyboardVideo?.url]
    .filter(Boolean)
    .some((url) => url === activeUrl);
  const isExistingStoryboardMedia = normalizedSource === 'storyboard-existing' || (!sourceValue && isShotMedia);
  const referenceModeValue = [
    activeMedia?.reference_mode,
    activeMedia?.referenceMode,
    metadata?.reference_mode,
    metadata?.referenceMode,
    metadata?.seedance_voice_video?.reference_mode,
    metadata?.seedanceVoiceVideo?.reference_mode,
    ...detailParameterContainers.map((container) => container.reference_mode || container.referenceMode),
  ].find(hasValue) ?? '';
  const referenceModeLabel = [
    activeMedia?.reference_mode_label,
    activeMedia?.referenceModeLabel,
    metadata?.reference_mode_label,
    metadata?.referenceModeLabel,
    metadata?.seedance_voice_video?.reference_mode_label,
    metadata?.seedanceVoiceVideo?.referenceModeLabel,
    ...detailParameterContainers.map((container) => container.reference_mode_label || container.referenceModeLabel),
  ].find(hasValue) ?? '';
  const frameReferenceMode = isFrameReferenceMode(referenceModeValue);
  const fullReferenceMode = isFullReferenceMode(referenceModeValue);
  const referenceGroups = collectReferenceGroups(
    activeMedia,
    metadata,
    detailParameterContainers,
    [],
    { fullReferenceMode },
  );
  const detailPrompt = detailParameterContainers.reduce(
    (result, value) => result
      || value.prompt_resolved || value.promptResolved
      || value.prompt_raw || value.promptRaw
      || value.prompt || value.input_prompt || value.inputPrompt,
    '',
  );
  const isLocalUpload = isLocalUploadMedia(activeMedia, metadata);
  const source = isLocalUpload
    ? 'local-upload'
    : isExistingStoryboardMedia
      ? 'storyboard-existing'
    : normalizeMediaSource(
      activeMedia.detailSource
        || activeMedia.detail_source
        || activeMedia.source
        || activeMedia.source_type
        || activeMedia.sourceType
        || metadata.detailSource
        || metadata.detail_source
        || metadata.source
        || metadata.source_type
        || metadata.sourceType,
    );
  const prompt = source === 'local-upload'
    ? ''
    : (activeMedia.prompt_resolved || activeMedia.promptResolved
      || metadata.prompt_resolved || metadata.promptResolved
      || activeMedia.prompt_raw || activeMedia.promptRaw
      || metadata.prompt_raw || metadata.promptRaw
      || activeMedia.input_prompt || activeMedia.inputPrompt
      || activeMedia.prompt
      || metadata.input_prompt || metadata.inputPrompt
      || metadata.prompt
      || detailPrompt
      || '');
  const parameterEntries = source === 'local-upload'
    ? []
    : collectParameterEntries(getAssetGenerationParameters(activeMedia, metadata));
  const normalizedParameterEntries = parameterEntries
    .filter((entry) => ![
      'reference_images', 'referenceImages', 'reference_image_urls', 'referenceImageUrls', 'ref_images', 'refImages',
      'first_frame_url', 'firstFrameUrl', 'last_frame_url', 'lastFrameUrl',
      'reference_video_url', 'referenceVideoUrl', 'reference_audio_url', 'referenceAudioUrl',
      'prompt_raw', 'promptRaw', 'prompt_resolved', 'promptResolved', 'watermark',
      'reference_mode_label', 'referenceModeLabel',
    ].some((key) => entry.label === key || entry.label.startsWith(`${key}.`)))
    .map((entry) => ({
      ...entry,
      label: entry.label.split('.').map(parameterLabel).join(' / '),
      value: ['reference_mode', 'referenceMode'].includes(entry.label)
        ? formatReferenceMode(entry.value, referenceModeLabel)
        : ['sound_effect', 'soundEffect'].includes(entry.label) && ['是', '否'].includes(entry.value)
          ? (entry.value === '是' ? '开' : '关')
          : entry.value,
    }));
  if (referenceModeLabel && !normalizedParameterEntries.some((entry) => entry.label === '参考模式')) {
    normalizedParameterEntries.push({ label: '参考模式', value: referenceModeLabel });
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(12px)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div style={{ width: `${modalW}px`, height: `${modalH}px`, transform: `scale(${modalScale})`, transformOrigin: 'center center', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px', background: '#161616', border: '1px solid #FFFFFF14', boxShadow: '-10px 24px 64px #00000099' }} onMouseDown={(event) => event.stopPropagation()}>
        <header style={{ height: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#161616' }}>
          <span style={{ color: '#FFFFFF', font: `500 16px/20px ${FONT_MEDIUM}` }}>查看详情</span>
          <CloseButton onClick={onClose} />
        </header>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0D0D0D' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#0A0A0A' }}>
              {video ? <video key={activeMedia.id || activeMedia.url} src={normalizeImageUrl(activeMedia.url || activeMedia.preview_video_url)} poster={activePoster || undefined} controls autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <img src={mediaImageUrl(activeMedia)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
            </div>
            <div style={{ flexShrink: 0, minHeight: '108px', padding: '16px', display: 'flex', gap: '12px', overflowX: 'auto', borderTop: '1px solid #FFFFFF0F', background: '#161616' }}>
              {items.map((item) => <CandidateThumbnail key={item.id || item.url} media={item} active={(item.id || item.url) === (activeMedia.id || activeMedia.url)} onClick={() => setActiveKey(item.id || item.url)} />)}
            </div>
          </div>
          <aside style={{ width: '280px', flex: '0 0 280px', minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #FFFFFF0F', background: '#161616' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>是否定稿</span>
                {readOnlyFinalize ? (
                  finalized ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '18px',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      backgroundColor: '#4AC981',
                      boxShadow: '#FFFFFF14 0 0 0 1px inset',
                      color: '#0A0A0A',
                      font: `500 12px/14px ${FONT}`,
                    }}>
                      定稿
                    </span>
                  ) : (
                    <span style={{ color: '#FFFFFF66', font: `12px/16px ${FONT}` }}>未定稿</span>
                  )
                ) : (
                  <Toggle value={finalized} onChange={(value) => onFinalizeChange?.(activeMedia, value)} />
                )}
              </div>
              <div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>分镜编号</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}` }}>{label}</span></div>
              <div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} />
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}><span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>内容类型</span><span style={{ color: '#FFFFFFCC', font: `12px/16px ${FONT}`, textAlign: 'right' }}>{video ? '视频' : '图片'}</span></div>

              {prompt && <>
                <div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} />
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                    <span style={{ color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>提示词</span>
                    <CopyPromptButton prompt={prompt} />
                  </div>
                  <p style={{ margin: 0, color: '#FFFFFFCC', font: `12px/20px ${FONT}`, wordBreak: 'break-word' }}>{prompt}</p>
                </div>
              </>}
              {frameReferenceMode
                ? (
                  <>
                    <ReferenceImageSection title="首帧图" items={referenceGroups.firstFrames} />
                    <ReferenceImageSection title="尾帧图" items={referenceGroups.lastFrames} />
                  </>
                )
                : fullReferenceMode
                  ? (
                    <>
                      <ReferenceImageSection title="参考主体" items={referenceGroups.subjects} />
                      <ReferenceImageSection title="参考图" items={referenceGroups.references} />
                      <ReferenceMediaSection title="参考视频" items={referenceGroups.videos} kind="video" />
                      <ReferenceMediaSection title="参考音频" items={referenceGroups.audios} kind="audio" />
                    </>
                  )
                  : (
                    <>
                      <ReferenceImageSection title="首帧图" items={referenceGroups.firstFrames} />
                      <ReferenceImageSection title="尾帧图" items={referenceGroups.lastFrames} />
                      <ReferenceImageSection title="参考主体" items={referenceGroups.subjects} />
                      <ReferenceImageSection title="参考图" items={referenceGroups.references} />
                      <ReferenceMediaSection title="参考视频" items={referenceGroups.videos} kind="video" />
                      <ReferenceMediaSection title="参考音频" items={referenceGroups.audios} kind="audio" />
                    </>
                  )}
              {normalizedParameterEntries.length > 0 && <><div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} /><div style={{ padding: '16px 20px' }}><span style={{ display: 'block', marginBottom: '10px', color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>生成参数</span><div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{normalizedParameterEntries.map((entry) => <div key={entry.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}><span style={{ color: '#FFFFFF66', font: `11px/15px ${FONT}` }}>{entry.label}</span><span style={{ color: '#FFFFFFCC', font: `12px/18px ${FONT}`, wordBreak: 'break-word', whiteSpace: entry.value.includes('\n') ? 'pre-wrap' : 'normal', textAlign: 'right' }}>{entry.value}</span></div>)}</div></div></>}
              {activeMedia.created_at && <><div style={{ height: '1px', margin: '0 20px', background: '#FFFFFF0A' }} /><div style={{ padding: '16px 20px' }}><span style={{ display: 'block', marginBottom: '8px', color: '#FFFFFF99', font: `12px/16px ${FONT}` }}>生成时间</span><span style={{ color: '#FFFFFF66', font: `12px/16px ${FONT}` }}>{formatDate(activeMedia.created_at)}</span></div></>}
            </div>
            <div style={{ flexShrink: 0, padding: '12px 20px 20px', borderTop: '1px solid #FFFFFF0A' }}><button type="button" onClick={() => onDownload?.(activeMedia)} style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #FFFFFF1F', background: '#FFFFFF14', color: '#FFFFFF99', cursor: 'pointer', font: `13px/16px ${FONT}` }}>下载</button></div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
