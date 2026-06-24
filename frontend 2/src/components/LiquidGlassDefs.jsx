/**
 * 全局液态玻璃滤镜定义。
 * 在 App 根部挂载一次，任意使用 `.fluid-glass` 的元素即可继承折射扭曲。
 *
 * 用法：<div className="fluid-glass">...</div>
 * 需搭配 src/index.css 里的 .fluid-glass 规则。
 */
export default function LiquidGlassDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="liquid-glass" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022 0.028" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1" result="blurredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
