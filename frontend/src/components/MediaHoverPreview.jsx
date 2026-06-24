import { useState, memo } from "react";
import { FONT } from "../utils/fonts";
function MediaHoverPreview({ url, isVideo, mouseX, mouseY }) {
  const [size, setSize] = useState(null);
  const GAP = 16;

  useEffect(() => {
    if (isVideo) {
      // 视频默认按 16:9 预览，实际尺寸等视频加载后更新
      setSize({ w: 16, h: 9 });
    } else {
      setSize(null);
      const img = new Image();
      img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    }
  }, [url, isVideo]);

  if (!size) return null;

  const maxW = window.innerWidth * 0.35;
  const maxH = window.innerHeight * 0.35;
  const ratio = size.w / size.h;

  let previewW, previewH;
  if (ratio >= 1) {
    previewW = maxW;
    previewH = previewW / ratio;
    if (previewH > maxH) { previewH = maxH; previewW = previewH * ratio; }
  } else {
    previewH = maxH;
    previewW = previewH * ratio;
    if (previewW > maxW) { previewW = maxW; previewH = previewW / ratio; }
  }

  let left = mouseX + GAP;
  let top = mouseY + GAP;
  if (left + previewW > window.innerWidth - GAP) left = mouseX - previewW - GAP;
  if (top + previewH > window.innerHeight - GAP) top = mouseY - previewH - GAP;
  left = Math.max(GAP, left);
  top = Math.max(GAP, top);

  return (
    <div
      style={{
        position: 'fixed', left, top,
        width: previewW, height: previewH,
        zIndex: 99999, pointerEvents: 'none',
        borderRadius: '8px', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.12)',
        backgroundColor: '#111',
      }}
    >
      {isVideo ? (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => {
            const { videoWidth: w, videoHeight: h } = e.target;
            if (w && h) setSize({ w, h });
          }}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      )}
    </div>
  );
}

// ─── 主体参考弹窗 ─────────────────────────────────────────────────────────────


export default memo(MediaHoverPreview);
