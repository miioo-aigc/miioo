import { BlobSource, UrlSource } from 'mediabunny';

const MAX_COMPLETE_BYTES = 128 * 1024 * 1024;
const TOO_LARGE = '视频服务不支持分段读取，且视频超过128兆字节，请使用较小的视频或联系管理员开启分段读取';

export async function createFrameMediaSource(url, onError, fetchMedia = fetch) {
  const response = await fetchMedia(url, { headers: { Range: 'bytes=0-0' } });
  if (response.status === 206) {
    await response.body?.cancel();
    return new UrlSource(url, {
      maxCacheSize: 32 * 1024 * 1024,
      parallelism: 1,
      getRetryDelay: (attempt) => attempt < 2 ? 1 : null,
      handleUnhandledError: onError,
    });
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`视频读取失败，服务器返回状态码${response.status}`);
  }
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel();
    throw new Error('视频服务器未返回有效的视频内容');
  }
  const contentType = response.headers.get('Content-Type') || '';
  if (/text\/html|application\/json/i.test(contentType)) {
    await response.body.cancel();
    throw new Error('视频地址返回了网页或接口信息，请检查原视频地址和访问权限');
  }
  if (Number(response.headers.get('Content-Length')) > MAX_COMPLETE_BYTES) {
    await response.body.cancel();
    throw new Error(TOO_LARGE);
  }

  // 无分段能力时保留完整文件，避免建立帧索引后回读已被淘汰的数据。
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_COMPLETE_BYTES) {
        await reader.cancel();
        throw new Error(TOO_LARGE);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error('视频文件为空，请检查原视频地址');
  return new BlobSource(new Blob(chunks, { type: contentType }));
}
