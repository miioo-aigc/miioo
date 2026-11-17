/** 项目名称来自项目；画布标题来自画布；资产操作始终使用集合身份。 */
export function groupCanvasLibraryProjects(projects, canvases, collections) {
  const byCanvas = new Map(collections.filter(item => item.kind === 'canvas').map(item => [item.bound_canvas_id, item]));
  const groups = new Map(projects.filter(item => item.project_type === 'canvas').map(project => [project.id, { ...project, canvases: [] }]));
  for (const canvas of canvases) {
    const project = groups.get(canvas.project_id);
    const collection = byCanvas.get(canvas.id);
    if (!project || !collection || canvas.parent_canvas_id || canvas.status === 'archived') continue;
    if (project.canvases.some(item => item.id === collection.id)) continue;
    project.canvases.push({ ...collection, name: canvas.title || collection.name, projectId: project.id, canvasCreatedAt: canvas.created_at });
  }
  return [...groups.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id).localeCompare(String(a.id)));
}

// 删除当前项目时原子切换到下一可用项目的首个画布；删除其他项目只移除列表项。
export function removeCanvasLibraryProject(state, projectId) {
  const items = state.items.filter((item) => item.id !== projectId);
  if (state.selectedId !== projectId) return { ...state, items };
  const project = items[0];
  return {
    ...state,
    items,
    selectedId: project?.id || null,
    collectionId: project?.canvases[0]?.id || null,
  };
}

// 集合可能由删除预检或其他入口移除；一次性更新树和当前选择，避免旧目录继续挂载。
export function removeCanvasLibraryCollection(state, collectionId) {
  let removedProjectIndex = -1;
  let removedCollectionIndex = -1;
  const items = state.items.map((project, projectIndex) => {
    const collectionIndex = project.canvases.findIndex((canvas) => canvas.id === collectionId);
    if (collectionIndex < 0) return project;
    removedProjectIndex = projectIndex;
    removedCollectionIndex = collectionIndex;
    return {
      ...project,
      canvases: project.canvases.filter((canvas) => canvas.id !== collectionId),
    };
  });
  if (removedProjectIndex < 0) return state;

  const affectedProject = items[removedProjectIndex];
  const selectedCollectionRemoved = state.collectionId === collectionId;
  if (!affectedProject.canvases.length) items.splice(removedProjectIndex, 1);
  // 删除后台同步掉的非当前集合时，仅更新侧栏树；当前内容仍有效，不能跳到同项目其他画布。
  if (!selectedCollectionRemoved) return { ...state, items };

  if (affectedProject.canvases.length) {
    const nextCollection = affectedProject.canvases[
      Math.min(removedCollectionIndex, affectedProject.canvases.length - 1)
    ];
    return {
      ...state,
      items,
      selectedId: affectedProject.id,
      collectionId: nextCollection.id,
    };
  }

  const fallbackProject = items.find((project) => project.canvases.length);
  return {
    ...state,
    items,
    selectedId: fallbackProject?.id || null,
    collectionId: fallbackProject?.canvases[0]?.id || null,
  };
}
