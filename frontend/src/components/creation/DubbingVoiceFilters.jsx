/**
 * @file DubbingVoiceFilters.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   配音音色弹窗的固定筛选条件区，展示语言、口音、性别与年龄下拉控件。
 *
 * ─── 数据流 ─────────────────────────────────────────────────────────
 *   通过受控 filters、options 和 onChange 接收弹窗的筛选状态，不读取 API、Store 或页面状态。
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-08-18  按选择音色弹窗筛选设计稿新增
 *   2026-08-31  语言筛选项统一中文展示并保留后端原始值
 *   2026-08-31  语言和口音下拉选项支持双向联动
 */
import { Select } from "../ui";
import { getLanguageDisplayName } from "./DubbingVoiceLanguage";

const FILTER_FIELDS = [
  { key: "language", label: "语言", optionKey: "languages" },
  { key: "accent", label: "口音", optionKey: "accents" },
  { key: "gender", label: "性别", optionKey: "genders" },
  { key: "ageGroup", label: "年龄", optionKey: "ageGroups" },
];

export default function DubbingVoiceFilters({ filters, options, onChange }) {
  return (
    <div aria-label="音色筛选条件" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px", flexShrink: 0 }}>
      {FILTER_FIELDS.map((field) => (
        <Select
          key={field.key}
          label={field.label}
          value={filters[field.key]}
          displayValue={field.key === "language" ? getLanguageDisplayName(filters[field.key]) : filters[field.key]}
          options={field.key === "language" ? [{ value: "不限", label: "不限" }, ...(options[field.optionKey] || [])] : ["不限", ...(options[field.optionKey] || [])]}
          width="100%"
          menuMaxHeight="216px"
          onChange={(value) => onChange?.(field.key, value)}
        />
      ))}
    </div>
  );
}
