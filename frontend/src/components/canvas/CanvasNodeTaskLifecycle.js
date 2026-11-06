import { normalizeCanvasResultBatch } from './CanvasNodeResults.js';

/**
 * 独立运行态登记器，不是后端 task 或 canvas run 协议。
 * start({ canvasId, nodeId, requestId, upstreamNodeIds, snapshot }) 返回冻结身份。
 * registerTaskIds(identity, taskIds) 可重复增量登记；accepted(identity) 才确认受理完成。
 * accept(identity, currentIdentity) 仅在完整身份匹配且生成中时消费一次结果写入许可；
 * 调用方应先校验终态结果，再同步消费许可并写入，不能在两者之间等待。
 * delete(canvasId, nodeIds) 为整批预检；调用方负责展开分组、移除节点和关联连线。
 * inspect(canvasId, nodeId) 提供自身状态及直接依赖锁，所有实际入口须在未来接线。
 * canvasId 应标识画布运行会话；重新打开画布须换会话或新建登记器。
 * requestId 在该登记器内的同画布同节点不可复用；记录保留到登记器被释放，
 * 以接收失败或删除后的晚到编号。不承诺刷新恢复，也不自行判定回调全部结束。
 * cancel({ canvasId, nodeId, requestId, taskIds }) 接收本次新增待取消的编号，
 * 由未来适配层匹配真实任务类型和取消接口；同步抛错和异步拒绝均静默不重试。
 */
const DEPENDENCY_MESSAGE = '操作可能导致下游丢失参考素材，请稍后再试';
const fail = (message) => { throw new Error(message); };
const validId = (value) => typeof value === 'string' && value.trim().length > 0
  && !/^(?:[a-z]+:|[/])/i.test(value.trim());
const checkId = (value) => { if (!validId(value)) fail('任务身份无效'); };
const key = (canvasId, nodeId) => JSON.stringify([canvasId, nodeId]);
const requestKey = ({ canvasId, nodeId, requestId }) => JSON.stringify([canvasId, nodeId, requestId]);

// 仅借用既有纯快照校验/复制能力；空归一化批次不登记、不暴露、不代表任务或结果。
function copyData(value) {
  return normalizeCanvasResultBatch({
    id: 'snapshot-validation', source: 'generation', requestedCount: 1,
    results: [], submittedAt: 0, completedAt: 0, snapshot: value,
  }).snapshot;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function identityOf(input) {
  const value = copyData(input);
  if (!value || Array.isArray(value)) fail('任务身份无效');
  const { canvasId, nodeId, requestId } = value;
  [canvasId, nodeId, requestId].forEach(checkId);
  return freeze({ canvasId, nodeId, requestId });
}

function idList(input) {
  const values = copyData(input);
  if (!Array.isArray(values)) fail('任务编号列表无效');
  values.forEach(checkId);
  return [...new Set(values)];
}

export function createCanvasNodeTaskLifecycle({ cancel = () => {} } = {}) {
  if (typeof cancel !== 'function') fail('取消回调必须是函数');
  const requests = new Map();
  const active = new Map();
  const dependencies = new Map();

  function find(identity) {
    return requests.get(requestKey(identityOf(identity)));
  }

  function release(entry) {
    if (!entry.protected) return;
    entry.protected = false;
    for (const nodeId of entry.upstreamNodeIds) {
      const nodeKey = key(entry.identity.canvasId, nodeId);
      const count = dependencies.get(nodeKey) - 1;
      if (count) dependencies.set(nodeKey, count);
      else dependencies.delete(nodeKey);
    }
  }

  function finish(entry, status) {
    release(entry);
    if (active.get(key(entry.identity.canvasId, entry.identity.nodeId)) === entry) {
      active.delete(key(entry.identity.canvasId, entry.identity.nodeId));
    }
    entry.status = status;
  }

  function cancelKnown(entry) {
    const taskIds = [...entry.taskIds].filter((id) => !entry.cancelled.has(id));
    if (!taskIds.length) return;
    taskIds.forEach((id) => entry.cancelled.add(id));
    const identity = freeze({ ...entry.identity, taskIds });
    try {
      Promise.resolve(cancel(identity)).catch(() => {});
    } catch { /* 删除不可被取消接口失败打断，也不重试。 */ }
  }

  return {
    start(input) {
      const plan = copyData(input);
      const identity = identityOf(plan);
      const upstreamNodeIds = idList(plan.upstreamNodeIds ?? []);
      const nodeKey = key(identity.canvasId, identity.nodeId);
      if (requests.has(requestKey(identity))) fail('本地请求身份不能复用');
      if (active.has(nodeKey)) fail('该节点正在创作，请稍后再试');
      if (dependencies.has(nodeKey)) fail(DEPENDENCY_MESSAGE);
      for (const nodeId of upstreamNodeIds) {
        if (nodeId === identity.nodeId) fail('不允许自身引用');
        if (active.has(key(identity.canvasId, nodeId))) fail('直接上游正在提交或生成');
      }
      const entry = { identity, upstreamNodeIds, snapshot: freeze(plan.snapshot ?? null),
        status: 'submitting', protected: true, taskIds: new Set(), cancelled: new Set() };
      requests.set(requestKey(identity), entry);
      active.set(nodeKey, entry);
      for (const nodeId of upstreamNodeIds) {
        const upstreamKey = key(identity.canvasId, nodeId);
        dependencies.set(upstreamKey, (dependencies.get(upstreamKey) ?? 0) + 1);
      }
      return identity;
    },

    registerTaskIds(identity, input) {
      const entry = find(identity);
      const ids = idList(input);
      if (!entry || entry.status === 'succeeded') return false;
      // 受理完成后仅允许已知编号的重复通知；新增编号说明适配层违反契约。
      if (entry.status === 'running' && ids.some((id) => !entry.taskIds.has(id))) {
        fail('受理完成后不能新增任务编号');
      }
      ids.forEach((id) => entry.taskIds.add(id));
      if (entry.status === 'deleted') cancelKnown(entry);
      return true;
    },

    accepted(identity) {
      const entry = find(identity);
      if (!entry || !['submitting', 'running'].includes(entry.status)) return false;
      if (!entry.taskIds.size) fail('受理完成必须已有真实服务端任务编号');
      release(entry);
      entry.status = 'running';
      return true;
    },

    fail(identity) {
      const entry = find(identity);
      if (!entry || !['submitting', 'running'].includes(entry.status)) return false;
      finish(entry, 'failed');
      return true;
    },

    accept(identity, currentIdentity) {
      const entry = find(identity);
      const current = identityOf(currentIdentity);
      if (!entry || entry.status !== 'running'
        || requestKey(entry.identity) !== requestKey(current)
        || active.get(key(current.canvasId, current.nodeId)) !== entry) return false;
      finish(entry, 'succeeded');
      return true;
    },

    delete(canvasId, input) {
      checkId(canvasId);
      const nodeIds = new Set(idList(input));
      for (const nodeId of nodeIds) {
        if (dependencies.has(key(canvasId, nodeId))) fail(DEPENDENCY_MESSAGE);
      }
      const deleted = [];
      for (const entry of requests.values()) {
        if (entry.identity.canvasId !== canvasId || !nodeIds.has(entry.identity.nodeId)
          || ['succeeded', 'deleted'].includes(entry.status)) continue;
        finish(entry, 'deleted');
        deleted.push(entry);
      }
      // 整批先失效再调用外部回调，回调重入也不能接受组内迟到结果。
      deleted.forEach(cancelKnown);
      return deleted.length;
    },

    inspect(canvasId, nodeId) {
      checkId(canvasId); checkId(nodeId);
      const nodeKey = key(canvasId, nodeId);
      const entry = active.get(nodeKey);
      const dependencyCount = dependencies.get(nodeKey) ?? 0;
      return freeze({
        identity: entry?.identity ?? null, status: entry?.status ?? 'idle',
        snapshot: entry?.snapshot ?? null, taskIds: entry ? [...entry.taskIds] : [],
        dependencyCount, submissionLocked: entry?.status === 'submitting',
        outputLocked: Boolean(entry) || dependencyCount > 0,
        deleteLocked: dependencyCount > 0,
      });
    },
  };
}
