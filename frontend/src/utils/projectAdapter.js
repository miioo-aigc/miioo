/**
 * @file projectAdapter.js
 * @structure-index
 *
 * 项目列表字段兼容和创建时间排序的纯适配函数。
 */

export function normalizeProject(project) {
  return { ...project, cover: project.cover ?? project.cover_url };
}

export function normalizeProjectList(projects = []) {
  const normalized = (Array.isArray(projects) ? projects : []).map(normalizeProject);
  return [...normalized].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });
}
