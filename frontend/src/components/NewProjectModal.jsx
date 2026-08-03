import { useRef, useState } from 'react';
import { apiCreateProject, apiUploadProjectCover } from '../api/project.js';
import { apiCreateUserStyle } from '../api/user-styles.js';
import TextField from '../components/ui/TextField';
import OptionTabs from '../components/ui/OptionTabs';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import { NEW_VISUAL_STYLE_GROUPS } from '../config/visualStyles';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";


const LIBRARY_GROUPS = NEW_VISUAL_STYLE_GROUPS;

const PRIMARY_BTN_GRADIENT =
  'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF66" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF66" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#FFFFFF33" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" stroke="#FFFFFF33" strokeWidth="1.5" />
      <path d="M3 15l5-5 4 4 3-3 6 6" stroke="#FFFFFF33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 视觉风格入口图标：调整/自定义
function AdjustIcon() {
  return (
    <svg viewBox="0 0 102.4 102.4" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20" style={{ flexShrink: '0' }}>
      <path d="M71.015 37.529l16.844-16.845-6.144-6.143-16.845 16.844 6.145 6.144zM96.768 20.684c0 1.024-0.358 1.895-1.024 2.612L21.709 97.28c-0.665 0.665-1.638 1.075-2.612 1.023-0.973 0.051-1.895-0.358-2.611-1.023L5.12 85.862c-0.665-0.665-1.075-1.638-1.025-2.611 0-1.024 0.358-1.895 1.025-2.611L79.155 6.656c0.665-0.665 1.638-1.075 2.611-1.024 1.024 0 1.895 0.358 2.611 1.024L95.744 18.073c0.665 0.665 1.024 1.536 1.024 2.611zM18.995 9.728l5.632 1.741-5.632 1.74-1.74 5.633-1.741-5.633-5.632-1.74 5.632-1.741 1.741-5.632 1.74 5.632z m20.173 9.318l11.264 3.43-11.264 3.431-3.431 11.264-3.43-11.264-11.264-3.431 11.264-3.43 3.43-11.264 3.431 11.264zM92.672 46.541l5.632 1.741-5.632 1.74-1.741 5.632-1.741-5.632-5.632-1.74 5.632-1.741 1.741-5.632 1.741 5.632zM55.859 9.728l5.632 1.741-5.632 1.74-1.741 5.633-1.741-5.633-5.632-1.74 5.632-1.741 1.741-5.632 1.741 5.632z m0 0" fill="#FFFFFFCC" />
    </svg>
  );
}


// 自定义风格二级弹窗：复用 ui 长文本输入框，高度 160px
function CustomStyleModal({ open, onClose, onConfirm, initialDesc = '' }) {
  const [styleDesc, setStyleDesc] = useState(initialDesc);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(styleDesc);
    onClose();
  };

  const handleClose = () => {
    setStyleDesc(initialDesc);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-overlay backdrop-blur-[20px]"
      onClick={handleClose}
    >
      <div
        className="w-[400px] h-[600px] flex flex-col rounded-large bg-surface-modal overflow-hidden [font-synthesis:none] antialiased"
        style={{ boxShadow: '0px 24px 64px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[24px] py-[16px] bg-surface-modal shrink-0">
          <span className="text-text-primary text-font-size-16 font-font-weight-medium" style={{ fontFamily: FONT_MEDIUM }}>
            自定义风格
          </span>
          <button type="button" onClick={handleClose} className="cursor-pointer bg-transparent border-0 p-0">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-[8px] px-[24px] py-[8px] bg-surface-modal min-h-0 overflow-y-auto">
          <TextField
            label="风格描述"
            value={styleDesc}
            placeholder="描述你想要的视觉风格，例如：赛博朋克风格，霓虹灯光，雨夜街道…"
            multiline
            height="160px"
            maxLength={300}
            onChange={(e) => setStyleDesc(e.target.value)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-[12px] px-[24px] py-[16px] bg-surface-modal rounded-b-large">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center h-9 shrink-0 rounded-medium px-[20px] bg-btn-primary-bg-normal border border-btn-primary-border [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active cursor-pointer"
          >
            <span className="text-btn-primary-text text-font-size-14" style={{ fontFamily: FONT }}>取消</span>
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex flex-col h-9 shrink-0 rounded-medium p-px [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] cursor-pointer"
            style={{ backgroundImage: PRIMARY_BTN_GRADIENT }}
          >
            <div className="flex items-center grow shrink basis-[0%] rounded-[7px] px-[20px] gap-[4px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active">
              <span className="text-text-primary text-font-size-14" style={{ fontFamily: FONT }}>确定</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// 风格库二级弹窗：固定 400×600，内容超出上下滚动查看
// 风格库二级弹窗：复用设计稿分类 Tab + 封面网格（来自 paper「从风格库选择」）
// 风格库二级弹窗：固定 400×600，内容超出上下滚动查看
function StyleLibraryModal({ open, onClose, selectedValue, onSelect }) {
  const [activeCategory, setActiveCategory] = useState(LIBRARY_GROUPS[0].category);
  if (!open) return null;

  const group = LIBRARY_GROUPS.find((g) => g.category === activeCategory) || LIBRARY_GROUPS[0];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-overlay backdrop-blur-[20px]"
      onClick={onClose}
    >
      <div
        className="w-[400px] h-[600px] flex flex-col rounded-large bg-surface-modal overflow-hidden relative [font-synthesis:none] antialiased"
        style={{ boxShadow: '0px 24px 64px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[24px] py-[20px] bg-surface-modal shrink-0">
          <span className="text-text-primary text-font-size-16 font-font-weight-medium" style={{ fontFamily: FONT_MEDIUM }}>
            从风格库选择
          </span>
          <button type="button" onClick={onClose} className="cursor-pointer bg-transparent border-0 p-0">
            <CloseIcon />
          </button>
        </div>

        {/* 分类 Tab：固定不滚动 */}
        <div className="px-[24px] pt-[8px] shrink-0 bg-surface-modal">
          <Tabs
            options={LIBRARY_GROUPS.map((g) => ({ value: g.category, label: g.category }))}
            value={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        {/* 封面网格：独立滚动区 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-[24px] pt-[8px] pb-[68px]">
          <div className="grid grid-cols-3 gap-[8px]">
            {group.styles.map((s) => {
              const selected = selectedValue === s.value;
              return (
                <div key={s.value} className="flex flex-col items-center gap-[8px]">
                  <button
                    type="button"
                    onClick={() => onSelect(s.value)}
                    className="w-full aspect-square rounded-md overflow-hidden relative shrink-0 bg-[#2A2A2A] border border-solid transition-[border-color,box-shadow] duration-150 cursor-pointer p-0"
                    style={{
                      borderColor: selected ? '#2DC3E1' : '#FFFFFF1F',
                      boxShadow: selected ? '0 0 8px rgba(45,195,225,0.25)' : 'none',
                    }}
                  >
                    {s.gradient && (
                      <div className="absolute inset-0" style={{ backgroundImage: s.gradient }} />
                    )}
                    {s.coverImg && (
                      <div
                        className="absolute inset-0 bg-cover"
                        style={{ backgroundImage: `url(${s.coverImg})`, backgroundPosition: '50%' }}
                      />
                    )}
                    {/* 选中态：右上角蓝色对勾角标 */}
                    {selected && (
                      <div className="absolute right-0 top-0 w-[22px] h-[22px] flex items-center justify-center bg-[#2DC3E1] rounded-bl-sm">
                        <svg viewBox="0 0 82 81.92" version="1.1" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                          <path d="M76.8 25.466l-6.466-6.466L33.479 55.854l-21.899-21.899-6.469 6.47 28.363 28.36 6.197-6.202 0.008 0.008L76.8 25.466zM76.8 25.466" fill="#FFFFFF" />
                        </svg>
                      </div>
                    )}
                  </button>
                  <span
                    className="text-[14px] leading-[16px]"
                    style={{ fontFamily: FONT, color: selected ? '#2DC3E1' : '#FFFFFFB3' }}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {/* /封面网格滚动区 */}

        {/* 底部绝对定位 footer：取消 / 确定 */}
        <div className="absolute left-0 right-0 bottom-0 flex items-center justify-end gap-[12px] px-[24px] py-[16px] bg-surface-modal rounded-b-large">
          <Button variant="secondary" size="large" onClick={onClose}>取消</Button>
          <Button variant="primary" size="large" onClick={onClose}>确定</Button>
        </div>
      </div>
    </div>
  );
}

function sanitizeInput(val) {
  val = val.replace(/[^a-zA-Z0-9一-龥_.  -]/g, '');
  val = val.replace(/^[_. -]+/, '');
  val = val.replace(/([_ .-])\1+/g, '$1');
  return val;
}

// 项目描述允许自然语言中的常用标点，仅过滤不可见控制字符；保留换行、回车和制表符。
function sanitizeDescription(val) {
  return Array.from(val).filter((char) => {
    const code = char.charCodeAt(0);
    return !((code >= 0 && code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) || (code >= 127 && code <= 159));
  }).join('');
}

function trimTrailingSpecials(val) {
  return val.replace(/[_. -]+$/, '');
}

export default function NewProjectModal({ open, onClose, onConfirm }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [ratio, setRatio] = useState('16:9');
  const [creationType, setCreationType] = useState('dialogue');
  // 视觉风格入口：none=未选 / custom=自定义 / library=从风格库选择
  const [styleMode, setStyleMode] = useState('none');
  const [customStyleDesc, setCustomStyleDesc] = useState('');
  const [libraryStyleValue, setLibraryStyleValue] = useState('');
  const [customStyleOpen, setCustomStyleOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [styleCustomHovered, setStyleCustomHovered] = useState(false);
  const [styleLibraryHovered, setStyleLibraryHovered] = useState(false);
  const [coverHovered, setCoverHovered] = useState(false);
  const [coverPressed, setCoverPressed] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleConfirm = async () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setSubmitting(true);
    try {
      let cover_url = null;
      if (coverFile) {
        cover_url = await apiUploadProjectCover(coverFile);
      }
      // 视觉风格：保存成功的自定义风格引用 custom:{id} 不再重复传 prompt。
      let visual_style = '';
      let visual_style_prompt = null;
      if (styleMode === 'custom' && customStyleDesc.trim()) {
        const styleName = customStyleDesc.replace(/\n/g, ' ').slice(0, 30);
        try {
          const userStyle = await apiCreateUserStyle({
            name: styleName,
            prompt: customStyleDesc,
          });
          visual_style = `custom:${userStyle.id || userStyle.value}`;
        } catch (err) {
          console.error('创建自定义风格失败', err);
          // 自定义风格记录创建失败时，仍按项目级自定义风格提交。
          visual_style = 'custom';
          visual_style_prompt = customStyleDesc;
        }
      } else if (styleMode === 'library' && libraryStyleValue) {
        visual_style = libraryStyleValue;
      }
      const result = await apiCreateProject({
        name: name.trim(),
        description: desc,
        aspect_ratio: ratio,
        visual_style,
        visual_style_prompt,
        creation_mode: creationType,
        project_type: 'video',
        cover_url,
      });
      onConfirm?.(result);
      handleClose();
    } catch (err) {
      console.error('创建项目失败', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDesc('');
    setRatio('16:9');
    setCreationType('dialogue');
    setStyleMode('none');
    setCustomStyleDesc('');
    setLibraryStyleValue('');
    setCoverFile(null);
    setCoverPreview(null);
    setNameError(false);
    setSubmitting(false);
    onClose?.();
  };

  const handleStyleClick = () => {
    setCustomStyleOpen(true);
  };

  const handleLibrarySelect = (value) => {
    setLibraryStyleValue(value);
    setStyleMode('library');
    setLibraryOpen(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay backdrop-blur-[20px]"
        onClick={handleClose}
      >
      <div
        className="w-[400px] h-[600px] flex flex-col rounded-large bg-surface-modal overflow-hidden relative [font-synthesis:none] antialiased"
        style={{ boxShadow: '0px 24px 64px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="flex items-center justify-between px-[24px] py-[20px] bg-surface-modal shrink-0">
            <span className="text-text-primary text-font-size-16 font-font-weight-medium" style={{ fontFamily: FONT_MEDIUM }}>
              新建项目
            </span>
            <button type="button" onClick={handleClose} className="cursor-pointer bg-transparent border-0 p-0">
              <CloseIcon />
            </button>
          </div>

          {/* Body */}
          <div
            className="flex flex-col gap-[20px] px-[24px] py-[8px] bg-surface-modal overflow-y-auto flex-1"
            style={{ paddingBottom: '84px' }}
          >
            {/* 项目名称 */}
            <TextField
              label="项目名称"
              value={name}
              placeholder="请输入项目名称"
              maxLength={50}
              error={nameError}
              errorMsg="项目名称不可为空"
              sanitize={sanitizeInput}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setNameError(false);
              }}
              onBlur={() => {
                const trimmed = trimTrailingSpecials(name);
                if (trimmed !== name) setName(trimmed);
                if (!trimmed.trim()) setNameError(true);
              }}
            />

            {/* 项目描述 */}
            <TextField
              label="项目描述"
              value={desc}
              placeholder="选填"
              multiline
              height="72px"
              maxLength={300}
              sanitize={sanitizeDescription}
              onChange={(e) => setDesc(e.target.value)}
            />

            {/* 画面比例 */}
            <div className="flex flex-col gap-[8px]">
              <span className="text-text-secondary text-font-size-14" style={{ fontFamily: FONT }}>画面比例</span>
              <OptionTabs
                layout="fixed"
                showRatioIcon
                value={ratio}
                onChange={setRatio}
                options={[
                  { value: '16:9', label: '16:9' },
                  { value: '9:16', label: '9:16' },
                ]}
              />
            </div>

            {/* 创作类型 */}
            <div className="flex flex-col gap-[8px]">
              <span className="text-[#FFFFFFB3] text-[14px] leading-[18px]" style={{ fontFamily: FONT }}>创作类型</span>
              <OptionTabs
                layout="flex"
                value={creationType}
                onChange={setCreationType}
                options={[
                  { value: 'dialogue', label: '剧情对白' },
                  { value: 'narration', label: '旁白解说' },
                ]}
              />
            </div>

            {/* 视觉风格：两个入口（自定义 / 从风格库选择） */}
            <div className="flex flex-col gap-[8px]">
              <span className="text-text-secondary text-font-size-14" style={{ fontFamily: FONT }}>视觉风格</span>
              <div className="flex items-start gap-[16px] self-stretch pb-[2px]">
                {/* 入口一：自定义（选中后原位替换为自定义风格卡片） */}
                {styleMode === 'custom' && customStyleDesc ? (
                  <button
                    type="button"
                    onClick={handleStyleClick}
                    className="flex flex-col items-center gap-[6px] flex-1 self-stretch bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <div
                      className="w-full h-[110px] flex flex-col items-center justify-center gap-[6px] rounded-md self-stretch shrink-0 bg-origin-border border border-solid px-[12px] transition-[box-shadow] duration-150"
                      style={{
                        borderColor: '#2DC3E1',
                        backgroundImage: 'linear-gradient(in oklab 134.47deg, oklab(20% 0 0) 0.09%, oklab(27.4% -0.039 -0.028) 101.55%)',
                        boxShadow: '0 0 8px rgba(45,195,225,0.25)',
                      }}
                    >
                      <AdjustIcon />
                      <div
                        className="w-[124px] text-[10px] leading-[14px] text-center"
                        style={{ fontFamily: FONT, color: '#FFFFFF66' }}
                      >
                        {customStyleDesc}
                      </div>
                    </div>
                    <span className="text-[14px] leading-[18px]" style={{ fontFamily: FONT, color: '#2DC3E1' }}>
                      自定义
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStyleClick}
                    onMouseEnter={() => setStyleCustomHovered(true)}
                    onMouseLeave={() => setStyleCustomHovered(false)}
                    className="flex flex-col items-center gap-[6px] flex-1 self-stretch bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <div
                      className="h-[110px] flex items-center justify-center rounded-md self-stretch shrink-0 bg-origin-border border border-solid transition-[border-color,box-shadow] duration-150"
                      style={{
                        borderColor: styleMode === 'custom' ? '#2DC3E1' : styleCustomHovered ? '#FFFFFF33' : '#FFFFFF14',
                        backgroundImage: 'linear-gradient(in oklab 134.47deg, oklab(20% 0 0) 0.23%, oklab(27.3% -0.039 -0.027) 101.55%)',
                        boxShadow: styleMode === 'custom' ? '0 0 8px rgba(45,195,225,0.25)' : styleCustomHovered ? '0 0 8px rgba(255,255,255,0.08)' : 'none',
                      }}
                    >
                      <AdjustIcon />
                    </div>
                    <span
                      className="text-[14px] leading-[18px]"
                      style={{ fontFamily: FONT, color: styleMode === 'custom' ? '#2DC3E1' : '#FFFFFFCC' }}
                    >
                      自定义
                    </span>
                  </button>
                )}

                {/* 入口二：从风格库选择（复刻设计稿最新结构） */}
                {(() => {
                  const selectedLibraryStyle = styleMode === 'library'
                    ? LIBRARY_GROUPS.flatMap((g) => g.styles).find((s) => s.value === libraryStyleValue)
                    : null;
                  return (
                    <button
                      type="button"
                      onClick={() => setLibraryOpen(true)}
                      onMouseEnter={() => setStyleLibraryHovered(true)}
                      onMouseLeave={() => setStyleLibraryHovered(false)}
                      className="[font-synthesis:none] flex flex-col items-center gap-1.5 flex-1 self-stretch relative antialiased text-xs/4 bg-transparent border-0 p-0 cursor-pointer"
                    >
                      {/* 卡片容器：统一管理圆角、边框、overflow裁切 */}
                      <div
                        className="relative rounded-md self-stretch flex-1 overflow-hidden border border-solid transition-[border-color,box-shadow] duration-150"
                        style={{
                          borderColor: styleMode === 'library' ? '#2DC3E1' : styleLibraryHovered ? '#FFFFFF33' : '#FFFFFF14',
                          boxShadow: styleMode === 'library' ? '0 0 8px rgba(45,195,225,0.25)' : styleLibraryHovered ? '0 0 8px rgba(255,255,255,0.08)' : 'none',
                        }}
                      >
                        {/* 背景渐变层 */}
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: 'linear-gradient(in oklab 305.55deg, oklab(20% 0 0) 0%, oklab(27.4% -0.039 -0.028) 99.72%)',
                          }}
                        />
                        {/* 封面图层：选中后替换为风格封面（60%透明度），未选中显示占位渐变 */}
                        {selectedLibraryStyle ? (
                          <div
                            className="absolute inset-0 opacity-60 bg-cover bg-center"
                            style={{ backgroundImage: `url(${selectedLibraryStyle.coverImg})` }}
                          />
                        ) : (
                          <div
                            className="absolute inset-0 bg-cover bg-[center_50%]"
                            style={{
                              backgroundImage: 'linear-gradient(in oklab 90deg, oklab(20.5% -0.005 -0.004) 0%, oklab(19% 0.007 -0.029 / 50%) 50%, oklab(26.1% -0.032 -0.024) 100%), url(https://app.paper.design/file-assets/01KQYRKV5GAPKWF7X9K33912CS/01KTJEZVHEVP5MPM1DW2VA9SV2.png)',
                            }}
                          />
                        )}
                      </div>
                      {/* 标签文字：选中后显示风格名称 */}
                      <div
                        className="inline-block relative text-[#FFFFFFCC] text-sm/4"
                        style={{ fontFamily: FONT }}
                      >
                        {selectedLibraryStyle ? selectedLibraryStyle.label : '从风格库选择'}
                      </div>
                      {/* 光标图标 */}
                      <svg
                        viewBox="0 0 102.4 102.4"
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        style={{ position: 'absolute', left: 74, top: 45 }}
                      >
                        <path d="M17.463 7.898c0.003-1.261 1.641-1.991 2.581-1.15l32.872 29.398 31.827 28.463c1.051 0.94 0.04 2.675-1.425 2.446L43.57 60.843c-0.623-0.097-1.272 0.192-1.616 0.72L19.996 95.272c-0.809 1.242-2.776 0.834-2.772-0.576l0.117-42.697 0.122-44.101z" fill="#FFFFFFCC" />
                      </svg>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* 项目封面 */}
            <div className="flex flex-col gap-[8px]">
              <div className="flex items-center gap-[4px]">
                <span className="text-text-secondary text-font-size-14" style={{ fontFamily: FONT }}>项目封面</span>
                <span className="text-text-disabled text-font-size-12" style={{ fontFamily: FONT }}>选填</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setCoverHovered(true)}
                onMouseLeave={() => { setCoverHovered(false); setCoverPressed(false); }}
                onMouseDown={() => setCoverPressed(true)}
                onMouseUp={() => setCoverPressed(false)}
                className="flex flex-col items-center justify-center gap-[8px] h-[96px] w-full rounded-medium bg-input-bg-normal border border-dashed cursor-pointer overflow-hidden transition-[border-color,transform] duration-150"
                style={{
                  borderColor: coverHovered ? '#FFFFFF33' : '#FFFFFF1A',
                  transform: coverPressed ? 'scale(0.98)' : 'scale(1)',
                }}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="封面预览" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <UploadIcon />
                    <div className="flex flex-col items-center gap-[2px]">
                      <span className="text-text-secondary text-font-size-12" style={{ fontFamily: FONT }}>点击上传封面图片</span>
                      <span className="text-text-disabled text-font-size-12" style={{ fontFamily: FONT }}>支持 JPG、PNG，建议尺寸 16:9</span>
                    </div>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleCoverChange}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="absolute left-0 right-0 bottom-0 flex items-center justify-end gap-[12px] px-[24px] py-[16px] bg-surface-modal rounded-b-large">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center h-9 shrink-0 rounded-medium px-[20px] bg-btn-primary-bg-normal border border-btn-primary-border [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active cursor-pointer"
            >
              <span className="text-btn-primary-text text-font-size-14" style={{ fontFamily: FONT }}>取消</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex flex-col h-9 shrink-0 rounded-medium p-px [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundImage: PRIMARY_BTN_GRADIENT }}
            >
              <div className="flex items-center grow shrink basis-[0%] rounded-[7px] px-[20px] gap-[4px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active">
                <span className="text-text-primary text-font-size-14" style={{ fontFamily: FONT }}>
                  {submitting ? '创建中…' : '确定'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <CustomStyleModal
        open={customStyleOpen}
        onClose={() => setCustomStyleOpen(false)}
        onConfirm={(desc) => {
          setCustomStyleDesc(desc);
          setStyleMode('custom');
        }}
        initialDesc={customStyleDesc}
      />

      <StyleLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        selectedValue={libraryStyleValue}
        onSelect={handleLibrarySelect}
      />
    </>
  );
}
