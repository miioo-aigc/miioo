// Only a successful list read can consume the initial route; failures leave it pending.
export function createProjectRouteRestore(route, storage, session) {
  const key = route.key !== 'home' ? route.key : storage.getItem('miioo_active_key');
  const projectId = route.projectId
    || (route.key === 'home' ? storage.getItem('miioo_active_project_id') : null);
  let pending = key === 'project' && projectId
    ? { projectId, step: route.projectId ? route.step : null, session }
    : null;
  return {
    cancel() { pending = null; },
    consume(projects, currentSession) {
      const target = pending;
      if (!target) return null;
      pending = null;
      if (target.session !== currentSession) return null;
      return { ...target, exists: projects.some((project) => project.id === target.projectId) };
    },
  };
}
