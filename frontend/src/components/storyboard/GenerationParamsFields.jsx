/**
 * @file GenerationParamsFields.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   GenerationParamsFields 组合生成面板中的模型、时长和分辨率选择器
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收展示值、选项和变更回调，不调用模型 API、不读取页面状态
 */
import PanelSelect from './PanelSelect';

export function GenerationModelField({ label = '选择模型', value, options, disabled = false, onChange }) {
  return <PanelSelect label={label} value={value} options={options} disabled={disabled} onChange={onChange} />;
}

export function GenerationOptionFields({ duration, durationOptions, resolution, resolutionOptions, onDurationChange, onResolutionChange, showDuration = false }) {
  return (
    <>
      {showDuration && <PanelSelect label="时长" value={duration} options={durationOptions} onChange={onDurationChange} />}
      <PanelSelect label="分辨率" value={resolution} options={resolutionOptions} onChange={onResolutionChange} />
    </>
  );
}
