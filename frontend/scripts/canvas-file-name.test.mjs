import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasFileName } from '../src/components/canvas/CanvasFileName.js';
import { applyCanvasAsset } from '../src/components/canvas/CanvasAssets.js';
import { addCanvasReference } from '../src/components/canvas/CanvasReferences.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';

test('文件标题移除最后一段扩展名，保留中间点号及无扩展名文件', () => {
  for (const [input, expected] of [['街景.最终版.mp4', '街景.最终版'], ['台词.txt', '台词'], ['配音.WAV', '配音'], ['无扩展名', '无扩展名'], ['.隐藏文件', '.隐藏文件'], ['', '']]) {
    assert.equal(getCanvasFileName(input), expected);
  }
});
test('本地上传命名覆盖默认标题，资产库回填保留用户标题', () => {
  for (const type of ['image', 'video', 'audio']) {
    const node = createCanvasNode(type);
    const local = { asset_type: type, url: '/file', name: '本地文件.v1.mp4', source: 'local-upload' };
    const result = applyCanvasAsset([node], node.id, local);
    assert.equal(result[0].data.label, '本地文件.v1');
    const renamed = [{ ...result[0], data: { ...result[0].data, label: '手动命名' } }];
    assert.equal(applyCanvasAsset(renamed, node.id, { ...local, source: 'library' })[0].data.label, '手动命名');
  }
});
test('本地参考素材新增节点在编号分配后使用文件名', () => {
  const target = createCanvasNode('video');
  const result = addCanvasReference([target], target.id, { asset_type: 'image', url: '/photo.png', name: '角色.定稿.png', source: 'local-upload' });
  const added = result.find((node) => node.id !== target.id);
  assert.equal(added.data.label, '角色.定稿');
  assert.equal(added.data.sequence, 1);
});
