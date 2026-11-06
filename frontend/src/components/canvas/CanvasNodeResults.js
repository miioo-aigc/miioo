/**
 * Node-local result protocol v1 (not the backend document schema).
 * { version, batches: append-order, currentResultId, selections: chronological }.
 * Batch: { id, source, requestedCount, results, status, snapshot, taskIds,
 * submittedAt, completedAt } (timestamps are epoch milliseconds).
 * Result: { id, index, type, content? , assetId? }; IDs are caller supplied,
 * node-local and never derived from URLs. taskIds are provenance, not live tasks.
 * No dependency version or server acceptance is inferred here.
 * Integration gap: CanvasHistory whole-field undo can overwrite async appends;
 * callers must resolve that policy before wiring this state into live history.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value) => typeof value === 'string' && value.trim().length > 0
  && !/^(?:[a-z]+:|[/])/i.test(value.trim());
const fail = (message) => { throw new Error(message); };

// Snapshots must already contain durable input identities, never media views.
function copySnapshot(value, ancestors = new Set(), key = '') {
  if (typeof value === 'string' && /(?:id|ids)$/i.test(key) && /^(?:[a-z]+:|[/])/i.test(value.trim())) fail('输入身份不能使用媒体地址');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) fail('执行快照必须是纯数据');
  if (ancestors.has(value)) fail('执行快照不能循环引用');
  ancestors.add(value);
  let copied;
  if (Array.isArray(value)) {
    // Only dense ordinary arrays: never invoke an iterator or indexed getter.
    if (Object.getPrototypeOf(value) !== Array.prototype
      || Reflect.ownKeys(value).length !== value.length + 1) fail('执行快照数组不能稀疏或包含额外属性');
    copied = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor) fail('执行快照数组不能稀疏');
      if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail('执行快照数组索引必须是普通数据属性');
      copied.push(copySnapshot(descriptor.value, ancestors, key));
    }
  } else {
    if (Reflect.ownKeys(value).length !== Object.keys(value).length) fail('执行快照对象不能包含符号或隐藏属性');
    copied = Object.fromEntries(Object.keys(value).sort().map((field) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (!Object.hasOwn(descriptor, 'value')) fail('执行快照不能包含访问器');
      if (['__proto__', 'constructor', 'prototype'].includes(field)) fail('执行快照包含危险对象键');
      if (/urls?$/i.test(field) || ['file', 'controller', 'signal'].includes(field)) fail('执行快照不能包含临时媒体或运行对象');
      return [field, copySnapshot(descriptor.value, ancestors, field)];
    }));
  }
  ancestors.delete(value);
  return copied;
}

export function createCanvasNodeResults() {
  return { version: 1, batches: [], currentResultId: null, selections: [] };
}

/** Failed slots use { index, status: 'failed' }; successful slots require IDs. */
export function normalizeCanvasResultBatch(batch) {
  if (!batch || !id(batch.id) || !['generation', 'upload', 'edit', 'legacy'].includes(batch.source)) fail('批次身份或来源无效');
  if (!Number.isInteger(batch.requestedCount) || batch.requestedCount < 1 || !Array.isArray(batch.results)) fail('批次数量或结果列表无效');
  const indexes = new Set(), ids = new Set();
  const results = [];
  for (const result of batch.results) {
    if (!result || !Number.isInteger(result.index) || result.index < 0 || result.index >= batch.requestedCount || indexes.has(result.index)) fail('结果索引无效或重复');
    indexes.add(result.index);
    if (result.status === 'failed') continue;
    if (result.status !== undefined && result.status !== 'success') fail('结果状态无效');
    if (!id(result.id) || ids.has(result.id)) fail('结果身份无效或重复');
    ids.add(result.id);
    if (!['text', 'image', 'video', 'audio'].includes(result.type)) fail('结果类型无效');
    if (result.type === 'text') {
      if (typeof result.content !== 'string' || !result.content.trim()) fail('文本结果为空');
      results.push({ id: result.id, index: result.index, type: result.type, content: result.content });
    } else {
      if (!UUID.test(result.assetId || '')) fail('媒体结果缺少永久资产编号');
      results.push({ id: result.id, index: result.index, type: result.type, assetId: result.assetId });
    }
  }
  results.sort((a, b) => a.index - b.index);
  if (new Set(results.map((result) => result.type)).size > 1) fail('同一批次不能混合结果类型');
  if (batch.requestedCount > 1
    && (batch.source !== 'generation' || results.some((result) => result.type !== 'image'))) fail('仅图片生成允许多结果批次');
  const taskIds = batch.taskIds ?? [];
  if (!Array.isArray(taskIds) || taskIds.some((value) => !id(value)) || new Set(taskIds).size !== taskIds.length) fail('服务端任务编号列表无效');
  // Epoch milliseconds; unknown timestamps are allowed only for legacy imports.
  const submittedAt = batch.submittedAt ?? null, completedAt = batch.completedAt ?? null;
  const validTime = (value) => Number.isSafeInteger(value) && value >= 0;
  if (batch.source === 'legacy' && submittedAt === null && completedAt === null) { /* Unknown legacy time. */ }
  else if (!validTime(submittedAt) || !validTime(completedAt) || completedAt < submittedAt) fail('批次提交或完成时间无效');
  return { id: batch.id, source: batch.source, requestedCount: batch.requestedCount, results, submittedAt, completedAt,
    status: results.length === 0 ? 'failed' : results.length === batch.requestedCount ? 'complete' : 'partial',
    snapshot: copySnapshot(batch.snapshot ?? null), taskIds: [...taskIds] };
}

export function validateCanvasNodeResults(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.batches) || !Array.isArray(state.selections)) fail('结果协议版本或结构无效');
  const batchIds = new Set(), resultIds = new Set(), types = new Set();
  for (const batch of state.batches) {
    const normalized = normalizeCanvasResultBatch(batch);
    if (!normalized.results.length || normalized.status !== batch.status || batchIds.has(batch.id)) fail('历史批次无效或重复');
    // Failed slots belong to terminal input only, never to retained state.
    // Unknown fields remain allowed so cloning can strip runtime additions.
    if (normalized.results.length !== batch.results.length
      || normalized.results.some((result, index) => result.id !== batch.results[index].id)) fail('历史结果必须是按索引排序的成功结果');
    batchIds.add(batch.id);
    for (const result of normalized.results) {
      if (resultIds.has(result.id)) fail('跨批次结果身份重复');
      resultIds.add(result.id);
      types.add(result.type);
    }
  }
  if (types.size > 1) fail('节点结果类型不一致');
  if (resultIds.size ? !resultIds.has(state.currentResultId) : state.currentResultId !== null) fail('当前结果引用无效');
  for (const selection of state.selections) {
    if (!selection || !resultIds.has(selection.resultId) || !['success', 'select', 'legacy'].includes(selection.reason)) fail('历史选择引用无效');
  }
  if (resultIds.size && state.selections.at(-1)?.resultId !== state.currentResultId) fail('当前结果与选择记录不一致');
  return state;
}

/** Terminal batches only: duplicates are no-ops; conflicting reuse is rejected. */
export function commitCanvasResultBatch(state, input) {
  validateCanvasNodeResults(state);
  const batch = normalizeCanvasResultBatch(input);
  const existing = state.batches.find((item) => item.id === batch.id);
  if (existing) {
    if (JSON.stringify(normalizeCanvasResultBatch(existing)) !== JSON.stringify(batch)) fail('批次编号已被不同结果使用');
    return state;
  }
  if (!batch.results.length) return state;
  const currentResultId = batch.results[0].id;
  const next = { ...state, batches: [...state.batches, batch], currentResultId,
    selections: [...state.selections, { resultId: currentResultId, reason: batch.source === 'legacy' ? 'legacy' : 'success' }] };
  return validateCanvasNodeResults(next);
}

/** Browsing uses get; only this explicit action changes the selected output. */
export function selectCanvasNodeResult(state, resultId) {
  validateCanvasNodeResults(state);
  if (!state.batches.some((batch) => batch.results.some((result) => result.id === resultId))) fail('选择的结果不存在');
  if (state.currentResultId === resultId) return state;
  return { ...state, currentResultId: resultId, selections: [...state.selections, { resultId, reason: 'select' }] };
}

export function getCanvasCurrentResult(state) {
  validateCanvasNodeResults(state);
  const result = state.batches.flatMap((batch) => normalizeCanvasResultBatch(batch).results).find((item) => item.id === state.currentResultId);
  return result ? { ...result } : null;
}

/** 台词属于当前生成结果，不能从可编辑的节点提示词推断。 */
export function getCanvasResultAudioTranscript(state, asset) {
  if (state) {
    const batch = state.batches.find((item) => item.results.some((result) =>
      result.id === state.currentResultId && result.type === 'audio' && result.assetId === asset?.asset_id));
    if (!batch) return '';
    if (batch.source === 'generation' && typeof batch.snapshot?.prompt === 'string') {
      return batch.snapshot.prompt.trim();
    }
  }
  return asset?.source !== 'local-preview' && typeof asset?.transcript === 'string' ? asset.transcript.trim() : '';
}

/** Durable projection only. The caller must resolve media URLs separately. */
export function projectCanvasCurrentResult(state) {
  const result = getCanvasCurrentResult(state);
  if (!result) return { asset: null, content: '' };
  return result.type === 'text' ? { asset: null, content: result.content }
    : { asset: { asset_id: result.assetId, asset_type: result.type }, content: '' };
}

/** Validates EVERY retained result before returning deduplicated durable assets.
 * Existing CanvasDocument serialization does not call this yet.
 */
export function collectCanvasResultAssetIds(state) {
  validateCanvasNodeResults(state);
  return [...new Set(state.batches.flatMap((batch) => normalizeCanvasResultBatch(batch).results.map((result) => result.assetId).filter(Boolean)))];
}

/** Newest submission first, stable ties; selecting history never changes order. */
export function getCanvasResultHistory(state) {
  validateCanvasNodeResults(state);
  return state.batches.map(normalizeCanvasResultBatch)
    .sort((a, b) => (b.submittedAt ?? -1) - (a.submittedAt ?? -1));
}
