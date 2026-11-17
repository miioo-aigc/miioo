const PERMANENT_SAVE_FAILURE_STATUSES = new Set([400, 403, 404, 409, 410, 422]);

/** 永久失败重试同一请求体没有恢复价值；网络、鉴权和临时服务错误仍需保留原请求。 */
export function isPermanentCanvasSaveFailure(error) {
  const code = error?.code ?? error?.detail?.code;
  return code === 'ASSET_UNAVAILABLE'
    || PERMANENT_SAVE_FAILURE_STATUSES.has(Number(error?.status));
}

/** 失败后先重放原请求，确认响应后才提交后续编辑，避免网络丢包造成重复保存。 */
export function createCanvasSaveSession(update, createId = () => crypto.randomUUID()) {
  let pending = null;
  let revision = null;
  let tail = Promise.resolve();
  const attempt = async (canvasId, body) => {
    try {
      return await update(canvasId, body);
    } catch (error) {
      if (isPermanentCanvasSaveFailure(error)) pending = null;
      throw error;
    }
  };
  return {
    // 文本历史写入与画布 PATCH 共用队列；失败的 PATCH 必须先确认，不能跳过。
    mutate(action) {
      const operation = tail.then(async () => {
        if (pending) throw new Error('画布保存尚未确认，请先重试保存');
        return action((next) => {
          if (Number.isInteger(next)) revision = Math.max(revision ?? 0, next);
        });
      });
      tail = operation.catch(() => {});
      return operation;
    },
    save(canvasId, baseRevision, document) {
      const operation = tail.then(async () => {
        const content = JSON.stringify(document);
        if (pending) {
          if (pending.canvasId !== canvasId) throw new Error('存在另一画布未确认的保存请求');
          const recovered = await attempt(canvasId, pending.body);
          if (!Number.isInteger(recovered?.revision)) throw new Error('保存响应缺少画布版本');
          revision = recovered.revision;
          const same = pending.content === content;
          pending = null;
          if (same) return recovered;
        }
        pending = { canvasId, content, body: { baseRevision: Math.max(baseRevision, revision ?? baseRevision), document,
          clientSaveId: createId(), clientSavedAt: new Date().toISOString() } };
        const result = await attempt(canvasId, pending.body);
        if (!Number.isInteger(result?.revision)) throw new Error('保存响应缺少画布版本');
        revision = result.revision;
        pending = null;
        return result;
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
}
