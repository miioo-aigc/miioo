/** 窗口通知不携带令牌、绑定凭证或任意后端文案。 */
export function createWechatCallbackNotice(result) {
  if (!result?.session_id || !['confirmed', 'need_bind_mobile', 'scanned'].includes(result.status)) return null;
  return { type: 'wechat-callback-complete', payload: { session_id: result.session_id, status: result.status } };
}
export function isCurrentWechatNotice(event, { origin, source, sessionId }) {
  return Boolean(source && sessionId && event.origin === origin && event.source === source
    && event.data?.type === 'wechat-callback-complete'
    && event.data.payload?.session_id === sessionId
    && ['confirmed', 'need_bind_mobile', 'scanned'].includes(event.data.payload?.status));
}
