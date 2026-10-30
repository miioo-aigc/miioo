/** 素材箱封面：可视时优先小图，逐级失败后才挂载原图或视频首帧。 */
import { useEffect, useRef, useState } from 'react';
import RecoverableVideoPreview from '../creation/RecoverableVideoPreview';
import { compositionAssetCoverUrls } from '../../utils/CompositionAssetCover';
import { compositionMediaSource } from '../../utils/CompositionMediaSource';

function CoverSession({ covers, source, video }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState([]);
  useEffect(() => {
    if (!globalThis.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '80px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const ready = visible || !globalThis.IntersectionObserver;
  const image = covers.find(url => !failed.includes(url)) || (!video && !failed.includes(source) ? source : null);
  return <span ref={ref} className="relative flex h-full w-full items-center justify-center">
    {ready && image ? <img key={image} src={image} alt="" decoding="async" className="h-full w-full object-contain"
      onError={() => setFailed(previous => [...previous, image])} />
      : ready && video && source ? <RecoverableVideoPreview src={source} hovered={false} objectFit="contain" />
        : <span className="text-text-hint text-font-size-12">{video ? '视频' : '图片'}</span>}
  </span>;
}

export default function AssetCover({ asset }) {
  const covers = compositionAssetCoverUrls(asset);
  const source = compositionMediaSource(asset);
  const video = asset.asset_type === 'video';
  return <CoverSession key={JSON.stringify([covers, source, video])} covers={covers} source={source} video={video} />;
}
