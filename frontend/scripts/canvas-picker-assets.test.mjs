import test from 'node:test';
import assert from 'node:assert/strict';
import { toCanvasPickerAsset, sortCanvasPickerProjects } from '../src/components/assets/CanvasPickerAssets.js';

test('回填真实素材编号，跨目录引用保持同一编号，优先原件地址', () => {
  const asset = { id: 'asset', media_type: 'image', url: '/preview', original_url: '/original', name: '图片' };
  const first = toCanvasPickerAsset({ id: 'entry-a', asset_id: 'asset', asset });
  const second = toCanvasPickerAsset({ id: 'entry-b', asset });
  assert.equal(first.id, second.id);
  assert.notEqual(first.entryId, second.entryId);
  assert.equal(first.fileUrl, '/original');
  assert.equal(first.asset_type, 'image');
  assert.equal(first.name, '图片');
});

test('兼容音频地址、媒体类型及原始元数据，缺失素材不误用条目编号', () => {
  for (const type of ['image', 'video', 'audio']) {
    const result = toCanvasPickerAsset({ id: 'entry', asset: { id: type, media_type: type + '/test', audio_url: '/file', availability: 'unavailable', prompt: '提示词' } });
    assert.equal(result.asset_type, type);
    assert.equal(result.fileUrl, '/file');
    assert.equal(result.availability, 'unavailable');
    assert.equal(result.prompt, '提示词');
  }
  const missing = toCanvasPickerAsset({ id: 'entry' });
  assert.equal(missing.id, undefined);
  assert.equal(missing.url, '');
});

test('项目倒序、画布正序且不改变原数组，首项用于默认选择', () => {
  const older = { id: 'old', created_at: '2026-01-01', canvases: [] };
  const newer = { id: 'new', created_at: '2026-02-01', canvases: [
    { id: 'late', canvasCreatedAt: '2026-02-03' },
    { id: 'early', canvasCreatedAt: '2026-02-02' },
  ] };
  const result = sortCanvasPickerProjects([older, newer]);
  assert.deepEqual(result.map(item => item.id), ['new', 'old']);
  assert.deepEqual(result[0].canvases.map(item => item.id), ['early', 'late']);
  assert.equal(newer.canvases[0].id, 'late');
  assert.deepEqual(sortCanvasPickerProjects([]), []);
});
