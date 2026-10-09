import assert from 'node:assert/strict';
import { creationEditScope, visibleCreationEdits } from '../src/components/creation/CreationEditResults.js';

const pending = { id: 'pending:1', pending: true };
const result = { id: 'pending:1', backendId: 'asset-result', originalUrl: '/original.png', imageUrl: '/original.png' };
assert.deepEqual(visibleCreationEdits([pending], []), [pending]);
assert.deepEqual(visibleCreationEdits([result], []), [result]);
assert.deepEqual(visibleCreationEdits([result], [{ type: 'image', status: 'done', backendId: 'asset-result', imageUrl: '/thumbnail.webp' }]), []);
assert.deepEqual(visibleCreationEdits([result], [{ type: 'image', status: 'done', originalUrl: '/original.png' }]), []);
assert.deepEqual(visibleCreationEdits([result], [{ type: 'image', status: 'done', backendId: 'different' }]), [result]);
assert.notEqual(creationEditScope({ id: 'first', imageUrl: '/1' }), creationEditScope({ id: 'second', imageUrl: '/2' }));
assert.equal(creationEditScope({ assetId: 'asset', backendId: 'record' }), 'creation:asset');
console.log('创作编辑结果测试通过：占位、即时结果、资产去重、缩略图与原图去重、逐卡归属');
