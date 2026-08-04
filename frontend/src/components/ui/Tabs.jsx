/**
 * @file Tabs.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   Tabs 提供标签导航（tabs）视觉和交互，支持五种外观变体
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收选项、当前值和变更回调，不调用 API、不读取 Store
 *
 * ─── Props ──────────────────────────────────────────────────────────
 *   options   { value: string, label: string }[]  选项列表
 *   value     string                               当前选中值
 *   onChange  (value: string) => void              选中回调
 *   gap       string                               选项间距，默认 '24px'
 *   variant   'underline' | 'underline-ghost' | 'plain' | 'plain-ghost' | 'resplit'
 *             - underline       蓝色下划线 + 蓝色激活文字 + 底部全宽分隔线（默认）
 *             - underline-ghost 蓝色下划线 + 蓝色激活文字，无底部分隔线
 *             - plain           无下划线，激活态为白色加粗文字，有底部全宽分隔线
 *             - plain-ghost     无下划线，激活态为白色加粗文字，无底部分隔线
 *             - resplit         AI 重新分集弹窗中的等宽目标集数切换，支持输入项和单位
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  为 resplit 变体增加可编辑输入项和单位插槽
 *   2026-08-04  为 resplit 输入项增加两侧 8px 计步器，数字和单位保持居中
 */

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function Tabs({
  options = [],
  value,
  onChange,
  inputValue,
  onInputChange,
  onInputStep,
  gap = '24px',
  variant = 'underline',
}) {
  if (variant === 'resplit') {
    return (
      <div className="[font-synthesis:none] flex w-full antialiased" style={{ gap }}>
        {options.map((opt) => {
          const active = value === opt.value;
          const hasStepper = Boolean(opt.input && opt.stepper);
          const handleStepperClick = (event, delta) => {
            event.stopPropagation();
            onChange?.(opt.value);
            onInputStep?.(delta);
          };

          if (opt.input) {
            return (
              <div
                key={opt.value}
                role="tab"
                aria-selected={active}
                tabIndex={0}
                onClick={() => onChange?.(opt.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onChange?.(opt.value);
                  }
                }}
                className="relative flex h-[40px] min-w-0 flex-1 items-center justify-center rounded-[6px] border-0 px-[8px] text-[14px] leading-[18px] transition-[background-color,outline-color] duration-150"
                style={{ background: active ? '#2DC3E133' : '#FFFFFF14', outline: active ? '1px solid #2DC3E1' : 'none', color: '#FFFFFF', fontFamily: FONT }}
              >
                {hasStepper && (
                  <button
                    type="button"
                    aria-label={opt.decrementAriaLabel || '减少集数'}
                    onClick={(event) => handleStepperClick(event, -1)}
                    className="absolute left-[8px] top-1/2 flex h-[24px] w-[24px] -translate-y-1/2 items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-[18px] leading-[18px] text-[#FFFFFF99] transition-colors hover:bg-[#FFFFFF14] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2DC3E1]"
                  >
                    −
                  </button>
                )}
                <span className="flex min-w-0 items-center justify-center gap-[4px]">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={opt.inputAriaLabel || opt.label}
                    value={inputValue ?? ''}
                    onChange={(event) => onInputChange?.(event.target.value)}
                    onClick={(event) => { event.stopPropagation(); onChange?.(opt.value); }}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="w-[24px] min-w-0 border-0 bg-transparent p-0 text-center text-[14px] leading-[18px] text-white outline-none"
                    style={{ fontFamily: FONT }}
                  />
                  {opt.suffix && <span className="shrink-0 text-[14px] leading-[18px] text-[#FFFFFF66]">{opt.suffix}</span>}
                </span>
                {hasStepper && (
                  <button
                    type="button"
                    aria-label={opt.incrementAriaLabel || '增加集数'}
                    onClick={(event) => handleStepperClick(event, 1)}
                    className="absolute right-[8px] top-1/2 flex h-[24px] w-[24px] -translate-y-1/2 items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-[18px] leading-[18px] text-[#FFFFFF99] transition-colors hover:bg-[#FFFFFF14] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2DC3E1]"
                  >
                    +
                  </button>
                )}
              </div>
            );
          }

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange?.(opt.value)}
              className="relative flex h-[40px] min-w-0 flex-1 items-center justify-center gap-[8px] rounded-[6px] border-0 px-[12px] text-[14px] leading-[18px] transition-[background-color,outline-color] duration-150"
              style={{ background: active ? '#2DC3E133' : '#FFFFFF14', outline: active ? '1px solid #2DC3E1' : 'none', color: '#FFFFFF', fontFamily: FONT }}
            >
              {opt.icon && <span style={{ display: 'inline-flex', width: '16px', height: '16px', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{opt.icon}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  const hasUnderline = variant === 'underline' || variant === 'underline-ghost';
  const hasSeparator = variant === 'underline';

  return (
    <div
      className="[font-synthesis:none] antialiased flex items-baseline pt-3 pb-[10px] relative"
      style={{ gap }}
    >
      {options.map((opt) => {
        const active = value === opt.value;

        // ── 按钮类名 ──────────────────────────────────────────────
        let btnClass = 'bg-transparent border-0 p-0 cursor-pointer';
        if (active && hasUnderline) {
          // border-0 先清空所有边框，border-b-2 longhand 单独恢复底边，实现"仅底部下划线"
          btnClass = 'flex items-center gap-[4px] pb-[6px] border-0 border-b-2 border-b-solid border-b-[#2DC3E1] bg-transparent p-0 cursor-pointer';
        }

        // ── 文字颜色 ──────────────────────────────────────────────
        let color;
        if (active) {
          color = hasUnderline ? '#2DC3E1' : '#FFFFFF';
        } else {
          color = '#FFFFFF99';
        }

        // ── 字体粗细 ──────────────────────────────────────────────
        // underline 变体：激活用 Medium；plain/plain-ghost 变体：激活也用 Medium（白色加粗）
        const fontFamily = active ? FONT_MEDIUM : FONT;

        // ── 行高：激活态略高以配合 Medium 字重 ────────────────────
        const lineHeightClass = active ? 'text-[14px] leading-[20px]' : 'text-[14px] leading-[18px]';

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            className={btnClass}
          >
            <span
              className={lineHeightClass}
              style={{ fontFamily, color }}
            >
              {opt.label}
            </span>
          </button>
        );
      })}

      {/* 底部全宽分隔线：仅 underline 变体渲染 */}
      {hasSeparator && (
        <span className="h-px absolute left-0 right-0 top-[39px] bg-[#FFFFFF14] pointer-events-none" />
      )}
    </div>
  );
}
