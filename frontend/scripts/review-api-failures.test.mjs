import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

async function loadApi(file, fetcher) {
  const module = new SourceTextModule(readFileSync(new URL(`../src/api/${file}`, import.meta.url), 'utf8'), {
    initializeImportMeta(meta) { meta.env = { VITE_API_BASE_URL: 'https://test.invalid' }; },
  });
  await module.link(() => new SyntheticModule(['authFetch'], function () {
    this.setExport('authFetch', fetcher);
  }));
  await module.evaluate();
  return module.namespace;
}

for (const status of [400, 401, 422, 500]) {
  test(`phone operations reject HTTP ${status}`, async () => {
    const api = await loadApi('user.js', async () => Response.json({ detail: '失败' }, { status }));
    assert.deepEqual(await api.apiVerifyPhoneCode('phone', 'code'), { valid: false });
    await assert.rejects(api.apiRebindPhone('phone', 'code'));
    await assert.rejects(api.apiSendPhoneCode('phone'));
    await assert.rejects(api.apiUnbindPhone('code'));
  });
}

test('phone confirmation requires documented success data', async () => {
  let payload = {};
  const api = await loadApi('user.js', async () => Response.json(payload));
  assert.deepEqual(await api.apiVerifyPhoneCode('phone', 'code'), { valid: false });
  await assert.rejects(api.apiRebindPhone('phone', 'code'));
  payload = { access_token: 'test-only' };
  assert.deepEqual(await api.apiVerifyPhoneCode('phone', 'code'), { valid: true });
  payload = { phone: 'phone' };
  assert.equal((await api.apiRebindPhone('phone', 'code')).phone, 'phone');
  payload = { success: false };
  await assert.rejects(api.apiSendPhoneCode('phone'));
});

test('watermark read failure does not become an empty successful list', async () => {
  const api = await loadApi('settings.js', async () => Response.json({}, { status: 500 }));
  await assert.rejects(api.apiGetWatermarkSettings());
  await assert.rejects(api.apiUpdateWatermarkSettings({}));
});

test('watermark waits for every provider and reports partial failure', async () => {
  const calls = [];
  const api = await loadApi('settings.js', async (url, options) => {
    if (!options.method) return Response.json([{ id: 'one', name: '甲' }, { id: 'two', name: '乙' }]);
    calls.push(url);
    return Response.json({}, { status: url.endsWith('two') ? 500 : 200 });
  });
  await assert.rejects(api.apiUpdateWatermarkSettings({ imageWatermark: true }), /1\/2.*乙/);
  assert.equal(calls.length, 2);
});

test('notification HTTP failure is not an empty state', async () => {
  const api = await loadApi('user.js', async () => Response.json({}, { status: 500 }));
  await assert.rejects(api.apiGetNotifications());
});
