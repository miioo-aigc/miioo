import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import {
  canConnectCanvasVideo,
  connectCanvasVideo,
  getCanvasVideoReferenceStatus,
  getCanvasVideoEdges,
  getCanvasVideoRequestModes,
  planCanvasVideoGeneration,
  beginCanvasVideoGeneration,
  validateCanvasVideoMedia,
  validateCanvasVideoReferenceAddition,
} from '../src/components/canvas/CanvasVideoGeneration.js';

const node = (type, id, sourceIds = [], overrides = {}) => ({
  ...createCanvasNode(type, { x: 0, y: 0 }, id),
  data: {
    ...createCanvasNode(type, { x: 0, y: 0 }, id).data,
    videoSourceIds: sourceIds,
    content: type === 'text' ? `${id} 内容` : '',
    asset: ['image', 'video', 'audio'].includes(type) ? { url: `/${id}.${type}` } : null,
    ...overrides,
  },
});

const capabilities = {
  supported_generation_modes: ['text_to_video', 'first_frame', 'start_end', 'reference_subjects'],
  generation_reference_mode_map: {
    text_to_video: null,
    first_frame: 'first_frame',
    start_end: 'start_end',
    reference_subjects: 'multi_image',
  },
  max_reference_images: 3,
  max_reference_videos: 1,
  max_reference_audios: 1,
  max_total_attachments: 3,
};

test('Seedance 编辑请求强制使用智能与 -1，即便传入了旧参数', () => {
  for (const mode of ['video_ref', 'video_edit']) {
    const caps = { ...capabilities, supported_generation_modes: [mode], generation_reference_mode_map: { [mode]: 'video_ref' } };
    const plan = planCanvasVideoGeneration([node('video', 'target', [], { asset: null })], 'target', '编辑视频', 'doubao-seedance-2.0', {
      capabilities: caps, generationMode: mode, ratio: '16:9', duration: '8', resolution: '1080P',
    });
    assert.equal(plan.params.ratio, 'adaptive');
    assert.equal(plan.params.duration, '-1');
    assert.equal(plan.params.videoDuration, '-1');
    assert.equal(plan.params.resolution, '1080P');
    assert.equal(plan.params.generation_mode, mode);
    assert.equal(plan.params.reference_mode, 'video_ref');
  }
});

test('视频节点接受文本、图片、视频、音频，拒绝反向连接和错误端口', () => {
  const nodes = [node('text', 'text'), node('image', 'image'), node('video', 'video'), node('audio', 'audio'), node('video', 'target')];
  for (const source of ['text', 'image', 'video', 'audio']) {
    assert.equal(canConnectCanvasVideo(nodes, { source, target: 'target' }, capabilities), true);
  }
  assert.equal(canConnectCanvasVideo(nodes, { source: 'target', target: 'text' }, capabilities), false);
  assert.equal(canConnectCanvasVideo(nodes, { source: 'image', target: 'target', targetHandle: 'text-input' }, capabilities), false);
});

test('媒体连线不因模式上限被拒绝，超出的后续连线标红且发送失败', () => {
  const text = node('text', 'text');
  const image1 = node('image', 'image1');
  const image2 = node('image', 'image2');
  const emptyTarget = node('video', 'empty-target');
  const firstFrameTarget = node('video', 'first-target', ['image1'], {
    model: 'video-model', generationMode: 'first_frame', videoCapabilities: capabilities,
  });
  assert.equal(canConnectCanvasVideo([text, image1, emptyTarget], { source: 'text', target: 'empty-target' }, { ...capabilities, selectedGenerationMode: 'text_to_video' }), true);
  assert.equal(canConnectCanvasVideo([text, image1, emptyTarget], { source: 'image1', target: 'empty-target' }, { ...capabilities, selectedGenerationMode: 'text_to_video' }), true);
  assert.equal(canConnectCanvasVideo([text, image1, image2, firstFrameTarget], { source: 'image2', target: 'first-target' }, { ...capabilities, selectedGenerationMode: 'first_frame' }), true);
  const connected = connectCanvasVideo([text, image1, image2, firstFrameTarget], { source: 'image2', target: 'first-target' });
  assert.deepEqual(getCanvasVideoReferenceStatus(connected, 'first-target').overflowSourceIds, ['image2']);
  assert.equal(getCanvasVideoEdges(connected).find((edge) => edge.source === 'image2').data.overflow, true);
  assert.throws(() => planCanvasVideoGeneration(connected, 'first-target', '生成视频', 'video-model', {
    capabilities, generationMode: 'first_frame',
  }), /最多支持1张图片素材/);
});

test('素材添加入口即时限制最大值，但精确数量只在发送前校验', () => {
  const firstFrameTarget = node('video', 'first-target', [], {
    asset: null, model: 'video-model', generationMode: 'first_frame', videoCapabilities: capabilities,
  });
  assert.equal(validateCanvasVideoReferenceAddition([firstFrameTarget], 'first-target', { asset_type: 'image' }).allowed, true);
  assert.equal(validateCanvasVideoMedia([], capabilities, 'video-model', 'first_frame').allowed, true);
  assert.deepEqual(validateCanvasVideoMedia([], capabilities, 'video-model', 'first_frame', { final: true }), {
    allowed: false, message: '当前参考模式需要1张图片素材',
  });
  assert.equal(validateCanvasVideoMedia(['image'], capabilities, 'video-model', 'first_frame', { final: true }).allowed, true);
  assert.equal(validateCanvasVideoMedia(['image', 'image'], capabilities, 'video-model', 'first_frame').allowed, false);
  assert.equal(validateCanvasVideoMedia(['image'], capabilities, 'video-model', 'start_end').allowed, true);
  assert.equal(validateCanvasVideoMedia(['image'], capabilities, 'video-model', 'start_end', { final: true }).allowed, false);
  assert.equal(validateCanvasVideoMedia(['image', 'image'], capabilities, 'video-model', 'start_end', { final: true }).allowed, true);
  assert.equal(validateCanvasVideoMedia(['image'], capabilities, 'video-model', 'last_frame', { final: true }).allowed, true);
  assert.equal(validateCanvasVideoMedia(['image'], capabilities, 'video-model', 'text_to_video').allowed, false);
});

test('模型专属最终约束校验视频数量和音频唯一素材', () => {
  const editCaps = { ...capabilities, max_reference_images: 5, max_reference_videos: 1, max_reference_audios: 0, max_total_attachments: 6 };
  assert.deepEqual(validateCanvasVideoMedia([], editCaps, 'happyhorse-1.0-video-edit', 'video_edit', { final: true }), {
    allowed: false, message: '当前参考模式需要1条视频素材',
  });
  assert.equal(validateCanvasVideoMedia(['video'], editCaps, 'happyhorse-1.0-video-edit', 'video_edit', { final: true }).allowed, true);
  assert.equal(validateCanvasVideoMedia(['video', 'video'], editCaps, 'happyhorse-1.0-video-edit', 'video_edit').allowed, false);
  const seedanceCaps = { ...capabilities, max_reference_images: 9, max_reference_videos: 3, max_reference_audios: 3, max_total_attachments: 15 };
  assert.equal(validateCanvasVideoMedia(['audio'], seedanceCaps, 'doubao-seedance-2.0', 'full', { final: true }).allowed, false);
  assert.equal(validateCanvasVideoMedia(['audio', 'image'], seedanceCaps, 'doubao-seedance-2.0', 'full', { final: true }).allowed, true);
  assert.equal(validateCanvasVideoMedia(['audio'], seedanceCaps, 'doubao-seedance-2-5-260628', 'full', { final: true }).allowed, true);
});

test('视频素材上限按媒体类型和总媒体数计算，文本不计入总数，超限按连接顺序标记', () => {
  const nodes = [node('text', 'text'), node('image', 'image1'), node('image', 'image2'), node('video', 'video1'), node('audio', 'audio1'), node('video', 'target', ['text', 'image1', 'image2', 'video1', 'audio1'])];
  const status = getCanvasVideoReferenceStatus(nodes, 'target', capabilities);
  assert.deepEqual(status.mediaSourceIds, ['image1', 'image2', 'video1', 'audio1']);
  assert.deepEqual(status.overflowSourceIds, ['audio1']);
  assert.equal(status.canGenerate, false);
  assert.equal(getCanvasVideoEdges(nodes).find((edge) => edge.source === 'audio1').data.overflow, true);
});

test('视频请求模式使用映射值，文生视频明确发送 reference_mode null', () => {
  assert.deepEqual(getCanvasVideoRequestModes(capabilities, 'text_to_video'), { generation_mode: 'text_to_video', reference_mode: null });
  assert.deepEqual(getCanvasVideoRequestModes(capabilities, 'reference_subjects'), { generation_mode: 'reference_subjects', reference_mode: 'multi_image' });
});

test('已有视频内容时提前创建空结果节点并继承直连上游', () => {
  const source = node('text', 'source');
  const target = node('video', 'target', ['source'], { asset: { url: '/target.mp4', asset_type: 'video' } });
  const editCapabilities = { ...capabilities, supported_generation_modes: ['reference_subjects'], generation_reference_mode_map: { reference_subjects: 'multi_image' } };
  const plan = planCanvasVideoGeneration([source, target], 'target', '继续创作', 'video-model', { capabilities: editCapabilities, generationMode: 'reference_subjects' });
  assert.equal(plan.createsResult, true);
  const next = beginCanvasVideoGeneration([source, target], plan);
  const result = next.find((item) => item.id === plan.resultId);
  assert.ok(result);
  assert.equal(result.data.generating, true);
  assert.deepEqual(result.data.videoSourceIds, ['source', 'target']);
  assert.equal(result.data.asset, null);
});

test('视频节点的文本连线与媒体连线共用一条顺序稳定的边', () => {
  const text = node('text', 'text');
  const image = node('image', 'image');
  const target = node('video', 'target', ['text', 'image']);
  const edges = getCanvasVideoEdges([text, image, target]);
  assert.deepEqual(edges.map((edge) => edge.source), ['text', 'image']);
  assert.equal(new Set(edges.map((edge) => edge.id)).size, 2);
});
