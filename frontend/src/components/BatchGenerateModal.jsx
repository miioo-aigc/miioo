/**
 * @file BatchGenerateModal.jsx
 * @structure-index
 *
 * ─── 常量与局部组件 ─────────────────────────────────────────────────
 *   FALLBACK_MODELS / GENERATION_MODES  模型兜底数据和批量生成方式
 *   CloseIcon                         弹窗关闭图标
 *   RadioGroup                        生成方式单选组
 *   BatchGenerateModal                模型、比例、分辨率和批量生成参数编排
 *
 * ─── 状态与数据流 ───────────────────────────────────────────────────
 *   modelList / modelsLoading         模型能力请求及加载状态
 *   model / ratio / resolution        当前模型和生成选项
 *   mode / onlyUndrafted              生成方式及未定稿筛选状态
 *   ratioOptions / resolutionOptions  按模型能力派生的选择项
 *
 * ─── 副作用与业务回调 ───────────────────────────────────────────────
 *   模型列表请求                     打开弹窗时读取 image 模型能力
 *   弹窗重置                         打开弹窗时恢复默认模型和 16:9 画面比例
 *   ESC 关闭                         弹窗打开时监听 Escape
 *   handleModelChange                切换模型并校正分辨率和比例
 *   handleResolutionChange           切换分辨率并校正比例
 *   handleConfirm                    保持批量生成确认参数结构不变
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  复用 components/ui/Select，移除批量生成弹窗内重复选择器
 *   2026-07-22  批量生成弹窗内模型、比例和分辨率选择器改为填满父级宽度
 *   2026-07-22  批量生成角色弹窗的多视图生成方式调整为首位
 *   2026-07-22  批量生成角色弹窗默认生成方式改为多视图
 *   2026-07-22  批量生成进行中允许通过关闭和取消按钮退出弹窗
 *   2026-07-23  批量生成弹窗默认选中“仅生成未定稿”
 *   2026-08-07  批量生成弹窗默认画面比例改为 16:9，不再继承项目画幅
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
// 模型能力直接从后端 capabilities 获取
import { apiListModels } from '../api/config';
import { Select } from './ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const ACCENT_BUTTON_GRADIENT =
  'linear-gradient(in oklab 107.50999999999999deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)';

// 本地兜底模型列表（后端不可用时使用）
const FALLBACK_MODELS = [
  { value: 'doubao-seedream-5.0-lite', label: 'Doubao-Seed-5.0-Lite', resolutions: ['2K','3K','4K'], resolutionSizeMap: {}, ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'] },
  { value: 'doubao-seedream-4.5', label: 'Doubao-Seed-4.5', resolutions: ['2K','4K'], resolutionSizeMap: {}, ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'] },
  { value: 'doubao-seedream-4.0', label: 'Doubao-Seed-4.0', resolutions: ['1K','2K','4K'], resolutionSizeMap: {}, ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'] },
];

const GENERATION_MODES = [
  { label: '多视图', value: 'three_view' },
  { label: '主视图', value: 'single' },
];

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RadioGroup({ label, value, options, onChange }) {
  return (
    <div className="flex flex-col gap-[8px] self-stretch">
      <div className="text-sm/[18px] text-[#FFFFFF99]" style={{ fontFamily: FONT }}>
        {label}
      </div>
      <div className="flex gap-[24px] self-stretch items-center">
        {options.map((opt) => {
          const checked = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="flex items-center gap-[8px] p-0 bg-transparent border-0 cursor-pointer"
            >
              <div className="shrink-0 relative w-[16px] h-[16px]">
                <div
                  className="rounded-full border border-solid outline outline-1 outline-[#00000080] w-[16px] h-[16px] transition-colors"
                  style={{ backgroundColor: checked ? '#2DC3E1' : '#090909', borderColor: '#FFFFFF33' }}
                />
                {checked && (
                  <div
                    className="absolute rounded-full bg-[#0A0A0A] w-[6px] h-[6px]"
                    style={{ left: '50%', top: '50%', translate: '-50% -50%' }}
                  />
                )}
              </div>
              <span
                className="text-sm/[18px] transition-colors"
                style={{ fontFamily: FONT, color: checked ? '#FFFFFF' : '#FFFFFF99' }}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BatchGenerateModal({ open, onClose, onConfirm, generating = false, activeTab = 'char' }) {
  // ── 从后端拉取模型列表，与本地能力表合并 ──────────────────────
  const [modelList, setModelList] = useState(FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await apiListModels({ category: 'image' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        const merged = list.map((m) => {
          const modelId = m.model_id || m.id;
        const caps = m.capabilities || {};
         const resolutions = (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
         const resolutionSizeMap = caps.resolution_size_map || {};
          const ratios = caps.supported_aspect_ratios || [];
         return {
           value: modelId,
            label: m.name || modelId,
            resolutions,
            resolutionSizeMap,
            ratios,
            is_default: m.is_default,
         };
        });
        setModelList(merged.length > 0 ? merged : FALLBACK_MODELS);
      } catch {
        setModelList(FALLBACK_MODELS);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, [open]);

  const defaultModel = modelList.find(m => m.is_default) || modelList[0];
  const [model, setModel] = useState(defaultModel?.value || '');
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState('2K');
  const [mode, setMode] = useState('three_view');
  const [onlyUndrafted, setOnlyUndrafted] = useState(true);

  // 根据当前选中的模型 + 分辨率，动态计算可用的比例列表
 const ratioOptions = useMemo(() => {
   const selected = modelList.find(m => m.value === model);
   if (!selected) return [];
   const resRatios = selected.resolutionSizeMap?.[resolution];
    // 空映射（resolutionSizeMap[res] 为 {}）表示「该分辨率不限制比例」，回退到模型全局比例，
    // 否则会把比例错误过滤成空白（新接入模型常为空 resolution_size_map）
    if (resRatios && Object.keys(resRatios).length > 0) return Object.keys(resRatios).map((r) => ({ value: r, label: r }));
    // resolutionSizeMap 中没有当前分辨率时，回退到模型全局支持的 aspect ratios
    return (selected.ratios || []).map((r) => ({ value: r, label: r }));
 }, [model, resolution, modelList]);

  // 根据当前选中的模型，动态计算可用的分辨率列表
  const resolutionOptions = useMemo(() => {
    const selected = modelList.find(m => m.value === model);
    if (!selected || selected.resolutions.length === 0) return [];
    return selected.resolutions.map((r) => ({ label: r, value: r }));
  }, [model, modelList]);

  // 切换模型时：保留当前比例/分辨率（若新模型支持），否则回退第一个
  const handleModelChange = useCallback((newModel) => {
    setModel(newModel);
    const selected = modelList.find(m => m.value === newModel);
    const resList = selected?.resolutions || [];
    if (resList.length > 0) {
      const currentResSupported = resList.includes(resolution);
      const newRes = currentResSupported ? resolution : resList[0];
      setResolution(newRes);
      const resRatios = selected?.resolutionSizeMap?.[newRes];
      if (resRatios) {
        const ratioKeys = Object.keys(resRatios);
        if (currentResSupported && ratioKeys.includes(ratio)) {
          setRatio(ratio);
        } else {
          setRatio(ratioKeys[0] || '16:9');
        }
      } else if (selected?.ratios?.length) {
        if (selected.ratios.includes(ratio)) {
          setRatio(ratio);
        } else {
          setRatio(selected.ratios[0]);
        }
      }
    }
  }, [modelList, ratio, resolution]);

  // 切换分辨率时：检查当前比例在新分辨率下是否可用，不可用则切到第一个
  const handleResolutionChange = useCallback((newRes) => {
    setResolution(newRes);
    const selected = modelList.find(m => m.value === model);
   const resRatios = selected?.resolutionSizeMap?.[newRes];
   if (resRatios) {
     const validRatios = Object.keys(resRatios);
     if (!validRatios.includes(ratio)) {
       setRatio(validRatios[0]);
     }
   }
    else {
      const allRatios = selected?.ratios || [];
      if (!allRatios.includes(ratio)) {
        setRatio(allRatios[0] || '16:9');
      }
    }
  }, [model, ratio, modelList]);

  const resetForm = useCallback(() => {
    setRatio('16:9');
    const first = modelList.find(m => m.is_default) || modelList[0];
    if (!first) return;
    setModel(first.value);
    const resList = first.resolutions || [];
    if (resList.length > 0) {
      setResolution(resList[0]);
      const resRatios = first.resolutionSizeMap?.[resList[0]];
      if (resRatios) {
        const ratioKeys = Object.keys(resRatios);
        const availableRatios = ratioKeys.length > 0 ? ratioKeys : (first.ratios || []);
        setRatio(availableRatios.includes('16:9') ? '16:9' : (availableRatios[0] || '16:9'));
      } else if (first.ratios?.length) {
        setRatio(first.ratios.includes('16:9') ? '16:9' : first.ratios[0]);
      }
    }
    setMode('three_view');
    setOnlyUndrafted(true);
  }, [modelList]);

  // 每次打开弹窗时，重置为第一个模型的默认值，画面比例优先使用 16:9。
  useEffect(() => {
    if (!open) return;
    // 弹窗打开和模型异步加载完成时，必须同步恢复原有受控表单初始值。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetForm();
  }, [open, resetForm]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    await onConfirm?.({ model, ratio, resolution, mode, only_undrafted: onlyUndrafted });
    // onClose 由父组件在成功后自行调用，避免异步请求未完成就关闭弹窗
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#00000066] backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="[font-synthesis:none] flex flex-col items-start antialiased text-xs/4 w-[400px] rounded-2xl"
        style={{ boxShadow: '0px 8px 32px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-[16px] justify-between w-full py-[16px] bg-[#161616] rounded-t-2xl px-[24px]">
          <div className="flex-1 text-base/5 font-medium text-white" style={{ fontFamily: FONT_MEDIUM }}>
            批量生成
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center transition-opacity hover:opacity-70 active:opacity-40"
            aria-label="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-start gap-[16px] py-[8px] w-full px-[24px] bg-[#161616]">
          <Select
            label="选择模型"
            width="100%"
            value={model}
            displayValue={modelList.find((item) => item.value === model)?.label || model}
            options={modelList}
            loading={modelsLoading}
            loadingText="加载模型中…"
            selectedOptionColor="#FFFFFF"
            selectedOptionBackground="rgba(255,255,255,0.08)"
            optionHoverBackground="rgba(255,255,255,0.05)"
            menuMaxHeight="240px"
            openBoxShadow="0px 0px 10px rgba(45,195,225,0.3)"
            openMixBlendMode="lighten"
            onChange={handleModelChange}
          />
          <Select
            label="比例"
            width="100%"
            value={ratio}
            options={ratioOptions}
            selectedOptionColor="#FFFFFF"
            selectedOptionBackground="rgba(255,255,255,0.08)"
            optionHoverBackground="rgba(255,255,255,0.05)"
            menuMaxHeight="240px"
            openBoxShadow="0px 0px 10px rgba(45,195,225,0.3)"
            openMixBlendMode="lighten"
            onChange={setRatio}
          />
          <Select
            label="分辨率"
            width="100%"
            value={resolution}
            options={resolutionOptions}
            selectedOptionColor="#FFFFFF"
            selectedOptionBackground="rgba(255,255,255,0.08)"
            optionHoverBackground="rgba(255,255,255,0.05)"
            menuMaxHeight="240px"
            openBoxShadow="0px 0px 10px rgba(45,195,225,0.3)"
            openMixBlendMode="lighten"
            onChange={handleResolutionChange}
          />
          {activeTab === 'char' && (
            <RadioGroup label="生成方式" value={mode} options={GENERATION_MODES} onChange={setMode} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-[16px] justify-between w-full bg-[#161616] py-[16px] px-[24px] rounded-b-2xl">
          {/* 左侧：仅生成未定稿 checkbox（角色/场景/道具通用） */}
          <label
            onClick={() => setOnlyUndrafted(v => !v)}
            className="flex items-center gap-[4px] cursor-pointer select-none"
          >
            <div className="flex items-center gap-0 p-[2px]">
              <div
                className={
                  "relative rounded-sm shrink-0 border border-solid w-[16px] h-[16px] [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 " +
                  (onlyUndrafted
                    ? "bg-checkbox-bg-active border-checkbox-border-active"
                    : "bg-checkbox-bg-normal border-checkbox-border-normal")
                }
              >
                {onlyUndrafted && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%" }}>
                    <path d="M3.333 8L6.667 11.333L13.333 4.667"
                      stroke="#090909" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm/[18px] text-[#FFFFFFCC]" style={{ fontFamily: FONT }}>
              {activeTab === 'scene' ? '仅生成未定稿场景' : activeTab === 'prop' ? '仅生成未定稿道具' : '仅生成未定稿角色'}
            </span>
          </label>
          <div className="flex items-center gap-[16px]">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center h-[36px] shrink-0 rounded-lg px-[16px] gap-[4px] bg-[#161616] border border-solid border-[#FFFFFF0D] outline outline-1 outline-[#00000080] transition-colors hover:bg-[#1D1E1E] active:bg-[#111111]"
            style={{ boxShadow: '#00000066 3px 3px 8px' }}
          >
            <span className="text-sm/[18px] text-[#FFFFFF99]" style={{ fontFamily: FONT }}>取消</span>
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={generating || modelsLoading}
            className="flex items-center h-[36px] shrink-0 rounded-lg px-[16px] gap-[4px] bg-[#2DC3E1] bg-origin-border border border-solid border-[#FFFFFF33] outline outline-1 outline-[#00000080] transition-colors hover:bg-[#53D3ED] active:bg-[#139EBA] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundImage: ACCENT_BUTTON_GRADIENT }}
          >
            <span className="text-sm/[18px] font-medium text-[#090909]" style={{ fontFamily: FONT_MEDIUM }}>
              {generating ? '生成中…' : '开始生成'}
            </span>
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
