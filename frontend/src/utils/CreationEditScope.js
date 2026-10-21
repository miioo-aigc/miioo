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

export function imageEditOwner(scope) {
  const match = /^(creation|subject|storyboard):owner:([^:]+):.+/.exec(scope || '');
  if (!match) return null;
  try { return decodeURIComponent(match[2]); } catch { return null; }
}

export function accountImageEditScope(scope, ownerId) {
  if (!/^(creation|subject|storyboard):/.test(scope || '') || ownerId == null || ownerId === '') return null;
  const [kind, ...parts] = scope.split(':');
  if (parts[0] === 'owner') return imageEditOwner(scope) === String(ownerId) ? scope : null;
  return `${kind}:owner:${encodeURIComponent(String(ownerId))}:${parts.join(':')}`;
}

export function imageEditBusinessScope(scope) {
  if (!imageEditOwner(scope)) return scope;
  const [kind, , , ...parts] = scope.split(':');
  return `${kind}:${parts.join(':')}`;
}
