import { useEffect, useState } from 'react';

/** 缩略图先显示；原图完成下载与解码后再替换，失败静默保留兜底。 */
export default function PreviewImage({ source, fallback }) {
  const [decodedSource, setDecodedSource] = useState(null);
  useEffect(() => {
    if (!source || source === fallback) return;
    let cancelled = false;
    const image = new Image();
    image.onload = async () => {
      try {
        await image.decode();
        if (!cancelled && image.naturalWidth > 0) setDecodedSource(source);
      } catch { /* 原图下载或解码失败，保留缩略图。 */ }
    };
    image.onerror = () => {};
    image.src = source;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
    };
  }, [source, fallback]);
  const src = decodedSource && decodedSource === source ? source : fallback || source;
  return <img src={src || undefined} alt="" className="w-full h-full object-contain" />;
}
