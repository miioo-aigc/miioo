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
  return { api: request.namespace, auth: auth.namespace, localStorage, events, calls };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const methods = ['authFetch', 'authFetchForm', 'authFetchStream'];
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
      await assert.rejects(state.api[method]('/api/projects'));
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
