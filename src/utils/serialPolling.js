/**
 * 串行轮询工具：保证轮询任务串行执行，支持暂停、错误退避
 */
export function createSerialPolling({
  task,
  interval = 2000,
  onResult,
  onError,
  maxConsecutiveErrors = 5,
  errorBackoffMultiplier = 1.5,
  pauseWhenHidden = true,
}) {
  let currentInterval = interval;
  let consecutiveErrors = 0;
  let isRunning = false;
  let isPaused = false;
  let pollTimer = null;

  const handleVisibilityChange = () => {
    if (pauseWhenHidden) {
      if (document.hidden) {
        isPaused = true;
      } else {
        isPaused = false;
        schedulePoll();
      }
    }
  };

  const poll = async () => {
    if (isPaused) { schedulePoll(); return; }
    try {
      const result = await task();
      consecutiveErrors = 0;
      currentInterval = interval;
      onResult?.(result);
    } catch (error) {
      consecutiveErrors++;
      if (onError) onError(error);
      else console.error('[serialPolling] 轮询出错:', error);
      if (consecutiveErrors >= maxConsecutiveErrors) { stop(); return; }
      currentInterval = Math.min(interval * Math.pow(errorBackoffMultiplier, consecutiveErrors), 60000);
    }
    if (isRunning) schedulePoll();
  };

  const schedulePoll = () => {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, currentInterval);
  };

  const start = () => {
    if (isRunning) return;
    isRunning = true;
    consecutiveErrors = 0;
    currentInterval = interval;
    isPaused = pauseWhenHidden && document.hidden;
    if (pauseWhenHidden) document.addEventListener('visibilitychange', handleVisibilityChange);
    schedulePoll();
  };

  const stop = () => {
    isRunning = false;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    if (pauseWhenHidden) document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  return { start, stop, isRunning: () => isRunning };
}
