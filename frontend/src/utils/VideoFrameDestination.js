export function videoFrameDestination(pathname) {
  const path = pathname.replace(/\/+$/, '');
  if (path === '/workspace/create') return '/workspace/create?tab=image';
  if (path === '/workspace/assets') return '/workspace/assets?module=creative&tab=image';
  return null;
}

export function openVideoFrameDestination(href) {
  if (!['/workspace/create?tab=image', '/workspace/assets?module=creative&tab=image'].includes(href)) return;
  window.history.pushState({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
