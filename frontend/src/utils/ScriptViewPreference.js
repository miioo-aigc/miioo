const PREFIX = 'miioo:script-view:';

export function rememberScriptView(projectId, outline, storage = globalThis.localStorage) {
  if (!projectId) return;
  try { storage?.setItem(PREFIX + projectId, outline ? 'outline' : 'dialogue'); }
  catch { /* 无法保存偏好不影响页面切换。 */ }
}

export function restoreScriptView(projectId, hasOutline, storage = globalThis.localStorage) {
  if (!hasOutline) return false;
  try {
    return storage?.getItem(PREFIX + projectId) !== 'dialogue';
  } catch { return true; }
}
