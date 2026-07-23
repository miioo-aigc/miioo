/**
 * @file SubjectGenerationOptions.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectGenerationOptions  主体生图模型、画面比例和分辨率选择区
 *   Select                     由 components/ui 提供的通用受控下拉选择器
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收模型能力、当前选中值和变更回调
 *   不调用 API、不读取 Store、不修改页面状态、不依赖页面组件
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体生图选项区
 *   2026-07-15  改为复用 components/ui/Select 基础选择器
 */
import { Select } from '../ui';

export default function SubjectGenerationOptions({
  imageModels = [],
  modelsLoading = false,
  selectedModel = '',
  selectedRatio = '',
  selectedResolution = '',
  availableRatios = [],
  availableResolutions = [],
  onModelChange,
  onRatioChange,
  onResolutionChange,
}) {
  const selectedModelLabel = imageModels.find((model) => model.value === selectedModel)?.label || selectedModel;

  return (
    <>
      <Select
        label="选择模型"
        width="100%"
        value={selectedModel}
        displayValue={selectedModelLabel}
        options={imageModels}
        loading={modelsLoading}
        loadingText="加载模型中…"
        onChange={onModelChange}
      />
      <Select
        label="选择画面比例"
        width="100%"
        value={selectedRatio}
        options={availableRatios}
        onChange={onRatioChange}
      />
      <Select
        label="分辨率"
        width="100%"
        value={selectedResolution}
        options={availableResolutions}
        onChange={onResolutionChange}
      />
    </>
  );
}
