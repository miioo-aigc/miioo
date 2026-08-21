/**
 * 音频详情视图适配：统一 Asset 与 AudioClip 两种后端视图的字段。
 * 只做纯数据转换，不调用接口、不持有页面状态。
 */

import { normalizeImageUrl } from './imageUrl';

function readMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? '';
}

export function getAudioAssetMetadata(asset) {
  return readMetadata(asset?.metadata_json || asset?.metadataJson || asset?.metadata);
}

export function normalizeAudioAssetDetail(asset) {
  const metadata = getAudioAssetMetadata(asset);
  const audioUrl = normalizeImageUrl(firstValue(
    asset?.preview_url,
    asset?.previewUrl,
    asset?.file_url,
    asset?.fileUrl,
    asset?.url,
  )) || firstValue(asset?.preview_url, asset?.previewUrl, asset?.file_url, asset?.fileUrl, asset?.url);

  return {
    id: asset?.id || asset?.asset_id || asset?.assetId,
    assetId: asset?.id || asset?.asset_id || asset?.assetId,
    name: firstValue(asset?.name, metadata.name, '音频'),
    audioUrl,
    prompt: firstValue(asset?.input_prompt, asset?.inputPrompt, asset?.prompt, metadata.spoken_text, metadata.prompt, metadata.text),
    model: firstValue(asset?.model, metadata.model),
    duration: firstValue(asset?.duration, metadata.duration),
    voiceId: firstValue(asset?.voice_id, asset?.voiceId, metadata.voice_id, metadata.voiceId),
    voiceName: firstValue(asset?.voice_name, asset?.voiceName, metadata.voice_name, metadata.voiceName),
    voiceOriginLabel: firstValue(asset?.voice_origin_label, asset?.voiceOriginLabel, metadata.voice_origin_label, metadata.voiceOriginLabel),
    speed: firstValue(asset?.speed, metadata.speed),
    pitch: firstValue(asset?.pitch, metadata.pitch),
    volume: firstValue(asset?.volume, metadata.volume),
    advancedEnabled: firstValue(asset?.advanced_mode_enabled, asset?.advanced_enabled, asset?.advancedEnabled, metadata.advanced_mode_enabled, metadata.advanced_enabled, metadata.advancedEnabled),
    createdAt: firstValue(asset?.created_at, asset?.createdAt),
    favorited: Boolean(firstValue(asset?.is_starred, asset?.is_favorite, asset?.isLiked)),
    clipId: firstValue(asset?.clip_id, asset?.clipId, metadata.clip_id, metadata.clipId),
  };
}

export function normalizeCreationAudioDetail(detail, fallback = {}) {
  const metadata = readMetadata(detail?.metadata_json || detail?.metadataJson || detail?.metadata);
  return {
    ...fallback,
    id: detail?.id || detail?.audio_id || fallback.id,
    backendId: detail?.id || detail?.audio_id || fallback.backendId,
    name: firstValue(detail?.name, fallback.name, '音频'),
    audioUrl: normalizeImageUrl(firstValue(detail?.audio_url, detail?.audioUrl, detail?.preview_url, detail?.previewUrl))
      || firstValue(detail?.audio_url, detail?.audioUrl, detail?.preview_url, detail?.previewUrl, fallback.audioUrl),
    prompt: firstValue(detail?.text, detail?.prompt, detail?.input_prompt, fallback.prompt),
    model: firstValue(detail?.model, fallback.model),
    duration: firstValue(detail?.duration, fallback.duration),
    voiceId: firstValue(detail?.voice_id, detail?.voiceId, fallback.voiceId),
    voiceName: firstValue(detail?.voice_name, detail?.voiceName, fallback.voiceName),
    voiceOriginLabel: firstValue(detail?.voice_origin_label, detail?.voiceOriginLabel, metadata.voice_origin_label, metadata.voiceOriginLabel, fallback.voiceOriginLabel),
    speed: firstValue(detail?.speed, fallback.speed),
    pitch: firstValue(detail?.pitch, fallback.pitch),
    volume: firstValue(detail?.volume, fallback.volume),
    advancedEnabled: firstValue(detail?.advanced_mode_enabled, detail?.advanced_enabled, detail?.advancedEnabled, fallback.advancedEnabled),
    createdAt: firstValue(detail?.human_created_at, detail?.created_at, detail?.createdAt, fallback.createdAt),
    favorited: Boolean(firstValue(detail?.is_favorite, detail?.is_liked, fallback.favorited)),
  };
}
