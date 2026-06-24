 import { useState, useEffect, useRef, useCallback, useMemo } from "react";
 import { createPortal } from "react-dom";
 import { FONT, FONT_MEDIUM } from "../../utils/fonts";
import { apiListModels } from '../../api/config';
import { apiBindSubjectReferenceImages, apiDownloadSubjectImage, apiGenerateSubjectImage, apiGetSubjectDetail, apiSetPrimarySubjectImage, apiUploadSubjectReferenceImage } from '../../api/subject';
import { triggerBlobDownload } from '../../utils/downloadImage';
import { normalizeImageUrl } from '../../utils/imageUrl';
import ChevronDownIcon from '../../components/ChevronDownIcon';
import ImageItem from './ImageItem';
const pendingGenerations = new Map();
import ImageItemUpload from './ImageItemUpload';
import ImageViewModal from './ImageViewModal';
import RadioOption from './RadioOption';
import RefImageField from './RefImageField';

export default 
function EditSubjectPanel({ projectId, char, tabLabel = '角色', projectRatio, onClose, onCommit, onCoverChange, refreshToken, setBatchLoadingSubjects }) {
  // ── 从后端拉取模型列表，直接使用后端 capabilities ──────────────
  const [imageModels, setImageModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let merged;
      try {
        const data = await apiListModels({ category: 'image' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        merged = list.map((m) => {
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
            maxRefImages: caps.max_reference_images || 3,
          };
        });
        setImageModels(merged.length > 0 ? merged : getFallbackModels());
      } catch {
        setImageModels(getFallbackModels());
      } finally {
        setModelsLoading(false);
      }

      // 如果角色没有预设模型，加载完后自动选中默认模型
      if (merged.length > 0 && !char?.model && !char?.default_image_model) {
        const def = merged.find(m => m.is_default) || merged[0];
        if (def) setSelectedModel(def.value);
      }
    })();
  }, [projectId]);

  // 本地兜底（后端不可用时）
  function getFallbackModels() {
    return [
      { value: 'doubao-seedream-5.0-lite', label: 'Doubao-Seed-5.0-Lite', resolutions: ['2K','3K','4K'], resolutionSizeMap: {}, ratios: ['1:1','16:9','9:16','4:3','3:4'], maxRefImages: 3 },
      { value: 'doubao-seedream-4.5', label: 'Doubao-Seed-4.5', resolutions: ['2K','4K'], resolutionSizeMap: {}, ratios: ['1:1','16:9','9:16','4:3','3:4'], maxRefImages: 3 },
      { value: 'doubao-seedream-4.0', label: 'Doubao-Seed-4.0', resolutions: ['1K','2K','4K'], resolutionSizeMap: {}, ratios: ['1:1','16:9','9:16','4:3','3:4'], maxRefImages: 3 },
    ];
  }

  const [closeHovered, setCloseHovered] = useState(false);
  const [genHovered, setGenHovered] = useState(false);
  const [genPressed, setGenPressed] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const [promptHovered, setPromptHovered] = useState(false);
  // 提示词：优先从 char 对象取，再从后端拉取
  const [promptText, setPromptText] = useState(char?.prompt || char?.prompt_text || '');
  const [modelHovered, setModelHovered] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  // 模型：优先从 char 对象取，否则用默认
  const [selectedModel, setSelectedModel] = useState(char?.model || char?.default_image_model || imageModels[0]?.value || 'doubao-seedream-5.0-lite');
  const modelTriggerRef = useRef(null);
  const [ratioHovered, setRatioHovered] = useState(false);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState(char?.ratio || projectRatio || '16:9');
  const ratioTriggerRef = useRef(null);
  const [resolutionHovered, setResolutionHovered] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState(char?.resolution || '2K');
  const resolutionTriggerRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const ratioDropdownRef = useRef(null);
  const resolutionDropdownRef = useRef(null);
  const [genMode, setGenMode] = useState('main');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [refImageIds, setRefImageIds] = useState(Array.isArray(char?.reference_image_ids) ? char.reference_image_ids : []);
  const [viewImageUrl, setViewImageUrl] = useState(null);
  const [viewImageId, setViewImageId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const isMountedRef = useRef(true); // 跟踪组件是否已挂载，关闭弹窗后仍让请求跑完
  const [detailLoaded, setDetailLoaded] = useState(false);

  const [primaryImageUrl, setPrimaryImageUrl] = useState(null);
  const [primaryImageId, setPrimaryImageId] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── 从后端拉取主体详情和已生成图片 ─────────────────────────────
  useEffect(() => {
    if (!projectId || !char?.id) return;
    let cancelled = false;

    (async () => {
      // 只拉一次详情，SubjectDetailResponse 包含：
      //   subject (SubjectResponse)
      //   primary_image (SubjectImageResponse | null)
      //   candidate_images (SubjectImageResponse[])
      //   reference_images (SubjectReferenceImage[])
      //   latest_generate_config (SubjectGenerateConfig | null)
      const detailRes = await apiGetSubjectDetail(projectId, char.id).catch(() => null);
      if (cancelled) return;

      if (!detailRes) {
        if (!promptText) setPromptText(defaultPromptForTab(tabLabel));
        setDetailLoaded(true);
        return;
      }

      // ── 从 subject 字段读取基础信息 ──────────────────────────────
      const subject = detailRes.subject || detailRes;   // 兼容后端扁平返回
      const genCfg = detailRes.latest_generate_config || subject.gen_config || {};

      if (subject.prompt) setPromptText(subject.prompt);
      if (genCfg.model || subject.model) setSelectedModel(genCfg.model || subject.model);
      if (genCfg.ratio || subject.ratio) setSelectedRatio(genCfg.ratio || subject.ratio);
      if (genCfg.resolution || genCfg.size || subject.resolution) {
        setSelectedResolution(genCfg.resolution || genCfg.size || subject.resolution);
      }

      // ── 候选图列表（SubjectImageResponse[]） ─────────────────────
      // 字段：id, image_url, is_primary
      const candidateImgs = Array.isArray(detailRes.candidate_images) ? detailRes.candidate_images : [];
      const candidateMapped = candidateImgs.map((img) => ({
        id: img.id,
        rawUrl: img.image_url,
        url: normalizeImageUrl(img.image_url),
        settled: img.is_primary ?? false,
        isReference: false,
      }));

      // ── 手动上传的图（SubjectReferenceImage[]）也放入右侧列表 ────
      // 字段：asset_id, file_url, name, is_primary
      // 注意：不写入 refImageIds，参考图字段由用户在本次 session 手动选择，不从后端自动填充
      // settled 强制为 false：这类图片是用户手动上传的素材，不继承原资产的定稿状态
      const refImgs = Array.isArray(detailRes.reference_images) ? detailRes.reference_images : [];
      const refMapped = refImgs.map((img) => ({
        id: img.asset_id,
        rawUrl: img.file_url,
        url: normalizeImageUrl(img.file_url),
        settled: false,   // 手动上传的图永远不预设为定稿
        isReference: true,
      }));

      // 合并，候选图在前，手动上传在后，去重
      const seen = new Set();
      const seenUrls = new Set();
      let finalImages = [...candidateMapped, ...refMapped].filter((img) => {
        if (!img.id || seen.has(img.id)) return false;
        seen.add(img.id);
        if (img.url) seenUrls.add(img.url);
        return true;
      });

      // 检查是否有进行中/已完成的跨弹窗生成
      const pending = pendingGenerations.get(char.id);
      if (pending?.status === 'pending') {
        finalImages.unshift({ url: null, settled: false, id: pending.placeholderId, isReference: false });
      } else if (pending?.status === 'done' && !seenUrls.has(normalizeImageUrl(pending.rawUrl))) {
        finalImages.unshift({
          rawUrl: pending.rawUrl,
          url: normalizeImageUrl(pending.rawUrl),
          settled: false,
          id: pending.placeholderId,
          isReference: false,
        });
        pendingGenerations.delete(char.id);
      } else if (pending?.status === 'done') {
        pendingGenerations.delete(char.id);
      }

      if (finalImages.length > 0) {
        setGeneratedImages(finalImages);
      } else if (char?.imageUrl) {
        // 兜底用 char 的封面图
        setGeneratedImages([{ rawUrl: char.imageUrl, url: normalizeImageUrl(char.imageUrl), settled: true, id: char.imageUrl, isReference: false }]);
      } else {
        setGeneratedImages([]);
      }

      setDetailLoaded(true);

      // 将后端返回的定稿图同步到卡片封面
      const _settledImg = finalImages.find((img) => img.settled && img.rawUrl);
      if (_settledImg) {
        setPrimaryImageUrl(_settledImg.rawUrl);
        setPrimaryImageId(_settledImg.id);
        onCoverChange?.(_settledImg.rawUrl);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, char?.id, refreshToken]);

  // ── 默认提示词 ────────────────────────────────────────────────
  function defaultPromptForTab(tab) {
    const defaults = {
      '角色': '一只雄性成年角色，站姿平稳，角色设定图。',
      '场景': '一个场景环境，宽阔视野，场景设定图。',
      '道具': '一个道具，细节清晰，道具设定图。',
    };
    return defaults[tab] || '高质量设定图，细节清晰。';
  }

  // 获取当前模型的能力配置（直接从后端 capabilities 读取）
  const currentModel = imageModels.find(m => m.value === selectedModel) || {};
  // 比例根据当前选中的分辨率动态获取，不同分辨率可能支持不同比例
  const availableRatios = useMemo(() => {
    const resRatios = currentModel.resolutionSizeMap?.[selectedResolution];
    if (resRatios) return Object.keys(resRatios);
    return currentModel.ratios || [];
  }, [currentModel, selectedResolution]);
  const availableResolutions = currentModel.resolutions || [];
  const maxRefImages = currentModel.maxRefImages || 3;

  // 当模型切换时（非首次加载），保留当前比例/分辨率（若新模型支持）
  const prevModelRef = useRef(selectedModel);
  useEffect(() => {
    // 跳过首次渲染（初始化）
    if (!detailLoaded) {
      prevModelRef.current = selectedModel;
      return;
    }
    // 只有用户主动切换模型时才处理
    if (prevModelRef.current === selectedModel) return;
    prevModelRef.current = selectedModel;

    const newModel = imageModels.find(m => m.value === selectedModel);
    const resList = newModel?.resolutions || [];
    if (resList.length > 0) {
      // 若新模型支持当前分辨率则保留，否则回退到第一个
      const currentResSupported = resList.includes(selectedResolution);
      const newRes = currentResSupported ? selectedResolution : resList[0];
      setSelectedResolution(newRes);
      // 若新模型在该分辨率下支持当前比例则保留
      const resRatios = newModel?.resolutionSizeMap?.[newRes];
      if (resRatios) {
        const ratioKeys = Object.keys(resRatios);
        if (currentResSupported && ratioKeys.includes(selectedRatio)) {
          setSelectedRatio(selectedRatio);
        } else {
          setSelectedRatio(ratioKeys[0] || '16:9');
        }
      }
    } else {
      setSelectedResolution('');
      setSelectedRatio('16:9');
    }
  }, [selectedModel, detailLoaded, imageModels]);

  // 当选中的分辨率/比例不在当前模型支持列表中时，自动修正到第一个可用值
  useEffect(() => {
    if (!availableResolutions.includes(selectedResolution)) {
      setSelectedResolution(availableResolutions[0]);
    }
  }, [availableResolutions, selectedResolution]);
  useEffect(() => {
    if (!availableRatios.includes(selectedRatio)) {
      setSelectedRatio(availableRatios[0]);
    }
  }, [availableRatios, selectedRatio]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(e) {
      if (modelOpen && modelTriggerRef.current && !modelTriggerRef.current.contains(e.target) && modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setModelOpen(false);
      }
      if (ratioOpen && ratioTriggerRef.current && !ratioTriggerRef.current.contains(e.target) && ratioDropdownRef.current && !ratioDropdownRef.current.contains(e.target)) {
        setRatioOpen(false);
      }
      if (resolutionOpen && resolutionTriggerRef.current && !resolutionTriggerRef.current.contains(e.target) && resolutionDropdownRef.current && !resolutionDropdownRef.current.contains(e.target)) {
        setResolutionOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelOpen, ratioOpen, resolutionOpen]);

  function showToast(msg, type = 'success') {
    clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }
  const [charName, setCharName] = useState(char?.name ?? '');
  const [charDesc, setCharDesc] = useState(char?.desc ?? '');
  const [nameFocused, setNameFocused] = useState(false);
  const [nameHovered, setNameHovered] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [descHovered, setDescHovered] = useState(false);

  if (!char) return null;

  const selectStyle = (hovered) => ({
    display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', padding: '0 12px', gap: '8px',
    background: hovered ? '#222222' : '#1D1E1E',
    border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
    outline: '1px solid #00000080', cursor: 'pointer',
    transition: 'background 100ms, border-color 100ms',
  });

  return (
    <>
    {/* 点击遮罩层关闭弹窗 */}
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 49,
        background: 'transparent',
      }}
    />
    <div
      style={{
        position: 'fixed', top: '60px', right: '24px', bottom: '24px',
        width: '600px', zIndex: 50,
        display: 'flex', flexDirection: 'column',
        background: '#161616', border: '1px solid #FFFFFF14',
        borderRadius: '16px', boxShadow: '#00000099 0px 24px 64px',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBlock: '20px', paddingInline: '24px', background: '#161616', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>编辑{tabLabel}</span>
        <button
          type="button"
          onClick={onClose}
          onMouseEnter={() => setCloseHovered(true)}
          onMouseLeave={() => setCloseHovered(false)}
          style={{
            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: closeHovered ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, borderRadius: '6px',
            transition: 'background 100ms',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="2" y1="2" x2="14" y2="14" stroke={closeHovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66'} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="2" x2="2" y2="14" stroke={closeHovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66'} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* two-column body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', overflow: 'hidden' }}>
        {/* left: form */}
        <div style={{ width: 'round(70%, 1px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '24px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '80px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
          {/* name + desc — editable */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>角色名称</span>
            <div
              onMouseEnter={() => setNameHovered(true)}
              onMouseLeave={() => setNameHovered(false)}
              style={{
                display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', padding: '0 12px',
                background: nameFocused ? 'rgba(45,195,225,0.04)' : nameHovered ? '#222222' : '#1D1E1E',
                border: `1px solid ${nameFocused ? 'rgba(45,195,225,0.6)' : nameHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                outline: nameFocused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
                transition: 'border-color 120ms, background 120ms',
              }}
            >
              <input
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => { setNameFocused(false); onCommit?.(charName, charDesc); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>描述</span>
            <div
              onMouseEnter={() => setDescHovered(true)}
              onMouseLeave={() => setDescHovered(false)}
              style={{
                display: 'flex', flexDirection: 'column', height: '120px', borderRadius: '8px', padding: '9px 12px',
                background: descFocused ? 'rgba(45,195,225,0.04)' : descHovered ? '#222222' : '#1D1E1E',
                border: `1px solid ${descFocused ? 'rgba(45,195,225,0.6)' : descHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                outline: descFocused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
                transition: 'border-color 120ms, background 120ms',
              }}
            >
              <textarea
                value={charDesc}
                onChange={(e) => setCharDesc(e.target.value)}
                onFocus={() => setDescFocused(true)}
                onBlur={() => { setDescFocused(false); onCommit?.(charName, charDesc); }}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '150%', color: '#FFFFFF' }}
              />
            </div>
          </div>

          {/* prompt textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>提示词</span>
            <div
              onMouseEnter={() => setPromptHovered(true)}
              onMouseLeave={() => setPromptHovered(false)}
              style={{
                display: 'flex', flexDirection: 'column', height: '120px', borderRadius: '8px', padding: '9px 12px',
                background: promptFocused ? 'rgba(45,195,225,0.04)' : promptHovered ? '#222222' : '#1D1E1E',
                border: `1px solid ${promptFocused ? 'rgba(45,195,225,0.6)' : promptHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                outline: promptFocused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
                transition: 'border-color 120ms, background 120ms',
              }}
            >
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onFocus={() => setPromptFocused(true)}
                onBlur={() => setPromptFocused(false)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '150%', color: '#FFFFFF' }}
              />
            </div>
          </div>

          {/* model select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>选择模型</span>
            <div
              ref={modelTriggerRef}
              style={{ ...selectStyle(modelHovered || modelOpen), border: `1px solid ${modelOpen ? 'rgba(45,195,225,0.6)' : modelHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}` }}
              onMouseEnter={() => setModelHovered(true)}
              onMouseLeave={() => setModelHovered(false)}
              onClick={() => {
                console.log('[SubjectPage] 点击模型选择器，当前状态:', modelOpen);
                setModelOpen((v) => !v);
              }}
            >
              <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: modelsLoading ? '#FFFFFF66' : '#FFFFFF' }}>
                {modelsLoading ? '加载模型中…' : (imageModels.find(m => m.value === selectedModel)?.label || selectedModel)}
              </span>
              <ChevronDownIcon />
            </div>
            {modelOpen && createPortal(
              <div
                ref={modelDropdownRef}
                style={{
                  position: 'fixed',
                  top: `${(modelTriggerRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
                  left: `${modelTriggerRef.current?.getBoundingClientRect().left || 0}px`,
                  width: `${modelTriggerRef.current?.getBoundingClientRect().width || 200}px`,
                  zIndex: 9999,
                  background: '#1D1E1E',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {console.log('[SubjectPage] 渲染模型下拉菜单，选项数量:', imageModels.length)}
                {imageModels.map((model) => (
                  <div
                    key={model.value}
                    onClick={() => {
                      console.log('[SubjectPage] 点击模型选项:', model.value);
                      setSelectedModel(model.value);
                      setModelOpen(false);
                    }}
                    style={{
                      padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                      color: selectedModel === model.value ? '#2DC3E1' : '#FFFFFFCC',
                      background: selectedModel === model.value ? 'rgba(45,195,225,0.08)' : 'transparent',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => { if (selectedModel !== model.value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = selectedModel === model.value ? 'rgba(45,195,225,0.08)' : 'transparent'; }}
                  >
                    {model.label}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* ratio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>选择画面比例</span>
            <div
              ref={ratioTriggerRef}
              style={{ ...selectStyle(ratioHovered || ratioOpen), border: `1px solid ${ratioOpen ? 'rgba(45,195,225,0.6)' : ratioHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}` }}
              onMouseEnter={() => setRatioHovered(true)}
              onMouseLeave={() => setRatioHovered(false)}
              onClick={() => {
                console.log('[SubjectPage] 点击画面比例选择器，当前状态:', ratioOpen);
                setRatioOpen((v) => !v);
              }}
            >
              <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>{selectedRatio}</span>
              <ChevronDownIcon />
            </div>
            {ratioOpen && createPortal(
              <div
                ref={ratioDropdownRef}
                style={{
                  position: 'fixed',
                  top: `${(ratioTriggerRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
                  left: `${ratioTriggerRef.current?.getBoundingClientRect().left || 0}px`,
                  width: `${ratioTriggerRef.current?.getBoundingClientRect().width || 200}px`,
                  zIndex: 9999,
                  background: '#1D1E1E',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {console.log('[SubjectPage] 渲染画面比例下拉菜单，选项:', availableRatios)}
                {availableRatios.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => {
                      console.log('[SubjectPage] 点击画面比例选项:', opt);
                      setSelectedRatio(opt);
                      setRatioOpen(false);
                    }}
                    style={{
                      padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                      color: selectedRatio === opt ? '#2DC3E1' : '#FFFFFFCC',
                      background: selectedRatio === opt ? 'rgba(45,195,225,0.08)' : 'transparent',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => { if (selectedRatio !== opt) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = selectedRatio === opt ? 'rgba(45,195,225,0.08)' : 'transparent'; }}
                  >
                    {opt}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* quality */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>分辨率</span>
            <div
              ref={resolutionTriggerRef}
              style={{ ...selectStyle(resolutionHovered || resolutionOpen), border: `1px solid ${resolutionOpen ? 'rgba(45,195,225,0.6)' : resolutionHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}` }}
              onMouseEnter={() => setResolutionHovered(true)}
              onMouseLeave={() => setResolutionHovered(false)}
              onClick={() => {
                console.log('[SubjectPage] 点击分辨率选择器，当前状态:', resolutionOpen);
                setResolutionOpen((v) => !v);
              }}
            >
              <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>{selectedResolution}</span>
              <ChevronDownIcon />
            </div>
            {resolutionOpen && createPortal(
              <div
                ref={resolutionDropdownRef}
                style={{
                  position: 'fixed',
                  top: `${(resolutionTriggerRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
                  left: `${resolutionTriggerRef.current?.getBoundingClientRect().left || 0}px`,
                  width: `${resolutionTriggerRef.current?.getBoundingClientRect().width || 200}px`,
                  zIndex: 9999,
                  background: '#1D1E1E',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {console.log('[SubjectPage] 渲染分辨率下拉菜单，选项:', availableResolutions)}
                {availableResolutions.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => {
                      console.log('[SubjectPage] 点击分辨率选项:', opt);
                      setSelectedResolution(opt);
                      setResolutionOpen(false);
                    }}
                    style={{
                      padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                      color: selectedResolution === opt ? '#2DC3E1' : '#FFFFFFCC',
                      background: selectedResolution === opt ? 'rgba(45,195,225,0.08)' : 'transparent',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => { if (selectedResolution !== opt) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = selectedResolution === opt ? 'rgba(45,195,225,0.08)' : 'transparent'; }}
                  >
                    {opt}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* ref image */}
          <RefImageField
            maxImages={maxRefImages}
            projectId={projectId}
            subjectId={char?.id}
            refImageIds={refImageIds}
            onRefImagesChange={(ids) => setRefImageIds(ids)}
          />

          {/* generation mode radio — 仅角色 Tab 显示 */}
          {tabLabel === '角色' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>生成方式</span>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                {[{ key: 'main', label: '单视图' }, { key: 'three_view', label: '多视图' }].map(({ key, label }) => {
                  const active = genMode === key;
                  return (
                    <RadioOption key={key} label={label} checked={active} onChange={() => setGenMode(key)} />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* right: image list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
          <ImageViewModal open={!!viewImageUrl} imageUrl={viewImageUrl} imageId={viewImageId} projectId={projectId} subjectId={char?.id} onClose={() => { setViewImageUrl(null); setViewImageId(null); }} />
          {/* upload card always first */}
          <ImageItemUpload
            projectId={projectId}
            onUpload={(fileOrId) => {
              // 从资产库选择的资产对象（有 id 和 url 属性）
              if (fileOrId && typeof fileOrId === 'object' && fileOrId.id) {
                const raw = fileOrId.url || fileOrId.file_url || fileOrId.fileUrl;
                // 从资产库选择的图片，settled 强制为 false，不继承原资产的定稿状态
                const hasSettled = generatedImages.some((img) => img.settled && img.rawUrl);
                setGeneratedImages((prev) => {
                  const newImg = { rawUrl: raw, url: normalizeImageUrl(raw), settled: !hasSettled, id: fileOrId.id, isReference: true };
                  return [newImg, ...prev];
                });
                if (!hasSettled) {
                  setPrimaryImageUrl(raw);
                  setPrimaryImageId(fileOrId.id);
                  onCoverChange?.(raw);
                }
                // 绑定资产到主体
                if (projectId && char?.id) {
                  apiBindSubjectReferenceImages(projectId, char.id, { asset_ids: [fileOrId.id] }).catch((err) => {
                    console.error('[SubjectPage] 绑定资产到主体失败:', err);
                  });
                }
              } else if (fileOrId instanceof File) {
                // 本地上传：先用 blob URL 占位，上传完成后替换为真实 asset_id + file_url
                const blobUrl = URL.createObjectURL(fileOrId);
                const tempId = `upload-${Date.now()}`;
                setGeneratedImages((prev) => [{ rawUrl: blobUrl, url: blobUrl, settled: false, id: tempId, isReference: true }, ...prev]);
                // 上传到后端，返回 SubjectReferenceImage { asset_id, file_url, name }
                if (projectId && char?.id) {
                  apiUploadSubjectReferenceImage(projectId, char.id, fileOrId)
                    .then((res) => {
                      // res: SubjectReferenceImage
                      const realId = res?.asset_id;
                      const realUrl = res?.file_url;
                      const hasSettled2 = generatedImages.some((img) => img.settled && img.rawUrl);
                      const shouldBecomeCover = !hasSettled2 && realUrl;
                      setGeneratedImages((prev) => {
                        const updated = prev.map((img) =>
                          img.id === tempId
                            ? { ...img, id: realId || tempId, rawUrl: realUrl || blobUrl, url: normalizeImageUrl(realUrl || blobUrl), settled: !hasSettled2 }
                            : img
                        );
                        return updated;
                      });
                      if (shouldBecomeCover) {
                        setPrimaryImageUrl(realUrl);
                        setPrimaryImageId(realId);
                        onCoverChange?.(realUrl);
                      }
                    })
                    .catch((err) => {
                      console.error('[SubjectPage] 上传参考图失败:', err);
                      // 上传失败时移除占位
                      setGeneratedImages((prev) => prev.filter((img) => img.id !== tempId));
                    });
                }
              }
            }}
          />
          {generatedImages.map((img, i) => (
            <ImageItem
              key={img.id ?? img.url + i}
              imageUrl={img.url}
              imageId={img.id}
              settled={img.settled}
              onView={(url) => { setViewImageUrl(url); setViewImageId(img.id); }}
              onDownload={async () => {
                try {
                  const blob = await apiDownloadSubjectImage(projectId, char.id, img.id);
                  triggerBlobDownload(blob, `subject-image-${img.id}.jpg`);
                  showToast('下载成功', 'success');
                } catch (err) {
                  console.error('[SubjectPage] 下载图片失败:', err);
                  showToast('下载失败', 'error');
                }
              }}
              onSettledChange={(newSettled) => {
                if (newSettled) {
                  onCoverChange?.(img?.rawUrl ?? img?.url ?? null);
                  // 只有真实 ID（非前端占位符）才调后端
                  if (img.id && !String(img.id).startsWith('generated-')) {
                    if (img.isReference) {
                      // 参考图：通过 bind 接口把该资产设为 primary
                      apiBindSubjectReferenceImages(projectId, char.id, {
                        asset_ids: [img.id],
                        primary_asset_id: img.id,
                      }).catch((err) => {
                        console.error('[SubjectPage] 设置参考图为定稿失败:', err);
                      });
                    } else {
                      // 候选图：set-primary 接口
                      apiSetPrimarySubjectImage(projectId, char.id, img.id).catch((err) => {
                        console.error('[SubjectPage] 设置定稿图失败:', err);
                      });
                    }
                  }
                }

                setGeneratedImages((prev) =>
                  prev.map((item, idx) =>
                    idx === i
                      ? { ...item, settled: newSettled }
                      : { ...item, settled: newSettled ? false : item.settled }
                  )
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* footer: 生成图片按钮 — 绝对定位于底部 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 'round(70%, 1px)',
          padding: '16px 24px',
          background: '#161616',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onMouseEnter={() => setGenHovered(true)}
          onMouseLeave={() => { setGenHovered(false); setGenPressed(false); }}
          onMouseDown={() => setGenPressed(true)}
          onMouseUp={() => setGenHovered(true)}
          onClick={async () => {
            if (!promptText.trim()) {
              showToast('请输入提示词', 'error');
              return;
            }

            // 防止同一主体重复点击生成
            const existing = pendingGenerations.get(char.id);
            if (existing && existing.status === 'pending') {
              showToast('该主体已有生成任务进行中', 'error');
              return;
            }

            const placeholder = `generated-${Date.now()}`;
            // 写入模块级缓存，跨弹窗打开/关闭保持
            pendingGenerations.set(char.id, { placeholderId: placeholder, status: 'pending' });
            setBatchLoadingSubjects((prev) => ({ ...prev, [char.id]: true }));
            setGeneratedImages((prev) => [{ url: null, settled: false, id: placeholder }, ...prev]);

            const genParams = {
              model: selectedModel,
              ratio: selectedRatio,
              resolution: selectedResolution,
              prompt: promptText,
              generation_mode: genMode,
            };
            if (Array.isArray(refImageIds) && refImageIds.length > 0) {
              genParams.reference_mode = 'subject';
            }

            // 使用 .then() 代替 await，使回调在组件卸载后仍能更新缓存
            apiGenerateSubjectImage(projectId, char.id, genParams)
              .then((result) => {
                const rawUrl = result.image_url || result.imageUrl || result.url || null;

                if (isMountedRef.current) {
                  // 弹窗仍打开：正常更新图片列表
                  const imageUrl = normalizeImageUrl(rawUrl);
                  const realImageId = result.id || result.image_id || null;
                  let _shouldBecomeCover = false;
                  let _coverUrl = null;
                  let _coverId = null;
                  setGeneratedImages((prev) => {
                    // ① 占位图替换为真实数据
                    const updated = prev.map((img) =>
                      img.id === placeholder
                        ? { ...img, id: realImageId || placeholder, rawUrl, url: imageUrl, settled: false }
                        : img
                    );
                    // ② 如果没有任何定稿图，自动将新生成的图设为定稿并更新封面
                    const hasSettled = updated.some((img) => img.settled && img.rawUrl);
                    if (!hasSettled && rawUrl) {
                      updated[0] = { ...updated[0], settled: true };
                      _shouldBecomeCover = true;
                      _coverUrl = rawUrl;
                      _coverId = realImageId;
                    }
                    return updated;
                  });
                  if (_shouldBecomeCover) {
                    setPrimaryImageUrl(_coverUrl);
                    setPrimaryImageId(_coverId);
                    onCoverChange?.(_coverUrl);
                  }
                  setBatchLoadingSubjects((prev) => {
                    const next = { ...prev };
                    delete next[char.id];
                    return next;
                  });
                  showToast('图片生成成功', 'success');
                  pendingGenerations.delete(char.id);
                } else {
                  // 弹窗已关闭：缓存结果，下次打开弹窗时显示
                  pendingGenerations.set(char.id, {
                    placeholderId: placeholder,
                    status: 'done',
                    rawUrl,
                    imageUrl: result.image_url || result.imageUrl || result.url || null,
                  });
                  console.log('[SubjectPage] 弹窗已关闭，图片后台生成完成，结果已缓存');
                }
              })
              .catch((err) => {
                console.error('[SubjectPage] 生成图片失败:', err);
                pendingGenerations.delete(char.id);
                setBatchLoadingSubjects((prev) => {
                  const next = { ...prev };
                  delete next[char.id];
                  return next;
                });
                if (isMountedRef.current) {
                  setGeneratedImages((prev) => prev.filter((img) => img.id !== placeholder));
                }
                const errMsg = err?.message || '图片生成失败';
                showToast(errMsg, 'error');
              });
          }}
          style={{
            display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', padding: '0 16px', gap: '4px', cursor: 'pointer',
            backgroundColor: genPressed ? '#28AFCA' : genHovered ? '#35D4F5' : '#2DC3E1',
            border: '1px solid #FFFFFF33',
            outline: '1px solid #00000080',
            backgroundImage: 'linear-gradient(in oklab 107.51deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
            transition: 'background 100ms',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#090909" strokeLinejoin="round" />
            <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#090909" />
            <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '18px', color: '#090909', whiteSpace: 'nowrap' }}>生成图片</span>
        </button>
      </div>
    </div>
    {toast && createPortal(
      <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
        <div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]" style={{ whiteSpace: 'nowrap' }}>
          {toast.type === 'success' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {toast.type === 'warning' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#EB8B14" stroke="#EB8B14" strokeWidth="1.333" strokeLinejoin="round" />
              <path fillRule="evenodd" clipRule="evenodd" d="M8 12.333C8.46 12.333 8.833 11.96 8.833 11.5C8.833 11.04 8.46 10.667 8 10.667C7.54 10.667 7.167 11.04 7.167 11.5C7.167 11.96 7.54 12.333 8 12.333Z" fill="#FFFFFF" />
              <path d="M8 4V9.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
            </svg>
          )}
          <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>
            {toast.msg}
          </span>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
