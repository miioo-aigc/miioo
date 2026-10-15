// Each project has its own queue; a failed save must not block later drafts.
export function createProjectSaveQueue() {
  const pending = new Map();
  return (projectId, save) => {
    const previous = pending.get(projectId) || Promise.resolve();
    const result = previous.catch(() => {}).then(save);
    pending.set(projectId, result);
    const clear = () => {
      if (pending.get(projectId) === result) pending.delete(projectId);
    };
    result.then(clear, clear);
    return result;
  };
}

export function applyProjectSave(current, projectId, updates) {
  return current?.id === projectId ? { ...current, ...updates } : current;
}
