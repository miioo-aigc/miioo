import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCanvasViewportCenterNodePosition } from '../src/components/canvas/CanvasImportLayout.js';

const read = (file) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');

test('视口中心空白直接落点，冲突时搜索相邻空位', () => {
  assert.deepEqual(getCanvasViewportCenterNodePosition([], { x: 500, y: 400 }, { width: 240, height: 264 }), { x: 380, y: 268 });
  const nodes = [{ id: 'occupied', type: 'image', position: { x: 380, y: 268 }, width: 240, height: 264, data: { asset: null } }];
  const position = getCanvasViewportCenterNodePosition(nodes, { x: 500, y: 400 }, { width: 240, height: 264 });
  assert.notDeepEqual(position, { x: 380, y: 268 });
  assert.ok(position.x >= 652 || position.x + 240 <= 348 || position.y >= 564 || position.y + 264 <= 236);
});

test('历史界面以来源画布读取，删除记录走专用历史 API，不把文本纳入卡片', () => {
  const modal = read('components/canvas/CanvasGenerationHistory.jsx');
  const api = read('api/canvas.js');
  assert.ok(modal.includes('apiListCanvasGenerationHistory(sourceCanvasId'));
  assert.ok(modal.includes('targetCanvasId: targetCanvasId || canvasId || sourceCanvasId'));
  assert.ok(modal.includes('apiDeleteCanvasGenerationHistory(sourceCanvasId, record.id, { targetCanvasId:'));
  assert.ok(modal.includes("['image', 'video', 'audio'].includes(recordType(item))"));
  assert.ok(modal.includes('onAddToCanvas={() => void add(selected)}'));
  assert.ok(api.includes('generation-history'));
});
