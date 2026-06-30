import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
// 模型能力直接从后端 capabilities 获取
import { apiListModels } from '../api/config';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const ACCENT_BUTTON_GRADIENT =
  'linear-gradient(in oklab 107.50999999999999deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)';

// 本地兜底模型列表（后端不可用时使用）
const FALLBACK_MODELS = [
  { value: 'doubao-seedream-5.0-lite', label: 'Doubao-Seed-5.0-Lite', resolutions: ['2K','3K','4K'], resolutionSizeMap: {} },
  { value: 'doubao-seedream-4.5', label: 'Doubao-Seed-4.5', resolutions: ['2K','4K'], resolutionSizeMap: {} },
  { value: 'doubao-seedream-4.0', label: 'Doubao-Seed-4.0', resolutions: ['1K','2K','4K'], resolutionSizeMap: {} },
];

const GENERATION_MODES = [
  { label: '主视图', value: 'main' },
  { label: '多视图', value: 'three_view' },
];

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
    </svg>
  );
}

function SelectField({ label, value, options, onChange, loading = false }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const triggerStyle = open
    ? { borderColor: '#2DC3E1', backgroundColor: '#1D1E1E', boxShadow: '0px 0px 10px rgba(45,195,225,0.3)', mixBlendMode: 'lighten' }
    : {};

  return (
    <div className="flex flex-col gap-[8px] self-stretch">
      <div className="text-sm/[18px] text-[#FFFFFF99]" style={{ fontFamily: FONT }}>
        {label}
      </div>
      <div ref={containerRef} className="relative self-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center h-[36px] w-full rounded-lg px-[12px] gap-[8px] shrink-0 bg-[#1D1E1E] border border-solid border-[#FFFFFF14] outline outline-1 outline-[#00000080] transition-[border-color,background-color] hover:border-[#FFFFFF33] hover:bg-[#222323] active:bg-[#1A1B1B]"
          style={triggerStyle}
          aria-expanded={open}
        >
          <div className="flex-1 text-left text-sm/[18px] text-white" style={{ fontFamily: FONT }}>
            {loading ? '加载模型中…' : (selected?.label ?? '请选择')}
          </div>
          <ChevronDownIcon />
        </button>

        {open && (
          <div
           className="absolute top-[calc(100%+4px)] left-0 z-10 w-full flex flex-col rounded-lg border border-solid border-[#FFFFFF14] bg-[#1D1E1E] p-[4px]"
            style={{ boxShadow: '0px 4px 16px rgba(0,0,0,0.6)', maxHeight: '240px', overflowY: 'auto' }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex w-full items-center rounded-md px-[12px] py-[8px] text-left text-sm/[18px] transition-colors ${
                    isSelected
                      ? 'bg-[#FFFFFF14] text-white'
                      : 'text-[#FFFFFFCC] hover:bg-[#FFFFFF0D] hover:text-white active:bg-[#FFFFFF14]'
                  }`}
                  style={{ fontFamily: FONT }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
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

export default function BatchGenerateModal({ open, onClose, onConfirm, generating = false, projectRatio, activeTab = 'char' }) {
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
  const [ratio, setRatio] = useState(projectRatio || '16:9');
  const [resolution, setResolution] = useState('2K');
  const [mode, setMode] = useState('main');

  // 根据当前选中的模型 + 分辨率，动态计算可用的比例列表
 const ratioOptions = useMemo(() => {
   const selected = modelList.find(m => m.value === model);
   if (!selected) return [];
   const resRatios = selected.resolutionSizeMap?.[resolution];
    if (resRatios) return Object.keys(resRatios).map((r) => ({ value: r, label: r }));
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

  // 每次打开弹窗时，重置为第一个模型的默认值（比例优先用项目比例）
  useEffect(() => {
    if (!open) return;
    const first = modelList.find(m => m.is_default) || modelList[0];
    if (!first) return;
    setModel(first.value);
    const resList = first.resolutions || [];
    if (resList.length > 0) {
      setResolution(resList[0]);
      const resRatios = first.resolutionSizeMap?.[resList[0]];
      if (resRatios) {
        const ratioKeys = Object.keys(resRatios);
        if (projectRatio && ratioKeys.includes(projectRatio)) {
          setRatio(projectRatio);
        } else {
          setRatio(ratioKeys[0] || '16:9');
        }
      }
    }
    setMode('main');
  }, [open, modelList]);

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
    await onConfirm?.({ model, ratio, resolution, mode });
    // onClose 由父组件在成功后自行调用，避免异步请求未完成就关闭弹窗
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#00000066] backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="[font-synthesis:none] flex flex-col items-start antialiased text-xs/4 w-[400px] rounded-2xl overflow-hidden"
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
          <SelectField label="选择模型" value={model} options={modelList} onChange={handleModelChange} loading={modelsLoading} />
          <SelectField label="比例" value={ratio} options={ratioOptions} onChange={setRatio} />
          <SelectField label="分辨率" value={resolution} options={resolutionOptions} onChange={handleResolutionChange} />
          {activeTab === 'char' && (
            <RadioGroup label="生成方式" value={mode} options={GENERATION_MODES} onChange={setMode} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-[16px] justify-end w-full bg-[#161616] py-[16px] px-[24px] rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="flex items-center h-[36px] shrink-0 rounded-lg px-[16px] gap-[4px] bg-[#161616] border border-solid border-[#FFFFFF0D] outline outline-1 outline-[#00000080] transition-colors hover:bg-[#1D1E1E] active:bg-[#111111] disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}
