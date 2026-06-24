import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { PulsingBorder } from '@paper-design/shaders-react';
import { FONT, FONT_MEDIUM } from '../utils/fonts';
import { ALLOWED_EXTS, ALLOWED_IMAGE_EXTS, ALLOWED_VIDEO_EXTS, ALLOWED_AUDIO_EXTS, ALLOWED_MEDIA_EXTS } from '../utils/fileTypes';
import GenTypeSelector from './GenTypeSelector';
import ModelSelector from './ModelSelector';
import ParamsSelector from './ParamsSelector';
import VideoParamsSelector from './VideoParamsSelector';
import SoundToggle from './SoundToggle';
import DubbingAdjust from './DubbingAdjust';
import UploadPlaceholder from './UploadPlaceholder';
import FrameUploader from './FrameUploader';
import FileCard from './FileCard';
import SendButton from './SendButton';
import CopyPromptButton from './CopyPromptButton';
import formatMentionLabel from '../utils/formatMentionLabel';
import isImageFile from '../utils/isImageFile';
import isVideoFile from '../utils/isVideoFile';

const ROTATE_STYLE_ID = 'creation-chatbox-rotate-style';
const THINKING_STYLE_ID = 'creation-thinking-style';

function ensureRotateKeyframe() {
  if (document.getElementById(ROTATE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ROTATE_STYLE_ID;
  style.textContent = `
    @property --creation-chatbox-angle {
      syntax: '<angle>';
      initial-value: 161.1deg;
      inherits: false;
    }
    @keyframes creation-chatbox-spin {
      from { --creation-chatbox-angle: 161.1deg; }
      to { --creation-chatbox-angle: 521.1deg; }
    }
  `;
  document.head.appendChild(style);
}

function ensureThinkingStyle() {
  if (document.getElementById(THINKING_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = THINKING_STYLE_ID;
  style.textContent = `
    .creation-thinking-dot {
      animation: creation-thinking-bounce 0.8s infinite alternate;
    }
    .creation-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
    .creation-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes creation-thinking-bounce {
      from { transform: translateY(0); opacity: 0.4; }
      to { transform: translateY(-3px); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

const GEN_TYPE_OPTIONS = [
  { value: 'image', label: '图片生成',
    iconSelected: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFF" />
        <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconDefault: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFF99" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFF99" />
        <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    triggerIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFFCC" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFFCC" />
        <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  { value: 'video', label: '视频生成',
    iconSelected: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M13 2H3C2.448 2 2 2.448 2 3V13C2 13.552 2.448 14 3 14H13C13.552 14 14 13.552 14 13V3C14 2.448 13.552 2 13 2Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.833 9.333V7.313L8.583 8.323L10.333 9.333L8.583 10.344L6.833 11.354V9.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 5H14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 2L9 5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 2L5 5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconDefault: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M13 2H3C2.448 2 2 2.448 2 3V13C2 13.552 2.448 14 3 14H13C13.552 14 14 13.552 14 13V3C14 2.448 13.552 2 13 2Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.833 9.333V7.313L8.583 8.323L10.333 9.333L8.583 10.344L6.833 11.354V9.333Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 5H14" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 2L9 5" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 2L5 5" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    triggerIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M13 2H3C2.448 2 2 2.448 2 3V13C2 13.552 2.448 14 3 14H13C13.552 14 14 13.552 14 13V3C14 2.448 13.552 2 13 2Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.833 9.333V7.313L8.583 8.323L10.333 9.333L8.583 10.344L6.833 11.354V9.333Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 5H14" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 2L9 5" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 2L5 5" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  { value: 'dubbing', label: '配音生成',
    iconSelected: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M8 2V11.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.333 12.013C3.333 11.085 4.086 10.333 5.013 10.333H8V12.32C8 13.248 7.248 14 6.32 14H5.013C4.086 14 3.333 13.248 3.333 12.32V12.013Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M8 4.689L12.294 5.707V3.004L8 2V4.689Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconDefault: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M8 2V11.667" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.333 12.013C3.333 11.085 4.086 10.333 5.013 10.333H8V12.32C8 13.248 7.248 14 6.32 14H5.013C4.086 14 3.333 13.248 3.333 12.32V12.013Z" stroke="#FFFFFF99" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M8 4.689L12.294 5.707V3.004L8 2V4.689Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    triggerIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M8 2V11.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.333 12.013C3.333 11.085 4.086 10.333 5.013 10.333H8V12.32C8 13.248 7.248 14 6.32 14H5.013C4.086 14 3.333 13.248 3.333 12.32V12.013Z" stroke="#FFFFFFCC" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M8 4.689L12.294 5.707V3.004L8 2V4.689Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// Model/params options are backend-driven; see apiGetCreationModels / apiGetCreationParams in src/api/creation.js

// ─── Upload placeholder ───────────────────────────────────────────────────────
function InputCard({ onGenerate, width = '800px', disabled = false, genType, onGenTypeChange,

  model, onModelChange, modelOptions = [], creationParams, prefillVersion = 0, prefillData = null, onBeforeModelOpen, showToast, activeCount = 0 }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [ratio, setRatio] = useState('');
  const [resolution, setResolution] = useState('');
  const [count, setCount] = useState('');
  const [refMode, setRefMode] = useState('');
  const [videoRatio, setVideoRatio] = useState('');
  const [videoResolution, setVideoResolution] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [dubbingSpeed, setDubbingSpeed] = useState(1.0);
  const [dubbingEmotion, setDubbingEmotion] = useState('');
  const [files, setFiles] = useState([]);
  const [firstFrameFile, setFirstFrameFile] = useState(null);
  const [lastFrameFile, setLastFrameFile] = useState(null);
  const [frameAssetTarget, setFrameAssetTarget] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const [mentionAnchorRange, setMentionAnchorRange] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const editorRef = useRef(null);
  const mentionFromTagRef = useRef(false);
  const savedCursorRangeRef = useRef(null); // 失焦前保存的光标位置


  // Video: filter modelOptions by refMode
  const dubbingEmotions = useMemo(() => { return creationParams?.emotions ?? DEFAULT_EMOTIONS; }, [creationParams]);

  const filteredModelOptions = useMemo(() => {
    if (genType !== 'video') return modelOptions;
    if (!refMode) return modelOptions;
    if (refMode === 'frame') {
      return modelOptions.filter(m => m.hasFrame);
    }
    // 'all' (全能参考): 只显示支持全能参考的模型
    return modelOptions.filter(m => m.hasFull);
  }, [genType, refMode, modelOptions]);

  // Video: sync model when refMode changes
  const handleRefModeChange = useCallback((newRefMode) => {
    // 切换到首尾帧：将 files 中的图片迁移到帧槽位，其余丢弃
    if (newRefMode === 'frame') {
      const imageFiles = files.filter(f => isImageFile(f));
      setFirstFrameFile(imageFiles[0] || null);
      setLastFrameFile(imageFiles[1] || null);
      setFiles([]);
    }
    // 离开首尾帧：将帧槽位的图片合并回 files 作为普通参考图
    if (refMode === 'frame' && newRefMode !== 'frame') {
      const carried = [firstFrameFile, lastFrameFile].filter(Boolean);
      if (carried.length > 0) setFiles(carried);
    }
    setRefMode(newRefMode);
    const filtered = newRefMode === 'frame'
      ? modelOptions.filter(m => m.hasFrame)
      : modelOptions.filter(m => m.hasFull);
    const inList = filtered.some(m => m.value === model);
    if (!inList && filtered.length > 0) {
      onModelChange(filtered[0].value);
    }
  }, [files, refMode, firstFrameFile, lastFrameFile, modelOptions, model, onModelChange]);
  // Reset param selections when creationParams changes (model or genType changed)
  useEffect(() => {
    if (!creationParams) return;
    if (genType === 'image') {
      setRatio(creationParams.defaults?.ratio || creationParams.ratios?.[0]?.value || '');
      setResolution(creationParams.defaults?.resolution || creationParams.resolutions?.[0] || '');
      setCount(creationParams.defaults?.count || creationParams.counts?.[0] || '');
    } else {
      setVideoRatio(creationParams.defaults?.ratio || creationParams.ratios?.[0]?.value || '');
      setVideoResolution(creationParams.defaults?.resolution || creationParams.resolutions?.[0] || '');
      setVideoDuration(creationParams.defaults?.duration || creationParams.durations?.[0] || '');
      setRefMode(creationParams.defaults?.refMode || creationParams.refModes?.[0]?.value || '');
    }
  }, [creationParams, genType]);

  useEffect(() => {
    setFiles([]);
    setFirstFrameFile(null);
    setLastFrameFile(null);
  }, [genType]);

  useEffect(() => {
    if (refMode !== 'frame') {
      setFirstFrameFile(null);
      setLastFrameFile(null);
      setDubbingSpeed(1.0);
      setDubbingEmotion('中性');
      setSelectedVoiceId('');
      setSelectedVoiceName('');
    }
  }, [refMode]);

  useEffect(() => {
    ensureRotateKeyframe();
    ensureThinkingStyle();
  }, []);

  // Apply prefill when version bumps (re-edit or use-as-ref or use-as-first-frame)
  useEffect(() => {
    if (!prefillVersion || !prefillData) return;
    if (prefillData.prompt !== undefined && editorRef.current) {
      editorRef.current.innerHTML = '';
      if (prefillData.promptHTML) {
        editorRef.current.innerHTML = prefillData.promptHTML;
        // innerHTML 恢复后事件监听器丢失，需用 buildTagElement 重建每个标签
        const filesToUse = prefillData.files ?? [];
        editorRef.current.querySelectorAll('[data-file-ref]').forEach((oldTag) => {
          const fileName = oldTag.dataset.fileRef;
          const file = filesToUse.find((f) => f.name === fileName) || { name: fileName, url: '', size: 0 };
          const newTag = buildTagElement(file);
          oldTag.parentNode?.replaceChild(newTag, oldTag);
        });
      } else if (prefillData.prompt) {
        editorRef.current.textContent = prefillData.prompt;
      }
      setHasContent((prefillData.prompt || '').trim().length > 0);
    }
    if (prefillData.files !== undefined) {
      // 替换模式（onReEdit 等场景）
      setFiles(prefillData.files);
    } else if (prefillData.appendFiles !== undefined) {
      // 追加模式（onUseAsRef 场景）：追加到已有列表，按 url 去重，最多20个
      setFiles((prev) => {
        if (prev.length >= MAX_FILES) {
          showToast('error', '您添加的文件太多了，最多支持20个参考文件');
          return prev;
        }
        const existingUrls = new Set((prev ?? []).map((f) => f.url).filter(Boolean));
        const toAdd = prefillData.appendFiles.filter((f) => !f.url || !existingUrls.has(f.url));
        const merged = [...(prev ?? []), ...toAdd];
        if (merged.length > MAX_FILES) {
          showToast('error', '您添加的文件太多了，最多支持20个参考文件');
          return merged.slice(0, MAX_FILES);
        }
        return merged;
      });
    }
    if (prefillData.ratio !== undefined) setRatio(prefillData.ratio);
    if (prefillData.resolution !== undefined) setResolution(prefillData.resolution);
    if (prefillData.count !== undefined) setCount(prefillData.count);
    if (prefillData.duration !== undefined) setVideoDuration(prefillData.duration);
    if (prefillData.refMode !== undefined) setRefMode(prefillData.refMode);
    if (prefillData.firstFrameFile !== undefined) setFirstFrameFile(prefillData.firstFrameFile);
    if (prefillData.lastFrameFile !== undefined) setLastFrameFile(prefillData.lastFrameFile);
  }, [prefillVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const mentionMenuRef = useRef(null);
  useEffect(() => {
    if (!mentionOpen) return;
    const handleOutside = (e) => {
      if (mentionMenuRef.current && mentionMenuRef.current.contains(e.target)) return;
      if (editorRef.current && editorRef.current.contains(e.target)) return;
      setMentionOpen(false);
      setMentionTargetTag(null);
      mentionFromTagRef.current = false;
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [mentionOpen]);

  const uploadAllowedExts =
    genType === 'image' ? ALLOWED_IMAGE_EXTS
    : genType === 'video'
      ? (creationParams?.supportsAudio
          ? ALLOWED_MEDIA_EXTS
          : [...ALLOWED_IMAGE_EXTS, ...ALLOWED_VIDEO_EXTS])
    : genType === 'dubbing' ? ALLOWED_AUDIO_EXTS
    : ALLOWED_EXTS;
  const uploadAcceptAttr = uploadAllowedExts.join(',');

  const MAX_FILES = 20;

  const handleFileSelect = (newFiles) => {
    const oversized = newFiles.filter((f) => isImageFile(f) && f.size > 20 * 1024 * 1024);
    if (oversized.length > 0) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      return;
    }
    setFiles((prev) => {
      if (prev.length >= MAX_FILES) {
        showToast('error', '您添加的文件太多了，最多支持20个参考文件');
        return prev;
      }
      const enriched = newFiles.map((f) => {
        if (isImageFile(f)) {
          const previewUrl = URL.createObjectURL(f);
          Object.defineProperty(f, 'previewUrl', { value: previewUrl, writable: true });
        } else if (isVideoFile(f)) {
          // 预先创建 blob URL，避免 FileCard effect 在 React Strict Mode 双执行时
          // revoke 掉旧 URL 而新 URL 还未设置导致 ERR_FILE_NOT_FOUND
          const objectUrl = URL.createObjectURL(f);
          Object.defineProperty(f, '_objectUrl', { value: objectUrl, writable: true });
        }
        return f;
      });
      const merged = [...prev, ...enriched];
      if (merged.length > MAX_FILES) {
        showToast('error', '您添加的文件太多了，最多支持20个参考文件');
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  };

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    const mediaFiles = []; // video/audio
    for (const item of items) {
      if (item.kind !== 'file') continue;
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      } else if (item.type.startsWith('video/') || item.type.startsWith('audio/')) {
        const file = item.getAsFile();
        if (file) mediaFiles.push(file);
      }
    }
    // 有图片时阻止浏览器把 <img> 插入 contentEditable
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFileSelect(imageFiles);
      return;
    }
    // 视频/音频粘贴
    if (mediaFiles.length > 0) {
      e.preventDefault();
      if (genType === 'image') {
        showToast?.('error', '不支持的文件格式！');
      } else {
        handleFileSelect(mediaFiles);
      }
      return;
    }
    // 无文件：只插入纯文本，剥除富文本样式（粗体、颜色等）
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      document.execCommand('insertText', false, text);
    }
  }, [genType, showToast]);

  const handleRemoveFile = (index) => {
    setFiles((prev) => {
      const file = prev[index];
      if (file) {
        // 释放预先创建的 blob URL
        if (file._objectUrl) URL.revokeObjectURL(file._objectUrl);
        if (file.previewUrl && file.previewUrl.startsWith('blob:')) URL.revokeObjectURL(file.previewUrl);
        if (editorRef.current) {
          const tags = editorRef.current.querySelectorAll('[data-file-ref]');
          tags.forEach((tag) => {
            if (tag.dataset.fileRef === file.name) tag.remove();
          });
          const content = editorRef.current.innerText ?? '';
          setHasContent(content.trim().length > 0);
        }
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAssetConfirm = (selectedAssets) => {
    setAssetPickerOpen(false);
    if (frameAssetTarget && selectedAssets.length > 0) {
      const asset = selectedAssets[0];
      // fileUrl 是真实文件地址（项目资产 normalize 后），url 可能是缩略图
      const realUrl = asset.fileUrl || asset.url;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const rawFrameId = asset.backendId || asset.asset_id;
      const assetFile = {
        name: asset.name || asset.id,
        size: 0,
        url: realUrl,
        previewUrl: asset.url || realUrl,
        assetId: rawFrameId && UUID_RE.test(rawFrameId) ? rawFrameId : undefined,
        isAsset: true,
      };
      if (frameAssetTarget === 'first') setFirstFrameFile(assetFile);
      else setLastFrameFile(assetFile);
      setFrameAssetTarget(null);
      return;
    }
    const assetFiles = selectedAssets.map((asset) => {
      const isVideo = asset.type === 'video';
      const isAudio = asset.type === 'audio';
      let fileUrl;
      if (isVideo) fileUrl = asset.videoUrl || asset.fileUrl || asset.url;
      else if (isAudio) fileUrl = asset.audioUrl || asset.fileUrl || asset.url;
      else fileUrl = asset.fileUrl || asset.url;
      const previewUrl = asset.url || asset.thumbnailUrl || asset.thumbnail_url || fileUrl;
      // 只传真实后端 UUID：backendId（创作资产回写的 card.id）或 asset_id（项目资产）
      // 排除 composite id（如 "gen-xxx-0" / "history-xxx-0"），这些不是有效后端 ID
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const rawId = asset.backendId || asset.asset_id;
      const assetId = rawId && UUID_RE.test(rawId) ? rawId : undefined;
      return {
        name: asset.name || asset.id,
        size: 0,
        url: fileUrl,
        previewUrl,
        assetId,
        isAsset: true,
        type: isVideo ? 'video/mp4' : isAudio ? 'audio/mpeg' : 'image/jpeg',
      };
    });
    setFiles((prev) => [...prev, ...assetFiles]);
  };

  const [mentionTargetTag, setMentionTargetTag] = useState(null);

  const buildTagElement = (file) => {
    const tag = document.createElement('span');
    tag.contentEditable = 'false';
    tag.dataset.fileRef = file.name;
    tag.style.cssText = 'display:inline-flex;align-items:center;background:rgba(45,195,225,0.10);color:#2DC3E1;border-radius:6px;padding:0 4px;font-size:14px;line-height:22px;height:22px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);user-select:none;cursor:pointer;white-space:nowrap;font-family:' + FONT + ';';

    const label = document.createElement('span');
    label.textContent = formatMentionLabel(file.name);
    label.style.cssText = 'pointer-events:none;';
    tag.appendChild(label);

    const closeBtn = document.createElement('span');
    closeBtn.style.cssText = 'display:none;width:12px;height:12px;margin-left:3px;border-radius:50%;background:rgba(255,255,255,0.15);align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;';
    closeBtn.innerHTML = '<svg width="7" height="7" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="#FFFFFFCC" stroke-width="1.2" stroke-linecap="round"/></svg>';
    closeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      tag.remove();
      const content = editorRef.current?.innerText ?? '';
      setHasContent(content.trim().length > 0);
    });
    tag.appendChild(closeBtn);

    tag.addEventListener('mouseenter', () => {
      closeBtn.style.display = 'inline-flex';
    });
    tag.addEventListener('mouseleave', () => {
      closeBtn.style.display = 'none';
    });

    return tag;
  };


  // 点击 FileCard 直接插入 @ 标签（无需 @ 触发，插到光标位置或末尾）
  const insertFromCard = (file) => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    let range;

    // 优先使用当前 selection（输入框处于焦点时）
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
      range = sel.getRangeAt(0);
    // 其次使用 onBlur 时保存的光标位置
    } else if (savedCursorRangeRef.current && editor.contains(savedCursorRangeRef.current.startContainer)) {
      range = savedCursorRangeRef.current;
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      // 没有历史光标位置 — 追加到末尾
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    editor.focus();

    const tag = buildTagElement(file);
    tag.addEventListener('click', (e) => handleTagClick(e, tag));
    range.deleteContents();
    range.insertNode(tag);
    const afterRange = document.createRange();
    afterRange.setStartAfter(tag);
    afterRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(afterRange);
    savedCursorRangeRef.current = null;
    setHasContent(true);
  };

  const insertMention = (file) => {
    setMentionOpen(false);
    const targetTag = mentionTargetTag;
    if (targetTag) {
      // replacing an existing tag via click
      const newTag = buildTagElement(file);
      newTag.addEventListener('click', (e) => handleTagClick(e, newTag));
      targetTag.replaceWith(newTag);
      setMentionTargetTag(null);
      editorRef.current.focus();
      setHasContent(true);
      return;
    }
    const savedRange = mentionAnchorRange;
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const textBefore = textNode.textContent.slice(0, range.startOffset);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx === -1) return;
    const deleteRange = document.createRange();
    deleteRange.setStart(textNode, atIdx);
    deleteRange.setEnd(textNode, range.startOffset);
    deleteRange.deleteContents();
    const tag = buildTagElement(file);
    tag.addEventListener('click', (e) => handleTagClick(e, tag));
    deleteRange.insertNode(tag);
    const afterRange = document.createRange();
    afterRange.setStartAfter(tag);
    afterRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(afterRange);
    editorRef.current.focus();
    setHasContent(true);
  };

  const handleTagClick = (e, tagEl) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    mentionFromTagRef.current = true;
    setMentionTargetTag(tagEl);
    setMentionQuery('');
    setMentionAnchorRange(null);
    const rect = tagEl.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    setMentionPos({ top: rect.bottom - editorRect.top + 4, left: Math.max(0, rect.left - editorRect.left) });
    setMentionOpen(true);
  };

  const handleInput = () => {
    const content = editorRef.current?.innerText ?? '';
    setHasContent(content.trim().length > 0);
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) { setMentionOpen(false); return; }
    const range = sel.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) { setMentionOpen(false); return; }
    const textBefore = range.startContainer.textContent.slice(0, range.startOffset);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx !== -1) {
      const query = textBefore.slice(atIdx + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setMentionIndex(0);
        setMentionOpen(true);
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        setMentionPos({ top: rect.bottom - editorRect.top + 4, left: Math.max(0, rect.left - editorRect.left) });
        setMentionAnchorRange(range.cloneRange());
        return;
      }
    }
    setMentionOpen(false);
  };

  const atConcurrentLimit = activeCount >= 5;
  const canSend = !disabled && !atConcurrentLimit && (hasContent || files.length > 0 || firstFrameFile || lastFrameFile || (genType === 'dubbing' && selectedVoiceId));

  const handleSend = async () => {
    if (!canSend) return;
    // 提取纯文字 prompt，剔除 @ 标签节点（data-file-ref），避免把 @文件名 混入发给后端的 prompt
    let currentText = '';
    if (editorRef.current) {
      const clone = editorRef.current.cloneNode(true);
      clone.querySelectorAll('[data-file-ref]').forEach((el) => el.remove());
      currentText = clone.innerText?.trim() ?? '';
    }
    const savedFiles = files;
    const savedHTML = editorRef.current?.innerHTML ?? '';
    // 立即清空输入框和附件
    if (editorRef.current) editorRef.current.innerHTML = '';
    setHasContent(false);
    setFiles([]);
    setFirstFrameFile(null);
    setLastFrameFile(null);
    setDubbingSpeed(1.0);
    setDubbingEmotion('中性');
    setSelectedVoiceId('');
    setSelectedVoiceName('');
    // 视频模式：把「全能参考」/「首尾帧」映射为当前模型支持的实际 reference_mode
    let actualRefMode = refMode;
    if (genType === 'video') {
      const currentModel = modelOptions.find(m => m.value === model);
      if (refMode === 'all') {
        actualRefMode = currentModel?.actualAllRefMode || 'full';
      } else if (refMode === 'frame') {
        actualRefMode = currentModel?.actualFrameRefMode || 'first_frame';
      }
    }
    const result = await onGenerate?.({
      prompt: currentText,
      promptHTML: savedHTML,
      genType,
      model,
      ...(genType === 'image' ? { ratio, resolution, count } : {}),
      ...(genType === 'video' ? { refMode: actualRefMode, videoRatio, videoResolution, videoDuration, soundEnabled, firstFrameFile, lastFrameFile } : {}),
      ...(genType === 'dubbing' ? { speed: dubbingSpeed, emotion: dubbingEmotion, voiceId: selectedVoiceId, voiceName: selectedVoiceName } : {}),
      files,
      onFail: (fallbackPrompt) => {
        // 失败时回退输入框内容（含标签 HTML）和附件
        if (editorRef.current) {
          if (savedHTML) {
            editorRef.current.innerHTML = savedHTML;
            setHasContent(true);
          } else if (fallbackPrompt) {
            editorRef.current.innerText = fallbackPrompt;
            setHasContent(true);
          }
        }
        if (savedFiles.length > 0) {
          setFiles(savedFiles);
        }
      },
    });
  };

  const handleKeyDown = (e) => {
    if (mentionOpen) {
      const mentionFiles = files.filter(f =>
        mentionQuery === '' || f.name.toLowerCase().includes(mentionQuery.toLowerCase())
      );
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => mentionFiles.length ? (i + 1) % mentionFiles.length : 0);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => mentionFiles.length ? (i - 1 + mentionFiles.length) % mentionFiles.length : 0);
        return;
      }
      if (e.key === 'Enter' && mentionFiles.length > 0) {
        e.preventDefault();
        insertMention(mentionFiles[mentionIndex] || mentionFiles[0]);
        return;
      }
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return; // 有选区时让浏览器默认处理
      let tagToRemove = null;
      if (e.key === 'Backspace') {
        // 光标前一个节点是 tag
        const { startContainer, startOffset } = range;
        if (startOffset === 0 && startContainer.previousSibling?.dataset?.fileRef) {
          tagToRemove = startContainer.previousSibling;
        } else if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
          const prev = startContainer.previousSibling;
          if (prev?.dataset?.fileRef) tagToRemove = prev;
        }
      } else {
        // Delete：光标后一个节点是 tag
        const { startContainer, startOffset } = range;
        if (startContainer.nodeType === Node.TEXT_NODE && startOffset === startContainer.textContent.length) {
          const next = startContainer.nextSibling;
          if (next?.dataset?.fileRef) tagToRemove = next;
        } else if (startContainer.nextSibling?.dataset?.fileRef) {
          tagToRemove = startContainer.nextSibling;
        }
      }
      if (tagToRemove) {
        e.preventDefault();
        tagToRemove.remove();
        const content = editorRef.current?.innerText ?? '';
        setHasContent(content.trim().length > 0);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTyping = focused;
  const hoverBg = 'conic-gradient(from var(--creation-chatbox-angle), oklab(86.8% -0.081 -0.057 / 30%) 0%, oklab(75.5% -0.102 -0.072 / 25%) 15%, oklab(75.5% -0.102 -0.072 / 0%) 50%, oklab(100% 0 0 / 5%) 55%, oklab(86.8% -0.081 -0.057 / 30%) 100%)';
  const idleBg = 'linear-gradient(in oklab 161.1deg, oklab(86.8% -0.081 -0.057 / 30%) 9.06%, oklab(75.5% -0.102 -0.072 / 25%) 15.35%, oklab(75.5% -0.102 -0.072 / 0%) 52.98%, oklab(100% 0 0 / 5%) 56.39%)';

  const wrapperStyle = (() => {
    if (isTyping) return { background: '#2DC3E1', animation: 'none' };
    if (hovered) return { backgroundImage: hoverBg, animation: 'creation-chatbox-spin 4s linear infinite' };
    return { backgroundImage: idleBg, animation: 'none' };
  })();

  const assetPickerAccept = genType === 'image' ? 'image' : genType === 'video' ? (creationParams?.supportsAudio ? 'all' : 'image') : genType === 'dubbing' ? 'audio' : 'all';

  return (
    <>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0px',
        borderRadius: '20px',
        justifyContent: 'flex-end',
        padding: '1px',
        width,
        ...wrapperStyle,
        boxShadow: '-5px -10px 50px #2DC3E11F',
        opacity: disabled ? 0.72 : 1,
        overflow: 'visible',
      }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '0px',
          borderRadius: '19px',
          paddingTop: '16px',
          paddingBottom: '12px',
          flex: 1,
          alignSelf: 'stretch',
          background: '#131313',
          paddingLeft: '16px',
          paddingRight: '16px',
          overflow: 'visible',
        }}
      >
        {/* Textarea row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            alignSelf: 'stretch',
            height: '110px',
            flexShrink: 0,
            padding: 0,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          {files.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '8px', bottom: 'calc(100% + 24px)' }}>
              {files.map((file, index) => (
                <FileCard key={index} file={file} onRemove={() => handleRemoveFile(index)} disabled={disabled} onInsert={() => insertFromCard(file)} />
              ))}
            </div>
          )}
          {genType === 'video' && refMode === 'frame' ? (
            <FrameUploader
              firstFile={firstFrameFile}
              lastFile={lastFrameFile}
              onFirstChange={setFirstFrameFile}
              onLastChange={setLastFrameFile}
              onSwap={() => { setFirstFrameFile(lastFrameFile); setLastFrameFile(firstFrameFile); }}
              onFirstAssetPick={() => { setFrameAssetTarget('first'); setAssetPickerOpen(true); }}
              onLastAssetPick={() => { setFrameAssetTarget('last'); setAssetPickerOpen(true); }}
              disabled={disabled}
            />
          ) : genType === 'dubbing' ? (
            selectedVoiceId ? (
              <DubbingVoiceFileCard voiceName={selectedVoiceName} voiceId={selectedVoiceId} onRemove={() => { setSelectedVoiceId(''); setSelectedVoiceName(''); }} onOpenModal={() => setVoiceModalOpen(true)} />
            ) : (
              <UploadPlaceholder onDirectClick={() => setVoiceModalOpen(true)} disabled={disabled} allowedExts={uploadAllowedExts} acceptAttr={uploadAcceptAttr} />
            )
          ) : (
            <UploadPlaceholder onFileSelect={handleFileSelect} onAssetPick={() => setAssetPickerOpen(true)} disabled={disabled} allowedExts={uploadAllowedExts} acceptAttr={uploadAcceptAttr} />
          )}
          <div style={{ flex: 1, alignSelf: 'stretch', position: 'relative' }}>
            {!hasContent && (() => {
              // 图片分页
              if (genType === 'image') {
                return (
                  <span style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>上传参考图，输入文字或</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(45,195,225,0.10)', color: '#2DC3E1', borderRadius: '6px', padding: '0 4px', fontSize: '14px', lineHeight: '18px', height: '18px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>@</span>
                    <span>主体，描述你想生成的图片</span>
                  </span>
                );
              }
              // 视频分页
              if (genType === 'video') {
                // 全能参考
                if (refMode === 'all') {
                  return (
                    <span style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <span>上传最多12个参考素材、输入文字或</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(45,195,225,0.10)', color: '#2DC3E1', borderRadius: '6px', padding: '0 4px', fontSize: '14px', lineHeight: '18px', height: '18px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>@</span>
                      <span>参考内容，自由组合图、文、音、视频多元素</span>
                    </span>
                  );
                }
                // 首尾帧
                if (refMode === 'frame') {
                  return (
                    <span style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66', userSelect: 'none' }}>
                      输入文字，描述你想创作的画面内容
                    </span>
                  );
                }
                // 智能多帧
                if (refMode === 'multi') {
                  return (
                    <span style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66', userSelect: 'none' }}>
                      请添加智能多帧分镜图
                    </span>
                  );
                }
              }
              // 默认提示词
              return (
                <span style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66', userSelect: 'none' }}>
                  描述你想生成的内容
                </span>
              );
            })()}
            <div
              ref={editorRef}
              contentEditable={!disabled}
              suppressContentEditableWarning
              style={{
                width: '100%',
                height: '100%',
                resize: 'none',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: FONT,
                fontSize: '14px',
                lineHeight: '18px',
                color: '#FFFFFFCC',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                cursor: disabled ? 'not-allowed' : 'text',
              }}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                // 失焦前保存光标位置，供点击图片卡片插入时使用
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  savedCursorRangeRef.current = sel.getRangeAt(0).cloneRange();
                }
                if (mentionFromTagRef.current) {
                  mentionFromTagRef.current = false;
                } else {
                  setMentionOpen(false);
                  setMentionTargetTag(null);
                }
              }}
            />
            {mentionOpen && files.length > 0 && (() => {
              const mentionFiles = files.filter(f =>
                mentionQuery === '' || f.name.toLowerCase().includes(mentionQuery.toLowerCase())
              );
              if (mentionFiles.length === 0) return null;
              return (
                <div ref={mentionMenuRef} style={{
                  position: 'absolute',
                  top: mentionPos.top,
                  left: mentionPos.left,
                  zIndex: 100,
                  width: '200px',
                  borderRadius: '8px',
                  boxShadow: '#00000066 0px 4px 16px',
                  background: '#1D1E1E',
                  border: '1px solid #FFFFFF0D',
                  padding: '4px',
                }}>
                  {mentionFiles.map((file, i) => (
                    <div
                      key={i}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(file); }}
                      onMouseEnter={() => setMentionIndex(i)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: i === mentionIndex ? '#FFFFFF0D' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        flexShrink: 0,
                        background: (file.previewUrl || file.url) ? 'transparent' : '#FFFFFF14',
                        backgroundImage: (file.previewUrl || file.url) ? `url(${file.previewUrl || file.url})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }} />
                      <span style={{
                        flex: 1,
                        fontFamily: FONT,
                        fontSize: '14px',
                        lineHeight: '18px',
                        color: i === mentionIndex ? '#FFFFFF' : '#FFFFFF99',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {file.name}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
        {/* Bottom controls */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0px', justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: 0 }}>
            <GenTypeSelector value={genType} onChange={onGenTypeChange} disabled={disabled} options={GEN_TYPE_OPTIONS} />
            <ModelSelector value={model} onChange={onModelChange} options={genType === 'video' ? filteredModelOptions : modelOptions} disabled={disabled} onBeforeOpen={onBeforeModelOpen} />
            {genType === 'dubbing' && (
              <DubbingAdjust
                speed={dubbingSpeed}
                emotion={dubbingEmotion}
                onSpeedChange={setDubbingSpeed}
                onEmotionChange={setDubbingEmotion}
                emotions={dubbingEmotions}
                disabled={disabled}
              />
            )}
            {genType === 'image' && (
              <ParamsSelector
                ratio={ratio}
                resolution={resolution}
                count={count}
                onRatioChange={setRatio}
                onResolutionChange={setResolution}
                onCountChange={setCount}
                disabled={disabled}
                ratioOptions={creationParams?.ratios ?? []}
                resolutionOptions={creationParams?.resolutions ?? []}
                countOptions={creationParams?.counts ?? []}
              />
            )}
            {genType === 'video' && (
              <>
                <RefModeSelector value={refMode} onChange={handleRefModeChange} disabled={disabled} options={creationParams?.refModes ?? []} />
                <VideoParamsSelector
                  ratio={videoRatio}
                  resolution={videoResolution}
                  duration={videoDuration}
                  onRatioChange={setVideoRatio}
                  onResolutionChange={setVideoResolution}
                  onDurationChange={setVideoDuration}
                  disabled={disabled}
                  ratioOptions={creationParams?.ratios ?? []}
                  resolutionOptions={creationParams?.resolutions ?? []}
                  durationOptions={creationParams?.durations ?? []}
                />
                {creationParams?.supportsAudio && (
                  <SoundToggle enabled={soundEnabled} onChange={setSoundEnabled} disabled={disabled} />
                )}
              </>
            )}
          </div>
          <SendButton onClick={handleSend} disabled={!canSend} loading={disabled} disabledTooltip={atConcurrentLimit ? '当前有5个任务进行中，为了保证成功率，请稍等一会儿再发送创作请求' : ''} />
        </div>
      </div>
    </div>
    <AssetPickerModal
      open={assetPickerOpen}
      onClose={() => { setAssetPickerOpen(false); setFrameAssetTarget(null); }}
      onConfirm={handleAssetConfirm}
      accept={frameAssetTarget ? 'image' : assetPickerAccept}
    />
    <DubbingVoiceModal
      open={voiceModalOpen}
      onClose={() => setVoiceModalOpen(false)}
      onConfirm={(voiceId, voiceName) => {
        setSelectedVoiceId(voiceId);
        setSelectedVoiceName(voiceName);
        setVoiceModalOpen(false);
      }}
    />
    </>
  );
}

// ─── Empty state icons ────────────────────────────────────────────────────────


export default memo(InputCard);
