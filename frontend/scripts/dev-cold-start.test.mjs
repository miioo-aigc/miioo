import test from 'node:test';
import assert from 'node:assert/strict';
import { checkModuleGraph } from './lib/check-module-graph.mjs';

function fixtures(modules) {
  const requested = [];
  return {
    requested,
    fetchModule: async (url) => {
      const path = new URL(url).pathname;
      requested.push(path);
      const value = modules[path];
      return new Response(value ?? 'missing', {
        status: value === undefined ? 404 : 200,
        headers: { 'content-type': 'text/javascript' },
      });
    },
  };
}

test('递归检查静态、转导出和字面量动态导入，循环依赖不会重复遍历', async () => {
  const fixture = fixtures({
    '/main.js': 'import "./base.js"; const open = () => import("./page.js");',
    '/base.js': 'export { value } from "./shared.js";',
    '/page.js': 'import "./shared.js"; import "./style.css";',
    '/shared.js': 'import "./main.js"; export const value = 1;',
    '/style.css': 'export default "body {}";',
  });
  const result = await checkModuleGraph('http://localhost:1234', ['/main.js'], fixture.fetchModule);
  assert.equal(result.checked, 5);
  assert.deepEqual(result.failures, []);
  assert.equal(fixture.requested.length, 10);
});

test('依赖返回 504 时失败并记录来源，不通过重试掩盖错误', async () => {
  let requests = 0;
  const result = await checkModuleGraph('http://localhost:1234', ['/page.js'], async (url) => {
    if (new URL(url).pathname === '/page.js') {
      return new Response('import "/deps/editor.js?v=old";');
    }
    requests++;
    return new Response('Outdated Optimize Dep', { status: 504 });
  });
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].message, /504/);
  assert.match(result.failures[0].url, /editor.js\?v=old/);
  assert.match(result.failures[0].importer, /page.js/);
  assert.equal(requests, 1);
});

test('全部发现后复查原始地址，捕获预构建导致的旧地址失效', async () => {
  let requests = 0;
  const result = await checkModuleGraph('http://localhost:1234', ['/page.js'], async () => {
    requests++;
    return requests === 1
      ? new Response('export default 1;')
      : new Response('Outdated Optimize Dep', { status: 504 });
  });
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].phase, 'recheck');
});

test('语法错误、网络异常和 HTML 回退响应不能算通过', async () => {
  for (const fetchModule of [
    async () => new Response('export const = ;'),
    async () => { throw new Error('connection closed'); },
    async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
  ]) {
    const result = await checkModuleGraph('http://localhost:1234', ['/page.js'], fetchModule);
    assert.equal(result.failures.length, 1);
  }
});
