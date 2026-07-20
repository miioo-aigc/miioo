/**
 * @file OptionTabs.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   OptionTabs 提供无业务的受控分段选项卡（segmented option）视觉和交互
 *   支持等宽(w-[168px])与自适应(flex:1 1 0px)两种布局，可选图标，选中态蓝底蓝边
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收选项、当前值和变更回调，不调用 API、不读取 Store
 */
import { useState } from 'react';

// 画面比例图标：按 Paper 设计稿还原。16:9 与 9:16 共用同一方形 viewBox 与同一路径，
// 9:16 仅通过 rotate 270deg 旋转得到竖向比例，不再使用两套不同 viewBox/路径。
// 设计稿中选中态图标为白色（蓝底白图），未选中为 #FFFFFFCC（white-80）。
function RatioIcon({ active, value }) {
  const color = active ? 'var(--color-white-100)' : 'var(--color-white-80)';
  const style =
    value === '9:16'
      ? { rotate: '270deg', flexShrink: '0', transformOrigin: '50% 50%' }
      : { flexShrink: '0' };
  return (
    <svg
      viewBox="0 0 92.16 92.16"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      style={style}
    >
      <path
        d="M77.938 23.04H14.223c-5.028 0-9.102 3.437-9.103 7.681v30.719c0 4.243 4.074 7.68 9.103 7.68h63.715c5.028 0 9.102-3.437 9.102-7.68V30.721c0-4.243-4.074-7.68-9.102-7.681z m0 38.4H14.223V30.721h63.715v30.719z"
        fill={color}
      />
    </svg>
  );
}

export default function OptionTabs({
  options = [],
  value,
  onChange,
  // 'fixed' = 等宽选项卡(w-[168px], shrink-0)；'flex' = 自适应等分(flex:1 1 0px)
  layout = 'fixed',
  // 是否在每个选项中渲染比例图标（仅画面比例字段使用）
  showRatioIcon = false,
}) {
  const [hovered, setHovered] = useState(null);

  const containerClass =
    layout === 'fixed'
      ? 'flex items-start gap-[16px] self-stretch'
      : 'flex gap-[16px] self-stretch items-center';

  return (
    <div className={`[font-synthesis:none] flex antialiased ${containerClass}`}>
      {options.map((opt) => {
        const active = value === opt.value;
        const itemWidth = layout === 'fixed' ? 'w-[168px] shrink-0' : '[flex:1_1_0px]';
        const itemGap = layout === 'fixed' ? 'gap-[8px]' : 'gap-[6px]';
        const bgClass = active ? 'bg-blue-alpha-10' : 'bg-white-8';
        const textColor = active ? 'text-white-100' : 'text-white-80';
        const isHovered = hovered === opt.value;
        const outlineStyle = active
          ? { outline: '1px solid var(--color-blue-300)' }
          : { outline: `1px solid rgba(255, 255, 255, ${isHovered ? 0.3 : 0.12})` };
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            onMouseEnter={() => setHovered(opt.value)}
            onMouseLeave={() => setHovered((prev) => (prev === opt.value ? null : prev))}
            style={outlineStyle}
            className={`h-[40px] flex items-center justify-center rounded-medium cursor-pointer p-0 border-0 transition-[background-color,outline-color] duration-150 ${itemWidth} ${itemGap} ${bgClass} ${isHovered && !active ? 'brightness-110' : ''}`}
          >
            {showRatioIcon && <RatioIcon active={active} value={opt.value} />}
            <div
              className={`font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] ${textColor} text-[14px] leading-[20px]`}
            >
              {opt.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
