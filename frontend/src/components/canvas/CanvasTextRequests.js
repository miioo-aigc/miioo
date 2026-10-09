/** 独立结果任务登记；素材使用发送快照，删除素材不取消其他结果任务。 */
export function createCanvasTextRequests() {
  const pending = new Map();
  return {
    get size() { return pending.size; },
    start(plan) {
      if (pending.size >= 5) throw new Error('最大请求数为5，请稍后再试。');
      if ([...pending.values()].some((entry) => entry.plan.resultId === plan.resultId)) throw new Error('该节点正在创作，请稍后再试。');
      const controller = new AbortController();
      pending.set(plan.requestId, { plan, controller });
      return controller;
    },
    finish: (requestId) => pending.delete(requestId),
    reconcile(nodes) {
      for (const [id, { plan, controller }] of pending) {
        const result = nodes.find((node) => node.id === plan.resultId);
        if (result?.data.generationRequestId !== id) {
          controller.abort();
          pending.delete(id);
        }
      }
    },
    abortAll() {
      pending.forEach(({ controller }) => controller.abort());
      pending.clear();
    },
  };
}
