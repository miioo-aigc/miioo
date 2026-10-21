import { getAuthSessionGeneration } from './request';

export function imageEditSessionCheck() {
  const session = getAuthSessionGeneration();
  return () => {
    if (session !== getAuthSessionGeneration()) {
      throw new DOMException('账号会话已变化，已停止本次图片编辑处理', 'AbortError');
    }
  };
}
