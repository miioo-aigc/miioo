import test from 'node:test';
import assert from 'node:assert/strict';
import { getResponseErrorCode } from '../src/api/error.js';
import { getCanvasViewportCenterNodePosition } from '../src/components/canvas/CanvasImportLayout.js';
import {
  canvasGenerationRecordKey,
  filterCanvasGenerationSources,
  getCanvasGenerationAssetType,
  getCanvasGenerationImportAsset,
  groupCanvasGenerationRecords,
  isCanvasGenerationAssetReady,
  isCanvasGenerationRecordReady,
  mergeCanvasGenerationResolvedAssets,
  mergeCanvasGenerationRecords,
  mergeValidatedCanvasGenerationDetail,
  normalizeCanvasGenerationRecord,
  shanghaiDayLabel,
} from '../src/utils/canvasGenerationHistoryAdapter.js';

test('画布接口错误码兼容 detail.code 与响应顶层 code', () => {
  assert.equal(getResponseErrorCode({ detail: { code: 'INVALID_CURSOR', message: '游标无效' } }), 'INVALID_CURSOR');
  assert.equal(getResponseErrorCode({ code: 'INVALID_CURSOR', message: '游标无效' }), 'INVALID_CURSOR');
  assert.equal(getResponseErrorCode({ code: 'TOP_LEVEL', detail: { code: 'DETAIL_CODE' } }), 'DETAIL_CODE');
  assert.equal(getResponseErrorCode({ detail: [{ msg: '参数错误' }] }), '');
});

test('视口中心空白直接落点，冲突时搜索相邻空位', () => {
  assert.deepEqual(getCanvasViewportCenterNodePosition([], { x: 500, y: 400 }, { width: 240, height: 264 }), { x: 380, y: 268 });
  const nodes = [{ id: 'occupied', type: 'image', position: { x: 380, y: 268 }, width: 240, height: 264, data: { asset: null } }];
  const position = getCanvasViewportCenterNodePosition(nodes, { x: 500, y: 400 }, { width: 240, height: 264 });
  assert.notDeepEqual(position, { x: 380, y: 268 });
  assert.ok(position.x >= 652 || position.x + 240 <= 348 || position.y >= 564 || position.y + 264 <= 236);
});

test('历史编号不会冒充资产编号，只有 ready 资产暴露媒体地址', () => {
  const missing = normalizeCanvasGenerationRecord({
    id: 'history-only',
    type: 'image',
    completed_at: '2026-11-16T10:00:00+08:00',
    asset: {
      name: 'private-name',
      availability: 'missing',
      preview_url: 'https://private.invalid/preview.png',
      thumbnail_url: 'https://private.invalid/thumb.png',
      download_url: 'https://private.invalid/download.png',
    },
  });
  assert.equal(missing.historyId, 'history-only');
  assert.equal(missing.assetId, '');
  assert.equal(missing.ready, false);
  assert.equal(missing.availabilityLabel, '文件已缺失');
  assert.equal(missing.asset.name, undefined);
  assert.equal(missing.asset.preview_url, undefined);
  assert.equal(missing.asset.thumbnail_url, undefined);
  assert.equal(missing.asset.download_url, undefined);
  assert.equal(isCanvasGenerationRecordReady(missing), false);

  const ready = normalizeCanvasGenerationRecord({
    id: 'history-1',
    type: 'image',
    asset_id: 'asset-1',
    completed_at: '2026-11-16T10:00:00+08:00',
    asset: {
      id: 'asset-1',
      media_type: 'image',
      availability: 'ready',
      preview_url: 'https://example.test/asset-1.png',
    },
  });
  assert.equal(ready.assetId, 'asset-1');
  assert.equal(ready.asset.preview_url, 'https://example.test/asset-1.png');
  assert.equal(isCanvasGenerationRecordReady(ready), true);
});

test('历史资产兼容 availability 与旧 ready 字段，并识别可导入媒体类型', () => {
  const available = { asset_type: 'image', availability: 'ready', original_url: '/image.png' };
  const legacyReady = { type: 'video', ready: true, preview_url: '/video-preview.jpg' };
  assert.equal(getCanvasGenerationAssetType(available), 'image');
  assert.equal(getCanvasGenerationAssetType({ media_type: 'video/mp4' }), 'video');
  assert.equal(getCanvasGenerationAssetType({ asset_type: 'audio' }), 'audio');
  assert.equal(getCanvasGenerationAssetType({ asset_type: 'document' }), '');
  assert.equal(isCanvasGenerationAssetReady(available), true);
  assert.equal(isCanvasGenerationAssetReady(legacyReady), true);
  for (const availability of ['missing', 'forbidden', 'trashed']) {
    assert.equal(isCanvasGenerationAssetReady({ asset_type: 'image', availability }), false);
  }
  assert.equal(isCanvasGenerationAssetReady({ asset_type: 'image', availability: 'missing', ready: true }), false);

  const normalizedLegacy = normalizeCanvasGenerationRecord({
    id: 'history-legacy',
    asset_id: 'asset-legacy',
    type: 'image',
    asset: { ready: true, preview_url: '/legacy.png' },
  });
  assert.equal(normalizedLegacy.ready, true);
  assert.equal(normalizedLegacy.asset.preview_url, '/legacy.png');
  assert.deepEqual(getCanvasGenerationImportAsset({ asset_type: 'image', availability: 'ready' }), {
    asset_type: 'image', media_type: 'image', availability: 'ready',
  });
  assert.deepEqual(getCanvasGenerationImportAsset({ asset_type: 'video', availability: 'ready' }), {
    asset_type: 'video', media_type: 'video', availability: 'ready',
  });
  assert.deepEqual(getCanvasGenerationImportAsset({ media_type: 'audio', ready: true }), {
    media_type: 'audio', ready: true, asset_type: 'audio',
  });
  assert.equal(getCanvasGenerationImportAsset({ asset_type: 'image', availability: 'missing' }), null);
  assert.equal(getCanvasGenerationImportAsset({ asset_type: 'video', availability: 'trashed' }), null);
  assert.equal(getCanvasGenerationImportAsset({ asset_type: 'audio', availability: 'forbidden' }), null);
  assert.equal(getCanvasGenerationImportAsset({ asset_type: 'document', availability: 'ready' }), null);
});

test('历史来源仅在当前画布和同项目画布间筛选，排除其他项目', () => {
  const canvases = [
    { id: 'current', project_id: 'project-a', status: 'active' },
    { id: 'same-project', project_id: 'project-a', status: 'active' },
    { id: 'other-project', project_id: 'project-b', status: 'active' },
    { id: 'archived', project_id: 'project-a', status: 'archived' },
  ];
  assert.deepEqual(filterCanvasGenerationSources(canvases, 'current', '').map((item) => item.id), ['current']);
  assert.deepEqual(filterCanvasGenerationSources(canvases, 'current', 'project-a').map((item) => item.id), ['current', 'same-project']);
});

test('分页按历史编号去重，同一资产的不同历史事件仍然保留', () => {
  const merged = mergeCanvasGenerationRecords([
    { id: 'h-old', asset_id: 'asset-old', type: 'video', completed_at: '2026-11-15T08:00:00Z', asset: { availability: 'ready', url: 'old' } },
    { id: 'h-unknown', asset_id: 'asset-unknown', type: 'video', created_at: '2026-11-16T12:00:00Z', completed_at: null, asset: { availability: 'ready', url: 'unknown' } },
  ], [
    { id: 'h-new', asset_id: 'asset-new', type: 'video', completed_at: '2026-11-16T08:00:00Z', asset: { availability: 'ready', url: 'new' } },
    { id: 'h-old', asset_id: 'asset-old', type: 'video', completed_at: '2026-11-15T08:00:00Z', asset: { availability: 'ready', url: 'old-refreshed' } },
    { id: 'h-same-asset', asset_id: 'asset-old', type: 'video', completed_at: '2026-11-14T08:00:00Z', asset: { availability: 'ready', url: 'another-event' } },
  ]);
  assert.equal(merged.length, 4);
  assert.equal(canvasGenerationRecordKey(merged[0]), 'history:h-new');
  assert.equal(merged[1].asset.url, 'old-refreshed');
  assert.ok(merged.some((record) => record.historyId === 'h-same-asset' && record.assetId === 'asset-old'));
  assert.equal(merged.at(-1).historyId, 'h-unknown');
});

test('历史按 Asia/Shanghai 自然日分组，未知成功时间不借用创建时间', () => {
  const records = mergeCanvasGenerationRecords([
    { id: 'h-shanghai-next-day', asset_id: 'asset-17', type: 'image', completed_at: '2026-11-16T16:30:00Z', asset: { availability: 'ready', preview_url: '17' } },
    { id: 'h-shanghai-day', asset_id: 'asset-16', type: 'image', completed_at: '2026-11-16T15:59:00Z', asset: { availability: 'ready', preview_url: '16' } },
    { id: 'h-unknown', asset_id: 'asset-unknown', type: 'image', created_at: '2026-11-17T01:00:00Z', completed_at: null, asset: { availability: 'ready', preview_url: 'unknown' } },
  ]);
  const groups = groupCanvasGenerationRecords(records, new Date('2026-11-18T12:00:00+08:00'));
  assert.deepEqual(groups.map(([label]) => label), ['昨天', '2026年11月16日', '未知时间']);
  assert.equal(groups.at(-1)[1][0].createdAt, '2026-11-17T01:00:00.000Z');
  assert.equal(shanghaiDayLabel('2026-11-17T16:30:00Z', new Date('2026-11-19T00:00:00+08:00')), '昨天');

  const missingCompletedKey = normalizeCanvasGenerationRecord({
    id: 'h-legacy',
    asset_id: 'asset-legacy',
    type: 'image',
    created_at: '2026-11-17T03:00:00Z',
    asset: { availability: 'ready', preview_url: 'legacy' },
  });
  assert.equal(missingCompletedKey.completedAt, '2026-11-17T03:00:00.000Z');
});

test('资产详情必须匹配稳定编号、媒体类型和可用状态', () => {
  const record = normalizeCanvasGenerationRecord({
    id: 'history-1',
    asset_id: 'asset-1',
    type: 'image',
    completed_at: '2026-11-16T10:00:00+08:00',
    asset: { id: 'asset-1', media_type: 'image', availability: 'ready', original_url: '/history.png' },
  });
  const detail = { id: 'asset-1', asset_id: 'asset-1', asset_type: 'image', availability: 'ready', original_url: '/fresh.png' };
  assert.equal(mergeValidatedCanvasGenerationDetail(record, { ...detail, id: 'asset-2' }), null);
  assert.equal(mergeValidatedCanvasGenerationDetail(record, { ...detail, asset_id: 'asset-3' }), null);
  assert.equal(mergeValidatedCanvasGenerationDetail(record, { ...detail, asset_type: 'video' }), null);
  assert.equal(mergeValidatedCanvasGenerationDetail(record, { ...detail, availability: 'trashed' }), null);
  assert.equal(mergeValidatedCanvasGenerationDetail(record, { ...detail, is_deleted: true }), null);
  assert.equal(mergeValidatedCanvasGenerationDetail(record, { ...detail, original_url: '' }), null);
  const merged = mergeValidatedCanvasGenerationDetail(record, detail);
  assert.equal(merged.asset.original_url, '/fresh.png');
  assert.equal(merged.ready, true);
});

test('批量解析结果合并可用、缺失、无权及遗漏资产', () => {
  const records = mergeCanvasGenerationRecords([
    { id: 'h-a', asset_id: 'asset-a', type: 'image', asset: { availability: 'ready', preview_url: '/old-a.png' } },
    { id: 'h-b', asset_id: 'asset-b', type: 'image', asset: { availability: 'ready', preview_url: '/old-b.png' } },
    { id: 'h-c', asset_id: 'asset-c', type: 'image', asset: { availability: 'ready', preview_url: '/old-c.png' } },
  ]);
  const merged = mergeCanvasGenerationResolvedAssets(records, {
    items: [{ id: 'asset-a', asset_id: 'asset-a', media_type: 'image', availability: 'ready', preview_url: '/new-a.png' }],
    missing_ids: ['asset-b'],
    forbidden_ids: [],
  });
  const byHistory = new Map(merged.map((record) => [record.historyId, record]));
  assert.equal(byHistory.get('h-a').asset.preview_url, '/new-a.png');
  assert.equal(byHistory.get('h-a').availability, 'ready');
  assert.equal(byHistory.get('h-b').availability, 'missing');
  assert.equal(byHistory.get('h-b').asset.name, undefined);
  assert.equal(byHistory.get('h-b').asset.preview_url, undefined);
  assert.equal(byHistory.get('h-b').asset.thumbnail_url, undefined);
  assert.equal(byHistory.get('h-b').asset.download_url, undefined);
  assert.equal(byHistory.get('h-c').availability, 'unavailable');
  assert.equal(byHistory.get('h-c').asset.preview_url, undefined);
});
