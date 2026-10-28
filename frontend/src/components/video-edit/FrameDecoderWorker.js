import { ALL_FORMATS, Input, EncodedPacketSink, VideoSampleSink } from 'mediabunny';
import { orderedFrameTimes } from './FrameIndex';
import { createFrameMediaSource } from './FrameMediaSource';
import { toVideoMediaUrl } from '../../utils/VideoMediaUrl';

let input;
let sink;
let times = [];
let canvas;
let selected = -1;
let pending = null;
let running = false;
let thumbnails = [];
let previewSourceUrl;

function fail(message, id) {
  const localized = /^[\u4e00-\u9fff]/u.test(message || '') ? message : '视频处理失败，请检查视频格式、网络和跨域权限后重试';
  self.postMessage({ type: 'error', message: localized, id });
}

async function open(url, baseUrl) {
  if (!url || typeof url !== 'string') throw new Error('未找到可用的视频地址');
  // Workers have no window; the decoder's full-response fallback requires an absolute URL.
  const sourceUrl = new URL(toVideoMediaUrl(url), baseUrl).href;
  previewSourceUrl = sourceUrl;
  if (!self.VideoDecoder || !self.OffscreenCanvas) {
    throw new Error('当前浏览器不支持逐帧解码，请使用新版电脑浏览器');
  }
  const source = await createFrameMediaSource(sourceUrl, () => fail('视频读取失败，请检查网络后重试'));
  input = new Input({ formats: ALL_FORMATS, source });
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
    while (pending || thumbnails.length) {
      const request = pending || thumbnails.shift();
      pending = null;
      let sample;
      try {
        sample = await sink.getSample(times[request.index]);
        if (!sample) throw new Error('无法解码选中的画面');
        if (pending) continue;
        if (request.type === 'thumbnail') {
          const scale = Math.min(1, 240 / sample.displayWidth, 120 / sample.displayHeight);
          const small = new OffscreenCanvas(Math.max(1, Math.round(sample.displayWidth * scale)), Math.max(1, Math.round(sample.displayHeight * scale)));
          sample.draw(small.getContext('2d'), 0, 0, small.width, small.height);
          const blob = await small.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
          self.postMessage({ type: 'thumbnail', index: request.index, blob });
          continue;
        }
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
        if (request.type === 'thumbnail') self.postMessage({ type: 'thumbnail', index: request.index, error: true });
        else fail(error.message || '画面解码失败，请重试', request.id);
      } finally {
        sample?.close();
      }
    }
  } finally {
    running = false;
  }
}

async function exportOriginal(data) {
  const url = new URL(toVideoMediaUrl(data.originalUrl), data.baseUrl).href;
  if (url === previewSourceUrl) return canvas.convertToBlob({ type: 'image/png' });
  let originalInput;
  let sample;
  try {
    const source = await createFrameMediaSource(url);
    originalInput = new Input({ formats: ALL_FORMATS, source });
    const track = await originalInput.getPrimaryVideoTrack();
    if (!track || !await track.canDecode()) throw new Error('当前浏览器无法解码原视频格式');
    sample = await new VideoSampleSink(track).getSample(times[data.index]);
    if (!sample) throw new Error('原视频中未找到对应时间的画面');
    const originalCanvas = new OffscreenCanvas(sample.displayWidth, sample.displayHeight);
    const context = originalCanvas.getContext('2d');
    if (!context) throw new Error('无法创建原画图片画布');
    sample.draw(context, 0, 0);
    return await originalCanvas.convertToBlob({ type: 'image/png' });
  } finally {
    sample?.close();
    originalInput?.dispose();
  }
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'open') await open(data.url, data.baseUrl);
    if (data.type === 'seek' && sink) {
      pending = data;
      void drain();
    }
    if (data.type === 'thumbnails' && sink) {
      thumbnails = data.indices.filter(index => Number.isInteger(index) && index >= 0 && index < times.length).map(index => ({ type: 'thumbnail', index }));
      void drain();
    }
    if (data.type === 'export') {
      if (!canvas || pending || data.index !== selected) throw new Error('画面尚未就绪，请稍后下载');
      if (!data.originalUrl) throw new Error('未找到原视频地址，无法下载原画图片');
      const blob = await exportOriginal(data);
      self.postMessage({ type: 'export', blob, index: selected, timestamp: times[data.index], purpose: data.purpose || 'download' });
    }
  } catch (error) {
    if (data.type === 'export') {
      self.postMessage({ type: 'export-error', message: /^[\u4e00-\u9fff]/u.test(error.message || '') ? error.message : '原视频提帧失败，请重试' });
    } else fail(error.message || '视频读取失败，请检查视频地址和跨域权限', data.id);
  }
};
