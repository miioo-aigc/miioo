/** 时间轴媒体：封面回退、首帧兜底、可见时持续退避重试。 */
export function createTimelineMediaLoad({ image, video, covers = [], videoSrc = '', onChange, network = window, timeoutMs = 30000, retryDelays = [1000, 3000, 8000, 15000, 30000] }) {
  const sources = [...new Set(covers.filter(Boolean))];
  let disposed = false, hovered = false, coverReady = false, frameReady = false, playing = false;
  let imageIndex = 0, imageFailures = 0, videoFailures = 0, playVersion = 0;
  let imageTimer, videoTimer, imagePending = false, videoPending = false, playPending = false;
  const visible = () => network.document?.visibilityState !== 'hidden' && network.navigator?.onLine !== false;
  const publish = () => { if (!disposed) onChange({ coverReady, frameReady, playing }); };
  const delay = count => retryDelays[Math.min(count, retryDelays.length - 1)];
  function loadImage() {
    if (disposed || coverReady || !visible() || !sources.length) return;
    clearTimeout(imageTimer);
    imagePending = true;
    image.src = sources[imageIndex];
    imageTimer = setTimeout(imageFailed, timeoutMs);
  }
  function imageFailed() {
    if (disposed || !imagePending || coverReady) return;
    imagePending = false;
    clearTimeout(imageTimer);
    imageIndex++;
    if (imageIndex < sources.length && visible()) loadImage();
    else {
      imageIndex = 0;
      if (visible()) imageTimer = setTimeout(loadImage, delay(imageFailures++));
      if (!frameReady && !videoPending && !videoTimer) loadVideo();
    }
  }
  function imageLoaded() {
    if (disposed || !imagePending) return;
    clearTimeout(imageTimer);
    imagePending = false;
    coverReady = true;
    publish();
  }
  function play() {
    if (disposed || !hovered || !visible() || !frameReady || playing || playPending) return;
    playPending = true;
    const version = ++playVersion;
    Promise.resolve(video.play()).then(() => {
      if (disposed || version !== playVersion || !hovered || !visible()) return;
      playPending = false;
      playing = true;
      publish();
    }).catch(error => {
      if (disposed || version !== playVersion) return;
      playPending = false;
      if (error?.name !== 'NotAllowedError' && error?.name !== 'AbortError') videoFailed();
    });
  }
  function loadVideo() {
    if (disposed || !videoSrc || !visible() || videoPending || (!hovered && coverReady)) return;
    clearTimeout(videoTimer);
    videoTimer = undefined;
    videoPending = true;
    frameReady = false;
    publish();
    video.src = videoSrc;
    video.load();
    videoTimer = setTimeout(videoFailed, timeoutMs);
  }
  function videoFailed() {
    if (disposed) return;
    clearTimeout(videoTimer);
    videoPending = false;
    playing = false;
    playPending = false;
    playVersion++;
    video.pause();
    publish();
    if (visible()) videoTimer = setTimeout(loadVideo, delay(videoFailures++));
  }
  function videoLoaded() {
    if (disposed || video.error) return;
    clearTimeout(videoTimer);
    videoTimer = undefined;
    videoPending = false;
    frameReady = true;
    videoFailures = 0;
    publish();
    play();
  }
  function waiting() {
    if (disposed || !hovered || !visible()) return;
    clearTimeout(videoTimer);
    videoTimer = setTimeout(videoFailed, timeoutMs);
  }
  function videoPlaying() {
    if (disposed) return;
    if (!hovered || !visible()) { video.pause(); return; }
    clearTimeout(videoTimer);
    playing = true;
    publish();
  }
  function suspend() {
    clearTimeout(imageTimer);
    clearTimeout(videoTimer);
    imageTimer = undefined;
    videoTimer = undefined;
    imagePending = false;
    videoPending = false;
    playVersion++;
    playPending = false;
    video.pause();
    playing = false;
    publish();
  }
  function resume() {
    if (disposed) return;
    if (!visible()) { suspend(); return; }
    if (!coverReady) loadImage();
    if (frameReady && !video.error) play();
    else if (hovered || !sources.length) loadVideo();
  }
  const listeners = [
    [image, 'load', imageLoaded], [image, 'error', imageFailed],
    [video, 'loadeddata', videoLoaded], [video, 'canplay', videoLoaded],
    [video, 'error', videoFailed], [video, 'waiting', waiting],
    [video, 'stalled', waiting], [video, 'playing', videoPlaying],
    [network, 'online', resume], [network, 'offline', suspend],
    [network.document, 'visibilitychange', resume],
  ];
  listeners.forEach(([target, event, handler]) => target?.addEventListener(event, handler));
  return {
    start: resume,
    setHovered(value) {
      hovered = value;
      if (disposed) return;
      if (hovered && visible()) {
        if (frameReady && !video.error) play(); else loadVideo();
      } else {
        playVersion++;
        playPending = false;
        video.pause();
        playing = false;
        publish();
      }
    },
    dispose() {
      disposed = true;
      suspend();
      listeners.forEach(([target, event, handler]) => target?.removeEventListener(event, handler));
      image.removeAttribute('src');
      video.removeAttribute('src');
      video.load();
    },
  };
}
