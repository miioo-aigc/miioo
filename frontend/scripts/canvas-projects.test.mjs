import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/api/CanvasProjects.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/export /g, '');
function setup(deps) {
  return runInNewContext(source + '\n({apiCreateCanvasProject,apiListCanvasProjects,apiGetCanvasProjectEntry})', deps);
}

test('创建正式画布项目，无风格参数且原子创建首张画布', async () => {
  let body;
  const api = setup({ apiCreateProject: async (value) => {
    body = value;
    return { id: 'project', project_type: 'canvas', first_canvas_id: 'canvas', visual_style: null };
  } });
  assert.equal((await api.apiCreateCanvasProject()).first_canvas_id, 'canvas');
  assert.deepEqual(JSON.parse(JSON.stringify(body)), {
    name: '未命名项目', project_type: 'canvas', create_first_canvas: true, first_canvas_title: '画布1',
  });
});

test('创建失败仅请求一次，不提供模拟或独立画布降级', async () => {
  let calls = 0;
  const api = setup({ apiCreateProject: async () => { calls++; throw new Error('网络中断'); } });
  await assert.rejects(api.apiCreateCanvasProject(), /网络中断/);
  assert.equal(calls, 1);
  for (const result of [{ id: 'project' }, { id: 'project', project_type: 'canvas', first_canvas_id: 'canvas', visual_style: 'custom' }]) {
    await assert.rejects(setup({ apiCreateProject: async () => result }).apiCreateCanvasProject());
  }
});

test('项目裸数组按offset读完再筛选，不漏掉第二页画布项目', async () => {
  const calls = [];
  const api = setup({ apiGetProjects: async (params) => {
    calls.push(JSON.parse(JSON.stringify(params)));
    return params.offset === 0
      ? Array.from({ length: 200 }, (_, i) => ({ id: String(i), project_type: 'video' }))
      : [{ id: 'canvas-project', project_type: 'canvas' }];
  } });
  assert.equal((await api.apiListCanvasProjects())[0].id, 'canvas-project');
  assert.deepEqual(calls, [{ limit: 200, offset: 0 }, { limit: 200, offset: 200 }]);
});

test('异常分页及格式显式失败，失效会话不再读取后续页', async () => {
  await assert.rejects(setup({ apiGetProjects: async () => ({ items: [] }) }).apiListCanvasProjects(), /格式/);
  await assert.rejects(setup({ apiGetProjects: async () => Array.from({ length: 200 }, (_, i) => ({ id: String(i) })) }).apiListCanvasProjects(), /分页/);
  let calls = 0;
  const api = setup({ apiGetProjects: async () => { calls++; return []; } });
  await api.apiListCanvasProjects({ isCurrent: () => false });
  assert.equal(calls, 0);
});

test('打开项目获取归属正确的画布编号，跨项目条目不会被打开', async () => {
  const calls = [];
  const api = setup({ apiListCanvasDocuments: async (params) => {
    calls.push(params);
    return params.page === 1 ? { items: [{ id: 'wrong', project_id: 'other' }], total: 101 }
      : { items: [{ id: 'actual-canvas', project_id: 'project' }], total: 101 };
  } });
  assert.equal(await api.apiGetCanvasProjectEntry('project'), 'actual-canvas');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].projectId, 'project');
  assert.equal(calls[0].status, 'active');
  await assert.rejects(setup({ apiListCanvasDocuments: async () => ({ items: [], total: 0 }) }).apiGetCanvasProjectEntry('project'), /没有可打开/);
});

const hookSource = readFileSync(new URL('../src/components/canvas/UseCanvasProjects.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/export /g, '');
function hookSetup(create) {
  const effects = [];
  const opened = [];
  const messages = [];
  let session = 1;
  const useCanvasProjects = runInNewContext(hookSource + '\nuseCanvasProjects', {
    useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}],
    useCallback: (callback) => callback, useEffect: (effect) => effects.push(effect),
    apiCreateCanvasProject: create, getToken: () => 'token', getAuthSessionGeneration: () => session,
    showGlobalToast: (...args) => messages.push(args), normalizeProjectList: (value) => value,
  });
  const hook = useCanvasProjects({ active: false, isLoggedIn: true, onLogin() {}, onOpen: (id) => opened.push(id) });
  const cleanup = effects[0]();
  return { hook, opened, messages, cleanup, changeSession: () => session++ };
}

test('重复点击创建只提交一次，成功后打开首张画布', async () => {
  let release;
  let calls = 0;
  const state = hookSetup(() => { calls++; return new Promise((resolve) => { release = resolve; }); });
  const first = state.hook.create();
  await state.hook.create();
  assert.equal(calls, 1);
  release({ first_canvas_id: 'canvas' });
  await first;
  assert.deepEqual(state.opened, ['canvas']);
});

test('账号变化或离开入口后忽略迟到创建结果', async () => {
  for (const invalidate of ['changeSession', 'cleanup']) {
    let release;
    const state = hookSetup(() => new Promise((resolve) => { release = resolve; }));
    const pending = state.hook.create();
    state[invalidate]();
    release({ first_canvas_id: 'canvas' });
    await pending;
    assert.deepEqual(state.opened, []);
  }
});

test('创建结果未知提醒核对列表，不自动重试', async () => {
  let calls = 0;
  const state = hookSetup(async () => { calls++; throw new Error('网络中断'); });
  await state.hook.create();
  assert.equal(calls, 1);
  assert.match(state.messages[0][1], /刷新项目列表/);
});
