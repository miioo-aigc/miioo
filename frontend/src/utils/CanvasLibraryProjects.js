/** 集合为事实来源；缺失项目或画布元数据不隐藏集合。 */
export function groupCanvasLibraryProjects(projects, canvases, collections) {
  const canvasById = new Map(canvases.map(item => [item.id, item]));
  const groups = new Map(projects.filter(item => item.project_type === 'canvas').map(project => [project.id, { ...project, projectId: project.id, canvases: [] }]));
  const seen = new Set();
  for (const collection of collections) {
    if (collection.kind !== 'canvas' || seen.has(collection.id)) continue;
    seen.add(collection.id);
    const canvas = canvasById.get(collection.bound_canvas_id);
    const projectId = collection.source_project_id ?? canvas?.project_id ?? null;
    const key = projectId || ('standalone:' + collection.id);
    if (!groups.has(key)) groups.set(key, { id: key, projectId, metadataMissing: true, name: collection.name, canvases: [] });
    groups.get(key).canvases.push({ ...collection, projectId,
      displayName: collection.bound_canvas_id ? collection.name : '项目共享资产', canvasCreatedAt: canvas?.created_at });
  }
  return [...groups.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id).localeCompare(String(a.id)));
}

// 删除当前项目时原子切换到下一可用项目的首个画布；删除其他项目只移除列表项。
export function removeCanvasLibraryProject(state, projectId) {
  const items = state.items.filter((item) => item.id !== projectId);
  if (state.selectedId !== projectId) return { ...state, items };
  const project = items.find(item => item.canvases.length) || items[0];
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
