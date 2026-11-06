import test from 'node:test';
import assert from 'node:assert/strict';
import { readCanvasShareDocument } from '../src/components/canvas/CanvasShareDocument.js';
import { serializeSharedCanvasFile } from '../src/components/canvas/SharedCanvasFile.js';

const publicPayload = () => ({ document: {
  engine: 'xyflow', schemaVersion: 1,
  records: [{ id: 'text', type: 'free-canvas-node', x: 0, y: 0,
    props: { nodeType: 'text', content: '公开当前结果' } }],
} });

test('开发草稿及混合格式均不能绕过分享读取和导出检查', async () => {
  for (const mixed of [false, true]) {
    const payload = mixed ? publicPayload() : { document: {} };
    Object.assign(payload.document, { schema_version: 1, nodes: [
      { id: 'text', type: 'text', position: { x: 0, y: 0 },
        data: { content: '私有正文', nodeResults: { private: '私有历史' } } },
    ] });
    assert.throws(() => readCanvasShareDocument(payload), /公开协议/);
    await assert.rejects(serializeSharedCanvasFile(payload, 'https://example.com'), /公开协议/);
  }
});

test('公开当前结果仍可读取和导出', async () => {
  const payload = publicPayload();
  assert.equal(readCanvasShareDocument(payload).nodes[0].data.content, '公开当前结果');
  assert.match(await serializeSharedCanvasFile(payload, 'https://example.com'), /公开当前结果/);
});

for (const field of ['nodeResults', 'resultAssetViews']) {
  test(`公开响应携带${field}时拒绝读取和导出且不改变输入`, async () => {
    const payload = publicPayload();
    payload.document.records[0].props[field] = { private: '未公开素材' };
    const before = structuredClone(payload);
    assert.throws(() => readCanvasShareDocument(payload), /未公开/);
    await assert.rejects(serializeSharedCanvasFile(payload, 'https://example.com'), /未公开/);
    assert.deepEqual(payload, before);
  });
}
