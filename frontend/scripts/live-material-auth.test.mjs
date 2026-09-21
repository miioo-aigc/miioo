import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../src/api/liveMaterials.js', import.meta.url), 'utf8');
const detail = '请前往请求接口所使用的 API Key 编辑页面，设置只用供应商，素材库使用请看文档 https://docs.onelinkai.cloud/8655248m0';

async function loadApi(response) {
  const request = new SyntheticModule(['authFetch'], function () {
    this.setExport('authFetch', async () => response);
  });
  const api = new SourceTextModule(source, {
    initializeImportMeta(meta) {
      meta.env = { VITE_API_BASE_URL: 'https://example.test' };
    },
  });
  await api.link(() => request);
  await api.evaluate();
  return api.namespace;
}

for (const status of [400, 403, 500]) {
  test(`认证失败 ${status} 保留后端说明和文档地址`, async () => {
    const api = await loadApi(new Response(JSON.stringify({ detail }), { status }));
    await assert.rejects(api.apiCreateLiveMaterialAuthSession({ source: 'assets' }), (error) => {
      assert.equal(error.status, status);
      assert.equal(error.detail, detail);
      assert.equal(error.message, detail);
      return true;
    });
  });
}

test('空错误响应保留兜底信息，不伪造后端说明', async () => {
  const api = await loadApi(new Response('', { status: 502 }));
  await assert.rejects(api.apiCreateLiveMaterialAuthSession(), (error) => {
    assert.equal(error.detail, undefined);
    assert.equal(error.message, '创建认证会话失败: 502');
    return true;
  });
});

test('认证成功正常返回会话', async () => {
  const session = { session_id: 'test-session', launch_url: 'https://example.test/auth' };
  const api = await loadApi(new Response(JSON.stringify(session)));
  assert.deepEqual(await api.apiCreateLiveMaterialAuthSession({ source: 'creation' }), session);
});
