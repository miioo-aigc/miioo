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
  acceptCanvasVideoSubmission,
  recoverCanvasVideoGenerationFailure,
  applyCanvasVideoResult,
  getCanvasGeneratedVideoAsset,
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

test('视频起始基于最新状态拒绝并发及受保护上游，解除提交锁后可执行', () => {
  const nodes = [node('video', 'target', [], { asset: null })];
  const plan = planCanvasVideoGeneration(nodes, 'target', '生成', 'model', { capabilities, generationMode: 'text_to_video' });
  for (const flag of ['generating', 'submissionLocked']) {
    const current = [{ ...nodes[0], data: { ...nodes[0].data, [flag]: true } }];
    assert.throws(() => beginCanvasVideoGeneration(current, plan), /正在提交或生成/);
  }
  const locked = { id: 'other', data: { submissionLocked: true, executionSourceIds: ['target'] } };
  assert.throws(() => beginCanvasVideoGeneration([...nodes, locked], plan), /上游保护/);
  assert.doesNotThrow(() => beginCanvasVideoGeneration([...nodes, { ...locked, data: { ...locked.data, submissionLocked: false } }], plan));
  assert.throws(() => beginCanvasVideoGeneration([], plan), /已不存在/);
});

test('视频资产对象重新解析不阻止相同资产回填，真正换资产仍拒绝旧结果并结束生成', () => {
  const oldId = '11111111-1111-4111-8111-111111111111';
  const newId = '22222222-2222-4222-8222-222222222222';
  const nodes = [node('video', 'target', [], { asset: { asset_id: oldId, asset_type: 'video', url: '/old' } })];
  const plan = planCanvasVideoGeneration(nodes, 'target', '生成', 'model', { capabilities, generationMode: 'text_to_video' });
  const pending = beginCanvasVideoGeneration(nodes, plan);
  const resolved = pending.map((item) => ({ ...item, data: { ...item.data, asset: { ...item.data.asset, url: '/refreshed' } } }));
  const asset = getCanvasGeneratedVideoAsset({ videos: ['/new'], videoAssetIds: [newId] });
  const done = applyCanvasVideoResult(resolved, plan, asset);
  assert.equal(done[0].data.asset.asset_id, newId);
  assert.equal(done[0].data.generating, false);
  assert.equal(done[0].data.nodeResults.batches.length, 2);
  const changed = pending.map((item) => ({ ...item, data: { ...item.data, asset: { ...item.data.asset, asset_id: newId } } }));
  const rejected = applyCanvasVideoResult(changed, plan, asset);
  assert.equal(rejected[0].data.nodeResults, undefined);
  assert.equal(rejected[0].data.generating, false);
});

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

test('视频计划冻结媒体资产和结构化参数快照，不受后续草稿修改影响', () => {
  const sourceAsset = { url: '/source.mp4', asset_id: '11111111-1111-4111-8111-111111111111', asset_type: 'video', metadata: { crop: { x: 1 } } };
  const source = node('video', 'source', [], { asset: sourceAsset });
  const target = node('video', 'target', ['source'], { asset: null, videoCapabilities: capabilities, generationMode: 'reference_subjects' });
  const params = { capabilities, generationMode: 'reference_subjects', camera: { moves: ['push'], framing: { width: 16 } } };
  const plan = planCanvasVideoGeneration([source, target], 'target', '保留结构', 'video-model', params);
  sourceAsset.metadata.crop.x = 99;
  params.camera.moves.push('tilt');
  assert.equal(plan.sources[0].asset.metadata.crop.x, 1);
  assert.deepEqual(plan.snapshot.params.camera, { moves: ['push'], framing: { width: 16 } });
  assert.equal(plan.snapshot.params.generation_mode, 'reference_subjects');
  assert.equal(plan.snapshot.params.reference_mode, 'multi_image');
});

test('视频节点接受文本、图片、视频、音频，拒绝反向连接和错误端口', () => {
  const nodes = [node('text', 'text'), node('image', 'image'), node('video', 'video'), node('audio', 'audio'), node('video', 'target')];
  nodes.at(-1).data.asset = null;
  for (const source of ['text', 'image', 'video', 'audio']) {
    assert.equal(canConnectCanvasVideo(nodes, { source, target: 'target' }, capabilities), true);
  }
  assert.equal(canConnectCanvasVideo(nodes, { source: 'target', target: 'text' }, capabilities), false);
  assert.equal(canConnectCanvasVideo(nodes, { source: 'image', target: 'target', targetHandle: 'text-input' }, capabilities), false);
});

test('媒体新增按能力拦截，历史超限连线保留标红且发送失败', () => {
  const text = node('text', 'text');
  const image1 = node('image', 'image1');
  const image2 = node('image', 'image2');
  const emptyTarget = node('video', 'empty-target');
  const firstFrameTarget = node('video', 'first-target', ['image1'], {
    asset: null, model: 'video-model', generationMode: 'first_frame', videoCapabilities: capabilities,
  });
  assert.equal(canConnectCanvasVideo([text, image1, emptyTarget], { source: 'text', target: 'empty-target' }, { ...capabilities, selectedGenerationMode: 'text_to_video' }), true);
  assert.equal(canConnectCanvasVideo([text, image1, emptyTarget], { source: 'image1', target: 'empty-target' }, { ...capabilities, selectedGenerationMode: 'text_to_video' }), false);
  assert.equal(canConnectCanvasVideo([text, image1, image2, firstFrameTarget], { source: 'image2', target: 'first-target' }, { ...capabilities, selectedGenerationMode: 'first_frame' }), false);
  const initial = [text, image1, image2, firstFrameTarget];
  assert.equal(connectCanvasVideo(initial, { source: 'image2', target: 'first-target' }), initial);
  const connected = [text, image1, image2, { ...firstFrameTarget, data: { ...firstFrameTarget.data, videoSourceIds: ['image1', 'image2'] } }];
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
  nodes.at(-1).data.asset = null;
  // 能力已回填到节点后，边渲染才有真实上限可判定。
  nodes.at(-1).data.videoCapabilities = capabilities;
  const status = getCanvasVideoReferenceStatus(nodes, 'target', capabilities);
  assert.deepEqual(status.mediaSourceIds, ['image1', 'image2', 'video1', 'audio1']);
  assert.deepEqual(status.overflowSourceIds, ['audio1']);
  assert.equal(status.canGenerate, false);
  assert.equal(getCanvasVideoEdges(nodes).find((edge) => edge.source === 'audio1').data.overflow, true);
});

test('空媒体占名额；其他类型超限不阻止仍有名额的媒体与文本', () => {
  const caps = { ...capabilities, max_reference_images: 1, max_total_attachments: 5 };
  const target = node('video', 'target', ['i1', 'i2'], { asset: null, videoCapabilities: caps, generationMode: 'reference_subjects' });
  const nodes = [node('image', 'i1', [], { asset: null }), node('image', 'i2', [], { asset: null }),
    node('image', 'i3'), node('audio', 'a'), node('text', 't'), target];
  assert.equal(canConnectCanvasVideo(nodes, { source: 'i3', target: 'target' }), false);
  assert.equal(canConnectCanvasVideo(nodes, { source: 'a', target: 'target' }), true);
  assert.equal(canConnectCanvasVideo(nodes, { source: 't', target: 'target' }), true);
  assert.equal(validateCanvasVideoReferenceAddition(nodes, 'target', { asset_type: 'audio' }).allowed, true);
  assert.throws(() => planCanvasVideoGeneration(nodes, 'target', '创作', 'model', { capabilities: caps, generationMode: 'reference_subjects' }), /最多支持/);
  target.data.videoSourceIds = ['i1'];
  assert.throws(() => planCanvasVideoGeneration(nodes, 'target', '创作', 'model', { capabilities: caps, generationMode: 'reference_subjects' }), /缺少有效结果/);
  assert.equal(canConnectCanvasVideo(nodes, { source: 'a', target: 'target' }, { ...caps, max_total_attachments: 1 }), false);
});

test('视频请求模式使用映射值，文生视频明确发送 reference_mode null', () => {
  assert.deepEqual(getCanvasVideoRequestModes(capabilities, 'text_to_video'), { generation_mode: 'text_to_video', reference_mode: null });
  assert.deepEqual(getCanvasVideoRequestModes(capabilities, 'reference_subjects'), { generation_mode: 'reference_subjects', reference_mode: 'multi_image' });
});

test('已有视频内容时原节点进入生成态，不创建新结果节点并保留旧资产', () => {
  const source = node('text', 'source');
  const oldAsset = { url: '/target.mp4', asset_id: '11111111-1111-4111-8111-111111111111', asset_type: 'video' };
  const target = node('video', 'target', ['source'], { asset: oldAsset });
  const editCapabilities = { ...capabilities, supported_generation_modes: ['reference_subjects'], generation_reference_mode_map: { reference_subjects: 'multi_image' } };
  const plan = planCanvasVideoGeneration([source, target], 'target', '继续创作', 'video-model', { capabilities: editCapabilities, generationMode: 'reference_subjects' });
  assert.equal(plan.createsResult, false);
  assert.equal(plan.resultId, 'target');
  const next = beginCanvasVideoGeneration([source, target], plan);
  const result = next.find((item) => item.id === plan.resultId);
  assert.ok(result);
  assert.equal(result.data.generating, true);
  assert.equal(result.data.submissionLocked, true);
  assert.deepEqual(result.data.executionSourceIds, ['source']);
  assert.deepEqual(result.data.asset, oldAsset);
});

test('视频受理保存真实任务编号后解锁，失败回退保留旧结果', () => {
  const source = node('text', 'source');
  const oldAsset = { url: '/old.mp4', asset_id: '11111111-1111-4111-8111-111111111111', asset_type: 'video' };
  const target = node('video', 'target', ['source'], { asset: oldAsset });
  const caps = { ...capabilities, supported_generation_modes: ['reference_subjects'], generation_reference_mode_map: { reference_subjects: 'multi_image' } };
  const plan = planCanvasVideoGeneration([source, target], 'target', '新视频', 'model', { capabilities: caps, generationMode: 'reference_subjects' });
  const pending = beginCanvasVideoGeneration([source, target], plan);
  assert.equal(pending.find((item) => item.id === 'target').data.submissionLocked, true);
  const accepted = acceptCanvasVideoSubmission(pending, plan, { taskId: 'server-task-1' });
  const acceptedTarget = accepted.find((item) => item.id === 'target');
  assert.equal(acceptedTarget.data.submissionLocked, false);
  assert.deepEqual(acceptedTarget.data.generationTaskIds, ['server-task-1']);
  const failed = recoverCanvasVideoGenerationFailure(accepted, plan);
  const failedTarget = failed.find((item) => item.id === 'target');
  assert.deepEqual(failedTarget.data.asset, oldAsset);
  assert.equal(failedTarget.data.generating, false);
  assert.equal(failedTarget.data.generationTaskIds, undefined);
});

test('视频只接受真实永久 videoAssetIds，不以任务、卡片或 URL 冒充资产编号', () => {
  const assetId = '12345678-1234-1234-1234-123456789abc';
  assert.deepEqual(getCanvasGeneratedVideoAsset({ videos: ['/new.mp4'], videoAssetIds: [assetId] }), {
    url: '/new.mp4', asset_id: assetId, asset_type: 'video', source: 'ai-generated',
  });
  for (const result of [
    { videos: ['/new.mp4'], taskId: assetId },
    { videos: ['/new.mp4'], cardIds: [assetId] },
    { videos: ['/new.mp4'] },
    { videos: ['/new.mp4'], videoAssetIds: ['/new.mp4'] },
  ]) assert.throws(() => getCanvasGeneratedVideoAsset(result), /永久资产编号/);
});

test('删除节点或请求身份过期后，迟到视频结果不可回写', () => {
  const target = node('video', 'target', [], { asset: { url: '/old.mp4', asset_id: '11111111-1111-4111-8111-111111111111', asset_type: 'video' } });
  const plan = planCanvasVideoGeneration([target], 'target', '新视频', 'model', { capabilities, generationMode: 'text_to_video' });
  const pending = beginCanvasVideoGeneration([target], plan);
  const asset = getCanvasGeneratedVideoAsset({ videos: ['/new.mp4'], videoAssetIds: ['12345678-1234-1234-1234-123456789abc'] });
  assert.deepEqual(applyCanvasVideoResult([], plan, asset), []);
  const replaced = pending.map((item) => item.id === 'target' ? { ...item, data: { ...item.data, generationRequestId: 'new-request' } } : item);
  assert.equal(applyCanvasVideoResult(replaced, plan, asset), replaced);
});

test('视频节点的文本连线与媒体连线共用一条顺序稳定的边', () => {
  const text = node('text', 'text');
  const image = node('image', 'image');
  const target = node('video', 'target', ['text', 'image']);
  const edges = getCanvasVideoEdges([text, image, target]);
  assert.deepEqual(edges.map((edge) => edge.source), ['text', 'image']);
  assert.equal(new Set(edges.map((edge) => edge.id)).size, 2);
});
