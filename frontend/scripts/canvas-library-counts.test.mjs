import test from 'node:test';
import assert from 'node:assert/strict';
import { withCanvasFolderCounts } from '../src/api/CanvasLibraryCounts.js';

test('直属素材跨分页统计，排除子文件夹并去重', async () => {
  const pages = [
    { items: [{ type: 'folder', id: 'nested' }, { type: 'entry', id: 'a', asset: { media_type: 'image' } }], next_cursor: 'next' },
    { items: [{ type: 'entry', id: 'a', asset: { media_type: 'image' } }, { type: 'entry', id: 'b', asset: { media_type: 'audio' } }] },
  ];
  const result = await withCanvasFolderCounts({ items: [{ type: 'folder', id: 'folder' }] }, async (id, cursor) => {
    assert.equal(id, 'folder');
    return pages[cursor ? 1 : 0];
  });
  assert.equal(result.items[0].count, 2);
});

test('真实零计数直接使用，失败不伪装成零', async () => {
  const result = await withCanvasFolderCounts({ items: [{ type: 'folder', id: 'empty', count: 0 }, { type: 'folder', id: 'failed' }] }, async (id) => {
    assert.equal(id, 'failed');
    throw new Error('网络失败');
  });
  assert.equal(result.items[0].count, 0);
  assert.equal(result.items[1].count, '统计失败');
});
