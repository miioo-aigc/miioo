/**
 * 将 Response 读成 Blob，并在响应体支持流式读取时上报下载进度。
 * progress 为 0-100；响应缺少 Content-Length 时传 null，由 UI 展示不确定进度。
 */
export async function readResponseBlobWithProgress(response, onProgress) {
  if (!response.body || typeof onProgress !== 'function') {
    return response.blob();
  }

  const total = Number(response.headers.get('content-length')) || null;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(total ? received / total : null);
  }

  if (total) onProgress(1);
  return new Blob(chunks, { type: response.headers.get('content-type') || '' });
}
