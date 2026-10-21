// 通知只用于唤醒核验；删除事实由调用方读取持久记录确认。
export function createImageEditRemovalChannel({ verify, reconcile, onError }, environment = globalThis) {
  if (!environment.window || !environment.document) return { notify() {} };
  let channel;
  let checking = false;
  const report = (work) => Promise.resolve().then(work).catch(onError);
  const foreground = () => {
    if (environment.document.visibilityState === 'hidden' || checking) return;
    checking = true;
    report(reconcile).finally(() => { checking = false; });
  };
  try {
    channel = new environment.BroadcastChannel('miioo-image-edit-removals');
    channel.onmessage = ({ data }) => {
      if (data?.type !== 'removed' || typeof data.id !== 'string' || typeof data.scope !== 'string') return;
      report(() => verify(data.scope, data.id));
    };
  } catch { /* 通知不可用时，回到前台核验仍然有效。 */ }
  environment.window.addEventListener('focus', foreground);
  environment.document.addEventListener('visibilitychange', foreground);
  return {
    notify(scope, id) {
      try { channel?.postMessage({ type: 'removed', scope, id }); } catch { /* 不影响已成功落盘的移除。 */ }
    },
    dispose() {
      channel?.close();
      environment.window.removeEventListener('focus', foreground);
      environment.document.removeEventListener('visibilitychange', foreground);
    },
  };
}
