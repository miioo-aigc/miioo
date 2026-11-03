import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync(new URL('../src/api/project.js', import.meta.url), 'utf8');
const definition = api.slice(api.indexOf('export async function apiGetWorkflowProjects'), api.indexOf('export async function apiGetProject(projectId)')).replace('export ', '');
const load = (fetchPage, options) => new Function('apiGetProjects', `${definition}; return apiGetWorkflowProjects;`)(fetchPage)(options);

test('排除画布，保留工作流及历史空类型，并按创建时间倒序', async () => {
  const result = await load(async () => [
    { id: 'canvas', project_type: 'canvas' },
    { id: 'old', project_type: null, created_at: '2020-01-01' },
    { id: 'video', project_type: 'video', created_at: '2026-01-01' },
    { id: 'missing' },
    { id: 'empty', project_type: '' },
  ]);
  assert.deepEqual(result.map(p => p.id), ['video', 'old', 'missing', 'empty']);
});
test('整页都是画布仍继续读取，跨页项目不遗漏且去重', async () => {
  const offsets = [];
  const result = await load(async ({ limit, offset }) => {
    offsets.push(offset);
    assert.equal(limit, 200);
    if (offset === 0) return Array.from({ length: 200 }, (_, id) => ({ id, project_type: 'canvas' }));
    return [{ id: 'old' }, { id: 'old' }, { id: 'video', project_type: 'video' }];
  });
  assert.deepEqual(offsets, [0, 200]);
  assert.deepEqual(result.map(p => p.id), ['old', 'video']);
});
test('退出后不再继续分页，接口失败不当作空列表', async () => {
  let current = true;
  let calls = 0;
  assert.deepEqual(await load(async () => { calls++; current = false; return Array(200).fill({ id: 'p' }); }, { isCurrent: () => current }), []);
  assert.equal(calls, 1);
  await assert.rejects(load(async () => { throw new Error('网络失败'); }), /网络失败/);
  await assert.rejects(load(async () => ({})), /格式异常/);
});

const panel = readFileSync(new URL('../src/components/assets/AssetsProjectPanel.jsx', import.meta.url), 'utf8');
const effect = panel.slice(panel.indexOf('    let current = true;'), panel.indexOf('  }, [initialProjectId]);'));
async function select(list, initialProjectId, previous) {
  let selected = previous;
  const run = new Function('apiGetWorkflowProjects', 'initialProjectId', 'setProjects', 'setActiveProject', 'showGlobalToast', effect);
  run(async () => list, initialProjectId, () => {}, update => { selected = update(selected); }, () => {});
  await new Promise(resolve => setImmediate(resolve));
  return selected;
}
test('画布地址不能成为选中项目，失效旧选择回退到有效工作流项目', async () => {
  const projects = [{ id: 'video' }, { id: 'old' }];
  assert.equal(await select(projects, 'canvas', 'video'), null);
  assert.equal(await select(projects, null, 'canvas'), 'video');
  assert.equal(await select(projects, null, 'old'), 'old');
  assert.equal(await select(projects, 'old', 'video'), 'old');
  assert.equal(await select([], null, 'canvas'), null);
});
