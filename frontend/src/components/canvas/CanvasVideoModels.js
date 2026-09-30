/** 画布专用视频目录；2026-09-30：模型清单、模式文案与占位符独立适配，不参与创作页聚合。 */
const MODE_LABELS = {
  text_to_video: '文生视频',
  first_frame: '首帧参考',
  last_frame: '尾帧参考',
  start_end: '首尾帧',
  reference_images: '图片参考',
  reference_subjects: '参考主体',
  video_ref: '视频参考',
  full: '全能参考',
  multi_shot: '多镜头',
  video_edit: '视频编辑',
  video_extension: '视频延长',
};

const DEFAULT_PROMPT_PLACEHOLDER = '描述你想生成的内容';

const HAPPYHORSE_GROUPS = [
  { value: 'happyhorse-1.0', label: 'HappyHorse 1.0', order: 5, pattern: /^happyhorse-1\.0-(t2v|i2v|r2v|video-edit)$/i },
  { value: 'happyhorse-1.1', label: 'HappyHorse 1.1', order: 9, pattern: /^happyhorse-1\.1-(t2v|i2v|r2v|video-edit)$/i },
];

const HAPPYHORSE_ROUTE_ORDER = ['t2v', 'i2v', 'r2v', 'video-edit'];

const VIDEO_MODEL_PRESENTATION = {
  'doubao-seedance-2.0': {
    order: 1,
    name: 'Seedance 2.0',
    placeholders: {
      full: '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考9张图片、3条视频、3条音频',
      text_to_video: '输入文字，描述你想生成的内容',
      first_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      last_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      start_end: '输入文字和图片，描述你想生成的内容，图片=2',
      video_ref: '描述你想修改的内容，例如:把@视频角色A替换成@图片B',
      video_edit: '描述你想修改的内容，例如:把@视频角色A替换成@图片B',
    },
  },
  'doubao-seedance-2-0-fast': {
    order: 2,
    name: 'Seedance 2.0 Fast',
    placeholders: {
      full: '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考9张图片、3条视频、3条音频',
      text_to_video: '输入文字，描述你想生成的内容',
      first_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      last_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      start_end: '输入文字和图片，描述你想生成的内容，图片=2',
      video_ref: '描述你想修改的内容，例如:把@视频角色A替换成@图片B',
      video_edit: '描述你想修改的内容，例如:把@视频角色A替换成@图片B',
    },
  },
  'doubao-seedance-2-0-mini-260615': {
    order: 3,
    name: 'Seedance 2.0 Mini',
    placeholders: {
      full: '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考9张图片、3条视频、3条音频，',
      text_to_video: '输入文字，描述你想生成的内容',
      first_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      last_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      start_end: '输入文字和图片，描述你想生成的内容，图片=2',
      video_ref: '描述你想修改的内容，例如:把@视频角色A替换成@图片B',
      video_edit: '描述你想修改的内容，例如:把@视频角色A替换成@图片B',
    },
  },
  'doubao-seedance-2-5-260628': {
    order: 4,
    name: 'Seedance 2.5',
    placeholders: {
      full: '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考30张图片、10条视频、10条音频',
      text_to_video: '输入文字，描述你想生成的内容',
      first_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      last_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      start_end: '输入文字和图片，描述你想生成的内容，图片=2',
      video_ref: '描述你想修改的内容，例如:把@视频角色A替换成@图片B',
      video_edit: '描述你想修改的内容，例如:把@视频角色A替换成@图片B',
    },
  },
  'happyhorse-1.0-t2v': { order: 5, name: 'HappyHorse 1.0 文生视频', placeholders: { text_to_video: '输入文字，描述你想生成的内容' } },
  'happyhorse-1.0-i2v': { order: 6, name: 'HappyHorse 1.0 首帧生视频', placeholders: { first_frame: '输入文字和图片，描述你想生成的内容，图片=1' } },
  'happyhorse-1.0-r2v': {
    order: 7,
    name: 'HappyHorse 1.0 图生视频',
    modeLabels: { reference_subjects: '图片参考', reference_images: '图片参考' },
    placeholders: {
      reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考9张图片',
      reference_images: '可自由组合图文，通过@绑定参考内容，最多可参考9张图片',
    },
  },
  'happyhorse-1.0-video-edit': {
    order: 8,
    name: 'happyhorse 1.0 视频编辑',
    modeLabels: { video_ref: '视频编辑' },
    placeholders: {
      video_ref: '可自由组合图、文、视频，通过@绑定参考内容，最多可参考1条视频，5张图片',
      video_edit: '可自由组合图、文、视频，通过@绑定参考内容，最多可参考1条视频，5张图片',
    },
  },
  'happyhorse-1.1-t2v': { order: 9, name: 'HappyHorse 1.1 文生视频', placeholders: { text_to_video: '输入文字，描述你想生成的内容' } },
  'happyhorse-1.1-i2v': { order: 10, name: 'HappyHorse 1.1 首帧生视频', placeholders: { first_frame: '输入文字和图片，描述你想生成的内容，图片=1' } },
  'happyhorse-1.1-r2v': {
    order: 11,
    name: 'HappyHorse 1.1 图生视频',
    modeLabels: { reference_subjects: '图片参考', reference_images: '图片参考' },
    placeholders: {
      reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考9张图片',
      reference_images: '可自由组合图文，通过@绑定参考内容，最多可参考9张图片',
    },
  },
  'video-kling-v3': {
    order: 12,
    name: 'Kling V3',
    placeholders: {
      text_to_video: '输入文字，描述你想生成的内容',
      first_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      start_end: '输入文字和图片，描述你想生成的内容，图片=2',
    },
  },
  'video-vidu-q2': {
    order: 13,
    name: 'Vidu Q2',
    modeLabels: { reference_subjects: '图片参考', reference_images: '图片参考' },
    placeholders: {
      text_to_video: '输入文字，描述你想生成的内容',
      reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考7张图片',
    },
  },
  'video-viduq3-pro': {
    order: 14,
    name: 'Vidu Q3 Pro',
    placeholders: {
      text_to_video: '输入文字，描述你想生成的内容',
      first_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      start_end: '输入文字和图片，描述你想生成的内容，图片=2',
    },
  },
  'veo-3.1': {
    order: 15,
    name: 'Veo 3.1',
    modeLabels: { reference_subjects: '图片参考', reference_images: '图片参考' },
    placeholders: {
      text_to_video: '输入文字，描述你想生成的内容',
      first_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      start_end: '输入文字和图片，描述你想生成的内容，图片=2',
      reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考3张图片',
    },
  },
  'veo-3.1-fast': {
    order: 16,
    name: 'Veo 3.1 Fast',
    modeLabels: { reference_subjects: '图片参考', reference_images: '图片参考' },
    placeholders: {
      text_to_video: '输入文字，描述你想生成的内容',
      first_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      last_frame: '输入文字和图片，描述你想生成的内容，图片=1',
      start_end: '输入文字和图片，描述你想生成的内容，图片=2',
      reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考3张图片',
    },
  },
};

// 仅格式化显示文本，不改变选择器回调和请求中的时长原值。
export function formatCanvasVideoDuration(value) {
  const label = String(value ?? '');
  return /^\d+(?:\.\d+)?$/.test(label) ? `${label}s` : label;
}

export function adaptCanvasVideoModels(models = []) {
  const enabled = models.filter((model) => model.is_enabled && model.category === 'video');
  const groupedIds = new Set();
  const grouped = HAPPYHORSE_GROUPS.flatMap((group) => {
    const records = enabled.filter((model) => group.pattern.test(model.model_id || ''));
    if (!records.length) return [];
    const sortedRecords = [...records].sort((left, right) => {
      const leftRoute = group.pattern.exec(left.model_id || '')?.[1]?.toLowerCase();
      const rightRoute = group.pattern.exec(right.model_id || '')?.[1]?.toLowerCase();
      return HAPPYHORSE_ROUTE_ORDER.indexOf(leftRoute) - HAPPYHORSE_ROUTE_ORDER.indexOf(rightRoute);
    });
    const modelByGenerationMode = {};
    const capabilitiesByGenerationMode = {};
    const supportedGenerationModes = [];
    const generationReferenceModeMap = {};
    for (const model of sortedRecords) {
      groupedIds.add(model.model_id);
      const capabilities = model.capabilities || {};
      for (const mode of capabilities.supported_generation_modes || []) {
        if (!supportedGenerationModes.includes(mode)) supportedGenerationModes.push(mode);
        modelByGenerationMode[mode] = model.model_id;
        capabilitiesByGenerationMode[mode] = capabilities;
        if (Object.hasOwn(capabilities.generation_reference_mode_map || {}, mode)) {
          generationReferenceModeMap[mode] = capabilities.generation_reference_mode_map[mode];
        }
      }
    }
    const capabilities = {
      ...(sortedRecords[0]?.capabilities || {}),
      supported_generation_modes: supportedGenerationModes,
      generation_reference_mode_map: generationReferenceModeMap,
    };
    return [{
      option: {
        value: group.value,
        label: group.label,
        sourceModelIds: sortedRecords.map((model) => model.model_id),
        generationModes: supportedGenerationModes,
        modelByGenerationMode,
        capabilitiesByGenerationMode,
      },
      capabilities,
      order: group.order,
      index: Math.min(...sortedRecords.map((model) => enabled.indexOf(model))),
    }];
  });
  const standalone = enabled.filter((model) => !groupedIds.has(model.model_id))
    .map((model, index) => ({ model, index }))
    .sort((left, right) => {
      const leftOrder = VIDEO_MODEL_PRESENTATION[left.model.model_id]?.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = VIDEO_MODEL_PRESENTATION[right.model.model_id]?.order ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ model, index }) => ({
      option: {
        value: model.model_id,
        label: VIDEO_MODEL_PRESENTATION[model.model_id]?.name || model.name,
        generationModes: model.capabilities?.supported_generation_modes || [],
      },
      capabilities: model.capabilities || {},
      order: VIDEO_MODEL_PRESENTATION[model.model_id]?.order ?? Number.MAX_SAFE_INTEGER,
      index,
    }));
  const entries = [...standalone, ...grouped].sort((left, right) => left.order - right.order || left.index - right.index);
  return {
    options: entries.map((entry) => entry.option),
    capabilitiesMap: Object.fromEntries(entries.map((entry) => [entry.option.value, entry.capabilities])),
  };
}

export function resolveCanvasVideoModel(option, mode) {
  return option?.modelByGenerationMode?.[mode] || option?.value || '';
}

export function resolveCanvasVideoCapabilities(option, fallback, mode) {
  return option?.capabilitiesByGenerationMode?.[mode] || fallback || {};
}

export function isCanvasSeedanceVideoEdit(model, mode) {
  return /seedance/i.test(model || '') && ['video_ref', 'video_edit'].includes(mode);
}

export function getCanvasVideoParams(capabilities = {}, model = '') {
  const presentation = VIDEO_MODEL_PRESENTATION[model];
  return {
    ratios: (capabilities.supported_aspect_ratios || []).map((value) => ({ value, label: value === 'adaptive' ? '智能' : value, w: Number(value.split(':')[0]) || 1, h: Number(value.split(':')[1]) || 1 })),
    resolutions: capabilities.supported_resolutions || [],
    durations: (capabilities.supported_durations || []).map(String),
    refModes: (capabilities.supported_generation_modes || []).map((value) => ({
      value,
      label: presentation?.modeLabels?.[value]
        || (isCanvasSeedanceVideoEdit(model, value) ? '视频编辑' : MODE_LABELS[value] || value),
    })),
  };
}

export function getCanvasVideoPromptPlaceholder(model, mode) {
  const groupedSource = HAPPYHORSE_GROUPS.some((group) => group.value === model)
    ? `${model}-${mode === 'text_to_video' ? 't2v' : mode === 'first_frame' ? 'i2v' : ['video_ref', 'video_edit'].includes(mode) ? 'video-edit' : 'r2v'}`
    : model;
  return VIDEO_MODEL_PRESENTATION[groupedSource]?.placeholders?.[mode] || DEFAULT_PROMPT_PLACEHOLDER;
}

const keepSavedSelection = () => {};

// 不把编辑态写回共享状态：退出时原选择仍在，也不会重置分辨率。
export function getCanvasVideoControlValues(creationParams, model, params) {
  if (!creationParams) return { ...params, creationParams };
  if (isCanvasSeedanceVideoEdit(model, params.refMode)) {
    return {
      ...params,
      creationParams: {
        ...creationParams,
        ratios: [{ value: 'adaptive', label: '智能', w: 1, h: 1 }],
        durations: ['-1'],
      },
      videoRatio: 'adaptive',
      videoDuration: '-1',
      setVideoRatio: keepSavedSelection,
      setVideoDuration: keepSavedSelection,
    };
  }
  const ratios = creationParams.ratios.map((option) => option.value);
  const durations = creationParams.durations;
  return {
    ...params,
    creationParams,
    videoRatio: ratios.includes(params.videoRatio) ? params.videoRatio
      : ratios.includes(creationParams.defaults?.ratio) ? creationParams.defaults.ratio : ratios[0] || '',
    videoDuration: durations.includes(params.videoDuration) ? params.videoDuration
      : durations.includes(creationParams.defaults?.duration) ? creationParams.defaults.duration : durations[0] || '',
  };
}
