const GENERATION_KEYS = new Set([
  'model', 'resolution', 'size', 'duration', 'ratio', 'aspect_ratio', 'aspectRatio',
  'sound_effect', 'soundEffect', 'generate_audio', 'generateAudio', 'audio_setting', 'audioSetting',
  'reference_images', 'referenceImages', 'first_frame_url', 'firstFrameUrl',
  'reference_image_urls', 'referenceImageUrls',
  'last_frame_url', 'lastFrameUrl', 'reference_video_url', 'referenceVideoUrl',
  'reference_audio_url', 'referenceAudioUrl', 'reference_mode', 'referenceMode',
  'generation_mode', 'generationMode', 'generate_mode', 'generateMode',
  'watermark', 'multi_shot', 'multiShot', 'expand_options', 'expandOptions',
  'subject_completion_options', 'subjectCompletionOptions', 'optimize_prompt', 'optimizePrompt',
  'sequential_image_generation', 'sequentialImageGeneration', 'provider_params', 'providerParams',
]);

function parseObject(value) {
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

function readMetadata(media) {
  return parseObject(media.metadata || media.metadata_json || media.metadataJson || {});
}

function readGenerationParams(media, metadata) {
  const parameterContainers = [
    media.params, media.parameters, media.generation, media.options,
    media.genParams, media.gen_params, media.generation_params, media.generationParams,
    media.provider_params, media.providerParams,
    metadata.params, metadata.parameters, metadata.generation, metadata.options,
    metadata.gen_params, metadata.genParams, metadata.generation_params, metadata.generationParams,
    metadata.provider_params, metadata.providerParams,
  ].map(parseObject).filter((value) => Object.keys(value).length > 0);
  return Object.assign({}, ...parameterContainers);
}

function filterGenerationParams(value) {
  return Object.fromEntries(
    Object.entries(value && typeof value === 'object' ? value : {})
      .filter(([key, item]) => GENERATION_KEYS.has(key) && item !== undefined && item !== null && item !== ''),
  );
}

function readPrompt(media, metadata, generationParams) {
  return media.prompt || media.input_prompt || media.inputPrompt || media.prompt_raw || media.promptRaw
    || media.prompt_resolved || media.promptResolved
    || metadata.prompt || metadata.input_prompt || metadata.inputPrompt || metadata.prompt_raw || metadata.promptRaw
    || metadata.prompt_resolved || metadata.promptResolved
    || generationParams.prompt || generationParams.input_prompt || generationParams.inputPrompt;
}

function readFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function isAssetLibraryMedia(media) {
  return ['asset-library', 'asset', 'library'].includes(String(media.source || '').toLowerCase());
}

function buildMediaMetadata(media, metadata, generationParams, prompt) {
  const rawGenerationParams = generationParams;
  const filteredParams = filterGenerationParams(rawGenerationParams);
  const promptRaw = readFirst(media.prompt_raw, media.promptRaw, metadata.prompt_raw, metadata.promptRaw);
  const promptResolved = readFirst(media.prompt_resolved, media.promptResolved, metadata.prompt_resolved, metadata.promptResolved);
  const common = {
    ...metadata,
    ...(prompt ? { prompt, input_prompt: prompt } : {}),
    ...(promptRaw ? { prompt_raw: promptRaw } : {}),
    ...(promptResolved ? { prompt_resolved: promptResolved } : {}),
  };

  if (isAssetLibraryMedia(media)) {
    const assetParams = filterGenerationParams({
      model: readFirst(media.model, metadata.model),
      resolution: readFirst(media.resolution, metadata.resolution),
      size: readFirst(media.size, metadata.size),
      duration: readFirst(media.duration, metadata.duration),
      ratio: readFirst(media.ratio, media.aspect_ratio, media.aspectRatio, metadata.ratio, metadata.aspect_ratio, metadata.aspectRatio),
      reference_images: readFirst(media.referenceImages, media.reference_images, metadata.reference_images, metadata.referenceImages),
      reference_image_urls: readFirst(media.referenceImageUrls, media.reference_image_urls, metadata.reference_image_urls, metadata.referenceImageUrls),
      provider_params: readFirst(media.providerParams, media.provider_params, metadata.provider_params, metadata.providerParams),
    });
    const next = {
      ...common,
      ...assetParams,
      ...(Object.keys(filteredParams).length > 0 ? { gen_params: filteredParams } : {}),
    };
    if (Object.keys(rawGenerationParams).length > 0) {
      next.params = rawGenerationParams;
      next.generation_params = rawGenerationParams;
    }
    return next;
  }

  return {
    ...common,
    ...(media.model ? { model: media.model } : {}),
    ...(media.resolution ? { resolution: media.resolution } : {}),
    ...(media.duration != null ? { duration: media.duration } : {}),
    ...(readFirst(media.ratio, media.aspect_ratio, media.aspectRatio) ? { ratio: readFirst(media.ratio, media.aspect_ratio, media.aspectRatio) } : {}),
    ...(readFirst(media.referenceImages, media.reference_images) ? { reference_images: readFirst(media.referenceImages, media.reference_images) } : {}),
    ...(Object.keys(rawGenerationParams).length > 0 ? { gen_params: rawGenerationParams } : {}),
  };
}

export function buildStoryboardCandidatePayload(media) {
  const mediaType = media.mediaType || media.media_type || (media.type?.startsWith('video') ? 'video' : 'image');
  const mediaUrl = media.url || media.fileUrl || media.file_url;
  const metadata = readMetadata(media);
  const generationParams = readGenerationParams(media, metadata);
  const prompt = readPrompt(media, metadata, generationParams);

  return {
    payload: {
      media_type: mediaType,
      url: mediaUrl,
      thumbnail_url: media.thumbnail_url || media.thumbnailUrl || media.poster_url || media.posterUrl || mediaUrl,
      poster_url: media.poster_url || media.posterUrl || media.thumbnail_url || media.thumbnailUrl || mediaUrl,
      download_url: media.download_url || media.downloadUrl || null,
      source: media.source || 'ai-generated',
      asset_id: media.asset_id || media.assetId || null,
      metadata: buildMediaMetadata(media, metadata, generationParams, prompt),
      ...(media.created_at || media.createdAt ? { created_at: media.created_at || media.createdAt } : {}),
    },
    mediaUrl,
  };
}

export function normalizeSavedStoryboardCandidate(payload, saved) {
  return {
    ...payload,
    ...saved,
    metadata: { ...(payload.metadata || {}), ...(saved?.metadata || {}) },
    prompt: saved?.prompt || saved?.inputPrompt || saved?.input_prompt || payload.metadata?.prompt || payload.metadata?.input_prompt || payload.metadata?.params?.prompt || '',
    input_prompt: saved?.input_prompt || saved?.inputPrompt || saved?.prompt || payload.metadata?.input_prompt || payload.metadata?.prompt || payload.metadata?.params?.input_prompt || '',
    model: saved?.model || payload.metadata?.model || payload.metadata?.params?.model || '',
    resolution: saved?.resolution || payload.metadata?.resolution || payload.metadata?.params?.resolution || '',
    ratio: saved?.ratio || payload.metadata?.ratio || payload.metadata?.params?.ratio || '',
    duration: saved?.duration ?? payload.metadata?.duration ?? payload.metadata?.params?.duration ?? null,
    reference_images: saved?.reference_images || saved?.referenceImages || payload.metadata?.reference_images || payload.metadata?.referenceImages || payload.metadata?.params?.reference_images || null,
    genParams: saved?.genParams || saved?.gen_params || saved?.generation_params || payload.metadata?.gen_params || payload.metadata?.params || {},
    gen_params: saved?.gen_params || saved?.genParams || saved?.generation_params || payload.metadata?.gen_params || payload.metadata?.params || {},
    id: saved?.id || payload.url,
  };
}
