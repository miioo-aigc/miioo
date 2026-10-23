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
  const projects = new Map();
  for (const item of documents.values()) {
    if (!projects.has(item.project_id)) projects.set(item.project_id, { ...item, name: item.project_name });
  }
  return [...projects.values()].reverse();
}

export function listDevelopmentCanvases(projectId) {
  return [...documents.values()].filter((item) => item.project_id === projectId).map((item) => ({ ...item }));
}

export function createDevelopmentCanvas({ projectId, title }) {
  const item = createDevelopmentCanvasProject();
  const sibling = listDevelopmentCanvases(projectId)[0];
  const next = { ...item, project_id: projectId, project_name: sibling?.project_name || item.project_name, title };
  documents.set(item.id, next);
  return { ...next };
}

export function updateDevelopmentCanvas(id, { baseRevision, title, document }) {
  const current = getDevelopmentCanvas(id);
  if (current.revision !== baseRevision) throw new Error('画布已更新，请刷新后重试');
  const next = { ...current, ...(title !== undefined ? { title } : {}),
    ...(document !== undefined ? { document } : {}), revision: current.revision + 1, updated_at: new Date().toISOString() };
  documents.set(id, next);
  return { ...next };
}
