import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import ReactMarkdown from 'react-markdown';
import { apiSaveScriptWorkspace, apiGetScriptWorkspace, apiChatScriptWorkspaceStream, apiUploadScriptWorkspace, apiFinalizeScriptWorkspace, apiUpdateEpisode, apiGetEpisodes } from '../api/subject';
import { apiListModels } from '../api/config';
import { PulsingBorder } from '@paper-design/shaders-react';
import DotsLoading from '../components/DotsLoading';
import ConfirmDialog from '../components/ConfirmDialog';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const ALLOWED_EXTS = ['.txt', '.md', '.pdf', '.docx', '.doc'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CHARS = 100000;
const CHAT_TIMEOUT_MS = 120_000; // 2 分钟客户端超时兜底（后端通常先返回 504）

function parseScriptOutline(markdown) {
  if (!markdown) return [];

  const entries = [];
  let offset = 0;

  markdown.split('\n').forEach((line) => {
    if (/^#\s/.test(line)) {
      entries.push({
        title: line.replace(/^#\s+/, '').trim(),
        level: 1,
        offset,
      });
    } else if (/^##\s/.test(line)) {
      entries.push({
        title: line.replace(/^##\s+/, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '').trim(),
        level: 2,
        offset,
      });
    }

    offset += line.length + 1;
  });

  return entries;
}

/**
 * 将后端返回的"第X集"转换为 Markdown 二级标题 `## 第X集`，
 * 以便 parseScriptOutline 正确识别并生成分集导航。
 * 兼容：纯文本"第X集"、已有一级标题"# 第X集"、无空格"#第X集"。
 */
function formatEpisodeHeaders(content) {
  if (!content) return '';
  return content.replace(/^(?:#\s*)?第(\d+)集/gm, '## 第$1集');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function truncateFileName(name) {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) return name;
  const base = name.slice(0, dotIndex);
  const ext = name.slice(dotIndex);
  const maxBase = 12;
  if (base.length <= maxBase) return name;
  return base.slice(0, maxBase) + '… ' + ext;
}

const SPINNER_STYLE_ID = 'script-spinner-style';
function ensureSpinnerStyle() {
  if (document.getElementById(SPINNER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SPINNER_STYLE_ID;
  style.textContent = `@keyframes btn-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]"
          style={{ whiteSpace: 'nowrap', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
        >
          {t.type === 'success' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {t.type === 'warning' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#EB8B14" stroke="#EB8B14" strokeWidth="1.333" strokeLinejoin="round" />
              <path fillRule="evenodd" clipRule="evenodd" d="M8 12.333C8.46 12.333 8.833 11.96 8.833 11.5C8.833 11.04 8.46 10.667 8 10.667C7.54 10.667 7.167 11.04 7.167 11.5C7.167 11.96 7.54 12.333 8 12.333Z" fill="#FFFFFF" />
              <path d="M8 4V9.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {t.type === 'info' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#2DC3E1" stroke="#2DC3E1" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M8 7.333V11.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
              <circle cx="8" cy="5" r="0.667" fill="#FFFFFF" />
            </svg>
          )}
          {t.type === 'error' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
            </svg>
          )}
          <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

const ROTATE_STYLE_ID = 'chatbox-rotate-keyframe';
function ensureRotateKeyframe() {
  if (document.getElementById(ROTATE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ROTATE_STYLE_ID;
  style.textContent = `
    @property --chatbox-angle {
      syntax: '<angle>';
      initial-value: 161.1deg;
      inherits: false;
    }
    @keyframes chatbox-spin {
      from { --chatbox-angle: 161.1deg; }
      to { --chatbox-angle: 521.1deg; }
    }
  `;
  document.head.appendChild(style);
}

const THINKING_STYLE_ID = 'script-thinking-style';
function ensureThinkingStyle() {
  if (document.getElementById(THINKING_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = THINKING_STYLE_ID;
  style.textContent = `
    @keyframes thinking-dot {
      0%, 60%, 100% { opacity: 0.2; transform: translateY(0px); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    @keyframes thinking-label-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0px); }
    }
    @keyframes thinking-label-out {
      from { opacity: 1; transform: translateY(0px); }
      to { opacity: 0; transform: translateY(-6px); }
    }
    .thinking-dot { animation: thinking-dot 1.4s ease-in-out infinite; }
    .thinking-dot:nth-child(1) { animation-delay: 0s; }
    .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
    .thinking-dot:nth-child(3) { animation-delay: 0.4s; }
    .thinking-label-in { animation: thinking-label-in 0.35s cubic-bezier(0.4,0,0.2,1) forwards; }
    .thinking-label-out { animation: thinking-label-out 0.25s cubic-bezier(0.4,0,0.2,1) forwards; }
  `;
  document.head.appendChild(style);
}

const SCROLLBAR_STYLE_ID = 'script-scrollbar-style';
function ensureScrollbarStyle() {
  if (document.getElementById(SCROLLBAR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SCROLLBAR_STYLE_ID;
  style.textContent = `
    .script-scroll::-webkit-scrollbar { width: 4px; }
    .script-scroll::-webkit-scrollbar-track { background: transparent; }
    .script-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 9999px; transition: background 0.2s; }
    .script-scroll:hover::-webkit-scrollbar-thumb { background: #FFFFFF0D; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    .ai-text--typing::after { content: '|'; display: inline; opacity: 1; animation: blink 1s step-end infinite; color: #FFFFFFCC; margin-left: 1px; }
  `;
  document.head.appendChild(style);
}

const EDITOR_STYLE_ID = 'script-editor-style';
function ensureEditorStyle() {
  if (document.getElementById(EDITOR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = EDITOR_STYLE_ID;
  style.textContent = `
    .tiptap-editor .ProseMirror {
      outline: none;
      caret-color: #2DC3E1;
    }
    .tiptap-editor .ProseMirror h1 {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_85_Bold', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 20px;
      line-height: 24px;
      font-weight: bold;
      margin: 0 0 8px;
    }
    .tiptap-editor .ProseMirror h2 {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_85_Bold', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 16px;
      line-height: 20px;
      font-weight: bold;
      margin: 12px 0 6px;
    }
    .tiptap-editor .ProseMirror p {
      color: #FFFFFFCC;
      font-family: 'AlibabaPuHuiTi_2_55_Regular', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 14px;
      line-height: 150%;
      margin: 4px 0;
    }
    .tiptap-editor .ProseMirror strong {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_65_Medium', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
    }
    .tiptap-editor .ProseMirror ul,
    .tiptap-editor .ProseMirror ol {
      padding-left: 20px;
      color: #FFFFFFCC;
      font-family: 'AlibabaPuHuiTi_2_55_Regular', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 14px;
      line-height: 150%;
      margin: 4px 0;
    }
    .tiptap-editor .ProseMirror li { margin: 2px 0; }
    .tiptap-editor .ProseMirror li p { margin: 0; }
    .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
      color: #FFFFFF33;
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }
    .script-md {
      min-height: 0;
      height: 100%;
      overflow-y: auto;
      padding-right: 4px;
      scroll-behavior: smooth;
    }
    .script-md h1 {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_85_Bold', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 20px;
      line-height: 24px;
      font-weight: bold;
      margin: 0 0 8px;
    }
    .script-md h2 {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_85_Bold', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 16px;
      line-height: 20px;
      font-weight: bold;
      margin: 12px 0 6px;
      scroll-margin-top: 20px;
    }
    .script-md p {
      color: #FFFFFFCC;
      font-family: 'AlibabaPuHuiTi_2_55_Regular', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 14px;
      line-height: 150%;
      margin: 4px 0;
    }
    .script-md strong {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_65_Medium', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
    }
    .script-md ul,
    .script-md ol {
      padding-left: 20px;
      color: #FFFFFFCC;
      font-family: 'AlibabaPuHuiTi_2_55_Regular', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 14px;
      line-height: 150%;
      margin: 4px 0;
    }
    .script-md li { margin: 2px 0; }
  `;
  document.head.appendChild(style);
}

function UploadPlaceholder({ onFileSelect, disabled = false }) {
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef(null);

  const defaultBack = { opacity: 0.6, bg: '#FFFFFF14', rotate: '0deg' };
  const defaultFront = { bg: '#262626', rotate: '345deg', tx: 'calc(-50% - 7.015px)', ty: 'calc(-50% + 6.717px)' };
  const defaultIcon = { stroke: '#FFFFFF33', tx: 'calc(-50% - 1.349px)', ty: 'calc(-50% + 1.757px)', rotate: '345deg' };

  const hoverBack = { opacity: 0.6, bg: '#FFFFFF3D', rotate: '5deg' };
  const hoverFront = { bg: '#3D3D3D', rotate: '351deg', tx: 'calc(-50% - 4.422px)', ty: 'calc(-50% + 3.811px)' };
  const hoverIcon = { stroke: '#FFFFFF80', tx: 'calc(-50% - 0.865px)', ty: 'calc(-50% + 1.012px)', rotate: '351deg' };

  const back = hovered ? hoverBack : defaultBack;
  const front = hovered ? hoverFront : defaultFront;
  const icon = hovered ? hoverIcon : defaultIcon;
  const transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';

  const handleChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const invalid = selected.filter((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return !ALLOWED_EXTS.includes(ext);
    });
    if (invalid.length) {
      alert('仅支持 .txt/.docx/.pdf/.md/.doc 格式的文件');
      e.target.value = '';
      return;
    }

    const tooLarge = selected.filter((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge.length) {
      alert(`文件大小不能超过 10MB：${tooLarge.map((f) => f.name).join('、')}`);
      e.target.value = '';
      return;
    }

    for (const file of selected) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (ext === '.txt' || ext === '.md') {
        const content = await file.text();
        if (content.length > MAX_CHARS) {
          alert(`"${file.name}" 超过 10 万字符限制`);
          e.target.value = '';
          return;
        }
      }
    }

    onFileSelect?.(selected);
    e.target.value = '';
  };

  return (
    <button
      type="button"
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !disabled && fileInputRef.current?.click()}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0px',
        position: 'relative',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'transparent',
        border: 'none',
        opacity: disabled ? 0.45 : 1,
        outline: 'none',
        outlineOffset: '0px',
        borderRadius: '8px',
      }}
    >
      <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.pdf,.docx,.doc" className="hidden" onChange={handleChange} />
      <div
        style={{
          width: '44px',
          height: '60px',
          borderRadius: '4px',
          flexShrink: 0,
          boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset',
          opacity: back.opacity,
          background: back.bg,
          rotate: back.rotate,
          transition,
        }}
      />
      <div
        style={{
          width: '44px',
          height: '60px',
          borderRadius: '4px',
          position: 'absolute',
          boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset',
          transformOrigin: 'top left',
          background: front.bg,
          rotate: front.rotate,
          left: '50%',
          top: '50%',
          translate: `${front.tx} ${front.ty}`,
          transition,
        }}
      />
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          translate: `${icon.tx} ${icon.ty}`,
          rotate: icon.rotate,
          transformOrigin: '0% 0%',
          transition,
        }}
      >
        <path d="M8 3v10M3 8h10" stroke={icon.stroke} strokeWidth="1.5" strokeLinecap="round" style={{ transition }} />
      </svg>
    </button>
  );
}


function ModelSelector({ label, options, width, disabled = false, onSelect }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(label);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setSelected(label); }, [label]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isActive = open || hovered;

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((value) => !value)}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '32px',
          paddingLeft: '12px',
          paddingRight: '6px',
          borderRadius: '8px',
          justifyContent: 'space-between',
          flexShrink: 0,
          border: '1px solid',
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: open ? '#252525' : isActive ? '#222222' : '#1D1E1E',
          borderColor: open ? '#FFFFFF33' : '#FFFFFF14',
          outline: focused || open ? '1px solid #2DC3E180' : '1px solid #00000080',
          transition: 'background 0.2s, border-color 0.2s, outline 0.2s, opacity 0.2s',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: '12px',
            lineHeight: '16px',
            color: '#FFFFFFCC',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {selected}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            flexShrink: 0,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </button>

      {open && !disabled && (
        <div
          className="rounded-medium bg-select-bg border border-select-border p-[4px]"
          style={{
            position: 'absolute',
            zIndex: 50,
            left: 0,
            marginBottom: '4px',
            minWidth: '100%',
            maxWidth: '100%',
            width: '100%',
            bottom: '100%',
            outline: '1px solid #00000080',
            boxShadow: '0px -4px 16px var(--color-select-shadow)',
          }}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setSelected(option);
                setOpen(false);
                onSelect?.(option);
              }}
              className={`flex items-center px-[12px] py-[8px] self-stretch rounded-md text-font-size-14 w-full cursor-pointer border-none text-left transition-colors duration-150 ${
                option === selected
                  ? 'bg-select-item-bg-active text-select-item-text-active'
                  : 'bg-select-item-bg-normal text-select-item-text-normal hover:bg-select-item-bg-hover hover:text-select-item-text-hover'
              }`}
              style={{ fontFamily: FONT }}
            >
              <span className="truncate" title={option}>{option}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EpisodeCountSelector({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(typeof value === 'number' ? value : 1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isActive = open || hovered;
  const label = value == null ? '集数：自动适应' : `集数：${value} 集`;

  const handleAutoSelect = () => { onChange(null); setOpen(false); };

  const adjustCount = (delta) => {
    const base = typeof inputVal === 'number' ? inputVal : 1;
    const next = Math.max(1, base + delta);
    setInputVal(next);
    onChange(next);
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;
    if (raw === '') { setInputVal(''); return; }
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) { setInputVal(n); onChange(n); }
  };

  const handleInputBlur = () => {
    const n = parseInt(inputVal, 10);
    if (isNaN(n) || n < 1) { setInputVal(1); onChange(1); }
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '140px' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '32px',
          paddingLeft: '12px',
          paddingRight: '6px',
          borderRadius: '8px',
          justifyContent: 'space-between',
          flexShrink: 0,
          border: '1px solid',
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: open ? '#252525' : isActive ? '#222222' : '#1D1E1E',
          borderColor: open ? '#FFFFFF33' : '#FFFFFF14',
          outline: focused || open ? '1px solid #2DC3E180' : '1px solid #00000080',
          transition: 'background 0.2s, border-color 0.2s, outline 0.2s, opacity 0.2s',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </button>

      {open && !disabled && (
        <div
          className="rounded-medium bg-select-bg border border-select-border p-[4px]"
          style={{
            position: 'absolute', zIndex: 50, left: 0, marginBottom: '4px',
            width: '100%', maxWidth: '100%', bottom: '100%',
            outline: '1px solid #00000080',
            boxShadow: '0px -4px 16px var(--color-select-shadow)',
          }}
        >
          <button
            type="button"
            onClick={handleAutoSelect}
            className={`flex items-center px-[12px] py-[8px] self-stretch rounded-md text-font-size-14 w-full cursor-pointer border-none text-left transition-colors duration-150 ${
              value == null
                ? 'bg-select-item-bg-active text-select-item-text-active'
                : 'bg-select-item-bg-normal text-select-item-text-normal hover:bg-select-item-bg-hover hover:text-select-item-text-hover'
            }`}
            style={{ fontFamily: FONT }}
          >
            集数：自动适应
          </button>

          <div
            className={`flex items-center px-[12px] py-[8px] rounded-md gap-[4px] ${
              value != null
                ? 'bg-select-item-bg-active'
                : 'bg-select-item-bg-normal hover:bg-select-item-bg-hover'
            }`}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); adjustCount(-1); }}
              className="w-[20px] h-[20px] rounded-[4px] border-none bg-white-8 text-select-item-text-normal cursor-pointer flex items-center justify-center text-[14px] shrink-0 hover:bg-white-20 transition-colors duration-150"
            >−</button>
            <input
              type="number"
              min="1"
              value={inputVal}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onClick={(e) => { e.stopPropagation(); if (value == null) { setInputVal(1); onChange(1); } }}
              className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-select-item-text-normal bg-white-5 border border-stroke-normal rounded-[4px] text-center outline-none text-font-size-14 flex-1 min-w-0"
              style={{ height: '20px', fontFamily: FONT, MozAppearance: 'textfield' }}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); adjustCount(1); }}
              className="w-[20px] h-[20px] rounded-[4px] border-none bg-white-8 text-select-item-text-normal cursor-pointer flex items-center justify-center text-[14px] shrink-0 hover:bg-white-20 transition-colors duration-150"
            >+</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SendButton({ onClick, disabled = false, loading = false, isGenerating = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isClickable = isGenerating || !disabled;
  const scale = pressed ? 'scale(0.9)' : hovered ? 'scale(1.1)' : 'scale(1)';

  return (
    <button
      type="button"
      disabled={!isClickable}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isClickable && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={isClickable ? onClick : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0px',
        borderRadius: '9999px',
        position: 'relative',
        flexShrink: 0,
        boxShadow: '#2DC3E133 0px 0px 12px',
        width: '40px',
        height: '40px',
        cursor: !isClickable ? 'not-allowed' : 'pointer',
        transform: !isClickable ? 'scale(1)' : scale,
        transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1), opacity 0.15s',
        opacity: (!isClickable) ? 0.45 : 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 0,
      }}
    >
      <PulsingBorder
        speed={loading ? 1.3 : 1}
        roundness={1}
        thickness={0.41}
        softness={1}
        intensity={0.4}
        bloom={0.68}
        spots={4}
        spotSize={0.42}
        pulse={0.37}
        smoke={0.55}
        smokeSize={0.18}
        scale={0.94}
        rotation={0}
        aspectRatio="square"
        frame={34362983.25087259}
        colors={['#0DC1FDB3', '#E1F5FF', '#73FFE1']}
        colorBack="#00000000"
        className="rounded-full flex-1 w-full [box-shadow:#34DDFFB3_0px_0px_4px_2px_inset] bg-neutral-300"
      />
      {isGenerating ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
          <rect x="4" y="3" width="3" height="10" rx="1.5" fill="white" />
          <rect x="9" y="3" width="3" height="10" rx="1.5" fill="white" />
        </svg>
      ) : loading ? (
        <div style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
          <DotsLoading size={4} color="#FFFFFF" gap={3} />
        </div>
      ) : (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
          <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function FileCard({ file, onRemove, disabled = false }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '2px',
        paddingLeft: '8px',
        paddingRight: '8px',
        paddingTop: '6px',
        paddingBottom: '6px',
        borderRadius: '8px',
        width: '100px',
        height: '100px',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'relative',
        background: '#1D1E1E',
        border: `1px solid ${hovered ? '#FFFFFF33' : '#FFFFFF14'}`,
        transition: 'border-color 0.15s',
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '150%',
          alignSelf: 'stretch',
          flex: 1,
          overflow: 'hidden',
          color: '#FFFFFF',
        }}
      >
        {truncateFileName(file.name)}
      </div>
      <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '150%', alignSelf: 'stretch', color: '#FFFFFF66' }}>
        {formatFileSize(file.size)}
      </div>
      {hovered && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            top: '-5px',
            right: '-5px',
            width: '16px',
            height: '16px',
            borderRadius: '9999px',
            background: '#505151',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function InputCard({ onSend, onStop, restoreText = '', restoreFiles = [], selectedModel, onModelChange, episodeCount, onEpisodeCountChange, width = '700px', disabled = false }) {
  const [text, setText] = useState(restoreText); // 挂载时使用 restoreText 作为初始值（超时回到空状态时预填充）
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [files, setFiles] = useState(restoreFiles);
  const [models, setModels] = useState([]);
  const prevDisabledRef = useRef(false);

  useEffect(() => {
    ensureRotateKeyframe();
    ensureThinkingStyle();
  }, []);

  useEffect(() => {
    apiListModels({ category: 'chat' }).then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setModels(list);
        if (!selectedModel) { const def = list.find(m => m.is_default === true) || list[0]; onModelChange?.(def.model_id); }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      setText(restoreText);
      setFiles(restoreFiles);
    }
    prevDisabledRef.current = disabled;
  }, [disabled, restoreText, restoreFiles]);

  const handleFileSelect = (newFiles) => setFiles((prev) => [...prev, ...newFiles]);
  const handleRemoveFile = (index) => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

  const canSend = !disabled && (text.trim() || files.length > 0);

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim(), files, selectedModel, episodeCount);
    setText('');
    setFiles([]);
  };

  const handleStop = () => {
    onStop?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTyping = focused;
  const hoverBg = 'conic-gradient(from var(--chatbox-angle), oklab(86.8% -0.081 -0.057 / 30%) 0%, oklab(75.5% -0.102 -0.072 / 25%) 15%, oklab(75.5% -0.102 -0.072 / 0%) 50%, oklab(100% 0 0 / 5%) 55%, oklab(86.8% -0.081 -0.057 / 30%) 100%)';
  const idleBg = 'linear-gradient(in oklab 161.1deg, oklab(86.8% -0.081 -0.057 / 30%) 9.06%, oklab(75.5% -0.102 -0.072 / 25%) 15.35%, oklab(75.5% -0.102 -0.072 / 0%) 52.98%, oklab(100% 0 0 / 5%) 56.39%)';

  const wrapperStyle = (() => {
    if (isTyping) return { background: '#2DC3E1', animation: 'none' };
    if (hovered) return { backgroundImage: hoverBg, animation: 'chatbox-spin 4s linear infinite' };
    return { backgroundImage: idleBg, animation: 'none' };
  })();

  return (
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
            <div style={{ position: 'absolute', left: 0, display: 'flex', alignItems: 'flex-start', gap: '8px', bottom: 'calc(100% + 24px)' }}>
              {files.map((file, index) => (
                <FileCard key={index} file={file} onRemove={() => handleRemoveFile(index)} disabled={disabled} />
              ))}
            </div>
          )}
          <UploadPlaceholder onFileSelect={handleFileSelect} disabled={disabled} />
          <textarea
            disabled={disabled}
            className="placeholder:text-[#FFFFFF66]"
            style={{
              flex: 1,
              alignSelf: 'stretch',
              resize: 'none',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: FONT,
              fontSize: '14px',
              lineHeight: '18px',
              color: text ? '#FFFFFFCC' : '#FFFFFF66',
            }}
            placeholder="支持.txt/.docx/.pdf/.md/.doc格式，最大 10MB，剧本不超过10w字符"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0px', justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: 0 }}>
            <ModelSelector
              label={selectedModel ? (models.find(m => m.model_id === selectedModel)?.name ?? selectedModel) : (models[0]?.name ?? '加载中…')}
              options={models.map(m => m.name)}
              width="200px"
              disabled={disabled}
              onSelect={(name) => {
                const m = models.find(m => m.name === name);
                if (m) onModelChange?.(m.model_id);
              }}
            />
            <EpisodeCountSelector value={episodeCount} onChange={(v) => onEpisodeCountChange?.(v)} disabled={disabled} />
          </div>
          <SendButton onClick={disabled ? handleStop : handleSend} disabled={!canSend && !disabled} loading={disabled && !onStop} isGenerating={disabled && !!onStop} />
        </div>
      </div>
    </div>
  );
}

function ScriptEmptyState({ onSend, selectedModel, onModelChange, episodeCount, onEpisodeCountChange, restoreText = '', restoreFiles = [] }) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        alignSelf: 'stretch',
        paddingBottom: '24px',
      }}
    >
      <InputCard
        onSend={onSend}
        width="700px"
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        episodeCount={episodeCount}
        onEpisodeCountChange={onEpisodeCountChange}
        restoreText={restoreText}
        restoreFiles={restoreFiles}
      />
    </div>
  );
}

function EpisodeItem({ title, level, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: '36px',
        paddingLeft: '16px',
        paddingRight: '16px',
        borderRadius: '8px',
        alignSelf: 'stretch',
        flexShrink: 0,
        cursor: 'pointer',
        backgroundColor: isSelected ? '#FFFFFF0D' : hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background-color 0.15s',
        border: 'none',
        outline: 'none',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '18px',
          color: isSelected ? '#FFFFFF' : '#FFFFFF99',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
          transition: 'color 0.15s',
          paddingLeft: level === 2 ? '16px' : '0px',
        }}
      >
        {title}
      </span>
    </button>
  );
}

function EpisodeList({ outline, selectedIndex, onSelect, loading = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '16px',
        width: '216px',
        minWidth: '216px',
        alignSelf: 'stretch',
        flexShrink: 0,
      }}
    >
      <div style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', alignSelf: 'stretch' }}>
        剧集结构
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', gap: '4px' }}>
        {outline.length > 0 ? (
          outline.map((item, index) => (
            <EpisodeItem key={`${item.level}-${item.offset}-${index}`} title={item.title} level={item.level} isSelected={index === selectedIndex} onClick={() => onSelect(index)} />
          ))
        ) : loading ? (
          [0, 1, 2].map((index) => (
            <div
              key={index}
              style={{
                height: '36px',
                borderRadius: '8px',
                alignSelf: 'stretch',
                background: index === 0 ? '#FFFFFF0A' : 'transparent',
                paddingLeft: '16px',
                paddingRight: '16px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: index === 0 ? '96px' : index === 1 ? '120px' : '88px',
                  height: '10px',
                  borderRadius: '9999px',
                  background: '#FFFFFF12',
                }}
              />
            </div>
          ))
        ) : (
          <div style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '8px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF4D' }}>
              等待剧本生成
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const THINKING_LABELS = ['分析剧情结构', '构建人物关系', '生成剧本内容', '润色台词细节'];

function AiThinkingMessage() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('in');

  useEffect(() => {
    ensureThinkingStyle();
  }, []);

  useEffect(() => {
    const outTimer = setTimeout(() => setPhase('out'), 1500);
    const switchTimer = setTimeout(() => {
      setIdx((value) => (value + 1) % THINKING_LABELS.length);
      setPhase('in');
    }, 1800);

    return () => {
      clearTimeout(outTimer);
      clearTimeout(switchTimer);
    };
  }, [idx]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'stretch', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '20px' }}>
        <DotsLoading size={5} color="#2DC3E1" gap={5} />
      </div>
      <div style={{ position: 'relative', height: '20px', minWidth: '120px', overflow: 'hidden' }}>
        <span
          key={idx}
          className={phase === 'in' ? 'thinking-label-in' : 'thinking-label-out'}
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            translate: '0 -50%',
            fontFamily: FONT,
            fontSize: '13px',
            lineHeight: '20px',
            color: '#FFFFFF66',
            whiteSpace: 'nowrap',
          }}
        >
          {THINKING_LABELS[idx]}
        </span>
      </div>
    </div>
  );
}

// 流式打字动画速度：每个字符之间的间隔（毫秒）
const CHAR_INTERVAL = 15;

// 流式内容渲染组件：逐字打字动画 + 自动滚动到底部
// content 由 SSE 实时推送逐步增长，组件负责以打字机效果逐字展示
// 当浏览器标签页切到后台时，跳过打字动画直接展示全部内容，避免 setTimeout 被浏览器节流导致卡顿
function AiStreamingContent({ content, onDone, paused = false, onPause }) {
  const allChars = useMemo(() => [...content], [content]);
  const [renderIndex, setRenderIndex] = useState(0);
  const [pageVisible, setPageVisible] = useState(true);
  const containerRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  // 防止 onPause 重复触发
  const hasFiredPauseRef = useRef(false);

  // 监听标签页可见性
  useEffect(() => {
    const handle = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);

  // 标签页隐藏时，直接跳到末尾展示全部已接收内容（跳过逐字动画）
  useEffect(() => {
    if (!pageVisible && renderIndex < allChars.length && allChars.length > 0) {
      setRenderIndex(allChars.length);
    }
  }, [pageVisible, allChars.length, renderIndex]);

  // 暂停时：停止 timer，回调当前已渲染文字
  useEffect(() => {
    if (paused && !hasFiredPauseRef.current) {
      hasFiredPauseRef.current = true;
      const displayed = allChars.slice(0, renderIndex).join('');
      onPauseRef.current?.(displayed);
    }
    if (!paused) {
      hasFiredPauseRef.current = false;
    }
  }, [paused, allChars, renderIndex]);

  // 逐字渲染定时器 —— 仅在标签页可见且未暂停时运行
  useEffect(() => {
    if (!pageVisible || paused) return undefined;

    if (renderIndex >= allChars.length) {
      if (allChars.length > 0) {
        onDoneRef.current?.();
      }
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRenderIndex((value) => value + 1);
    }, CHAR_INTERVAL);

    return () => window.clearTimeout(timer);
  }, [pageVisible, paused, allChars.length, renderIndex]);

  // 自动滚动到底部
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldStickToBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [renderIndex]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceToBottom <= 24;
  }, []);

  const displayed = allChars.slice(0, renderIndex).join('');
  const done = renderIndex >= allChars.length;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={done ? 'script-md script-scroll' : 'script-md script-scroll ai-text--typing'}
      style={{ alignSelf: 'stretch', flex: 1, minHeight: 0, overflowY: 'auto' }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
          h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
        }}
      >
        {displayed}
      </ReactMarkdown>
    </div>
  );
}

function ScriptRendered({ content, contentRef, onActiveIndexChange }) {
  const paddingRef = useRef(null);

  // 每次内容变化后，重新计算底部 padding，确保最后一集也能滚到顶部
  useEffect(() => {
    const container = contentRef?.current;
    const paddingEl = paddingRef.current;
    if (!container || !paddingEl) return;

    // 先清零，避免旧 padding 干扰 scrollHeight 的计算
    paddingEl.style.height = '0px';

    const headings = container.querySelectorAll('h2');
    if (headings.length === 0) return;

    const lastHeading = headings[headings.length - 1];

    // 用 scrollTop + getBoundingClientRect 算绝对偏移，不依赖 offsetParent 的定位关系
    const lastHeadingOffset =
      container.scrollTop +
      lastHeading.getBoundingClientRect().top -
      container.getBoundingClientRect().top;

    const clientHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight; // padding 已清零，值准确

    // 要让最后一集标题能滚到顶部，需要 maxScrollTop >= lastHeadingOffset
    // maxScrollTop = scrollHeight - clientHeight
    // 所以补足：lastHeadingOffset - (scrollHeight - clientHeight)
    const needed = lastHeadingOffset - (scrollHeight - clientHeight);
    if (needed > 0) {
      paddingEl.style.height = `${needed}px`;
    }
  }, [content, contentRef]);

  const calcActiveIndex = useCallback(() => {
    const container = contentRef?.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;
    const containerHeight = containerRect.height;
    const headings = container.querySelectorAll('h2');

    if (headings.length === 0) { onActiveIndexChange?.(0); return; }

    // 阈值：某集标题进入可视区域顶部 30% 以内，直接高亮该集（解决短内容集永远抢不到高亮的问题）
    const threshold = containerHeight * 0.3;

    let activeIndex = 0;

    // 优先判断：从后往前找，第一个标题进入顶部阈值以内的集
    let foundByThreshold = false;
    for (let i = headings.length - 1; i >= 0; i--) {
      const headingTop = headings[i].getBoundingClientRect().top - containerTop;
      if (headingTop >= 0 && headingTop <= threshold) {
        activeIndex = i;
        foundByThreshold = true;
        break;
      }
      // 标题已滚过顶部（为负），也算进入了该集
      if (headingTop < 0) {
        activeIndex = i;
        foundByThreshold = true;
        break;
      }
    }

    // 兜底：如果阈值法没有命中（比如内容刚加载还没滚动），用占比最大法
    if (!foundByThreshold) {
      let maxVisible = -1;
      for (let i = 0; i < headings.length; i++) {
        const sectionTop = headings[i].getBoundingClientRect().top;
        const sectionBottom = i + 1 < headings.length
          ? headings[i + 1].getBoundingClientRect().top
          : containerBottom + 99999;
        const visibleTop = Math.max(sectionTop, containerTop);
        const visibleBottom = Math.min(sectionBottom, containerBottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        if (visibleHeight > maxVisible) {
          maxVisible = visibleHeight;
          activeIndex = i;
        }
      }
    }

    onActiveIndexChange?.(activeIndex);
  }, [contentRef, onActiveIndexChange]);

  return (
    <div
      ref={contentRef}
      className="script-md"
      style={{ alignSelf: 'stretch', flex: 1, minHeight: 0, overflowY: 'auto' }}
      onScroll={calcActiveIndex}
    >
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
          h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
        }}
      >
        {content}
      </ReactMarkdown>
      {/* 底部占位块：动态高度，确保最后一集内容短时也能滚到顶部 */}
      <div ref={paddingRef} aria-hidden="true" />
    </div>
  );
}

function ToolbarBtn({ onClick, children, title }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        height: '26px',
        minWidth: '26px',
        paddingLeft: '8px',
        paddingRight: '8px',
        borderRadius: '5px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontFamily: FONT_MEDIUM,
        fontSize: '12px',
        lineHeight: '16px',
        background: pressed ? '#2DC3E1' : hovered ? '#FFFFFF14' : 'transparent',
        color: pressed ? '#090909' : '#FFFFFFCC',
        transition: 'background 0.15s, color 0.15s',
        transform: pressed ? 'scale(0.93)' : 'scale(1)',
        outline: 'none',
      }}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }) {
  if (!editor) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        paddingBottom: '12px',
        borderBottom: '1px solid #FFFFFF14',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 1,
        background: '#161616',
      }}
    >
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="一级标题">
        H1
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="二级标题">
        H2
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} title="正文">
        正文
      </ToolbarBtn>

      <div style={{ width: '1px', height: '16px', background: '#FFFFFF14', margin: '0px 2px', flexShrink: 0 }} />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} title="加粗">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 6h4a2 2 0 0 0 0-4H3v4zm0 0h4.5a2.5 2.5 0 0 1 0 5H3V6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarBtn>

      <div style={{ width: '1px', height: '16px', background: '#FFFFFF14', margin: '0px 2px', flexShrink: 0 }} />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表">
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <circle cx="1.5" cy="2" r="1.2" fill="currentColor" />
          <circle cx="1.5" cy="6" r="1.2" fill="currentColor" />
          <circle cx="1.5" cy="10" r="1.2" fill="currentColor" />
          <path d="M5 2h8M5 6h8M5 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表">
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <text x="0" y="3.5" fontSize="4" fill="currentColor" fontFamily="monospace">1.</text>
          <text x="0" y="7.5" fontSize="4" fill="currentColor" fontFamily="monospace">2.</text>
          <text x="0" y="11.5" fontSize="4" fill="currentColor" fontFamily="monospace">3.</text>
          <path d="M5 2h8M5 6h8M5 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </ToolbarBtn>
    </div>
  );
}

function ScriptEditor({ initialContent, onContentChange, containerRef }) {
  useEffect(() => {
    ensureEditorStyle();
  }, []);

  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Markdown.configure({ html: false, transformCopiedText: true, transformPastedText: true }),
    ],
    content: initialContent || '',
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onContentChangeRef.current?.(currentEditor.storage.markdown.getMarkdown());
    },
  });

  return (
    <div style={{ alignSelf: 'stretch', display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
      <EditorToolbar editor={editor} />
      <div
        ref={containerRef}
        className="tiptap-editor"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}
      >
        <EditorContent editor={editor} style={{ width: '100%' }} />
      </div>
    </div>
  );
}

function SecondaryBtn({ onClick, children, disabled = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        flexShrink: 0,
        borderRadius: '8px',
        height: '36px',
        padding: '1px',
        backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
        boxShadow: '#00000066 3px 3px 8px',
        outline: focused ? '1px solid #2DC3E180' : '1px solid #00000080',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.15s, transform 0.15s',
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        border: 'none',
        backgroundColor: 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          borderRadius: '7px',
          gap: '4px',
          paddingLeft: '15px',
          paddingRight: '15px',
          background: disabled ? '#121212' : hovered ? '#1A1A1A' : '#161616',
          transition: 'background 0.15s',
        }}
      >
        {children}
      </div>
    </button>
  );
}

function PrimaryBtn({ onClick, children, disabled = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: '8px',
        gap: '4px',
        border: '1px solid #FFFFFF33',
        outline: focused ? '1px solid #2DC3E180' : '1px solid #00000080',
        cursor: disabled ? 'not-allowed' : 'pointer',
        height: '36px',
        paddingLeft: '16px',
        paddingRight: '16px',
        backgroundColor: '#2DC3E1',
        backgroundImage: 'linear-gradient(in oklab 107.51deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
        backgroundOrigin: 'border-box',
        opacity: disabled ? 0.45 : pressed ? 0.75 : hovered ? 0.88 : 1,
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'opacity 0.15s, transform 0.1s',
      }}
    >
      {children}
    </button>
  );
}

// ConfirmExtractModal 已迁移至 ConfirmDialog 共享组件（confirmVariant='orange'）

function ScriptPanel({
  phase,
  scriptContent,
  draftContent,
  onDraftChange,
  onEdit,
  onSave,
  onCancelEdit,
  onExtractRequest,
  isExtractingSubjects,
  isSubjectUnlocked,
  onStreamingDone,
  onStreamingPause,
  streamingPaused,
  onActiveIndexChange,
  renderedContentRef,
  editorContentRef,
  isSaving,
}) {
  const isThinking = phase === 'thinking';
  const isStreaming = phase === 'streaming';
  const isEditing = phase === 'edit';
  const hasScript = Boolean(scriptContent);
  const displayContent = isEditing ? draftContent : scriptContent;
  const showActions = phase === 'view' || phase === 'edit';

  // 按钮禁用：无剧本 / 提取中
  const isExtractDisabled = !scriptContent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'stretch', minHeight: 0, flex: 1 }}>
      <div
        style={{
          background: '#161616',
          border: `1px solid ${isEditing ? '#2DC3E1' : '#FFFFFF14'}`,
          borderRadius: '16px',
          paddingTop: '16px',
          paddingBottom: '16px',
          paddingLeft: '12px',
          paddingRight: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignSelf: 'stretch',
          overflow: 'hidden',
          transition: 'border-color 0.2s',
          flex: 1,
          minHeight: '0px',
        }}
      >
        {isThinking ? (
          <div style={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
            <AiThinkingMessage />
          </div>
        ) : isStreaming ? (
          <AiStreamingContent content={scriptContent} onDone={onStreamingDone} paused={streamingPaused} onPause={onStreamingPause} />
        ) : isEditing ? (
          <ScriptEditor initialContent={draftContent} onContentChange={onDraftChange} containerRef={editorContentRef} />
        ) : (
          <ScriptRendered content={displayContent} contentRef={renderedContentRef} onActiveIndexChange={onActiveIndexChange} />
        )}
      </div>

      {showActions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            alignSelf: 'stretch',
            minHeight: '36px',
            flexShrink: 0,
          }}
        >
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SecondaryBtn onClick={onSave} disabled={isSaving}>
                {isSaving ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'btn-spin 0.75s linear infinite', transformOrigin: '50% 50%' }}>
                    <circle cx="8" cy="8" r="6" stroke="#FFFFFF33" strokeWidth="1.5" />
                    <path d="M14 8a6 6 0 0 0-6-6" stroke="#FFFFFFCC" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 4.5L6 11.5L3 8.5" stroke="#FFFFFF" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC' }}>定稿</span>
              </SecondaryBtn>
              <SecondaryBtn onClick={onCancelEdit}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC' }}>取消</span>
              </SecondaryBtn>
            </div>
          ) : (
            <SecondaryBtn onClick={onEdit} disabled={!hasScript}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.667 14H2v-2.667L11.333 2z" stroke="#FFFFFF" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC' }}>编辑</span>
            </SecondaryBtn>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PrimaryBtn onClick={isExtractDisabled ? undefined : onExtractRequest} disabled={isExtractDisabled}>
              <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '18px', color: '#090909', whiteSpace: 'nowrap' }}>
                开始提取主体
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 8H2" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 4L14 8L10 12" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </PrimaryBtn>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScriptPage({ projectId, onGoToSubject, onScriptFinalized, onEpisodesChange, phase: phaseProp, onPhaseChange, hasStarted: hasStartedProp, onHasStartedChange, scriptContent: scriptContentProp, onScriptContentChange, draftContent: draftContentProp, onDraftContentChange, isSubjectUnlocked = false }) {
  const [phaseLocal, setPhaseLocalRaw] = useState('initial');
  const [hasStartedLocal, setHasStartedLocalRaw] = useState(false);
  const [scriptContentLocal, setScriptContentLocalRaw] = useState('');
  const [draftContentLocal, setDraftContentLocalRaw] = useState('');

  const isControlled = phaseProp !== undefined;
  const phase = isControlled ? phaseProp : phaseLocal;
  const hasStarted = isControlled ? hasStartedProp : hasStartedLocal;
  const scriptContent = isControlled ? scriptContentProp : scriptContentLocal;
  const draftContent = isControlled ? draftContentProp : draftContentLocal;

  const setPhase = isControlled ? onPhaseChange : setPhaseLocalRaw;
  const setHasStarted = isControlled ? onHasStartedChange : setHasStartedLocalRaw;
  const setScriptContent = isControlled ? onScriptContentChange : setScriptContentLocalRaw;
  const setDraftContent = isControlled ? onDraftContentChange : setDraftContentLocalRaw;
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [lastSentText, setLastSentText] = useState('');
  const [lastSentFiles, setLastSentFiles] = useState([]);
  // 仅在超时时设为已发送的内容，触发输入框恢复；成功/用户主动停止保持 '' 不恢复
  const [inputRestoreText, setInputRestoreText] = useState('');
  const [inputRestoreFiles, setInputRestoreFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [episodeCount, setEpisodeCount] = useState(null);
  const [backendEpisodes, setBackendEpisodes] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [streamingPaused, setStreamingPaused] = useState(false);
  const stopReasonRef = useRef(null); // 'user-thinking' | 'user-streaming' | null
  const renderedContentRef = useRef(null);
  const editorContentRef = useRef(null);
  const abortControllerRef = useRef(null); // 用于取消进行中的流式请求

  useEffect(() => {
    ensureScrollbarStyle();
    ensureEditorStyle();
    ensureThinkingStyle();
    ensureSpinnerStyle();
  }, []);

  const showToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  // 页面加载时从后端恢复剧本（仅非受控模式下自行加载，受控模式由父组件负责）
  useEffect(() => {
    if (!projectId || isControlled) return;

    apiGetScriptWorkspace(projectId)
      .then((data) => {
        const content = data?.script?.content || data?.content;
        if (content) {
          setScriptContent(content);
          setPhase('view');
          setHasStarted(true);
        }
      })
      .catch((err) => {
        console.error('[ScriptPage] 加载剧本失败:', err);
      });
  }, [projectId, isControlled, setScriptContent, setPhase, setHasStarted]);

  const visibleContent = phase === 'edit' ? draftContent : scriptContent;
  const markdownOutline = useMemo(() => parseScriptOutline(visibleContent).filter((item) => item.level === 2), [visibleContent]);
  const outline = useMemo(
    () => (phase !== 'edit' && backendEpisodes)
      ? backendEpisodes.map((ep, idx) => ({ ...ep, title: ep.title, level: 2, offset: idx }))
      : markdownOutline,
    [phase, backendEpisodes, markdownOutline],
  );

  useEffect(() => {
    if (backendEpisodes) {
      onEpisodesChange?.(backendEpisodes.map((ep) => ({ id: ep.id, title: ep.title, episode_number: ep.episode_number })));
    }
  }, [backendEpisodes, onEpisodesChange]);
  const safeSelectedEpisode = outline.length > 0 ? Math.min(selectedEpisode, outline.length - 1) : 0;

  const episodeRailLoading = hasStarted && (phase === "thinking" || phase === "streaming");
  const handleStop = useCallback(() => {
    // 用 ref 记录停止原因，避免 handleSend 闭包里 phase 是旧快照的问题
    if (phase === 'streaming') {
      stopReasonRef.current = 'user-streaming';
      setStreamingPaused(true);
    } else {
      stopReasonRef.current = 'user-thinking';
    }
    abortControllerRef.current?.abort();
  }, [phase]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && (phase === 'thinking' || phase === 'streaming')) {
        handleStop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleStop]);

  const handleSend = async (text, files, model, epCount) => {
    if (!text && files.length === 0) return;

    // 发送前保存当前内容，超时时可恢复（避免丢失已有剧本）
    const prevContent = scriptContent;

    // 每次发送前清除上次的恢复内容（成功时不恢复）
    setInputRestoreText('');
    setInputRestoreFiles([]);
    setStreamingPaused(false);

    // 取消上一次未完成的请求
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 客户端兜底超时：后端通常先返回 504，此处作为最后保障
    let isClientTimeout = false;
    const timeoutId = setTimeout(() => {
      isClientTimeout = true;
      abortController.abort();
    }, CHAT_TIMEOUT_MS);

    setLastSentText(text);
    setLastSentFiles(files);
    setHasStarted(true);
    setPhase('thinking');
    setScriptContent('');
    setDraftContent('');
    setSelectedEpisode(0);
    setBackendEpisodes(null);

    let receivedContent = '';

    // 超时统一处理：toast + 恢复输入 + 恢复内容
    // 关键：不调用 setHasStarted(false)，保持底部 InputCard 同一实例，
    // 通过 disabled(true→false) 转换触发 restoreText 机制，避免重新挂载的时序问题
    const handleTimeout = () => {
      showToast('请求超时，请稍后重试');
      setInputRestoreText(text);
      setInputRestoreFiles(files);
      if (receivedContent) {
        // 流式已收到部分内容则保留
        setScriptContent(receivedContent);
        setPhase('view');
      } else {
        // 恢复发送前的内容（如有），否则退回 initial；hasStarted 保持 true
        setScriptContent(prevContent);
        setPhase(prevContent ? 'view' : 'initial');
      }
    };

    try {
      // 1. 先上传文件（逐个上传，最后一个生效）
      //    上传内容仅在后端存储为上下文，不在前端展示为剧本
      if (files.length > 0) {
        for (const file of files) {
          const uploadResult = await apiUploadScriptWorkspace(projectId, file);
          const uploadContent = uploadResult?.script?.content ?? uploadResult?.script?.parsed_content ?? uploadResult?.content;
          if (uploadContent) {
            receivedContent = formatEpisodeHeaders(uploadContent);
            // 仅在纯上传路径（无提示词）时直接展示内容
            if (!text) {
              setScriptContent(formatEpisodeHeaders(uploadContent));
            }
          }
        }
      }

      // 2. 有文字消息时走流式 chat 接口
      if (text) {
        const chatMessage = epCount != null
          ? `${text}（集数要求：${epCount} 集）`
          : text;

        // 保持 thinking 阶段（DotsLoading 加载动画），等首个 SSE chunk 到达后再切 streaming
        receivedContent = '';

        let hasStartedStreaming = false;

        await apiChatScriptWorkspaceStream(
          projectId,
          { message: chatMessage, model, episode_count: epCount },
          {
            onChunk: (accumulated) => {
              const formatted = formatEpisodeHeaders(accumulated);
              receivedContent = formatted;
              if (!hasStartedStreaming) {
                hasStartedStreaming = true;
                setScriptContent(formatted);
                setPhase('streaming');
              } else {
                setScriptContent(formatted);
              }
            },
            signal: abortController.signal,
          }
        );
        // SSE 完成后不立即切 view，由 AiStreamingContent 的打字动画播完后
        // 通过 onDone → handleStreamingDone 来切换到 view 阶段
      } else {
        // 无文字消息 → 纯上传路径，直接展示内容，无打字动画
        if (!receivedContent) {
          throw new Error('后端未返回剧本内容');
        }
        setPhase('view');
      }
    } catch (err) {
      // 504 网关超时
      if (err.isGatewayTimeout) {
        handleTimeout();
        return;
      }

      // 网络层错误（DNS 失败、连接被拒等）→ 保留已有内容，不丢失
      if (err.isNetworkError) {
        if (receivedContent) {
          setScriptContent(receivedContent);
          setPhase('view');
        } else {
          setScriptContent(prevContent);
          setPhase(prevContent ? 'view' : 'initial');
        }
        setInputRestoreText(text);
        setInputRestoreFiles(files);
        showToast('网络连接失败，请检查网络后重试');
        return;
      }

      if (err.name === 'AbortError') {
        if (isClientTimeout) {
          // 客户端兜底超时触发
          handleTimeout();
        } else if (stopReasonRef.current === 'user-streaming') {
          // streaming 阶段用户主动暂停：交给 onStreamingPause 回调处理，此处只提示
          stopReasonRef.current = null;
          showToast('剧本创作已暂停', 'info');
        } else {
          // thinking 阶段用户主动暂停：尚未收到任何内容，恢复输入框并清空后端剧本
          stopReasonRef.current = null;
          setInputRestoreText(text);
          setInputRestoreFiles(files);
          setScriptContent(prevContent);
          setPhase(prevContent ? 'view' : 'initial');
          setHasStarted(!!prevContent);
          showToast('剧本创作已暂停', 'info');
          // 清空后端保存的内容，确保刷新后不显示未完成的剧本
          apiSaveScriptWorkspace(projectId, { content: prevContent || '' }).catch(() => {});
        }
        return;
      }

      console.error('[ScriptPage] 生成剧本失败:', err);
      setInputRestoreText(text);
      setInputRestoreFiles(files);
      setPhase('initial');
      setHasStarted(false);
      (() => {
        const rawMsg = err?.message || '';
        let toastMsg;
        const upstreamMatch = rawMsg.match(/上游模型服务返回\s*(\d+)/);
        if (upstreamMatch) {
          const code = upstreamMatch[1];
          toastMsg = code === '404' ? '上游模型服务返回 404，请换个模型重试' : `上游模型服务返回 ${code}，请稍后重试`;
        } else if (rawMsg.toLowerCase().includes('deprecated') || rawMsg.toLowerCase().includes('migrate')) {
          toastMsg = '当前模型已废弃，请换个模型重试';
        } else if (err?.status) {
          toastMsg = `请求失败 (HTTP ${err.status})，请稍后重试`;
        } else if (rawMsg.length > 0 && rawMsg.length < 60) {
          toastMsg = rawMsg;
        } else {
          toastMsg = '剧本生成失败，请稍后重试';
        }
        showToast(toastMsg);
      })();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleStreamingDone = useCallback(() => {
    setStreamingPaused(false);
    setPhase('view');
  }, []);

  // 打字动画暂停回调：用已渲染的文字作为最终内容，切到 view 阶段
  const handleStreamingPause = useCallback((displayedText) => {
    setStreamingPaused(false);
    if (displayedText) {
      setScriptContent(displayedText);
      setPhase('view');
      // 把已渲染的部分内容同步到后端，刷新后显示实际播放到的位置
      apiSaveScriptWorkspace(projectId, { content: displayedText }).catch(() => {});
    } else {
      // 动画还没开始播放，退回到发送前的状态，清空后端内容
      setScriptContent('');
      setPhase('initial');
      setHasStarted(false);
      apiSaveScriptWorkspace(projectId, { content: '' }).catch(() => {});
    }
  }, [projectId, setScriptContent, setPhase, setHasStarted]);

  const handleEdit = () => {
    setDraftContent(scriptContent);
    setPhase('edit');
  };

  const handleSave = async () => {
    if (!draftContent) return;

    setIsSaving(true);
    try {
      // 1. 保存 markdown 内容
      if (projectId) {
        await apiSaveScriptWorkspace(projectId, { content: draftContent });
      }

      // 2. 从编辑内容解析分集结构（## 标题 + 序号），确保定稿时传给后端
      const parsedEpisodes = parseScriptOutline(draftContent)
        .filter(item => item.level === 2)
        .map((item, i) => ({
          title: item.title,
          episode_number: i + 1,
        }));
      const resolvedEpisodeCount = episodeCount ?? (parsedEpisodes.length > 0 ? parsedEpisodes.length : null);

      // 3. 定稿：拆分为分集
      if (projectId) {
        const finalizeResult = await apiFinalizeScriptWorkspace(projectId, {
          episode_count: resolvedEpisodeCount,
          model: selectedModel,
        });
        // 兼容后端可能返回的不同字段名：items / episodes / data
        const episodesFromFinalize = finalizeResult?.items || finalizeResult?.episodes || finalizeResult?.data;
        if (Array.isArray(episodesFromFinalize) && episodesFromFinalize.length > 0) {
          // 重新获取分集列表（含正确 ID），再用每集 content 中第一个 ## 标题更新
          const episodesWithIds = await apiGetEpisodes(projectId);
          if (Array.isArray(episodesWithIds)) {
           for (const ep of episodesWithIds) {
             const firstHeading = ep.content?.match(/^##\s+(.+)/m)?.[1];
             if (firstHeading && firstHeading !== ep.title) {
               try {
                 await apiUpdateEpisode(projectId, ep.id, { title: firstHeading });
                ep.title = firstHeading;
               } catch (e) {
                 console.error('更新分集标题失败:', e);
               }
             }
           }
            setBackendEpisodes(episodesWithIds);
          }
        }
      }
      setScriptContent(draftContent);
      setPhase('view');
      onScriptFinalized?.();
      showToast('保存定稿成功！', 'success');
    } catch (err) {
      console.error('[ScriptPage] 定稿失败:', err);
      showToast('保存定稿失败，请重试', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setDraftContent(scriptContent);
    setPhase('view');
  };

  // 提取主体按钮点击：已提取过主体 → 弹窗二次确认（覆盖风险）；首次 → 直接跳转
  const [extractConfirmOpen, setExtractConfirmOpen] = useState(false);

  const handleExtractRequest = () => {
    if (isSubjectUnlocked) {
      setExtractConfirmOpen(true);
      return;
    }
    onGoToSubject?.('char');
  };

  // 提取主体二次确认弹窗
  const handleSelectEpisode = useCallback(
    (index) => {
      setSelectedEpisode(index);
      requestAnimationFrame(() => {
        const item = outline[index];
        if (!item) return;
        const container = phase === 'edit'
          ? editorContentRef.current
          : renderedContentRef.current;
        if (!container) return;
        const headings = container.querySelectorAll('h2');
        const heading = Array.from(headings).find((el) => el.textContent.trim() === item.title.trim());
        if (!heading) return;
        const containerTop = container.getBoundingClientRect().top;
        const headingTop = heading.getBoundingClientRect().top;
        container.scrollTop += headingTop - containerTop - 20;
      });
    },
    [outline, phase],
  );

  if (extractConfirmOpen) {
    return (
      <ConfirmDialog
        title="确定要提取主体吗？"
        description="本次提取主体会覆盖之前的主体内容，一旦提取不可撤销，请谨慎操作！"
        confirmText="确认提取主体"
        confirmVariant="orange"
        onConfirm={() => {
          setExtractConfirmOpen(false);
          onGoToSubject?.('char');
        }}
        onCancel={() => setExtractConfirmOpen(false)}
      />
    );
  }

  return (
    <>
    <div
      style={{
        display: 'flex',
        minHeight: 0,
        flex: 1,
        alignItems: 'stretch',
        gap: '24px',
        alignSelf: 'stretch',
        borderRadius: '16px',
        paddingTop: '16px',
        paddingBottom: '16px',
        paddingLeft: '24px',
        paddingRight: '24px',
        background: '#161616',
        border: '1px solid #FFFFFF14',
        overflow: 'hidden',
      }}
    >
      {!hasStarted ? (
        <ScriptEmptyState
          onSend={handleSend}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          episodeCount={episodeCount}
          onEpisodeCountChange={setEpisodeCount}
          restoreText={inputRestoreText}
          restoreFiles={inputRestoreFiles}
        />
      ) : (
        <div style={{ display: 'flex', minHeight: 0, flex: 1, alignItems: 'stretch', gap: '24px', alignSelf: 'stretch' }}>
          <EpisodeList outline={outline} selectedIndex={safeSelectedEpisode} onSelect={handleSelectEpisode} loading={episodeRailLoading} />

          <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between', gap: '24px', alignSelf: 'stretch', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0, justifyContent: 'center', alignItems: 'stretch', overflow: 'hidden' }}>
              <div style={{ display: 'flex', width: '80%', maxWidth: '80%', minWidth: '0px', minHeight: 0, flexDirection: 'column', alignSelf: 'stretch' }}>
                <ScriptPanel
                  phase={phase}
                  scriptContent={scriptContent}
                  draftContent={draftContent}
                  onDraftChange={setDraftContent}
                  onEdit={handleEdit}
                  onSave={handleSave}
                  onCancelEdit={handleCancelEdit}
                  onExtractRequest={handleExtractRequest}
                  onStreamingDone={handleStreamingDone}
                  onStreamingPause={handleStreamingPause}
                  streamingPaused={streamingPaused}
                  onActiveIndexChange={setSelectedEpisode}
                  renderedContentRef={renderedContentRef}
                  editorContentRef={editorContentRef}
                  isSaving={isSaving}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignSelf: 'stretch', paddingTop: '8px', overflow: 'visible', flexShrink: 0 }}>
              <InputCard
                onSend={handleSend}
                onStop={handleStop}
                restoreText={inputRestoreText}
                restoreFiles={inputRestoreFiles}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                episodeCount={episodeCount}
                onEpisodeCountChange={setEpisodeCount}
                width="min(700px, 100%)"
                disabled={phase === 'thinking' || phase === 'streaming'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
    <Toast toasts={toasts} />

    </>  );
}
