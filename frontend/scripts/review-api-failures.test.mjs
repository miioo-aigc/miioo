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
    await assert.rejects(api.apiRebindPhone('13900001111', 'code'));
    await assert.rejects(api.apiSendPhoneCode('phone'));
    await assert.rejects(api.apiSendPhoneUnbindCode());
  });
}

test('phone confirmation requires documented success data', async () => {
  let payload = {};
  const api = await loadApi('user.js', async () => Response.json(payload));
  await assert.rejects(api.apiVerifyPhoneCode('phone', 'code'));
  await assert.rejects(api.apiRebindPhone('13900001111', 'code'));
  payload = { access_token: 'test-only' };
  assert.deepEqual(await api.apiVerifyPhoneCode('phone', 'code'), { valid: true });
  payload = { id: 'u', phone_bound: true, phone: '139****1111' };
  assert.equal((await api.apiRebindPhone('13900001111', 'code')).phone, '139****1111');
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

 test('换绑与注销短信合同：请求体、错误白名单、畸形成功响应', async () => {
  let payload = { message: '已发送', expires_in: 300 }, status = 200;
  const calls = [];
  const api = await loadApi('user.js', async (url, options) => {
    calls.push({ url, options }); return Response.json(payload, { status });
  });
  await assert.rejects(api.apiSendRebindPhoneCode('138****0000'));
  assert.equal(calls.length, 0);
  await api.apiSendRebindPhoneCode('13900001111');
  assert.ok(calls.at(-1).url.endsWith('/phone/rebind/send-code'));
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { phone: '13900001111' });
  await api.apiSendPhoneUnbindCode();
  assert.equal(calls.at(-1).options.body, undefined);
  for (payload of [{ success: true }, { message: 'ok', expires_in: 0 }, { message: 'ok', expires_in: '300' }]) {
    await assert.rejects(api.apiSendPhoneUnbindCode());
  }
  status = 502; payload = { detail: '腾讯云 internal secret' };
  await assert.rejects(api.apiSendPhoneUnbindCode(), { message: '验证码发送失败，请稍后重试' });
  status = 400; payload = { detail: '验证码错误' };
  await assert.rejects(api.apiDeleteAccount('123456'), { message: '验证码错误' });
  status = 200; payload = { message: '账号已注销' };
  await api.apiDeleteAccount('123456');
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { code: '123456' });
  await api.apiDeleteAccount();
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), {});
 });
