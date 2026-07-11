/**
 * 在前端使用 <video> + <canvas> 抽取视频的最后一帧为 PNG Blob
 * @param {string} videoUrl 视频 CDN URL
 * @returns {Promise<{url: string, blob: Blob}>}
 */
export function captureVideoLastFrame(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl;

    let cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    const onError = () => {
      cleanup();
      reject(new Error('视频加载失败'));
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas 2D 上下文获取失败'));
          return;
        }
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          cleanup();
          if (blob) {
            const url = URL.createObjectURL(blob);
            resolve({ url, blob });
          } else {
            reject(new Error('Canvas toBlob 转换失败'));
          }
        }, 'image/png');
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.addEventListener('error', onError, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = video.duration || Number.MAX_SAFE_INTEGER;
    }, { once: true });

    video.load();
  });
}
