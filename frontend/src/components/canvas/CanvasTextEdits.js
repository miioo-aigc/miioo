/** 将已迁移文本的本地编辑写入服务端历史；网络重试复用原操作身份。 */
import { applyTextHistory, readTextHistory, textEditRequest } from './CanvasDurableText.js';

export async function syncCanvasTextEdits({ canvasId, nodes, api, operations, accept, check, apply }) {
  for (const node of nodes) {
    if (node.type !== 'text' || !(node.data.outputVersion > 0)) continue;
    check();
    const history = () => readTextHistory(cursor => api.apiGetCanvasTextBatches(canvasId, node.id, cursor));
    let page = await history();
    check();
    const selected = page.items.flatMap(batch => batch.results).find(result => result.id === page.current_result_id);
    const localId = node.data.nodeResults?.currentResultId;
    if (selected?.content === node.data.content && page.current_result_id === localId) continue;
    let operation = operations.get(node.id);
    const applied = operation && page.items.some(batch => batch.id === operation.body.batch_id);
    if (applied) {
      if (page.current_result_id !== operation.body.results[0].id) throw Object.assign(new Error('文本结果已被更新，已保留本地编辑，请备份后重新读取'), { status: 409, code: 'CANVAS_NODE_RESULT_CONFLICT' });
      accept(page.revision);
      operations.delete(node.id);
      if (operation.content === node.data.content && operation.resultId === localId) {
        apply(node, applyTextHistory(node, page));
        continue;
      }
      // 旧请求已完成，新草稿沿用刚确认的节点版本。
    } else if (page.output_version !== node.data.outputVersion) {
      throw Object.assign(new Error('文本结果已在服务端更改，已保留本地编辑，请备份后重新读取'), { status: 409, code: 'CANVAS_NODE_RESULT_CONFLICT' });
    }
    if (!operation || applied) {
      const ids = { operationId: crypto.randomUUID(), batchId: crypto.randomUUID(), resultId: crypto.randomUUID() };
      operation = { content: node.data.content, resultId: localId, body: textEditRequest(node.data.content ?? '', page.output_version, ids) };
      operations.set(node.id, operation);
    }
    try {
      const result = await api.apiAppendCanvasTextBatch(canvasId, node.id, operation.body);
      check();
      if (!Number.isInteger(result?.revision)) throw new Error('文本编辑响应缺少画布版本');
      accept(result.revision);
    } catch (error) {
      if (error.status && error.status < 500) operations.delete(node.id);
      throw error;
    }
    check();
    page = await history();
    check();
    if (!page.items.some(batch => batch.id === operation.body.batch_id)) throw new Error('文本编辑结果尚未确认，请重试');
    if (page.current_result_id !== operation.body.results[0].id) throw Object.assign(new Error('文本结果已被更新，已保留本地编辑，请备份后重新读取'), {status:409,code:'CANVAS_NODE_RESULT_CONFLICT'});
    operations.delete(node.id);
    if (operation.content !== node.data.content || operation.resultId !== localId) throw new Error('先前文本编辑已确认，请重试保存最新草稿');
    apply(node, applyTextHistory(node, page));
  }
}
