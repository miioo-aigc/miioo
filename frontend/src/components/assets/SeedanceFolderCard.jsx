/**
 * Seedance 素材库文件夹卡片。
 * 按 Paper 设计稿复刻文件夹层级，并使用路径插值实现挡板形状动画。
 * 前方挡板使用同一条动态路径裁剪 HTML 毛玻璃层，保证曲线边缘与挡板完全重合。
 */

import { useEffect, useId, useRef, useState } from 'react';
import { normalizeImageUrl } from '../../utils/imageUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FRONT_FILL_DEFAULT = 'M3.786 11.385L13.773 132.094C14.098 136.021 16.671 138.999 19.739 138.999H233.407C236.412 136.138 238.953 136.138 239.353 132.304L251.938 11.665C252.245 8.722 251.55 5.752 250.031 3.516C248.511 1.281 246.316 -0.001 244.009 -0.001H11.741C9.472 -0.001 7.309 1.239 5.792 3.411C4.275 5.583 3.546 8.481 3.786 11.385Z';
const FRONT_STROKE_DEFAULT = 'M4.733 11.385L13.773 132.094C14.098 136.021 16.671 138.999 19.739 138.999H233.407C236.412 136.138 238.953 136.138 239.353 132.304L250.989 11.665C251.296 8.722 250.601 5.752 249.082 3.516C247.562 1.281 245.367 -0.001 243.06 -0.001H12.688C10.419 -0.001 8.256 1.239 6.739 3.411C5.222 5.583 4.493 8.481 4.733 11.385Z';
const FRONT_FILL_HOVER = 'M-0.017 63.51L13.773 132.094C14.098 136.021 16.671 138.999 19.739 138.999H233.407C236.412 136.138 238.953 136.138 239.353 132.304L255.72 63.79C256.027 60.847 255.332 57.877 253.813 55.641C252.293 53.406 250.098 52.124 247.791 52.124H7.938C5.669 52.124 3.506 53.364 1.989 55.536C0.472 57.708 -0.257 60.606 -0.017 63.51Z';
const FRONT_STROKE_HOVER = 'M0.927 63.51L13.773 132.094C14.098 136.021 16.671 138.999 19.739 138.999H233.407C236.412 136.138 238.953 136.138 239.353 132.304L254.768 63.79C255.075 60.847 254.38 57.877 252.861 55.641C251.341 53.406 249.146 52.124 246.839 52.124H8.882C6.613 52.124 4.45 53.364 2.933 55.536C1.416 57.708 0.687 60.606 0.927 63.51Z';

function EditIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.333 14H14.333" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.667 8.907V11.333H6.106L13 4.436L10.565 2L3.667 8.907Z" fill="none" stroke="currentColor" strokeLinejoin="round" /></svg>;
}

function DeleteIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.333V14.667H13V3.333H3Z" fill="none" stroke="currentColor" strokeLinejoin="round" /><path d="M6.667 6.667V11M9.333 6.667V11M1.333 3.333H14.667M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" fill="none" stroke="currentColor" strokeLinejoin="round" /></svg>;
}

function interpolatePath(from, to, progress) {
  const fromNumbers = from.match(/-?\d*\.?\d+/g).map(Number);
  const toNumbers = to.match(/-?\d*\.?\d+/g).map(Number);
  let index = 0;
  return to.replace(/-?\d*\.?\d+/g, () => {
    const value = fromNumbers[index] + (toNumbers[index] - fromNumbers[index]) * progress;
    index += 1;
    return Number(value.toFixed(3));
  });
}

function createPathMask(path) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 139" preserveAspectRatio="none"><path d="${path}" fill="white"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function BackFolder({ id }) {
  return (
    <svg className="absolute left-1/2 top-0 h-full w-[90.234%] -translate-x-1/2" viewBox="0 0 231 195" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs><linearGradient id={`${id}-bottom-fill`} x1="0" y1="0" x2="0.98" y2="1.01"><stop stopColor="#515151" stopOpacity="0.8" /><stop offset="1" stopColor="#0C0C0C" /><stop offset="1" stopColor="#1A1919" stopOpacity="0.9" /></linearGradient><linearGradient id={`${id}-bottom-stroke`} x1="0.05" y1="0" x2="0.69" y2="1.08"><stop stopColor="#A19D9D" /><stop offset="1" stopColor="#454545" /></linearGradient></defs>
      <path d="M3.785 183.001V8.001C3.785 3.583 7.344 0.001 11.733 0.001H65.482C69.074 0 72.475 1.63 74.739 4.436L81.011 12.212C82.897 14.551 85.731 15.909 88.724 15.909H219.263C223.652 15.91 227.211 19.491 227.211 23.91V183.001C227.211 189.628 221.873 195.001 215.288 195.001H15.708C9.123 195.001 3.785 189.628 3.785 183.001Z" fill={`url(#${id}-bottom-fill)`} /><path d="M3.785 183V8C3.785 3.582 7.344 0 11.733 0H65.482C69.074 0 72.475 1.63 74.739 4.436L81.011 12.212C82.897 14.551 85.731 15.909 88.724 15.909H219.263C223.652 15.909 227.211 19.49 227.211 23.909V183C227.211 189.627 221.873 195 215.288 195H15.708C9.123 195 3.785 189.627 3.785 183Z" vectorEffect="non-scaling-stroke" fill="none" stroke={`url(#${id}-bottom-stroke)`} /></svg>
  );
}

function FrontFolder({ id, progress, showFill = true, showStroke = true }) {
  const fillPath = interpolatePath(FRONT_FILL_DEFAULT, FRONT_FILL_HOVER, progress);
  const strokePath = interpolatePath(FRONT_STROKE_DEFAULT, FRONT_STROKE_HOVER, progress);
  return (
    <svg className="absolute bottom-0 left-1/2 h-[71.282%] w-full -translate-x-1/2" viewBox="0 0 256 139" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-front-fill`} x1="0.41" y1="0" x2="0.61" y2="0.97">
          <stop stopColor="#696969" stopOpacity="0.85" />
          <stop offset="0.66" stopColor="#1A1919" stopOpacity="0.95" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${id}-front-stroke`} x1="0.06" y1="0" x2="0.33" y2="1.03">
          <stop stopColor="#ABABAB" />
          <stop offset="1" stopColor="#212121" />
        </linearGradient>
      </defs>
      {showFill ? <path d={fillPath} fill={`url(#${id}-front-fill)`} /> : null}
      {showStroke ? <path d={strokePath} vectorEffect="non-scaling-stroke" fill="none" stroke={`url(#${id}-front-stroke)`} /> : null}
    </svg>
  );
}

function FrontGlass({ progress }) {
  const fillPath = interpolatePath(FRONT_FILL_DEFAULT, FRONT_FILL_HOVER, progress);
  const pathMask = createPathMask(fillPath);
  return (
    <div
      className="pointer-events-none absolute bottom-0 left-1/2 h-[71.282%] w-full -translate-x-1/2"
      aria-hidden="true"
      style={{
        background: 'rgba(35, 35, 35, 0.14)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        maskImage: pathMask,
        WebkitMaskImage: pathMask,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
      }}
    />
  );
}

function getPreviewData(preview) {
  if (!preview) return null;
  if (typeof preview === 'string') return { url: preview, type: 'image', posterUrl: null };
  return {
    url: preview.url || preview.src || null,
    type: String(preview.type || preview.asset_type || 'image').toLowerCase(),
    posterUrl: preview.posterUrl || preview.poster_url || preview.thumbnailUrl || preview.thumbnail_url || null,
  };
}

function FolderPreview({ preview, className, style }) {
  const data = getPreviewData(preview);
  if (!data?.url) return null;
  const url = normalizeImageUrl(data.url);
  const posterUrl = data.posterUrl ? normalizeImageUrl(data.posterUrl) : undefined;
  if (data.type === 'video' || data.type.startsWith('video/')) {
    return (
      <video
        className={className}
        src={url}
        poster={posterUrl}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{ ...style, objectFit: 'cover' }}
        onLoadedData={(event) => {
          try {
            event.currentTarget.currentTime = 0;
            event.currentTarget.pause();
          } catch {
            /* 浏览器可能尚未允许定位媒体 */
          }
        }}
        onCanPlay={(event) => {
          if (posterUrl) return;
          const video = event.currentTarget;
          video.play()
            .then(() => window.setTimeout(() => video.pause(), 120))
            .catch(() => {});
        }}
      />
    );
  }
  return <div className={className} style={{ ...style, backgroundImage: `url(${url})` }} />;
}

function getPreviewTransform(index, previewCount, isHovered) {
  const translateY = isHovered ? (previewCount === 1 ? -20 : -16) : 0;
  if (previewCount === 1) return `translateY(${translateY}px)`;
  const translateX = isHovered ? (index === 0 ? 4 : -4) : 0;
  const rotate = isHovered ? (index === 0 ? 3 : -3) : 0;
  return `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg)`;
}

export default function SeedanceFolderCard({ name, count = 0, images = [], onOpen, onEdit, onDelete }) {
  const previews = images.slice(0, 2);
  const canManage = Boolean(onEdit || onDelete);
  const instanceId = useId().replace(/:/g, '');
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    let frameId;
    const start = performance.now();
    const initial = progressRef.current;
    const target = isHovered ? 1 : 0;
    const duration = 240;
    const animate = (now) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = elapsed < 0.5 ? 2 * elapsed * elapsed : 1 - ((-2 * elapsed + 2) ** 2) / 2;
      const nextProgress = initial + (target - initial) * eased;
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      if (elapsed < 1) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isHovered]);

  return (
    <article className="group aspect-[3/2] w-full min-w-[216px] max-w-[270px] min-h-0 cursor-pointer" role="button" tabIndex={0} style={{ fontFamily: FONT }} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen?.(); } }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onFocus={() => setIsHovered(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsHovered(false); }}>
      <div className="relative h-full w-full overflow-hidden">
        <BackFolder id={instanceId} />
        {previews.length > 1 ? (
          <FolderPreview
            preview={previews[0]}
            className="absolute left-[15.56%] top-[17.22%] h-[71.11%] w-[71.85%] rounded-[4px] border border-white/20 bg-cover bg-center opacity-40"
            style={{ opacity: isHovered ? 1 : 0.4, transform: getPreviewTransform(0, previews.length, isHovered), transition: 'opacity 300ms ease, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          />
        ) : null}
        {previews[0] ? (
          previews.length === 1 ? (
            <div className="absolute left-1/2 top-[22.78%] h-[71.11%] w-[71.85%] -translate-x-1/2">
              <FolderPreview
                preview={previews[0]}
                className="h-full w-full rounded-[4px] border border-white/50 bg-cover bg-center"
                style={{ transform: getPreviewTransform(1, previews.length, isHovered), transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              />
            </div>
          ) : (
            <FolderPreview
              preview={previews[1]}
              className="absolute left-[11.11%] top-[22.78%] h-[71.11%] w-[71.85%] rounded-[4px] border border-white/50 bg-cover bg-center"
              style={{ transform: getPreviewTransform(1, previews.length, isHovered), transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            />
          )
        ) : null}
        <FrontFolder id={instanceId} progress={progress} showStroke={false} />
        <FrontGlass progress={progress} />
        <FrontFolder id={instanceId} progress={progress} showFill={false} showStroke />
        <div className="absolute bottom-[16px] left-[24px] right-[28px] flex min-w-0 items-center">
          <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-white" title={name}>{name}</span>
          <span className={`shrink-0 text-[12px] leading-[16px] text-white/50${canManage ? ' transition-opacity group-hover:opacity-0 group-focus-within:opacity-0' : ''}`}>{count}</span>
          {canManage ? <div className="absolute right-0 flex items-center gap-[6px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><button type="button" aria-label={`编辑${name}`} title="编辑" onClick={(event) => { event.stopPropagation(); onEdit?.(); }} className="flex h-[24px] w-[24px] items-center justify-center rounded-[6px] border-0 bg-black/50 p-0 text-white transition-colors hover:text-text-accent"><EditIcon /></button><button type="button" aria-label={`删除${name}`} title="删除" onClick={(event) => { event.stopPropagation(); onDelete?.(); }} className="flex h-[24px] w-[24px] items-center justify-center rounded-[6px] border-0 bg-black/50 p-0 text-white transition-colors hover:text-text-danger"><DeleteIcon /></button></div> : null}
        </div>
      </div>
    </article>
  );
}
