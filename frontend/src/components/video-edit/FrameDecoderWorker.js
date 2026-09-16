import { ALL_FORMATS, Input, UrlSource, EncodedPacketSink, VideoSampleSink } from 'mediabunny';
import { orderedFrameTimes } from './FrameIndex';

let input;
let sink;
let times = [];
let canvas;
let selected = -1;
let pending = null;
let running = false;

function fail(message, id) {
  const localized = /^[\u4e00-\u9fff]/u.test(message || '') ? message : '视频处理失败，请检查视频格式、网络和跨域权限后重试';
  self.postMessage({ type: 'error', message: localized, id });
}

async function open(url, baseUrl) {
  if (!url || typeof url !== 'string') throw new Error('未找到可用的视频地址');
  // Workers have no window; the decoder's full-response fallback requires an absolute URL.
  const sourceUrl = new URL(url, baseUrl).href;
  if (!self.VideoDecoder || !self.OffscreenCanvas) {
    throw new Error('当前浏览器不支持逐帧解码，请使用新版电脑浏览器');
  }
  input = new Input({ formats: ALL_FORMATS, source: new UrlSource(sourceUrl, {
    maxCacheSize: 32 * 1024 * 1024,
    parallelism: 1,
    getRetryDelay: (attempt) => attempt < 2 ? 1 : null,
    handleUnhandledError: () => fail('视频读取失败，请检查网络后重试'),
  }) });
  const track = await input.getPrimaryVideoTrack();
  if (!track || !await track.canDecode()) throw new Error('当前浏览器无法解码此视频格式');
  const packets = new EncodedPacketSink(track);
  const metadata = [];
  // Only inspect packet metadata; do not decode the entire video or retain packet payloads.
  for await (const packet of packets.packets(undefined, undefined, { metadataOnly: true })) {
    metadata.push({ timestamp: packet.timestamp });
    if (metadata.length > 18000) throw new Error('视频帧数过多，暂不支持选帧');
  }
  times = orderedFrameTimes(metadata);
  if (!times.length) throw new Error('视频中没有可读取的画面');
  sink = new VideoSampleSink(track);
  self.postMessage({ type: 'ready', times });
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (pending) {
      const request = pending;
      pending = null;
      let sample;
      try {
        sample = await sink.getSample(times[request.index]);
        if (!sample) throw new Error('无法解码选中的画面');
        if (pending) continue;
        canvas ??= new OffscreenCanvas(1, 1);
        canvas.width = sample.displayWidth;
        canvas.height = sample.displayHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('无法创建图片画布');
        sample.draw(context, 0, 0);
        selected = request.index;
        // Transfer a small preview; keep only one original-resolution canvas for export.
        const scale = Math.min(1, 1200 / canvas.width, 600 / canvas.height);
        const bitmap = await createImageBitmap(canvas, { resizeWidth: Math.max(1, Math.round(canvas.width * scale)), resizeHeight: Math.max(1, Math.round(canvas.height * scale)) });
        self.postMessage({ type: 'frame', id: request.id, index: selected, width: canvas.width, height: canvas.height, bitmap }, [bitmap]);
      } catch (error) {
        fail(error.message || '画面解码失败，请重试', request.id);
      } finally {
        sample?.close();
      }
    }
  } finally {
    running = false;
  }
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'open') await open(data.url, data.baseUrl);
    if (data.type === 'seek' && sink) {
      pending = data;
      void drain();
    }
    if (data.type === 'export') {
      if (!canvas || running || pending || data.index !== selected) throw new Error('画面尚未就绪，请稍后下载');
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      self.postMessage({ type: 'export', blob, index: selected, purpose: data.purpose || 'download' });
    }
  } catch (error) {
    fail(error.message || '视频读取失败，请检查视频地址和跨域权限', data.id);
  }
};
