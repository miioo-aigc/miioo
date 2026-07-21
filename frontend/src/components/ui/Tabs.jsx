/**
 * @file Tabs.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   Tabs 提供标签导航（tabs）视觉和交互，支持四种外观变体
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收选项、当前值和变更回调，不调用 API、不读取 Store
 *
 * ─── Props ──────────────────────────────────────────────────────────
 *   options   { value: string, label: string }[]  选项列表
 *   value     string                               当前选中值
 *   onChange  (value: string) => void              选中回调
 *   gap       string                               选项间距，默认 '24px'
 *   variant   'underline' | 'underline-ghost' | 'plain' | 'plain-ghost'
 *             - underline       蓝色下划线 + 蓝色激活文字 + 底部全宽分隔线（默认）
 *             - underline-ghost 蓝色下划线 + 蓝色激活文字，无底部分隔线
 *             - plain           无下划线，激活态为白色加粗文字，有底部全宽分隔线
 *             - plain-ghost     无下划线，激活态为白色加粗文字，无底部分隔线
 */

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function Tabs({
  options = [],
  value,
  onChange,
  gap = '24px',
  variant = 'underline',
}) {
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
