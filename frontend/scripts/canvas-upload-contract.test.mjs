import { getImageReferenceId, getImageReferenceUrl, isManagedImageUrl } from '../src/api/ImageReferences.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/api/canvasAssets.js', import.meta.url), 'utf8')
  .replace(/^import \{[\s\S]*?\} from .*;\n/, '').replace(/^import .*;$/mg, '').replace(/export /g, '');
const projectId = '10000000-0000-0000-0000-000000000001';
const assetId = '20000000-0000-0000-0000-000000000001';
const file = { name: '素材.png' };

test('上传回填独立原图地址，预览地址不替代详情原图', () => {
  const { normalizeCanvasUploadedAsset: normalize } = setup();
  const result = normalize({ asset_id: assetId, uploaded_url: '/original.png',
    image: { preview_url: '/preview.webp', thumbnail_url: '/thumb.webp' } }, file, 'image');
  assert.equal(result.originalUrl, '/original.png');
  assert.equal(result.previewUrl, '/preview.webp');
  const explicit = normalize({ asset_id: assetId, uploaded_url: '/preview.webp',
    image: { file_url: '/full.png' } }, file, 'image');
  assert.equal(explicit.originalUrl, '/full.png');
});

function setup(payload = { asset_id: assetId, uploaded_url: 'https://media.example.test/a' }) {
  const calls = [];
  const upload = async (args) => { calls.push(args); return payload; };
  const api = runInNewContext(`${source}\n({uploadCanvasAsset,normalizeCanvasUploadedAsset,ensureCanvasImageAsset})`, {
    getImageReferenceId, getImageReferenceUrl, isManagedImageUrl, getAuthSessionGeneration: () => 1, File, fetch,
    apiUploadCreationImage: upload, apiUploadCreationVideo: upload, apiUploadCreationAudio: upload,
  });
  return { ...api, calls };
}

test('三类素材上传保留项目归属与取消信号，不推断会话编号', async () => {
  const { uploadCanvasAsset, calls } = setup();
  const signal = new AbortController().signal;
  for (const type of ['image', 'video', 'audio']) {
    const result = await uploadCanvasAsset(file, type, { projectId, signal });
    assert.equal(result.asset_id, assetId);
    assert.equal(result.uploadStatus, 'ready');
  }
  assert.ok(calls.every((args) => args.project_id === projectId && args.signal === signal
    && args.category === 'reference' && args.asset_name === file.name && !('session_id' in args)));
});

test('模拟或无效项目不发真实上传，也不降级为个人资产', async () => {
  const { uploadCanvasAsset, calls } = setup();
  for (const id of ['dev-project-1', '', 1]) {
    await assert.rejects(uploadCanvasAsset(file, 'image', { projectId: id }), /正式后端项目/);
  }
  assert.equal(calls.length, 0);
  await uploadCanvasAsset(file, 'image', { projectId: null });
  assert.equal(calls[0].project_id, undefined);
});

test('只接受永久素材编号，明确的asset_id优先于嵌套普通id，不误用file_id', () => {
  const { normalizeCanvasUploadedAsset: normalize } = setup();
  assert.equal(normalize({ asset_id: assetId, image: { id: projectId, url: 'https://media.example.test/a' } }, file, 'image').asset_id, assetId);
  for (const payload of [
    { asset_id: 'temporary', url: 'blob:a' },
    { file_id: assetId, url: 'https://media.example.test/a' },
  ]) assert.throws(() => normalize(payload, file, 'image'), /永久素材编号/);
  assert.throws(() => normalize({ asset_id: assetId }, file, 'image'), /素材地址/);
});

test('后台上传与生成兜底复用同一临时图片，项目隔离', async () => {
 const api = setup(); const asset = {url:'blob:one',file:new File(['x'],'x.png')};
 const [a,b] = await Promise.all([api.ensureCanvasImageAsset(asset,{projectId}),api.ensureCanvasImageAsset(asset,{projectId})]);
 assert.equal(api.calls.length,1); assert.equal(a,b);
 await api.ensureCanvasImageAsset(asset,{}); assert.equal(api.calls.length,2);
});
