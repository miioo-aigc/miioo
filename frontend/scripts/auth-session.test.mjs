import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createContext, SourceTextModule } from 'node:vm';

const sources = await Promise.all(['api/request.js', 'api/auth.js', 'utils/cache.js'].map(
  (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8'),
));

function storage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index],
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

async function load(fetcher) {
  const localStorage = storage();
  const events = [];
  const calls = [];
  const context = createContext({
    localStorage, sessionStorage: storage(), FormData, File, console,
    CustomEvent: class { constructor(type) { this.type = type; } },
    window: { dispatchEvent: (event) => events.push(event.type) },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return fetcher(url, options);
    },
  });
  const [request, auth, cache] = sources.map((source) => new SourceTextModule(source, {
    context,
    initializeImportMeta(meta) {
      meta.env = { VITE_API_BASE_URL: 'https://example.test', VITE_USE_MOCK: 'false' };
    },
  }));
  await cache.link(() => { throw new Error('意外依赖'); });
  await request.link(() => cache);
  await auth.link(() => request);
  await auth.evaluate();
  request.namespace.setTokens('old-access', 'old-refresh');
  localStorage.setItem('miioo_cache:projects', 'cached');
  return { api: request.namespace, auth: auth.namespace, cache: cache.namespace, localStorage, events, calls };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const methods = ['authFetch', 'authFetchForm', 'authFetchStream'];
const tick = () => new Promise((resolve) => setImmediate(resolve));

for (const medium of ['memory', 'local', 'session']) {
  test(`重新登录清理${medium}缓存并隔离旧缓存通知`, async () => {
    const { api, cache } = await load(() => json({}));
    await cache.cached('saved', async () => 'account-a', { medium });
    let finish;
    const updates = [];
    const unsubscribe = cache.subscribe('pending', (data) => updates.push(data));
    const pending = cache.cached('pending', () => new Promise((resolve) => { finish = resolve; }), { medium });
    await tick();
    api.setTokens('account-b', 'refresh-b');
    assert.equal(cache.peekCache('saved', medium), undefined);
    finish('stale');
    await pending;
    assert.equal(cache.peekCache('pending', medium), undefined);
    assert.deepEqual(updates, []);
    await cache.cached('pending', async () => 'account-b', { medium });
    assert.deepEqual(updates, ['account-b']);
    unsubscribe();
  });
}
test('同一会话自动刷新凭证保留业务缓存', async () => {
  const { api, cache } = await load(() => json({ access_token: 'renewed' }));
  await cache.cached('saved', async () => 'same-account');
  assert.equal(await api.refreshAccessToken(), true);
  assert.equal(cache.peekCache('saved'), 'same-account');
});

// 执行首页实际读取回调，隔离 React 渲染；请求层仍使用真实实现与模拟网络。
const homeSource = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const readProjectsBody = homeSource.match(/const readProjects = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[\]\);/)?.[1];
assert.ok(readProjectsBody, '首页项目读取回调必须可定位');
function projectReader(api, fetchProjects) {
  const state = { projects: ['existing'], loaded: true, error: '' };
  const deps = {
    getToken: api.getToken,
    getAuthSessionGeneration: api.getAuthSessionGeneration,
    projectListVersion: { current: 0 },
    apiGetProjects: fetchProjects,
    normalizeProjectList: (data) => data,
    setProjects: (data) => { state.projects = data; },
    setProjectListSession: (value) => { state.session = value; },
    setProjectsLoaded: (value) => { state.loaded = value; },
    setProjectsError: (value) => { state.error = value; },
  };
  const read = new Function(...Object.keys(deps), `return async () => {${readProjectsBody}}`)(...Object.values(deps));
  return { state, read };
}

for (const failure of [false, true]) {
  test(`首页读取期间凭证刷新后${failure ? '失败可重试' : '成功结束加载'}`, async () => {
    const { api } = await load(() => json({ access_token: 'renewed', refresh_token: 'renewed-refresh' }));
    const generation = api.getAuthSessionGeneration();
    let finish;
    const reader = projectReader(api, () => new Promise((resolve, reject) => { finish = failure ? reject : resolve; }));
    const pending = reader.read();
    assert.equal(reader.state.loaded, false);
    assert.equal(await api.refreshAccessToken(), true);
    assert.equal(api.getAuthSessionGeneration(), generation);
    finish(failure ? new Error('网络失败') : ['fresh']);
    await pending;
    assert.equal(reader.state.loaded, true);
    assert.deepEqual(reader.state.projects, failure ? ['existing'] : ['fresh']);
    assert.equal(Boolean(reader.state.error), failure);
    if (failure) {
      const retry = reader.read();
      assert.equal(reader.state.error, '');
      finish(new Error('仍不可用'));
      await retry;
      assert.equal(reader.state.loaded, true);
    }
  });
}

for (const change of ['退出', '重新登录', '新请求']) {
  test(`首页${change}后迟到结果不回写或结束当前加载`, async () => {
    const { api } = await load(() => json({}));
    const pendingResponses = [];
    const reader = projectReader(api, () => new Promise((resolve) => pendingResponses.push(resolve)));
    const old = reader.read();
    const generation = api.getAuthSessionGeneration();
    if (change === '退出') api.clearTokens();
    if (change === '重新登录') api.setTokens('old-access', 'old-refresh');
    if (change !== '新请求') assert.notEqual(api.getAuthSessionGeneration(), generation);
    const current = change === '退出' ? null : reader.read();
    pendingResponses[0](['stale']);
    assert.equal(await old, null);
    assert.deepEqual(reader.state.projects, ['existing']);
    assert.equal(reader.state.loaded, false);
    assert.equal(reader.state.error, '');
    if (current) {
      pendingResponses[1](['current']);
      await current;
      assert.deepEqual(reader.state.projects, ['current']);
      assert.equal(reader.state.loaded, true);
    }
  });
}

for (const method of methods) {
  test(`${method} 重试期间换号拒绝旧响应且不误报网络错误`, async () => {
    let finish;
    const state = await load((url, options) => {
      if (url.endsWith('/auth/refresh')) return json({ access_token: 'renewed' });
      if (options.headers.Authorization === 'Bearer renewed') return new Promise((resolve) => { finish = resolve; });
      return json({}, 401);
    });
    const pending = state.api[method]('/items');
    const rejected = assert.rejects(pending, (error) => error.status === 401 && !error.isNetworkError);
    await tick();
    state.api.setTokens('account-b', 'refresh-b');
    finish(json({ secret: 'old-account' }));
    await rejected;
    assert.equal(state.api.getToken(), 'account-b');
    assert.deepEqual(state.events, []);
  });
  for (const status of [200, 401]) {
    test(`${method} 刷新中换号不写回也不登出新账号 ${status}`, async () => {
      let finish;
      const state = await load((url) => url.endsWith('/auth/refresh')
        ? new Promise((resolve) => { finish = resolve; }) : json({}, 401));
      const pending = state.api[method]('/api/items');
      const rejected = assert.rejects(pending);
      await tick();
      state.api.setTokens('account-b', 'refresh-b');
      finish(json({ access_token: 'stale', refresh_token: 'stale-refresh' }, status));
      await rejected;
      assert.equal(state.api.getToken(), 'account-b');
      assert.equal(state.api.getRefreshToken(), 'refresh-b');
      assert.deepEqual(state.events, []);
      assert.equal(state.calls.length, 2);
    });
  }
  test(`${method} 迟到401在正常令牌轮换后使用新令牌重试`, async () => {
    let finishOld;
    const state = await load((url, options) => {
      if (url.endsWith('/auth/refresh')) return json({ access_token: 'new-access', refresh_token: 'rotated' });
      if (url.endsWith('/slow') && options.headers.Authorization === 'Bearer old-access') return new Promise((resolve) => { finishOld = resolve; });
      return json({}, options.headers.Authorization === 'Bearer new-access' ? 200 : 401);
    });
    const slow = state.api[method]('/slow');
    await tick();
    await state.api[method]('/fast');
    finishOld(json({}, 401));
    assert.equal((await slow).status, 200);
    assert.equal(state.calls.filter((call) => call.url.endsWith('/auth/refresh')).length, 1);
  });
  test(`${method} ensure等待阶段换号不发送旧业务请求`, async () => {
    let finish;
    const state = await load(() => new Promise((resolve) => { finish = resolve; }));
    state.localStorage.removeItem('token');
    const pending = state.api[method]('/old-write', { method: 'POST' });
    const rejected = assert.rejects(pending);
    await tick();
    state.api.clearTokens();
    state.api.setTokens('account-b', 'refresh-b');
    finish(json({ access_token: 'old-renewed' }));
    await rejected;
    assert.equal(state.calls.length, 1);
    assert.equal(state.api.getToken(), 'account-b');
  });
  test(`${method} 首次响应返回前换号拒绝旧响应`, async () => {
    let finish;
    const state = await load(() => new Promise((resolve) => { finish = resolve; }));
    const pending = state.api[method]('/items');
    const rejected = assert.rejects(pending);
    await tick();
    state.api.setTokens('account-b', 'refresh-b');
    finish(json({ secret: 'old-account' }));
    await rejected;
  });
}
test('旧账号刷新完成不清除新账号刷新锁，也不覆盖新令牌', async () => {
  const finishes = [];
  const state = await load(() => new Promise((resolve) => finishes.push(resolve)));
  const old = state.api.refreshAccessToken();
  state.api.setTokens('account-b', 'refresh-b');
  const current = state.api.refreshAccessToken();
  finishes[0](json({ access_token: 'stale' }));
  assert.equal(await old, false);
  const joined = state.api.refreshAccessToken();
  assert.equal(state.calls.length, 2);
  finishes[1](json({ access_token: 'renewed-b', refresh_token: 'rotated-b' }));
  assert.equal(await current, true);
  assert.equal(await joined, true);
  assert.equal(state.api.getToken(), 'renewed-b');
  assert.equal(state.api.getRefreshToken(), 'rotated-b');
});
const temporaryFailures = [
  ...[500, 502, 503, 504, 429, 422].map((status) => [String(status), () => json({}, status)]),
  ['断网', () => { throw new TypeError('Failed to fetch'); }],
  ['超时', () => { throw new DOMException('timeout', 'TimeoutError'); }],
  ['解析失败', () => new Response('<html>')],
  ['缺少访问凭证', () => json({})],
];

for (const method of methods) {
  for (const [name, failure] of temporaryFailures) {
    test(`${method} 刷新${name}不登出且允许下一次刷新`, async () => {
      let recover = false;
      const state = await load((url) => url.endsWith('/auth/refresh')
        ? (recover ? json({ access_token: 'new-access' }) : failure())
        : json({}, 401));
      await assert.rejects(state.api[method]('/api/projects'), (error) => {
        assert.notEqual(error.status, 401);
        if (/^\d+$/.test(name)) assert.equal(error.status, Number(name));
        return true;
      });
      assert.equal(state.api.getToken(), 'old-access');
      assert.equal(state.api.getRefreshToken(), 'old-refresh');
      assert.equal(state.localStorage.getItem('miioo_cache:projects'), 'cached');
      assert.deepEqual(state.events, []);
      assert.equal(state.calls.length, 2);
      recover = true;
      assert.equal(await state.api.refreshAccessToken(), true);
      assert.equal(state.api.getToken(), 'new-access');
    });
  }

  for (const status of [400, 401, 403]) {
    test(`${method} 刷新被明确拒绝 ${status} 才清理凭证和缓存`, async () => {
      const state = await load((url) => new Response('非 JSON 错误', {
        status: url.endsWith('/auth/refresh') ? status : 401,
      }));
      await assert.rejects(state.api[method]('/api/projects'));
      assert.equal(state.api.getToken(), null);
      assert.equal(state.api.getRefreshToken(), null);
      assert.equal(state.localStorage.getItem('miioo_cache:projects'), null);
      assert.deepEqual(state.events, ['auth:logout']);
    });
  }

  test(`${method} 刷新与重试携带凭证并保留上传内容`, async () => {
    const state = await load((url, options) => url.endsWith('/auth/refresh')
      ? json({ access_token: 'new-access', refresh_token: 'new-refresh' })
      : json({}, options.headers.Authorization === 'Bearer new-access' ? 200 : 401));
    const body = new FormData();
    body.append('file', new File(['content'], 'upload.txt'));
    const response = await state.api[method]('/api/upload', { method: 'POST', body });
    assert.equal(response.status, 200);
    assert.equal(state.calls.length, 3);
    for (const call of state.calls) assert.equal(call.options.credentials, 'include');
    assert.equal(JSON.parse(state.calls[1].options.body).refresh_token, 'old-refresh');
    const retry = state.calls[2].options;
    assert.equal(retry.headers.Authorization, 'Bearer new-access');
    assert.equal(retry.headers['Content-Type'], undefined);
    assert.equal(retry.body.get('file').name, 'upload.txt');
    assert.equal(await retry.body.get('file').text(), 'content');
    assert.equal(state.api.getRefreshToken(), 'new-refresh');
  });

  test(`${method} 业务非401错误不刷新、不登出`, async () => {
    const state = await load(() => json({}, 403));
    assert.equal((await state.api[method]('/api/projects')).status, 403);
    assert.equal(state.calls.length, 1);
    assert.deepEqual(state.events, []);
  });

  test(`${method} 无刷新凭证时退出但不锁住后续刷新`, async () => {
    const state = await load((url) => url.endsWith('/auth/refresh')
      ? json({ access_token: 'new-access' }) : json({}, 401));
    state.localStorage.removeItem('refresh_token');
    await assert.rejects(state.api[method]('/api/projects'));
    assert.equal(state.api.getToken(), null);
    assert.deepEqual(state.events, ['auth:logout']);
    state.api.setTokens('login-access', 'login-refresh');
    assert.equal(await state.api.refreshAccessToken(), true);
  });
}

test('并发401共享刷新请求，完成后释放锁', async () => {
  let resolveRefresh;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const state = await load((url, options) => {
    if (url.endsWith('/auth/refresh')) {
      markStarted();
      return new Promise((resolve) => { resolveRefresh = resolve; });
    }
    return json({}, options.headers.Authorization === 'Bearer new-access' ? 200 : 401);
  });
  const pending = methods.map((method) => state.api[method]('/api/projects'));
  await started;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.calls.filter((call) => call.url.endsWith('/auth/refresh')).length, 1);
  resolveRefresh(json({ access_token: 'new-access' }));
  assert.deepEqual((await Promise.all(pending)).map((res) => res.status), [200, 200, 200]);
  const next = state.api.refreshAccessToken();
  resolveRefresh(json({ access_token: 'latest-access' }));
  assert.equal(await next, true);
  assert.equal(state.api.getToken(), 'latest-access');
});

for (const name of ['apiSendCode', 'apiLogin', 'apiVerifyCodeLogin', 'apiRegister',
  'apiGetWechatQrCode', 'apiPollWechatQrCodeStatus', 'apiCompleteWechatCallback', 'apiConfirmWechatLogin']) {
  test(`${name} 直接认证请求携带凭证`, async () => {
    const state = await load(() => json({ qrcode_id: 'qr', raw_qr_code_value: 'qr-content' }));
    await state.auth[name]({});
    assert.equal(state.calls.length, 1);
    assert.equal(state.calls[0].options?.credentials, 'include');
  });
}

test('主动退出即使网络失败仍清理凭证和缓存', async () => {
  const state = await load(() => { throw new TypeError('offline'); });
  await state.auth.apiLogout();
  assert.equal(state.api.getToken(), null);
  assert.equal(state.api.getRefreshToken(), null);
  assert.equal(state.localStorage.getItem('miioo_cache:projects'), null);
});

for (const method of methods) {
  test(`${method} 只有续期凭证时502不伪装为401`, async () => {
    const state = await load(() => json({}, 502));
    state.localStorage.removeItem('token');
    await assert.rejects(state.api[method]('/api/projects'), { status: 502 });
    assert.equal(state.api.getRefreshToken(), 'old-refresh');
    assert.deepEqual(state.events, []);
    assert.equal(state.calls.length, 1);
  });
}

for (const name of ['apiLogin', 'apiVerifyCodeLogin', 'apiRegister', 'apiGetCurrentUser']) {
  for (const body of ['<html>Bad Gateway</html>', JSON.stringify({ detail: 'upstream unavailable' })]) {
    test(`${name} 网关错误保留502且不覆盖会话：${body[0]}`, async () => {
      const state = await load(() => new Response(body, { status: 502 }));
      await assert.rejects(state.auth[name]({}), { status: 502 });
      assert.equal(state.api.getToken(), 'old-access');
      assert.deepEqual(state.events, []);
    });
  }
}
