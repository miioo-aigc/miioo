export function accountCreationEditScope(scope, ownerId) {
  if (!scope?.startsWith('creation:')) return scope;
  if (ownerId == null || ownerId === '') return null;
  if (scope.startsWith('creation:owner:')) {
    return creationEditOwner(scope) === String(ownerId) ? scope : null;
  }
  return `creation:owner:${encodeURIComponent(String(ownerId))}:${scope.slice('creation:'.length)}`;
}

export function creationEditOwner(scope) {
  const match = /^creation:owner:([^:]+):.+/.exec(scope || '');
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
