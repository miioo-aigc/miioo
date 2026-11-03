/** 项目名称来自项目；画布标题来自画布；资产操作始终使用集合身份。 */
export function groupCanvasLibraryProjects(projects, canvases, collections) {
  const byCanvas = new Map(collections.filter(item => item.kind === 'canvas').map(item => [item.bound_canvas_id, item]));
  const groups = new Map(projects.filter(item => item.project_type === 'canvas').map(project => [project.id, { ...project, canvases: [] }]));
  for (const canvas of canvases) {
    const project = groups.get(canvas.project_id);
    const collection = byCanvas.get(canvas.id);
    if (!project || !collection || canvas.parent_canvas_id || canvas.status === 'archived') continue;
    if (project.canvases.some(item => item.id === collection.id)) continue;
    project.canvases.push({ ...collection, name: canvas.title || collection.name, projectId: project.id });
  }
  return [...groups.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id).localeCompare(String(a.id)));
}
