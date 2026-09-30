import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptCanvasVideoModels, getCanvasVideoParams, getCanvasVideoPromptPlaceholder, resolveCanvasVideoCapabilities, resolveCanvasVideoModel } from '../src/components/canvas/CanvasVideoModels.js';
import * as videoModels from '../src/components/canvas/CanvasVideoModels.js';

const editCapabilities = {
  supported_aspect_ratios: ['16:9', '9:16'],
  supported_durations: ['5', '8'],
  supported_resolutions: ['720P', '1080P'],
  supported_generation_modes: ['text_to_video', 'video_ref', 'video_edit'],
};

test('Seedance 视频编辑只提供智能与 -1，点击唯一选项不覆盖原选择', () => {
  assert.equal(typeof videoModels.getCanvasVideoControlValues, 'function');
  const base = getCanvasVideoParams(editCapabilities, 'doubao-seedance-2.0');
  for (const refMode of ['video_ref', 'video_edit']) {
    const saved = { refMode, videoRatio: '9:16', videoDuration: '8',
      setVideoRatio: (value) => { saved.videoRatio = value; },
      setVideoDuration: (value) => { saved.videoDuration = value; } };
    const active = videoModels.getCanvasVideoControlValues(base, 'doubao-seedance-2.0', saved);
    assert.deepEqual(active.creationParams.ratios.map(({ value, label }) => ({ value, label })), [{ value: 'adaptive', label: '智能' }]);
    assert.deepEqual(active.creationParams.durations, ['-1']);
    assert.deepEqual(active.creationParams.resolutions, ['720P', '1080P']);
    assert.equal(active.videoRatio, 'adaptive');
    assert.equal(active.videoDuration, '-1');
    active.setVideoRatio('adaptive');
    active.setVideoDuration('-1');
    assert.equal(saved.videoRatio, '9:16');
    assert.equal(saved.videoDuration, '8');
    const restored = videoModels.getCanvasVideoControlValues(base, 'doubao-seedance-2.0', { ...saved, refMode: 'text_to_video' });
    assert.equal(restored.videoRatio, '9:16');
    assert.equal(restored.videoDuration, '8');
    assert.equal(restored.creationParams, base);
  }
});

test('退出编辑后原值失效回退默认选项，非 Seedance 模型不受限制', () => {
  assert.equal(typeof videoModels.getCanvasVideoControlValues, 'function');
  const base = getCanvasVideoParams(editCapabilities);
  const restored = videoModels.getCanvasVideoControlValues(base, 'doubao-seedance-2-0-fast', { refMode: 'first_frame', videoRatio: '4:3', videoDuration: '12' });
  assert.equal(restored.videoRatio, '16:9');
  assert.equal(restored.videoDuration, '5');
  const other = videoModels.getCanvasVideoControlValues(base, 'happyhorse-1.0-video-edit', { refMode: 'video_edit', videoRatio: '9:16', videoDuration: '8' });
  assert.equal(other.creationParams, base);
  assert.equal(other.videoRatio, '9:16');
  assert.equal(other.videoDuration, '8');
});

test('只将 Seedance 的视频参考改名为视频编辑，保留模式原值', () => {
  assert.deepEqual(getCanvasVideoParams(editCapabilities, 'doubao-seedance-2.0').refModes[1], { value: 'video_ref', label: '视频编辑' });
  assert.deepEqual(getCanvasVideoParams(editCapabilities, 'other-video').refModes[1], { value: 'video_ref', label: '视频参考' });
  assert.equal(videoModels.formatCanvasVideoDuration('-1'), '-1');
});

test('画布视频模型逐条展示后端模型和 supported_generation_modes', () => {
  const catalog = adaptCanvasVideoModels([{
    model_id: 'veo-3.1-fast',
    name: 'Veo 3.1 Fast 生视频',
    category: 'video',
    is_enabled: true,
    capabilities: {
      supported_generation_modes: ['text_to_video', 'reference_subjects'],
      generation_reference_mode_map: { text_to_video: null, reference_subjects: 'multi_image' },
    },
  }]);
  assert.deepEqual(catalog.options, [{ value: 'veo-3.1-fast', label: 'Veo 3.1 Fast', generationModes: ['text_to_video', 'reference_subjects'] }]);
  assert.equal(catalog.capabilitiesMap['veo-3.1-fast'].generation_reference_mode_map.text_to_video, null);
});

test('画布参数中文展示保留后端原值与选项顺序', () => {
  const params = getCanvasVideoParams({
    supported_aspect_ratios: ['adaptive', '16:9'],
    supported_durations: ['8', '10s'],
    supported_generation_modes: ['first_frame', 'last_frame', 'start_end', 'text_to_video'],
  });
  assert.deepEqual(params.ratios.map(({ value, label }) => ({ value, label })), [
    { value: 'adaptive', label: '智能' }, { value: '16:9', label: '16:9' },
  ]);
  assert.deepEqual(params.durations, ['8', '10s']);
  assert.deepEqual(params.refModes, [
    { value: 'first_frame', label: '首帧参考' },
    { value: 'last_frame', label: '尾帧参考' },
    { value: 'start_end', label: '首尾帧' },
    { value: 'text_to_video', label: '文生视频' },
  ]);
});

test('画布视频模型按照清单排序并聚合 HappyHorse 展示名称', () => {
  const models = [
    { model_id: 'unknown-video', name: '未知模型', category: 'video', is_enabled: true },
    { model_id: 'veo-3.1-fast', name: 'Veo 3.1 Fast 生视频', category: 'video', is_enabled: true },
    { model_id: 'happyhorse-1.0-video-edit', name: 'happyhorse视频编辑', category: 'video', is_enabled: true },
    { model_id: 'doubao-seedance-2.0', name: '豆包·Seedance 2.0', category: 'video', is_enabled: true },
    { model_id: 'video-kling-v3', name: 'Kling V3 视频生成', category: 'video', is_enabled: true },
  ];
  assert.deepEqual(adaptCanvasVideoModels(models).options.map(({ value, label }) => ({ value, label })), [
    { value: 'doubao-seedance-2.0', label: 'Seedance 2.0' },
    { value: 'happyhorse-1.0', label: 'HappyHorse 1.0' },
    { value: 'video-kling-v3', label: 'Kling V3' },
    { value: 'veo-3.1-fast', label: 'Veo 3.1 Fast' },
    { value: 'unknown-video', label: '未知模型' },
  ]);
});

test('画布视频模型完整匹配清单排序并按版本聚合 HappyHorse', () => {
  const sourceModels = [
    ['doubao-seedance-2.0', 'Seedance 2.0'],
    ['doubao-seedance-2-0-fast', 'Seedance 2.0 Fast'],
    ['doubao-seedance-2-0-mini-260615', 'Seedance 2.0 Mini'],
    ['doubao-seedance-2-5-260628', 'Seedance 2.5'],
    ['happyhorse-1.0-t2v', 'HappyHorse 1.0 文生视频'],
    ['happyhorse-1.0-i2v', 'HappyHorse 1.0 首帧生视频'],
    ['happyhorse-1.0-r2v', 'HappyHorse 1.0 图生视频'],
    ['happyhorse-1.0-video-edit', 'happyhorse 1.0 视频编辑'],
    ['happyhorse-1.1-t2v', 'HappyHorse 1.1 文生视频'],
    ['happyhorse-1.1-i2v', 'HappyHorse 1.1 首帧生视频'],
    ['happyhorse-1.1-r2v', 'HappyHorse 1.1 图生视频'],
    ['video-kling-v3', 'Kling V3'],
    ['video-vidu-q2', 'Vidu Q2'],
    ['video-viduq3-pro', 'Vidu Q3 Pro'],
    ['veo-3.1', 'Veo 3.1'],
    ['veo-3.1-fast', 'Veo 3.1 Fast'],
  ];
  const models = sourceModels.toReversed().map(([model_id]) => ({
    model_id,
    name: `后端名称 ${model_id}`,
    category: 'video',
    is_enabled: true,
  }));
  assert.deepEqual(
    adaptCanvasVideoModels(models).options.map(({ value, label }) => [value, label]),
    [
      ['doubao-seedance-2.0', 'Seedance 2.0'],
      ['doubao-seedance-2-0-fast', 'Seedance 2.0 Fast'],
      ['doubao-seedance-2-0-mini-260615', 'Seedance 2.0 Mini'],
      ['doubao-seedance-2-5-260628', 'Seedance 2.5'],
      ['happyhorse-1.0', 'HappyHorse 1.0'],
      ['happyhorse-1.1', 'HappyHorse 1.1'],
      ['video-kling-v3', 'Kling V3'],
      ['video-vidu-q2', 'Vidu Q2'],
      ['video-viduq3-pro', 'Vidu Q3 Pro'],
      ['veo-3.1', 'Veo 3.1'],
      ['veo-3.1-fast', 'Veo 3.1 Fast'],
    ],
  );
});

test('HappyHorse 聚合项只展示真实子模型模式并路由真实模型能力', () => {
  const t2vCapabilities = { supported_generation_modes: ['text_to_video'], generation_reference_mode_map: { text_to_video: null } };
  const editCapabilities = { supported_generation_modes: ['video_edit'], generation_reference_mode_map: { video_edit: 'video_ref' }, max_reference_videos: 1 };
  const catalog = adaptCanvasVideoModels([
    { model_id: 'happyhorse-1.0-t2v', name: 't2v', category: 'video', is_enabled: true, capabilities: t2vCapabilities },
    { model_id: 'happyhorse-1.0-video-edit', name: 'edit', category: 'video', is_enabled: true, capabilities: editCapabilities },
  ]);
  const option = catalog.options[0];
  assert.deepEqual(option.generationModes, ['text_to_video', 'video_edit']);
  assert.deepEqual(option.sourceModelIds, ['happyhorse-1.0-t2v', 'happyhorse-1.0-video-edit']);
  assert.equal(resolveCanvasVideoModel(option, 'text_to_video'), 'happyhorse-1.0-t2v');
  assert.equal(resolveCanvasVideoModel(option, 'video_edit'), 'happyhorse-1.0-video-edit');
  assert.equal(resolveCanvasVideoCapabilities(option, catalog.capabilitiesMap[option.value], 'video_edit').max_reference_videos, 1);
  assert.equal(option.generationModes.includes('first_frame'), false);
});

test('清单指定的参考模式名称只覆盖对应模型', () => {
  const capabilities = { supported_generation_modes: ['reference_subjects', 'video_ref'] };
  assert.deepEqual(getCanvasVideoParams(capabilities, 'veo-3.1-fast').refModes, [
    { value: 'reference_subjects', label: '图片参考' },
    { value: 'video_ref', label: '视频参考' },
  ]);
  assert.deepEqual(getCanvasVideoParams(capabilities, 'happyhorse-1.0-video-edit').refModes, [
    { value: 'reference_subjects', label: '参考主体' },
    { value: 'video_ref', label: '视频编辑' },
  ]);
  assert.equal(getCanvasVideoParams({ supported_generation_modes: ['reference_subjects'] }, 'happyhorse-1.1-r2v').refModes[0].label, '图片参考');
});

test('模型与参考模式组合返回清单占位符，未知组合使用通用回退', () => {
  assert.equal(
    getCanvasVideoPromptPlaceholder('doubao-seedance-2.0', 'full'),
    '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考9张图片、3条视频、3条音频',
  );
  assert.equal(
    getCanvasVideoPromptPlaceholder('happyhorse-1.0-video-edit', 'video_edit'),
    '可自由组合图、文、视频，通过@绑定参考内容，最多可参考1条视频，5张图片',
  );
  assert.equal(
    getCanvasVideoPromptPlaceholder('veo-3.1-fast', 'last_frame'),
    '输入文字和图片，描述你想生成的内容，图片=1',
  );
  assert.equal(getCanvasVideoPromptPlaceholder('unknown-video', 'text_to_video'), '描述你想生成的内容');
});

test('清单中的所有模型模式组合均返回指定占位符', () => {
  const text = '输入文字，描述你想生成的内容';
  const oneImage = '输入文字和图片，描述你想生成的内容，图片=1';
  const twoImages = '输入文字和图片，描述你想生成的内容，图片=2';
  const edit = '描述你想修改的内容，例如:把@视频角色A替换成@图片B';
  const cases = {
    'doubao-seedance-2.0': {
      full: '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考9张图片、3条视频、3条音频',
      text_to_video: text, first_frame: oneImage, last_frame: oneImage, start_end: twoImages, video_edit: edit,
    },
    'doubao-seedance-2-0-fast': {
      full: '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考9张图片、3条视频、3条音频',
      text_to_video: text, first_frame: oneImage, last_frame: oneImage, start_end: twoImages, video_edit: edit,
    },
    'doubao-seedance-2-0-mini-260615': {
      full: '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考9张图片、3条视频、3条音频，',
      text_to_video: text, first_frame: oneImage, last_frame: oneImage, start_end: twoImages, video_edit: edit,
    },
    'doubao-seedance-2-5-260628': {
      full: '可自由组合图、文、视频、音频，通过@绑定参考内容，最多可参考30张图片、10条视频、10条音频',
      text_to_video: text, first_frame: oneImage, last_frame: oneImage, start_end: twoImages, video_edit: edit,
    },
    'happyhorse-1.0-t2v': { text_to_video: text },
    'happyhorse-1.0-i2v': { first_frame: oneImage },
    'happyhorse-1.0-r2v': { reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考9张图片' },
    'happyhorse-1.0-video-edit': { video_edit: '可自由组合图、文、视频，通过@绑定参考内容，最多可参考1条视频，5张图片' },
    'happyhorse-1.1-t2v': { text_to_video: text },
    'happyhorse-1.1-i2v': { first_frame: oneImage },
    'happyhorse-1.1-r2v': { reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考9张图片' },
    'video-kling-v3': { text_to_video: text, first_frame: oneImage, start_end: twoImages },
    'video-vidu-q2': { text_to_video: text, reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考7张图片' },
    'video-viduq3-pro': { text_to_video: text, first_frame: oneImage, start_end: twoImages },
    'veo-3.1': { text_to_video: text, first_frame: oneImage, start_end: twoImages, reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考3张图片' },
    'veo-3.1-fast': { text_to_video: text, first_frame: oneImage, last_frame: oneImage, start_end: twoImages, reference_subjects: '可自由组合图文，通过@绑定参考内容，最多可参考3张图片' },
  };
  for (const [model, placeholders] of Object.entries(cases)) {
    for (const [mode, placeholder] of Object.entries(placeholders)) {
      assert.equal(getCanvasVideoPromptPlaceholder(model, mode), placeholder, `${model} / ${mode}`);
    }
  }
});
