import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
const MIN_CROP_SIZE = 0.08;
const MAX_ZOOM = 4;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getInitialCrop(imageWidth, imageHeight, ratio) {
  const sourceRatio = imageWidth / imageHeight;
  if (!ratio || ratio === 'custom' || Math.abs(sourceRatio - ratio) < 0.001) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  if (sourceRatio > ratio) {
    const width = (imageHeight * ratio) / imageWidth;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = (imageWidth / ratio) / imageHeight;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

function getOrientedSize(imageSize, rotation) {
  return Math.abs(rotation) % 180 === 90
    ? { width: imageSize.height, height: imageSize.width }
    : imageSize;
}

function getOrientedRatio(ratio) {
  return ratio;
}

function getFittedCrop(imageWidth, imageHeight, cropRatio) {
  const imageRatio = imageWidth / imageHeight;
  if (imageRatio > cropRatio) {
    const width = cropRatio / imageRatio;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = imageRatio / cropRatio;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

function clampCrop(crop, ratio, imageWidth, imageHeight) {
  const sourceRatio = imageWidth / imageHeight;
  let width = clamp(crop.width, MIN_CROP_SIZE, 1);
  let height = clamp(crop.height, MIN_CROP_SIZE, 1);
  if (ratio && ratio !== 'custom') {
    if ((sourceRatio * width) / height > ratio) width = (ratio * height) / sourceRatio;
    else height = (sourceRatio * width) / ratio;
  }
  return {
    width,
    height,
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
  };
}

function getResizeCrop(startCrop, handle, dx, dy, ratio, imageWidth, imageHeight) {
  const next = { ...startCrop };
  const isCorner = handle.length === 2;
  if (!isCorner) {
    if (handle.includes('w')) { next.x = startCrop.x + dx; next.width = startCrop.width - dx; }
    if (handle.includes('e')) next.width = startCrop.width + dx;
    if (handle.includes('n')) { next.y = startCrop.y + dy; next.height = startCrop.height - dy; }
    if (handle.includes('s')) next.height = startCrop.height + dy;
    return clampCrop(next, 'custom', imageWidth, imageHeight);
  }

  const directionX = handle.includes('w') ? -1 : 1;
  const directionY = handle.includes('n') ? -1 : 1;
  const sourceRatio = imageWidth / imageHeight;
  const cropRatio = ratio && ratio !== 'custom' ? ratio : (sourceRatio * startCrop.width) / startCrop.height;
  const requestedWidth = startCrop.width + (directionX * dx);
  const requestedHeight = startCrop.height + (directionY * dy);
  let width = Math.max(MIN_CROP_SIZE, requestedWidth);
  let height = width * sourceRatio / cropRatio;
  if (requestedHeight > requestedWidth) {
    height = Math.max(MIN_CROP_SIZE, requestedHeight);
    width = height * cropRatio / sourceRatio;
  }
  if (startCrop.x + (directionX < 0 ? startCrop.width - width : width) > 1) {
    width = directionX < 0 ? startCrop.x + startCrop.width : 1 - startCrop.x;
    height = width * sourceRatio / cropRatio;
  }
  if (startCrop.y + (directionY < 0 ? startCrop.height - height : height) > 1) {
    height = directionY < 0 ? startCrop.y + startCrop.height : 1 - startCrop.y;
    width = height * cropRatio / sourceRatio;
  }
  const x = directionX < 0 ? startCrop.x + startCrop.width - width : startCrop.x;
  const y = directionY < 0 ? startCrop.y + startCrop.height - height : startCrop.y;
  return clampCrop({ x, y, width, height }, ratio, imageWidth, imageHeight);
}

const ImageCropEditor = forwardRef(function ImageCropEditor({ imageUrl, ratio, onRatioChange, onImageLoad, onChange, cropEnabled = true, rotation = 0, flipX = false, flipY = false, imageAlt = '待裁剪图片' }, ref) {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [interaction, setInteraction] = useState(null);
  const internalRatioChange = useRef(false);
  const previousRotation = useRef(rotation);
  const previousRatio = useRef(ratio);
  const suspendedCrop = useRef(false);
  const orientedSize = getOrientedSize(imageSize, rotation);
  const orientedRatio = getOrientedRatio(ratio);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const update = () => {
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    getEditState: () => ({ image: imageRef.current, imageSize, crop: cropEnabled ? crop : { x: 0, y: 0, width: 1, height: 1 }, zoom: cropEnabled ? zoom : 1, panX: cropEnabled ? pan.x : 0, panY: cropEnabled ? pan.y : 0 }),
    reset: () => {
      if (!imageSize.width || !imageSize.height) return;
      setCrop(getInitialCrop(orientedSize.width, orientedSize.height, orientedRatio));
      setZoom(1);
      setPan({ x: 0, y: 0 });
    },
  }), [crop, cropEnabled, imageSize, orientedRatio, orientedSize.height, orientedSize.width, pan, zoom]);

  useEffect(() => {
    if (!cropEnabled) {
      suspendedCrop.current = true;
      setInteraction(null);
      return;
    }
    if (!imageSize.width || !imageSize.height) return;
    if (previousRotation.current === rotation) {
      suspendedCrop.current = false;
      return;
    }
    const delta = rotation - previousRotation.current;
    let nextCrop = crop;
    if (Math.abs(delta) % 180 === 90) {
      if (!ratio) {
        // 原比例始终代表旋转后图片的完整比例，因此裁剪框也跟随图片方向变化。
        nextCrop = { x: 0, y: 0, width: 1, height: 1 };
      } else if (ratio === 'custom') {
        // 自定义比例是用户的明确选择，旋转图片时保留真实像素比例，只重新适配到新图片边界。
        const previousOrientedRatio = getOrientedSize(imageSize, previousRotation.current).width
          / getOrientedSize(imageSize, previousRotation.current).height;
        const customCropRatio = previousOrientedRatio * crop.width / crop.height;
        nextCrop = getFittedCrop(orientedSize.width, orientedSize.height, customCropRatio);
      } else {
        // 固定比例锁定用户选择的数值，不随图片旋转交换为反向比例。
        nextCrop = getFittedCrop(orientedSize.width, orientedSize.height, ratio);
      }
      if (suspendedCrop.current && ratio) {
        // 暂停期间仅在新边界容纳不下选区时缩小，保留原选区中心及像素尺寸。
        const previousSize = getOrientedSize(imageSize, previousRotation.current);
        const width = crop.width * previousSize.width / orientedSize.width;
        const height = crop.height * previousSize.height / orientedSize.height;
        const scale = Math.min(1, 1 / width, 1 / height);
        nextCrop = {
          width: width * scale,
          height: height * scale,
          x: clamp(crop.x + crop.width / 2 - width * scale / 2, 0, 1 - width * scale),
          y: clamp(crop.y + crop.height / 2 - height * scale / 2, 0, 1 - height * scale),
        };
      }
    }
    setCrop(clampCrop(nextCrop, orientedRatio, orientedSize.width, orientedSize.height));
    previousRotation.current = rotation;
    suspendedCrop.current = false;
  }, [crop, cropEnabled, imageSize, orientedRatio, orientedSize.height, orientedSize.width, ratio, rotation]);

  useEffect(() => {
    if (!imageSize.width || !imageSize.height) return;
    if (previousRatio.current === ratio) return;
    previousRatio.current = ratio;
    if (internalRatioChange.current) {
      internalRatioChange.current = false;
      return;
    }
    setCrop(clampCrop(getInitialCrop(orientedSize.width, orientedSize.height, orientedRatio), orientedRatio, orientedSize.width, orientedSize.height));
  }, [imageSize, orientedRatio, orientedSize.height, orientedSize.width, ratio]);

  useEffect(() => {
    if (!interaction || !cropEnabled) return undefined;
    const move = (event) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const dx = (event.clientX - interaction.startX) / rect.width;
      const dy = (event.clientY - interaction.startY) / rect.height;
      if (interaction.kind === 'pan') {
        setPan({ x: interaction.pan.x + dx, y: interaction.pan.y + dy });
        return;
      }
      if (interaction.kind === 'move') {
        setCrop(clampCrop({ ...interaction.crop, x: interaction.crop.x + dx, y: interaction.crop.y + dy }, orientedRatio, orientedSize.width, orientedSize.height));
        return;
      }
      const nextRatio = interaction.kind === 'edge' ? 'custom' : orientedRatio;
      if (interaction.kind === 'edge' && ratio !== 'custom') {
        internalRatioChange.current = true;
        onRatioChange?.('custom', true);
      }
      setCrop(getResizeCrop(interaction.crop, interaction.handle, dx, dy, nextRatio, orientedSize.width, orientedSize.height));
    };
    const end = () => setInteraction(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, [cropEnabled, imageSize, interaction, onRatioChange, orientedRatio, orientedSize.height, orientedSize.width, ratio]);

  useEffect(() => {
    onChange?.({ crop, zoom, panX: pan.x, panY: pan.y, imageSize });
  }, [crop, imageSize, onChange, pan, zoom]);

  const handleImageLoad = (event) => {
    const size = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
    setImageSize(size);
    previousRotation.current = rotation;
    previousRatio.current = ratio;
    const nextSize = getOrientedSize(size, rotation);
    setCrop(getInitialCrop(nextSize.width, nextSize.height, getOrientedRatio(ratio)));
    onImageLoad?.(size);
  };
  const beginInteraction = (event, kind, handle) => {
    if (!cropEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    setInteraction({ kind, handle, startX: event.clientX, startY: event.clientY, crop, pan });
  };
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !cropEnabled) return undefined;

    // React 的 onWheel 事件可能由被动委托监听器触发，滚轮缩放需要由编辑器接管默认滚动。
    const handleWheel = (event) => {
      event.preventDefault();
      setZoom((value) => clamp(value * (event.deltaY < 0 ? 1.1 : 0.9), 1, MAX_ZOOM));
    };

    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [cropEnabled]);
  const displayZoom = cropEnabled ? zoom : 1;
  const displayPan = cropEnabled ? pan : { x: 0, y: 0 };
  const imageStyle = {
    width: stageSize.width && stageSize.height && Math.abs(rotation) % 180 === 90 ? `${stageSize.height}px` : `${stageSize.width}px`,
    height: stageSize.width && stageSize.height && Math.abs(rotation) % 180 === 90 ? `${stageSize.width}px` : `${stageSize.height}px`,
    maxWidth: 'none', maxHeight: 'none', minWidth: '0', minHeight: '0',
    objectFit: 'fill', display: 'block', position: 'absolute', left: '50%', top: '50%',
    transform: `translate(-50%, -50%) translate(${displayPan.x * stageSize.width}px, ${displayPan.y * stageSize.height}px) rotate(${rotation}deg) scale(${(flipX ? -1 : 1) * displayZoom}, ${(flipY ? -1 : 1) * displayZoom})`,
  };
  const cropStyle = { position: 'absolute', left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` };
  const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
  const handleStyle = (handle) => ({
    position: 'absolute',
    width: handle.length === 2 ? '10px' : handle === 'w' || handle === 'e' ? '5px' : '24px',
    height: handle.length === 2 ? '10px' : handle === 'w' || handle === 'e' ? '24px' : '5px',
    left: handle.includes('w') ? '-2px' : handle.includes('e') ? 'calc(100% - 3px)' : 'calc(50% - 12px)',
    top: handle.includes('n') ? '-2px' : handle.includes('s') ? 'calc(100% - 3px)' : 'calc(50% - 12px)',
    ...(handle.length === 2 ? {
      left: handle.includes('w') ? '0px' : '100%',
      top: handle.includes('n') ? '0px' : '100%',
      transform: 'translate(-50%, -50%)',
    } : {}),
    background: '#2DC3E1', borderRadius: '2px', cursor: handle.length === 2 ? `${handle}-resize` : `${handle}-resize`,
  });
  const showGrid = Boolean(interaction && interaction.kind !== 'pan');

  return (
    <div ref={stageRef} onPointerDown={(event) => event.button === 1 && beginInteraction(event, 'pan')} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', touchAction: 'none' }}>
      {imageUrl ? <img ref={imageRef} src={imageUrl} alt={imageAlt} crossOrigin="anonymous" onLoad={handleImageLoad} style={imageStyle} /> : null}
      {cropEnabled && <>
      <div style={{ ...cropStyle, zIndex: 4, border: '1px solid #2DC3E1', boxSizing: 'border-box', cursor: 'move' }} onPointerDown={(event) => event.button === 0 && beginInteraction(event, 'move')}>
        {showGrid ? <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to right, transparent 33.333%, #2DC3E199 33.333%, #2DC3E199 calc(33.333% + 1px), transparent calc(33.333% + 1px), transparent 66.666%, #2DC3E199 66.666%, #2DC3E199 calc(66.666% + 1px), transparent calc(66.666% + 1px)), linear-gradient(to bottom, transparent 33.333%, #2DC3E199 33.333%, #2DC3E199 calc(33.333% + 1px), transparent calc(33.333% + 1px), transparent 66.666%, #2DC3E199 66.666%, #2DC3E199 calc(66.666% + 1px), transparent calc(66.666% + 1px))' }} /> : null}
        {handles.map((handle) => <span key={handle} onPointerDown={(event) => beginInteraction(event, handle.length === 2 ? 'corner' : 'edge', handle)} style={handleStyle(handle)} />)}
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, boxShadow: `${crop.x * 100}% ${crop.y * 100}% 0 0 rgba(0,0,0,0)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${crop.y * 100}%`, background: '#00000088', backdropFilter: 'blur(6px)', zIndex: 3, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(1 - crop.y - crop.height) * 100}%`, background: '#00000088', backdropFilter: 'blur(6px)', zIndex: 3, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: `${crop.y * 100}%`, bottom: `${(1 - crop.y - crop.height) * 100}%`, left: 0, width: `${crop.x * 100}%`, background: '#00000088', backdropFilter: 'blur(6px)', zIndex: 3, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: `${crop.y * 100}%`, bottom: `${(1 - crop.y - crop.height) * 100}%`, right: 0, width: `${(1 - crop.x - crop.width) * 100}%`, background: '#00000088', backdropFilter: 'blur(6px)', zIndex: 3, pointerEvents: 'none' }} />
      </>}
    </div>
  );
});

export default ImageCropEditor;
