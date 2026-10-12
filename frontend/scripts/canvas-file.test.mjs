import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCanvasFile, parseCanvasFile, serializeCanvasFile } from '../src/components/canvas/CanvasFile.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { normalizeProjectName, validateProjectName } from '../src/components/canvas/CanvasProjectName.js';

const nodes = [
  { id: 'g', type: 'canvasGroup', position: { x: 20, y: 20 }, style: { width: 500, height: 400 }, data: { label: '组', stacked: true } },
  { id: 'a', type: 'text', parentId: 'g', position: { x: 8, y: 8 }, data: { label: '文本', content: '内容', generating: true } },
  { id: 'b', type: 'image', position: { x: 600, y: 20 }, data: { label: '图片', textSourceIds: ['a'], referenceInputs: [{ sourceId: 'a', slot: 0 }] } },
];
const encode = (items) => JSON.stringify({ format: 'miioo-canvas', version: 1, nodes: items });

test('导出回读、编号重映射、右侧合并、重复导入及整批撤销', async () => {
  const imported = parseCanvasFile(await serializeCanvasFile(nodes, '项目'));
  assert.equal(imported[1].data.generating, undefined);
  const history = createCanvasHistory(nodes);
  let id = 0;
  const result = mergeCanvasFile(nodes, imported, () => String(++id));
  assert.equal(result.length, 6);
  assert.deepEqual(result[0].position, nodes[0].position);
  assert.equal(result[3].position.x, 960);
  assert.equal(result[4].parentId, result[3].id);
  assert.equal(result[3].data.stacked, true);
  assert.deepEqual(result[5].data.textSourceIds, [result[4].id]);
  assert.equal(result[5].data.referenceInputs[0].sourceId, result[4].id);
  assert.equal(result[5].data.label, '图片');
  history.setNodes(result);
  history.undo();
  assert.equal(history.getSnapshot().nodes.length, 3);
  history.redo();
  assert.equal(history.getSnapshot().nodes.length, 6);
  const again = mergeCanvasFile(result, imported, () => String(++id));
  assert.equal(new Set(again.map((node) => node.id)).size, 9);
  history.dispose();
});

test('损坏文件、重复编号、循环分组、断裂引用和临时地址拒绝导入', () => {
  assert.throws(() => parseCanvasFile('{}'));
  assert.throws(() => parseCanvasFile(encode([nodes[0], nodes[0]])));
  assert.throws(() => parseCanvasFile(encode([{ ...nodes[0], parentId: 'g' }])));
  assert.throws(() => parseCanvasFile(encode([nodes[2]])));
  assert.throws(() => parseCanvasFile(encode([{ ...nodes[0], data: { label: '组', url: 'blob:expired' } }])));
  assert.equal(parseCanvasFile(encode([])).length, 0);
});

test('名称允许常用标点、过滤符号且最多50字', () => {
  const name = '项目（第一版）：「你好！」，测试-01。';
  assert.equal(normalizeProjectName(name), name);
  assert.equal(validateProjectName(name), '');
  assert.equal(normalizeProjectName('名称★😀@#$%^&+=✓'), '名称');
  assert.equal(Array.from(normalizeProjectName('测'.repeat(60))).length, 50);
  assert.notEqual(validateProjectName('测'.repeat(51)), '');
});
