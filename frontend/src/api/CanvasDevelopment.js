/** 开发态画布项目内存适配；不持久化，不替代真实项目接口。 */
export const canvasDevelopmentEnabled = import.meta.env?.DEV === true
  && import.meta.env?.VITE_CANVAS_DEV_MOCK !== 'false';

const documents = new Map();
const PREFIX = 'dev-canvas-';

export function isDevelopmentCanvas(canvasId) {
  return canvasDevelopmentEnabled && typeof canvasId === 'string' && canvasId.startsWith(PREFIX);
}

export function createDevelopmentCanvasProject() {
  if (!canvasDevelopmentEnabled) throw new Error('仅开发环境支持模拟新建画布项目');
  const id = `${PREFIX}${crypto.randomUUID()}`;
  return getDevelopmentCanvas(id);
}

export function getDevelopmentCanvas(canvasId) {
  if (!isDevelopmentCanvas(canvasId)) throw new Error('不是开发态模拟画布');
  // 刷新后保留开发路由可访问性，但恢复为空白草稿，不读取服务器。
  if (!documents.has(canvasId)) {
    const now = new Date().toISOString();
    documents.set(canvasId, {
      id: canvasId,
      project_id: `dev-project-${canvasId.slice(PREFIX.length)}`,
      project_name: '未命名项目',
      title: '画布1',
      revision: 1,
      created_at: now,
      updated_at: now,
    });
  }
  return { ...documents.get(canvasId) };
}

export function listDevelopmentCanvasProjects() {
  if (!canvasDevelopmentEnabled) return [];
  return [...documents.values()].reverse().map((item) => ({ ...item, name: item.project_name }));
}
