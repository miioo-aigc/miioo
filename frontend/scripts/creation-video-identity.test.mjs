import assert from 'node:assert/strict';
import test from 'node:test';
import { creationVideoIdentity } from '../src/components/creation/CreationEditResults.js';
import { validateSourceAsset } from '../src/utils/MediaEditRequest.js';

function detailSource(card, generation) {
  return { ...card, backendId: creationVideoIdentity(card, generation) };
}

test('新生成视频使用后端卡片编号，不使用生成记录编号', () => {
  const source = detailSource({ id: 'video-1', type: 'video', status: 'done' }, { id: 'generation-1' });
  assert.equal(validateSourceAsset(source), 'video-1');
});

test('历史视频保留生成记录中明确的后端资产编号', () => {
  const source = detailSource({ id: 'video-1', status: 'done' }, { id: 'history-video-1', backendId: 'video-1' });
  assert.equal(validateSourceAsset(source), 'video-1');
});

test('卡片明确资产编号不被生成记录覆盖', () => {
  const source = detailSource({ backendId: 'video-2', status: 'done' }, { backendId: 'video-1' });
  assert.equal(validateSourceAsset(source), 'video-2');
});

test('无编号、加载占位和本地编号继续阻止提交', () => {
  for (const card of [
    { status: 'done' },
    { id: 'placeholder-1', status: 'loading' },
    { id: 'local-video-1', status: 'done' },
    { id: 'blob:video', status: 'done' },
  ]) {
    assert.throws(() => validateSourceAsset(detailSource(card, { id: 'generation-1' })), /缺少真实源资产编号/);
  }
  assert.throws(() => validateSourceAsset({ id: 'video-1' }), /缺少真实源资产编号/);
});
