import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasLibraryDrop } from '../src/components/assets/CanvasLibraryItems.js';

test('拖回自身或来源目录静默取消，有效目标只提交一次', () => {
  const calls = [];
  const drop = (items, target) => canvasLibraryDrop({ preventDefault() {}, dataTransfer: { getData: () => JSON.stringify(items) } }, (...args) => calls.push(args), target);
  const folder = { type: 'folder', id: 'folder-a', source_folder_id: 'root' };
  const media = { type: 'entry', id: 'image-a', source_folder_id: 'root' };
  drop([folder], 'folder-a');
  drop([media], 'root');
  drop([folder, media], 'folder-a');
  drop([folder, media], 'root');
  assert.equal(calls.length, 0);
  drop([folder, media], 'folder-b');
  assert.deepEqual(calls, [[[folder, media], 'folder-b']]);
});
