/**
 * Seedance 素材上传规则。
 * 浏览器可以可靠读取图片尺寸、视频时长和视频尺寸；视频源文件帧率以及 HEIC 尺寸
 * 在常见浏览器中没有稳定的原生读取能力，交由服务端审核兜底。
 */

const IMAGE_EXTENSIONS = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif', 'heic']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav']);
const IMAGE_MAX_BYTES = 30 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const AUDIO_MAX_BYTES = 15 * 1024 * 1024;

function getExtension(file) {
  return String(file?.name || '').split('.').pop()?.toLowerCase() || '';
}

function loadImageMetadata(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片尺寸'));
    };
    image.src = url;
  });
}

function loadMediaMetadata(file, kind) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement(kind);
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`无法读取${kind === 'video' ? '视频' : '音频'}信息`));
    }, 15000);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      media.removeAttribute('src');
      media.load();
      URL.revokeObjectURL(url);
    };
    media.onloadedmetadata = () => {
      const metadata = { duration: media.duration };
      if (kind === 'video') {
        metadata.width = media.videoWidth;
        metadata.height = media.videoHeight;
      }
      cleanup();
      resolve(metadata);
    };
    media.onerror = () => {
      cleanup();
      reject(new Error(`无法读取${kind === 'video' ? '视频' : '音频'}信息`));
    };
    media.preload = 'metadata';
    media.src = url;
  });
}

/** 从本地视频读取 0 秒画面，生成仅用于前端预览的首帧封面。 */
export function createVideoFirstFrame(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
      video.removeEventListener('seeked', handleFrameReady);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const handleError = () => finish(reject, new Error('无法生成视频首帧'));
    const handleFrameReady = () => {
      // seeked 只表示时间轴已定位，必须等浏览器提交一帧后再读取画面。
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(() => { if (!settled) captureFrame(); });
        return;
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => { if (!settled) captureFrame(); });
      });
    };
    const captureFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 640 / video.videoWidth, 640 / video.videoHeight);
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        if (!canvas.width || !canvas.height) throw new Error('视频没有有效画面');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('无法创建视频封面');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(resolve, canvas.toDataURL('image/jpeg', 0.86));
      } catch (error) {
        finish(reject, error);
      }
    };
    const handleLoadedData = () => {
      // 某些浏览器在当前时间已经是 0 时不会触发 seeked，主动播放一帧后再截取。
      if (video.currentTime !== 0) return;
      video.play()
        .then(() => {
          video.pause();
          handleFrameReady();
        })
        .catch(() => handleFrameReady());
    };
    const handleMetadata = () => {
      video.currentTime = 0;
    };

    video.addEventListener('loadedmetadata', handleMetadata, { once: true });
    video.addEventListener('loadeddata', handleLoadedData, { once: true });
    video.addEventListener('seeked', handleFrameReady, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
  });
}

function validateRatioAndDimensions(width, height, { inclusive, checkPixels = false } = {}) {
  if (!width || !height) return '无法读取素材尺寸，请更换文件后重试';
  const ratio = width / height;
  const ratioValid = inclusive ? ratio >= 0.4 && ratio <= 2.5 : ratio > 0.4 && ratio < 2.5;
  const dimensionValid = inclusive
    ? width >= 300 && width <= 6000 && height >= 300 && height <= 6000
    : width > 300 && width < 6000 && height > 300 && height < 6000;
  if (!ratioValid) return { code: 'aspect-ratio', message: inclusive ? '素材宽高比需在 0.4 到 2.5 之间' : '图片宽高比需大于 0.4 且小于 2.5' };
  if (!dimensionValid) return { code: 'resolution', message: inclusive ? '视频宽高需在 300 到 6000 像素之间' : '图片宽高需大于 300 且小于 6000 像素' };
  if (checkPixels && (width * height < 409600 || width * height > 927408)) {
    return { code: 'resolution', message: '视频分辨率不符合要求' };
  }
  return null;
}

async function validateImage(file, extension) {
  if (file.size >= IMAGE_MAX_BYTES) return { error: '图片大小必须小于 30MB' };
  try {
    const metadata = await loadImageMetadata(file);
    const error = validateRatioAndDimensions(metadata.width, metadata.height, { inclusive: false });
    return error ? { error: error.message, errorCode: error.code } : { type: 'image' };
  } catch {
    return { error: extension === 'heic' ? '当前浏览器无法读取 HEIC 尺寸，请转换为 JPG 或 PNG 后上传' : '无法读取图片尺寸，请更换文件后重试' };
  }
}

async function validateVideo(file) {
  if (file.size > VIDEO_MAX_BYTES) return { error: '视频大小不能超过 50MB' };
  try {
    const metadata = await loadMediaMetadata(file, 'video');
    if (metadata.duration < 2 || metadata.duration > 15) return { error: '视频时长需在 2 到 15 秒之间' };
    const error = validateRatioAndDimensions(metadata.width, metadata.height, { inclusive: true, checkPixels: true });
    return error ? { error: error.message, errorCode: error.code } : { type: 'video' };
  } catch {
    return { error: '无法读取视频信息，请更换文件后重试' };
  }
}

async function validateAudio(file) {
  if (file.size > AUDIO_MAX_BYTES) return { error: '音频大小不能超过 15MB' };
  try {
    const metadata = await loadMediaMetadata(file, 'audio');
    if (metadata.duration < 2 || metadata.duration > 15) return { error: '音频时长需在 2 到 15 秒之间' };
    return { type: 'audio' };
  } catch {
    return { error: '无法读取音频信息，请更换文件后重试' };
  }
}

export async function validateSeedanceUpload(file) {
  const extension = getExtension(file);
  if (IMAGE_EXTENSIONS.has(extension)) return validateImage(file, extension);
  if (VIDEO_EXTENSIONS.has(extension)) return validateVideo(file, extension);
  if (AUDIO_EXTENSIONS.has(extension)) return validateAudio(file, extension);
  return { error: '仅支持 JPEG、JPG、PNG、WEBP、GIF、HEIC、MP4 或 MOV 格式' };
}
