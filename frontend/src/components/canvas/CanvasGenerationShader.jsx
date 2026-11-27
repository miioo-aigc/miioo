/** 生成态第三方着色器背景：保留 Paper Shaders 效果，并隔离初始化与逐帧异常。 */
import { useEffect, useRef, useState } from 'react';
import {
  ShaderFitOptions,
  ShaderMount,
  defaultObjectSizing,
  defaultPatternSizing,
  dotOrbitFragmentShader,
  getShaderColorFromString,
  getShaderNoiseTexture,
  meshGradientFragmentShader,
} from '@paper-design/shaders';
import CanvasEffectBoundary from './CanvasEffectBoundary';

const CONTEXT_ATTRIBUTES = {
  alpha: true,
  antialias: true,
  depth: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'low-power',
  stencil: false,
};
const MAX_PIXEL_COUNT = 512 * 512;

function sizingUniforms(defaults, overrides = {}) {
  const value = { ...defaults, ...overrides };
  return {
    u_fit: ShaderFitOptions[value.fit],
    u_scale: value.scale,
    u_rotation: value.rotation,
    u_originX: value.originX,
    u_originY: value.originY,
    u_offsetX: value.offsetX,
    u_offsetY: value.offsetY,
    u_worldWidth: value.worldWidth,
    u_worldHeight: value.worldHeight,
  };
}

function dotOrbitUniforms(noiseTexture) {
  const colors = ['#FFFFFF0A'];
  return {
    u_colorBack: getShaderColorFromString('#00000000'),
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_size: 0.6,
    u_sizeRange: 0.48,
    u_spreading: 0.1,
    u_stepsPerColor: 1,
    u_noiseTexture: noiseTexture,
    ...sizingUniforms(defaultPatternSizing, { scale: 0.1 }),
  };
}

function meshGradientUniforms() {
  const colors = ['#FFFFFF99', '#00000080', '#2DC3E1'];
  return {
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_distortion: 0.43,
    u_swirl: 0.07,
    u_grainMixer: 0,
    u_grainOverlay: 0,
    ...sizingUniforms(defaultObjectSizing, { scale: 1.45 }),
  };
}

function loadNoiseTexture() {
  return new Promise((resolve, reject) => {
    const image = getShaderNoiseTexture();
    if (!image) {
      reject(new Error('Paper Shaders 噪点纹理不可用'));
      return;
    }
    if (image.complete && image.naturalWidth > 0) {
      resolve(image);
      return;
    }
    if (image.complete) {
      reject(new Error('Paper Shaders 噪点纹理加载失败'));
      return;
    }
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('Paper Shaders 噪点纹理加载失败')), { once: true });
  });
}

function createGuardedMount({ fragmentShader, frame, host, onFailure, speed, uniforms }) {
  const mount = new ShaderMount(
    host,
    fragmentShader,
    uniforms,
    CONTEXT_ATTRIBUTES,
    0,
    frame,
    2,
    MAX_PIXEL_COUNT,
  );
  if (!mount.program || mount.gl?.isContextLost?.()) {
    try {
      mount.dispose();
    } catch {
      // 初始化未完成时释放可能失败，不能让清理异常覆盖原始错误。
    }
    throw new Error('Paper Shaders 着色器程序初始化失败');
  }
  const canvas = mount.canvasElement;
  const render = mount.render;
  let stopped = false;

  const stop = (error) => {
    if (stopped) return;
    stopped = true;
    try {
      mount.setSpeed(0);
    } catch {
      // 上下文已经失效时停止调度即可。
    }
    onFailure(error);
  };

  mount.render = (time) => {
    if (stopped) return;
    try {
      render(time);
    } catch (error) {
      stop(error);
    }
  };

  const handleContextLost = () => stop(new Error('Paper Shaders WebGL 上下文已丢失'));
  canvas.addEventListener('webglcontextlost', handleContextLost, { once: true });

  try {
    mount.setSpeed(speed);
  } catch (error) {
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    try {
      mount.dispose();
    } catch {
      // 初始化失败后的清理不能再向外抛出。
    }
    throw error;
  }

  return () => {
    stopped = true;
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    try {
      mount.dispose();
    } catch {
      // WebGL 上下文丢失后资源可能已被浏览器回收。
    }
  };
}

function PaperShaderLayer({ layer, reducedMotion }) {
  const hostRef = useRef(null);
  const [available, setAvailable] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(Boolean(entry?.isIntersecting));
    }, { rootMargin: '160px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!available || !visible) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup;

    const start = async () => {
      try {
        const isDotOrbit = layer === 'orbit';
        const uniforms = isDotOrbit
          ? dotOrbitUniforms(await loadNoiseTexture())
          : meshGradientUniforms();
        if (cancelled) return;
        cleanup = createGuardedMount({
          fragmentShader: isDotOrbit ? dotOrbitFragmentShader : meshGradientFragmentShader,
          frame: isDotOrbit ? 9563964.609994078 : 17999729.999991026,
          host,
          onFailure: (error) => {
            if (cancelled) return;
            console.warn(`[画布] Paper Shaders ${layer} 背景运行失败，已降级:`, error);
            setAvailable(false);
          },
          speed: reducedMotion ? 0 : (isDotOrbit ? 1 : 2),
          uniforms,
        });
      } catch (error) {
        if (cancelled) return;
        console.warn(`[画布] Paper Shaders ${layer} 背景初始化失败，已降级:`, error);
        host.replaceChildren();
        setAvailable(false);
      }
    };

    const frame = requestAnimationFrame(start);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [available, layer, reducedMotion, visible]);

  if (!available) return null;
  return <div ref={hostRef} className={`canvas-generation-loading__shader canvas-generation-loading__shader--${layer}`} />;
}

export default function CanvasGenerationShader({ reducedMotion }) {
  return <>
    <CanvasEffectBoundary fallback={null}>
      <PaperShaderLayer layer="orbit" reducedMotion={reducedMotion} />
    </CanvasEffectBoundary>
    <CanvasEffectBoundary fallback={null}>
      <PaperShaderLayer layer="mesh" reducedMotion={reducedMotion} />
    </CanvasEffectBoundary>
  </>;
}
