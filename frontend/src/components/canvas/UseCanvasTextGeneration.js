/** 同节点持久生成：准备身份先保存，后台任务通过专用接口恢复与取消。 */
import { useCallback, useEffect, useRef } from 'react';
import * as api from '../../api/CanvasTextSubmissions.js';
import { getAuthSessionGeneration } from '../../api/request.js';
import { showGlobalToast } from '../../stores/toastStore';
import { planCanvasTextGeneration } from './CanvasTextGeneration';
import { canvasDescendantIds } from './CanvasNodeActions.js';
import { applyTextHistory, isActiveText, readTextHistory, textEditRequest } from './CanvasDurableText.js';
import { createCanvasTextTask } from './CanvasTextTask.js';

export function useCanvasTextGeneration(nodes, setNodes, canvasId, cancelPendingClicks, bridgeRef) {
  const registry = useRef(new Map());
  const lifetime = useRef(null);
  const getNodes = useCallback(() => bridgeRef.current.getNodes(), [bridgeRef]);
  const patch = useCallback((nodeId, id, update) => setNodes((current) => current.map((node) =>
    node.id === nodeId && node.data.textSubmission?.clientSubmissionId === id
      ? { ...node, data: { ...node.data, ...update(node.data) } } : node), { record: false, origin: 'system' }), [setNodes]);
  useEffect(() => {
    lifetime.current = { canvasId, auth: getAuthSessionGeneration() };
    const entries = registry.current;
    return () => { lifetime.current = null; entries.forEach((task) => task.dispose()); entries.clear(); };
  }, [canvasId]);

  const start = useCallback((nodeId) => {
    const sub = getNodes().find((node) => node.id === nodeId)?.data.textSubmission;
    if (!sub || registry.current.has(sub.clientSubmissionId)) return;
    const owner = lifetime.current, id = sub.clientSubmissionId;
    const current = () => lifetime.current === owner && owner?.canvasId === canvasId && owner.auth === getAuthSessionGeneration();
    const check = () => { if (!current()) throw new DOMException('画布会话已结束', 'AbortError'); };
    const local = () => getNodes().find((node) => node.id === nodeId)?.data.textSubmission;
    const update = (fields) => { check(); patch(nodeId, id, (data) => ({ textSubmission: { ...data.textSubmission, ...fields } })); };
    const persist = async () => {
      check();
      if (!await bridgeRef.current.persist(true)) throw new Error('文本任务尚不能保存，请等待素材上传完成');
      check();
    };
    const history = (targetId, signal) => readTextHistory((cursor) => api.apiGetCanvasTextBatches(canvasId, targetId, cursor, signal));
    const syncNode = async (targetId, signal) => {
      check();
      const target = getNodes().find((node) => node.id === targetId);
      if (!target || target.type !== 'text') throw new Error('文本来源已不存在');
      let page = await history(targetId, signal);
      const ids = local().operations[targetId];
      if (page.output_version === 0) {
        await bridgeRef.current.mutate(async (accept) => {
          try {
            const result = await api.apiMigrateCanvasText(canvasId, targetId, { operation_id: ids.migrateId, expected_version: 0 }, signal);
            check(); accept(result.revision);
          } catch (error) { if (error.code !== 'CANVAS_NODE_ALREADY_MIGRATED') throw error; }
        });
        page = await history(targetId, signal);
      }
      const selected = page.items.flatMap((batch) => batch.results).find((result) => result.id === page.current_result_id);
      const alreadyApplied = page.items.some((batch) => batch.id === ids.batchId);
      if (!alreadyApplied && (selected?.content ?? '') !== (target.data.content ?? '')) {
        const body = ids.editBody || textEditRequest(target.data.content ?? '', page.output_version, ids);
        update({ operations: { ...local().operations, [targetId]: { ...ids, editBody: body } } });
        await persist();
        await bridgeRef.current.mutate(async (accept) => {
          const result = await api.apiAppendCanvasTextBatch(canvasId, targetId, body, signal);
          check(); accept(result.revision);
        });
        page = await history(targetId, signal);
      }
      check();
      setNodes((items) => items.map((node) => node.id === targetId && node.data.content === target.data.content
        ? applyTextHistory(node, page) : node), { record: false, origin: 'system' });
      return page.output_version;
    };
    const task = createCanvasTextTask({ canvasId, nodeId, id, isCurrent: current, getSubmission: local,
      api: { get: api.apiGetCanvasTextSubmission, post: api.apiSubmitCanvasText, cancel: api.apiCancelCanvasTextSubmission },
      prepare: async (signal) => {
        const operations = { ...local().operations };
        for (const targetId of [...sub.sourceIds, nodeId]) operations[targetId] ||= {
          migrateId: crypto.randomUUID(), operationId: crypto.randomUUID(), batchId: crypto.randomUUID(), resultId: crypto.randomUUID(),
        };
        update({ operations });
        await persist();
        for (const sourceId of sub.sourceIds) await syncNode(sourceId, signal);
        const expected = await syncNode(nodeId, signal);
        update({ request: { client_submission_id: id, expected_version: expected, prompt: sub.prompt, model: sub.model } });
        await persist();
      },
      active: async (response) => {
        check();
        patch(nodeId, id, (data) => ({ generating: true, submissionLocked: false, executionSourceIds: undefined,
          generationRequestId: id, generationTaskIds: response.task_id ? [response.task_id] : [],
          textSubmission: { ...data.textSubmission, status: response.status, taskId: response.task_id } }));
      },
      finish: async (response, signal) => {
        check();
        if (response.status === 'completed') {
          await bridgeRef.current.mutate(async (accept) => {
            const page = await history(nodeId, signal);
            check();
            const batch = page.items.find((item) => item.source === 'generation' && item.task_ids.includes(response.task_id));
            const result = batch?.results.find((item) => item.index === 0 && item.type === 'text');
            if (!result) throw new Error('已完成的任务正在同步正文历史');
            const latest = getNodes().find((node) => node.id === nodeId);
            if (!latest) return;
            const selected = page.items.flatMap((item) => item.results).find((item) => item.id === page.current_result_id);
            if (latest.data.content !== sub.originalContent && latest.data.content !== selected?.content) {
              throw new Error('正文已改变，请保留编辑并重新同步历史');
            }
            setNodes((items) => items.map((node) => node.id === nodeId ? applyTextHistory(node, page) : node), { record: false, origin: 'system' });
            accept(page.revision);
            if (page.current_result_id !== result.id) showGlobalToast('生成结果已保存在历史，保留当前定稿', 'info');
          });
        } else {
          await bridgeRef.current.mutate(async (accept) => {
            const page = await history(nodeId, signal);
            check();
            // 取消/失败也可能推进服务端 revision；先读取可信正文再继续保存。
            const latest = getNodes().find((node) => node.id === nodeId);
            if (latest?.data.content === sub.originalContent && page.items.length) {
              setNodes((items) => items.map((node) => node.id === nodeId ? applyTextHistory(node, page) : node), { record: false, origin: 'system' });
            }
            accept(page.revision);
          });
        }
        const message = response.status === 'outcome_unknown' ? '生成结果暂无法确认，可能已产生费用；请核实后再手动重试'
          : response.status === 'failed' ? response.failure?.message || '文本生成失败，请检查模型后重试' : '';
        patch(nodeId, id, (data) => ({ generating: false, generationPending: false, submissionLocked: false,
          executionSourceIds: undefined, generationTaskIds: undefined, generationRequestId: undefined, generationError: message,
          textSubmission: { ...data.textSubmission, status: response.status } }));
        if (message) showGlobalToast(message, 'warning');
        await persist();
        registry.current.delete(id);
      },
      report: async (error, definitive, failures) => {
        patch(nodeId, id, () => ({ generationError: error.message }));
        if (definitive) {
          if ([422, 503].includes(error.status)) {
            patch(nodeId, id, (data) => ({ generating: false, submissionLocked: false, executionSourceIds: undefined,
              generationTaskIds: undefined, generationRequestId: undefined,
              textSubmission: { ...data.textSubmission, status: 'failed' } }));
            registry.current.delete(id);
            try { await persist(); } catch { showGlobalToast('任务失败状态尚未保存，请重试保存', 'warning'); }
          }
          showGlobalToast(error.message, 'error');
        }
        else if (failures === 1 || failures === 5) showGlobalToast('文本任务连接暂不可用，正在后台恢复，请勿重复提交', 'warning');
      },
    });
    registry.current.set(id, task);
    task.start();
  }, [bridgeRef, canvasId, getNodes, patch, setNodes]);

  useEffect(() => {
    if (!bridgeRef.current?.ready) return;
    nodes.filter(isActiveText).forEach((node) => {
      const sub = node.data.textSubmission;
      if (!node.data.generating) patch(node.id, sub.clientSubmissionId, () => ({ generating: true,
        submissionLocked: sub.status === 'preparing', generationRequestId: sub.clientSubmissionId,
        generationTaskIds: sub.taskId ? [sub.taskId] : [], executionSourceIds: sub.sourceIds }));
      start(node.id);
    });
  }, [nodes, start, patch, bridgeRef]);

  const generate = useCallback(async ({ nodeId, prompt, model }) => {
    try {
      if (!bridgeRef.current?.ready) throw new Error('画布尚未加载完成');
      if (getNodes().some(isActiveText)) throw new Error('请等待当前文本任务完成，或先取消再生成');
      const plan = planCanvasTextGeneration(getNodes(), nodeId, prompt, model);
      cancelPendingClicks();
      setNodes((items) => items.map((node) => node.id === nodeId ? { ...node, data: { ...node.data,
        generating: true, submissionLocked: true, generationRequestId: plan.requestId, generationError: '',
        executionSourceIds: plan.sources.map((source) => source.id), creationPanelOpen: false,
        textSubmission: { clientSubmissionId: plan.requestId, status: 'preparing', prompt: prompt || '', model,
          sourceIds: plan.sources.map((source) => source.id), originalContent: plan.originalContent },
      } } : node), { record: false, origin: 'system' });
      start(nodeId);
    } catch (error) { showGlobalToast(error.message, 'error'); }
  }, [bridgeRef, cancelPendingClicks, getNodes, setNodes, start]);

  const cancel = useCallback(async (ids) => {
    const all = getNodes();
    const targets = ids ? canvasDescendantIds(all, ids) : new Set(all.map((node) => node.id));
    for (const node of all.filter((item) => targets.has(item.id) && isActiveText(item))) {
      start(node.id);
      await registry.current.get(node.data.textSubmission.clientSubmissionId)?.cancel();
    }
  }, [getNodes, start]);
  return { generate, cancel };
}
