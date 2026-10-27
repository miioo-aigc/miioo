import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

// 每个测试实例独占缓存，不能修改正在运行的开发服务或其他测试的缓存。
export async function createTestViteServer(options = {}) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'miioo-vite-test-'));
  try {
    const server = await createServer({ ...options, cacheDir });
    const close = server.close.bind(server);
    server.close = async () => {
      try {
        await close();
      } finally {
        await rm(cacheDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    };
    return server;
  } catch (error) {
    await rm(cacheDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    throw error;
  }
}
