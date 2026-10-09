import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { checkModuleGraph } from './lib/check-module-graph.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), 'miioo-vite-cold-'));
let server;

async function findPages(directory) {
  const pages = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) pages.push(...await findPages(path));
    else if (/\.[jt]sx$/.test(item.name)) pages.push(`/${relative(root, path).split('\\').join('/')}`);
  }
  return pages.sort();
}

try {
  const pages = await findPages(resolve(root, 'src/pages'));
  if (!pages.length) throw new Error('未找到页面入口');
  server = await createServer({
    root,
    cacheDir,
    mode: 'development',
    server: { host: '127.0.0.1', port: 5187, strictPort: true, open: false, hmr: false },
  });
  await server.listen();
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  console.log(`冷启动检查：${pages.length} 个页面，独立端口 ${address.port}，全新临时缓存。`);
  const result = await checkModuleGraph(base, ['/src/main.jsx', ...pages]);
  for (const failure of result.failures) {
    console.error(`\n[${failure.phase}] ${failure.message}\n模块: ${failure.url}\n来源: ${failure.importer}`);
  }
  console.log(`检查模块 ${result.checked} 个，失败 ${result.failures.length} 个。`);
  if (result.failures.length) process.exitCode = 1;
} catch (error) {
  console.error('冷启动检查失败：', error);
  process.exitCode = 1;
} finally {
  try {
    await server?.close();
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
}
