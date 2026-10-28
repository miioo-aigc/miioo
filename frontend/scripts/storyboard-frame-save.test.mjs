import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const page = await readFile(new URL('../src/pages/StoryboardPage.jsx', import.meta.url), 'utf8');
const saveFrame = page.slice(page.indexOf('  async function saveExtractedFrame('), page.indexOf('  async function copyPersistedCandidateMedia('));

function setup(saveCandidateMedia) {
  const notices = [];
  const context = vm.createContext({
    isBackendStoryboardId: (id) => id === 'shot-id',
    saveCandidateMedia,
    showGlobalToast: (...args) => notices.push(args),
    refreshCandidateForShot: () => { throw new Error('新增候选不得回读覆盖原定稿'); },
  });
  vm.runInContext(saveFrame, context);
  return { save: context.saveExtractedFrame, notices };
}

test('选帧关联完成前不报成功，关联成功只新增候选', async () => {
  let resolve;
  const { save, notices } = setup((id, candidate) => {
    assert.equal(id, 'shot-id');
    assert.equal(candidate.media_type, 'image');
    assert.equal(candidate.asset_id, 'frame-id');
    assert.equal(candidate.is_finalized, undefined);
    return new Promise((done) => { resolve = done; });
  });
  const pending = save({ id: 'shot-id' }, { asset_id: 'frame-id', original_url: '/frame.png' });
  assert.equal(notices.length, 0);
  resolve({ id: 'candidate-id' });
  await pending;
  assert.equal(notices.length, 1);
  assert.equal(notices[0][1], 'success');
});

test('候选保存失败返回失败信号，不报成功', async () => {
  const { save, notices } = setup(async () => null);
  assert.equal(await save({ id: 'shot-id' }, { asset_id: 'frame-id', original_url: '/frame.png' }), false);
  assert.equal(notices.length, 1);
  assert.equal(notices[0][1], 'error');
});

test('缺少分镜归属时不提交候选', async () => {
  const { save, notices } = setup(() => { assert.fail('不得提交'); });
  assert.equal(await save({}, { asset_id: 'frame-id', original_url: '/frame.png' }), false);
  assert.equal(notices[0][1], 'error');
});
