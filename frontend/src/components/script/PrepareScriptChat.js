// 发送前确认服务端旧对话已结束；只停止当前任务，不自动重发生成请求。
export function hasActiveScriptTurn(workspace) {
  const turn = workspace?.active_turn;
  if (turn && ['completed', 'succeeded', 'failed', 'cancelled', 'canceled', 'interrupted'].includes(turn.status)) return false;
  return Boolean(workspace?.script?.active_turn_id || (turn && Object.keys(turn).length));
}

export async function prepareScriptChat({ readWorkspace, interrupt, isCurrent }) {
  const checkCurrent = () => {
    if (!isCurrent()) throw new DOMException('发送已取消', 'AbortError');
  };
  checkCurrent();
  const workspace = await readWorkspace();
  checkCurrent();
  if (!hasActiveScriptTurn(workspace)) return;
  await interrupt();
  checkCurrent();
  const latest = await readWorkspace();
  checkCurrent();
  if (hasActiveScriptTurn(latest)) throw new Error('旧剧本任务尚未停止，新要求已保留，请稍后重试');
}
