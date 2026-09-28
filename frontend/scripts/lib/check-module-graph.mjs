import { parse } from 'acorn';

function importsOf(source) {
  const imports = [];
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) {
      if (typeof node.source?.value === 'string') imports.push(node.source.value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value?.type) visit(value);
    }
  }
  visit(ast);
  return imports;
}

export async function checkModuleGraph(base, entries, fetchModule = fetch) {
  const pending = entries.map((entry) => ({ url: new URL(entry, base).href, importer: '(入口)' }));
  const seen = new Set();
  const loaded = [];
  const failures = [];

  async function load(item, phase) {
    try {
      const response = await fetchModule(item.url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      if (response.headers.get('content-type')?.includes('text/html')) {
        throw new Error('模块请求意外返回 HTML');
      }
      return importsOf(await response.text());
    } catch (error) {
      failures.push({ ...item, phase, message: error.message });
      return null;
    }
  }

  for (let index = 0; index < pending.length; index++) {
    const item = pending[index];
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    const imports = await load(item, 'discover');
    if (!imports) continue;
    loaded.push(item);
    for (const specifier of imports) {
      if (!specifier.startsWith('/') && !specifier.startsWith('.')) {
        failures.push({ ...item, phase: 'discover', message: `未转换为本地地址的导入: ${specifier}` });
        continue;
      }
      const url = new URL(specifier, item.url);
      if (url.origin !== new URL(base).origin) {
        failures.push({ ...item, phase: 'discover', message: `不支持检查外部模块: ${specifier}` });
        continue;
      }
      pending.push({ url: url.href, importer: item.url });
    }
  }
  // Keep the original versioned URLs: rediscovery must not hide invalidated dependencies.
  for (const item of loaded) await load(item, 'recheck');
  return { checked: seen.size, failures };
}
