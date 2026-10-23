import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectRouteRestore } from '../src/utils/ProjectRouteRestore.js';

const storage = { getItem: (key) => ({ miioo_active_key: 'project', miioo_active_project_id: 'cached' })[key] ?? null };
const route = { key: 'project', projectId: 'linked', step: 'storyboard' };

test('链接优先缓存，成功后只恢复一次且保留步骤', () => {
  const restore = createProjectRouteRestore(route, storage, 1);
  assert.deepEqual(restore.consume([{ id: 'linked' }], 1), {
    projectId: 'linked', step: 'storyboard', session: 1, exists: true,
  });
  assert.equal(restore.consume([{ id: 'linked' }], 1), null);
});
test('读取失败未消费目标，稍后成功仍可恢复', async () => {
  const restore = createProjectRouteRestore(route, storage, 1);
  await assert.rejects(Promise.reject(new Error('断网')));
  assert.equal(restore.consume([{ id: 'linked' }], 1).exists, true);
});
test('主动导航或退出后取消待恢复目标', () => {
  const restore = createProjectRouteRestore(route, storage, 1);
  restore.cancel();
  assert.equal(restore.consume([{ id: 'linked' }], 1), null);
});
test('跨会话不恢复，目标不带入新账号', () => {
  const restore = createProjectRouteRestore(route, storage, 1);
  assert.equal(restore.consume([{ id: 'linked' }], 2), null);
  assert.equal(restore.consume([{ id: 'linked' }], 1), null);
});
test('项目不存在仅报告一次，不持续尝试跳转', () => {
  const restore = createProjectRouteRestore(route, storage, 1);
  assert.equal(restore.consume([], 1).exists, false);
  assert.equal(restore.consume([{ id: 'linked' }], 1), null);
});
test('首页沿用缓存目标，其他模块不恢复缓存项目', () => {
  assert.equal(createProjectRouteRestore({ key: 'home' }, storage, 1).consume([{ id: 'cached' }], 1).projectId, 'cached');
  assert.equal(createProjectRouteRestore({ key: 'assets' }, storage, 1).consume([{ id: 'cached' }], 1), null);
});
