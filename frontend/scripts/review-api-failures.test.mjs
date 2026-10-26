import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

async function loadApi(file, fetcher) {
  const module = new SourceTextModule(readFileSync(new URL(`../src/api/${file}`, import.meta.url), 'utf8'), {
    initializeImportMeta(meta) { meta.env = { VITE_API_BASE_URL: 'https://test.invalid' }; },
  });
  await module.link((specifier) => {
    if (specifier === './Announcements.js') {
      const names = ['apiGetUserAnnouncements', 'apiGetLatestAnnouncementPopup', 'apiMarkAnnouncementRead'];
      return new SyntheticModule(names, function () {
        for (const name of names) this.setExport(name, () => { throw new Error('公告接口不属于此测试范围'); });
      });
    }
    assert.ok(['./request.js', './request'].includes(specifier), `未声明的测试依赖：${specifier}`);
    return new SyntheticModule(['authFetch'], function () {
    this.setExport('authFetch', fetcher);
    });
  });
  await module.evaluate();
  return module.namespace;
}

for (const status of [400, 401, 403, 422, 500]) {
  test(`phone operations reject HTTP ${status}`, async () => {
    const api = await loadApi('user.js', async () => Response.json({ detail: '失败' }, { status }));
    await assert.rejects(api.apiVerifyPhoneCode('phone', 'code'), { status });
    await assert.rejects(api.apiDeleteAccount(), { status });
    await assert.rejects(api.apiUnbindWechat(), { status });
    await assert.rejects(api.apiUpdateProfile({ nickname: '新昵称' }), { status });
    await assert.rejects(api.apiUploadAvatar(new Blob(['local'])), { status });
    await assert.rejects(api.apiRebindPhone('phone', 'code'));
    await assert.rejects(api.apiSendPhoneCode('phone'));
    await assert.rejects(api.apiUnbindPhone('code'));
  });
}

test('phone confirmation requires documented success data', async () => {
  let payload = {};
  const api = await loadApi('user.js', async () => Response.json(payload));
  await assert.rejects(api.apiVerifyPhoneCode('phone', 'code'));
  await assert.rejects(api.apiRebindPhone('phone', 'code'));
  payload = { access_token: 'test-only' };
  assert.deepEqual(await api.apiVerifyPhoneCode('phone', 'code'), { valid: true });
  payload = { phone: 'phone' };
  assert.equal((await api.apiRebindPhone('phone', 'code')).phone, 'phone');
  payload = { success: false };
  await assert.rejects(api.apiSendPhoneCode('phone'));
});

test('账号操作必须收到明确的成功响应', async () => {
  let payload = {};
  const api = await loadApi('user.js', async () => Response.json(payload));
  await assert.rejects(api.apiDeleteAccount());
  await assert.rejects(api.apiUnbindWechat());
  await assert.rejects(api.apiSendPhoneCode('phone'));
  payload = { message: '已注销' };
  await api.apiDeleteAccount();
  payload = { id: 'user', wechat_bound: false };
  assert.deepEqual(await api.apiUnbindWechat(), payload);
  payload = { success: true };
  await api.apiSendPhoneCode('phone');
});

test('资料与头像响应必须有确认字段，单字段提交不夹带另一字段', async () => {
  let payload = {};
  const calls = [];
  const api = await loadApi('user.js', async (url, options) => { calls.push({ url, options }); return Response.json(payload); });
  await assert.rejects(api.apiUpdateProfile({ nickname: '新昵称' }));
  await assert.rejects(api.apiUploadAvatar(new Blob(['local'])));
  payload = { id: 'user', nickname: '新昵称', avatar_url: '/avatar.png' };
  await api.apiUpdateProfile({ nickname: '新昵称' });
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { nickname: '新昵称' });
  await api.apiUpdateProfile({ avatar_url: '/avatar.png' });
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { avatar_url: '/avatar.png' });
  payload = { url: '/uploaded.png' };
  assert.deepEqual(await api.apiUploadAvatar(new Blob(['local'])), { avatarUrl: '/uploaded.png' });
  payload = { url: 'blob:local' };
  await assert.rejects(api.apiUploadAvatar(new Blob(['local'])));
});

test('验证网络异常保留错误类型，不冒充验证码错误', async () => {
  const error = Object.assign(new Error('断网'), { isNetworkError: true });
  const api = await loadApi('user.js', async () => { throw error; });
  await assert.rejects(api.apiVerifyPhoneCode('phone', 'code'), e => e === error);
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
