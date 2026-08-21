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
import { ModelIcon, ReferenceModeIcon } from '../ui';

export function GenerationModelField({ label = '选择模型', value, options, disabled = false, onChange }) {
  const modelOptions = (options || []).map((opt) => {
    const optLabel = typeof opt === 'object' ? opt.label : opt;
    return { label: optLabel, icon: <ModelIcon name={optLabel} /> };
  });
  return (
    <PanelSelect
      label={label}
      value={value}
      options={modelOptions}
      disabled={disabled}
      onChange={onChange}
      startIcon={(
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, opacity: 0.8 }}>
          <ModelIcon name={value} />
        </span>
      )}
    />
  );
}

export function GenerationReferenceModeField({ value, options, disabled = false, onChange }) {
  const referenceModeOptions = (options || []).map((option) => {
    const label = typeof option === 'object' ? option.label : option;
    const mode = typeof option === 'object' ? option.value : label;
    return { label, value: mode, icon: <ReferenceModeIcon mode={mode} /> };
  });

  return (
    <PanelSelect
      label="参考模式"
      value={value}
      options={referenceModeOptions}
      disabled={disabled}
      onChange={onChange}
      startIcon={(
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, color: '#FFFFFF', opacity: 0.8 }}>
          <ReferenceModeIcon mode={value} />
        </span>
      )}
    />
  );
}

export function GenerationOptionFields({ duration, durationOptions, resolution, resolutionOptions, onDurationChange, onResolutionChange, showDuration = false }) {
  return (
    <>
      {showDuration && <PanelSelect label="时长" value={duration} options={durationOptions} onChange={onDurationChange} />}
      <PanelSelect label="分辨率" value={resolution} options={resolutionOptions} onChange={onResolutionChange} />
    </>
  );
}
