import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/subject/SubjectImageActions.js', import.meta.url), 'utf8');
const factory = source.slice(source.indexOf('export function createSubjectImageActionHandlers')).replace('export ', '');
function setup() {
  let current = true;
  let images = [{ id: 'old', rawUrl: '/old', settled: true }, { id: 'new', rawUrl: '/new', settled: false }];
  const covers = [], toasts = [], requests = [];
  const deps = {
    apiSetPrimarySubjectImage: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
    apiUnsetPrimarySubjectImage: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
    apiGetSubjectDetail: async () => ({}), resolveSubjectImageId: () => 'resolved', normalizeImageUrl: url => url,
  };
  const create = new Function(...Object.keys(deps), `${factory}; return createSubjectImageActionHandlers;`)(...Object.values(deps));
  const options = {
    projectId: 1, subjectId: 2, primaryOperationRef: { current: { pending: false, version: 0 } },
    isCurrent: () => current, setGeneratedImages: fn => { images = fn(images); },
    onCoverChange: (...args) => covers.push(args), setPrimaryImageUrl: () => {}, setPrimaryImageId: () => {},
    showToast: (...args) => toasts.push(args),
  };
  return { create: () => create(options), requests, covers, toasts, images: () => images,
    reorder: () => { images = [images[1], images[0]]; }, invalidate: () => { current = false; } };
}

for (const settled of [true, false]) {
  for (const mode of ['success', 'failure', 'stale']) {
    test(`${settled ? '设置' : '取消'}定稿：${mode}成功前不改变显示`, async () => {
      const ctx = setup();
      const target = ctx.images()[settled ? 1 : 0];
      const pending = ctx.create().handleSettledChange(target, settled ? 1 : 0, settled);
      assert.equal(ctx.covers.length, 0);
      assert.equal(ctx.images()[0].settled, true);
      // 工厂每次点击重建，但必须仍共用同一把锁。
      await ctx.create().handleSettledChange(target, 0, !settled);
      assert.equal(ctx.requests.length, 1);
      ctx.reorder();
      if (mode === 'stale') ctx.invalidate();
      if (mode === 'failure') ctx.requests[0].reject(Error('模拟失败'));
      else ctx.requests[0].resolve({});
      await pending;
      assert.equal(ctx.covers.length, mode === 'success' ? 1 : 0);
      if (mode === 'success') {
        assert.deepEqual(ctx.covers[0], [settled ? '/new' : null, { persist: false }]);
        assert.equal(ctx.images().find(item => item.id === target.id).settled, settled);
        assert.equal(ctx.images().filter(item => item.settled).length, settled ? 1 : 0);
      } else assert.equal(ctx.images().find(item => item.id === 'old').settled, true);
      if (mode === 'failure') {
        const retry = ctx.create().handleSettledChange(target, 0, settled);
        assert.equal(ctx.requests.length, 2);
        ctx.requests[1].resolve({});
        await retry;
      }
    });
  }
}

test('无编号图片在补读详情后失效，不继续提交定稿', async () => {
  let current = true, writes = 0;
  const deps = {
    apiGetSubjectDetail: async () => { current = false; return {}; },
    apiSetPrimarySubjectImage: async () => { writes++; },
  };
  const create = new Function(...Object.keys(deps), `${factory}; return createSubjectImageActionHandlers;`)(...Object.values(deps));
  await create({ primaryOperationRef: { current: { pending: false, version: 0 } }, isCurrent: () => current })
    .handleSettledChange({ rawUrl: '/new' }, 0, true);
  assert.equal(writes, 0);
});

test('手动动作在自动封面保存结束前不提交接口', async () => {
  let finish, writes = 0;
  const waiting = new Promise(resolve => { finish = resolve; });
  const create = new Function('apiUnsetPrimarySubjectImage', 'normalizeImageUrl', `${factory}; return createSubjectImageActionHandlers;`)(async () => { writes++; }, value => value);
  const run = create({
    primaryOperationRef: { current: { pending: false, version: 0 } },
    beforeManualPrimary: () => waiting,
    isCurrent: () => true,
    setGeneratedImages: () => {},
  }).handleSettledChange({ id: 'image' }, 0, false);
  assert.equal(writes, 0);
  finish();
  await run;
  assert.equal(writes, 1);
});

test('三类主体读取和手动定稿明确只同步显示，生图仍保留封面持久化', () => {
  const page = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /onCoverChange\?\.\(_settledImg.rawUrl, \{ persist: false \}\)/);
  assert.match(page, /onCoverChange\?\.\(null, \{ persist: false \}\)/);
  assert.equal((page.match(/onCoverChange=\{\(imageUrl, \{ persist = false, primaryVersion = 0 \} = \{\}\) =>/g) || []).length, 3);
  assert.match(page, /onCoverChange\?\.\(rawUrl, \{ persist: true, primaryVersion \}\)/);
  assert.match(page, /primaryVersion === primaryOperationRef.current.version/);
});
