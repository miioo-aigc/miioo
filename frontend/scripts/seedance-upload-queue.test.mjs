import test from 'node:test';
import assert from 'node:assert/strict';
import { runSeedanceUploadQueue } from '../src/components/assets/SeedanceUploadQueue.js';

test('最多三个并发，完成后补位，失败不阻断后续且结果顺序稳定', async () => {
  let active = 0;
  let peak = 0;
  const started = [];
  const releases = [];
  const pending = runSeedanceUploadQueue([0, 1, 2, 3, 4], async (item) => {
    started.push(item);
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => { releases[item] = resolve; });
    active--;
    if (item === 1) throw new Error('下载失败');
    return { success: true, item };
  });
  assert.deepEqual(started, [0, 1, 2]);
  releases[1]();
  await new Promise(setImmediate);
  assert.deepEqual(started, [0, 1, 2, 3]);
  releases[0]();
  await new Promise(setImmediate);
  assert.deepEqual(started, [0, 1, 2, 3, 4]);
  releases[2](); releases[3](); releases[4]();
  const results = await pending;
  assert.equal(peak, 3);
  assert.equal(results[1].error, '下载失败');
  assert.equal(results[4].item, 4);
  assert.equal(results.filter((item) => item.success).length, 4);
});

test('离开文件夹后不再派发排队素材', async () => {
  let current = true;
  const started = [];
  const releases = [];
  const pending = runSeedanceUploadQueue([0, 1, 2, 3, 4], async (item) => {
    started.push(item);
    await new Promise((resolve) => releases.push(resolve));
  }, () => current);
  current = false;
  releases.forEach((resolve) => resolve());
  await pending;
  assert.deepEqual(started, [0, 1, 2]);
});

test('空批次不执行任务', async () => {
  assert.deepEqual(await runSeedanceUploadQueue([], () => assert.fail()), []);
});
