import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import BatchDownloadModal from '../components/BatchDownloadModal';
import ShotViewerModal from '../components/ShotViewerModal';
import Toggle from '../components/Toggle';
import Checkbox from '../components/Checkbox';
import AssetPickerModal from '../components/AssetPickerModal';
import { apiUploadFile, apiUploadImage, apiUploadStoryboardVideo, apiGenerateStoryboardImage, apiGenerateStoryboardVideo, apiCreateStoryboard, apiUpdateStoryboard, apiDeleteStoryboard, apiReorderStoryboards, apiGetStoryboards, apiBatchDownloadStoryboardImages, apiBatchDownloadStoryboardVideos, apiGetTask } from '../api/storyboard';
import { apiUploadCreationImage, apiUploadCreationVideo, apiUploadCreationAudio } from '../api/creation';
import { apiListModels } from '../api/config';
import DotsLoading from '../components/DotsLoading';
import { apiGetEpisodes } from '../api/subject';
import { getImageModelParams, getVideoModelParams, getVideoModelCapabilities } from '../config';
import { normalizeImageUrl, toAbsoluteUrl } from '../utils/imageUrl';
import ConfirmDialog from '../components/ConfirmDialog';
import { subscribe, peekCache } from '../utils/cache';
import { K, MEDIUM } from '../utils/cacheKeys';

// ─── 后端/前端数据模型双向映射 ───────────────────────────────────────────────

/**
 * 后端 StoryboardResponse (snake_case flat) → 前端 shot 模型 (camelCase nested)
 */
function normalizeStoryboard(be) {
  if (!be || typeof be !== 'object') return be;
  return {
    id: be.id,
    number: be.shot_number ?? be.number ?? 0,
    description: be.content ?? be.description ?? '',
    params: {
      framing: be.shot_type ?? be.params?.framing ?? '全景',
      cameraMotion: be.camera ?? be.params?.cameraMotion ?? '固定机位',
      angle: be.camera_angle ?? be.params?.angle ?? '平视拍摄',
      composition: be.composition ?? be.params?.composition ?? '三分法构图',
      duration: be.duration != null
        ? (typeof be.duration === 'string' ? be.duration : `${be.duration}s`)
        : (be.params?.duration ?? '3s'),
    },
    lightShadow: be.lighting ?? be.lightShadow ?? '',
    ambientSound: be.ambient_sound ?? be.ambientSound ?? '',
    narration: be.narration ?? (
      be.voiceover
        ? {
            segments: be.voiceover.split('\n').filter(Boolean).map((line) => {
              const idx = line.indexOf('：');
              if (idx > 0) return { role: line.slice(0, idx), lines: line.slice(idx + 1) };
              return { role: '', lines: line };
            }),
          }
        : { segments: [] }
    ),
    mainRefs: be.mainRefs ?? (
      [
        ...(be.character_ids || []).map(cid =>
          typeof cid === 'string' ? { id: cid, type: 'char' } : cid
        ),
        ...(be.reference_image_urls || [])
          .filter(url => {
            // 排除与分镜图相同的 URL，避免分镜图出现在主体参考列
            // 使用路径键比较，兼容绝对/相对 URL 混用的情况
            const imgPathKey = be.image_url ? urlPathKey(normalizeImageUrl(be.image_url)) : null;
            return !imgPathKey || urlPathKey(normalizeImageUrl(url)) !== imgPathKey;
          })
          .map(url => {
            const n = normalizeImageUrl(url);
            return { id: n, url: n, name: "参考图", type: "image/jpeg" };
          }),
      ]
    ),
    storyboardImage: be.storyboardImage ?? (
      be.image_url
        ? { id: `${be.id}_img`, url: normalizeImageUrl(be.image_url), name: '分镜图', type: 'image/jpeg' }
        : null
    ),
    storyboardVideo: be.storyboardVideo ?? (
      be.video_url
        ? {
            id: `${be.id}_vid`,
            url: normalizeImageUrl(be.video_url),
            name: '分镜视频',
            type: 'video/mp4',
            model: be.video_model,
            resolution: be.video_resolution,
            duration: be.video_duration,
            thumbnail: be.video_thumbnail_url ? normalizeImageUrl(be.video_thumbnail_url) : undefined,
            finalized: true,
          }
        : null
    ),
  };
}

/**
 * 前端 shot 模型 → 后端 StoryboardCreate / StoryboardUpdate (snake_case flat)
 */
function toBackendStoryboard(shot) {
  return {
    shot_number: shot.number,
    content: shot.description || undefined,
    shot_type: shot.params?.framing || undefined,
    camera: shot.params?.cameraMotion || undefined,
    camera_angle: shot.params?.angle || undefined,
    composition: shot.params?.composition || undefined,
    duration: shot.params?.duration ? parseFloat(shot.params.duration) : undefined,
    lighting: shot.lightShadow || undefined,
    ambient_sound: shot.ambientSound || undefined,
    voiceover: shot.narration?.segments?.length
      ? shot.narration.segments.map(s => s.role ? `${s.role}：${s.lines}` : s.lines).join('\n')
      : undefined,
    character_ids: (shot.mainRefs || [])
      .filter(ref => ref?.type === 'char' || ref?.type === 'scene' || ref?.type === 'prop')
      .map(ref => ref?.id).filter(Boolean),
    reference_image_urls: (shot.mainRefs || [])
      .filter(ref => ref?.url && !ref.uploading)
      .filter(ref => ref?.type !== 'char' && ref?.type !== 'scene' && ref?.type !== 'prop')
      .filter(ref => !shot.storyboardImage?.url || ref.url !== shot.storyboardImage.url)
      .map(ref => ref.url)
      .filter(Boolean),
    image_url: shot.storyboardImage?.url || undefined,
    video_url: shot.storyboardVideo?.url || undefined,
  };
}

/**
 * 将 URL 规范化为路径键，用于跨协议/域名的去重比较。
 * 绝对 URL 取 pathname，相对路径直接使用。
 * 例：
 *   "https://api.example.com/uploads/char_A.jpg" → "/uploads/char_A.jpg"
 *   "/uploads/char_A.jpg"                        → "/uploads/char_A.jpg"
 */
function urlPathKey(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    // 非绝对 URL，直接用原值（已是相对路径）
    return url.startsWith('/') ? url : `/${url}`;
  }
}

/**
 * 为从 character_ids 构造的 mainRefs 补上 url（normalizeStoryboard 里只有 id+type）
 * 同时去重：如果 reference_image_urls 里有与某个角色图片相同的条目（路径一致即视为相同），
 * 则跳过该 reference_image_urls 条目，避免刷新后出现重复主体。
 */
function enrichMainRefs(shot, chars) {
  if (!shot?.mainRefs) return shot;

  // Pass 1: enrich all subject-type entries (char/scene/prop) that don't have a URL,
  // collecting their URL path keys for dedup regardless of entry order
  const usedPathKeys = new Set();
  const enrichedById = {};
  for (const ref of shot.mainRefs) {
    if ((ref.type === 'char' || ref.type === 'scene' || ref.type === 'prop') && !ref.url) {
      const ch = (chars || []).find(c => c.id === ref.id);
      if (ch?.imageUrl) {
        const url = normalizeImageUrl(ch.imageUrl);
        const pathKey = urlPathKey(url);
        if (pathKey) usedPathKeys.add(pathKey);
        enrichedById[ref.id] = { ...ref, url, name: ch.name };
      }
    }
  }

  // Pass 2: build result, deduplicating by URL path
  // - Use enriched versions for subject entries that were enriched
  // - Skip non-subject entries whose URL path matches an already-used subject URL
  const result = [];
  for (const ref of shot.mainRefs) {
    if (enrichedById[ref.id]) {
      result.push(enrichedById[ref.id]);
      continue;
    }
    // Dedup by URL path — handles absolute vs relative URL mismatch
    if (ref.url) {
      const pathKey = urlPathKey(normalizeImageUrl(ref.url));
      if (pathKey && usedPathKeys.has(pathKey)) continue;
      if (pathKey) usedPathKeys.add(pathKey);
    }
    result.push(ref);
  }

  shot.mainRefs = result;
  return shot;
}

// ─────────────────────────────────────────────────────────────────────────────

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// ─── 集数选择器（面包屑下拉）─────────────────────────────────────────────────

const EPISODE_ITEM_H = 36;
const EPISODE_MAX_VISIBLE = 10;

function getEpisodeLabel(ep) {
  if (!ep) return '';
  if (typeof ep === 'string') return ep;
  const label = ep.title || `第${ep.episode_number}集` || JSON.stringify(ep);
  return label.length > 20 ? label.slice(0, 20) + '…' : label;
}
function getEpisodeId(ep) {
  if (!ep) return '';
  if (typeof ep === 'string') return ep;
  return ep.id ?? '';
}

function EpisodeSelector({ episodes, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const rootRef = useRef(null);
  const [selectorWidth, setSelectorWidth] = useState(null);

  // 测量所有选集标题的实际像素宽度，取最大值
  useEffect(() => {
    const tempSpan = document.createElement('span');
    tempSpan.style.cssText = `
      position: absolute;
      visibility: hidden;
      pointer-events: none;
      white-space: nowrap;
      font-family: ${FONT_MEDIUM};
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      padding: 0 6px;
    `;
    document.body.appendChild(tempSpan);

    let maxWidth = 0;

    if (episodes && episodes.length > 0) {
      episodes.forEach((ep) => {
        tempSpan.textContent = getEpisodeLabel(ep);
        const width = tempSpan.scrollWidth;
        if (width > maxWidth) maxWidth = width;
      });
    } else {
      tempSpan.textContent = getEpisodeLabel(value);
      maxWidth = tempSpan.scrollWidth;
    }

    document.body.removeChild(tempSpan);
    setSelectorWidth(Math.max(maxWidth + 12, 60));
  }, [episodes, value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const dropdownMaxH = EPISODE_ITEM_H * EPISODE_MAX_VISIBLE + 8;

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {open ? (
        <div
          className="flex items-center gap-[6px] h-[28px] pl-[10px] pr-[6px] rounded-[6px] cursor-pointer border border-solid bg-input-bg-normal border-input-border-focus [outline:1px_solid_var(--color-stroke-outline)]"
          style={{ boxShadow: '0px 0px 10px var(--color-glow)', width: selectorWidth ? `${selectorWidth + 32}px` : '80px' }}
          onClick={() => setOpen(false)}
        >
          <span className="flex-1 text-input-text-content text-font-size-14 truncate" style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, lineHeight: '20px' }}>
            {getEpisodeLabel(value)}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M10.5 5.833L7 9.333L3.5 5.833H10.5Z" fill="#FFFFFF99" stroke="#FFFFFF99" strokeWidth="1.167" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <div
          className="flex items-center rounded-[6px] cursor-pointer"
          style={{ height: '28px', padding: '0 6px', width: selectorWidth ? `${selectorWidth}px` : '60px', backgroundColor: hovered ? '#FFFFFF0F' : 'transparent', transition: 'background-color 0.12s' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => setOpen(true)}
        >
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '20px', color: '#FFFFFFD9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getEpisodeLabel(value)}
          </span>
        </div>
      )}
      {open && (
        <div
          className="flex flex-col rounded-medium bg-select-bg border border-select-border absolute z-50"
          style={{ top: 'calc(100% + 4px)', left: 0, width: selectorWidth ? `${selectorWidth + 32}px` : '80px', padding: '4px', boxShadow: '0px 4px 16px var(--color-select-shadow)', maxHeight: `${dropdownMaxH}px`, overflowY: episodes.length > EPISODE_MAX_VISIBLE ? 'auto' : 'visible' }}
        >
          {episodes.map((ep, i) => {
            const isStr = typeof ep === 'string';
            const isActive = isStr ? ep === value : (ep.id && value?.id ? ep.id === value.id : ep === value);
            const isHov = hoveredIdx === i;
            return (
              <div
                key={ep.id || ep}
                className="flex items-center px-[12px] rounded-[6px] shrink-0"
                style={{ height: `${EPISODE_ITEM_H}px`, cursor: 'pointer', backgroundColor: isActive ? 'var(--color-select-item-bg-active)' : isHov ? 'var(--color-select-item-bg-hover)' : 'transparent', color: isActive || isHov ? 'var(--color-select-item-text-hover)' : 'var(--color-select-item-text-normal)' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => { onChange(ep); setOpen(false); setHovered(false); }}
              >
                <span className="text-font-size-14 font-font-weight-regular" style={{ fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{getEpisodeLabel(ep)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 工具栏按钮 ───────────────────────────────────────────────────────────────

function SpinnerIcon({ color = '#FFFFFF' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, animation: 'spin 0.8s linear infinite' }}>
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GhostBtn({ icon, children, onClick, disabled, loading }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        padding: '1px',
        boxShadow: 'rgba(0,0,0,0.40) 3px 3px 8px',
        backgroundImage:
          'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
        outline: '1px solid #00000080',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.12s',
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          borderRadius: '7px',
          paddingInline: '15px',
          gap: '4px',
          backgroundColor: pressed ? '#1a1a1a' : hov ? '#1e1e1e' : '#161616',
          transition: 'background-color 0.10s',
        }}
      >
        {loading ? <SpinnerIcon color="#FFFFFF" /> : (icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>)}
        <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
          {children}
        </span>
      </div>
    </div>
  );
}

function PrimaryBtn({ icon, children, onClick, disabled, loading }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        paddingInline: '16px',
        gap: '4px',
        backgroundColor: pressed ? '#28b0cc' : hov ? '#32cde8' : '#2DC3E1',
        backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
        backgroundOrigin: 'border-box',
        border: '1px solid #FFFFFF33',
        outline: '1px solid #00000080',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.10s, opacity 0.12s',
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {loading ? <SpinnerIcon color="#090909" /> : (icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>)}
      <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
        {children}
      </span>
    </div>
  );
}
// Secondary 次要按钮 — 单层，无渐变，文字色 white 60%
function SecondaryBtn({ icon, children, onClick, disabled }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        paddingInline: '16px',
        gap: '4px',
        boxShadow: 'rgba(0,0,0,0.40) 3px 3px 8px',
        backgroundColor: pressed ? '#1a1a1a' : hov ? '#1e1e1e' : '#161616',
        border: '1px solid rgba(255,255,255,0.05)',
        outline: '1px solid #00000080',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.10s, opacity 0.12s',
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
        {children}
      </span>
    </div>
  );
}


// ─── 弹窗通用背景 ─────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, children }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>,
    document.body
  );
}

// 弹窗内小按钮
function ModalGhostBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', height: '36px', flexShrink: 0,
        borderRadius: '8px', paddingInline: '16px', gap: '4px',
        boxShadow: 'rgba(0,0,0,0.40) 3px 3px 8px',
        backgroundColor: pressed ? '#1a1a1a' : hov ? '#1e1e1e' : '#161616',
        border: '1px solid rgba(255,255,255,0.05)',
        outline: '1px solid #00000080',
        cursor: 'pointer',
        transition: 'background-color 0.10s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap', fontFamily: FONT }}>
        {children}
      </span>
    </div>
  );
}

function ModalPrimaryBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', height: '36px', flexShrink: 0,
        borderRadius: '8px', paddingInline: '16px', gap: '4px',
        backgroundColor: pressed ? '#28b0cc' : hov ? '#32cde8' : '#2DC3E1',
        backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
        backgroundOrigin: 'border-box',
        border: '1px solid #FFFFFF33',
        outline: '1px solid #00000080',
        cursor: 'pointer',
        transition: 'background-color 0.10s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: FONT_MEDIUM, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </div>
  );
}

// 弹窗内 Select 行
function ModalSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>
      <div ref={ref} style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', height: '36px', width: '100%',
            borderRadius: '8px', paddingInline: '12px', gap: '8px', flexShrink: 0,
            backgroundColor: hov ? '#222323' : '#1D1E1E',
            border: open ? '1px solid rgba(255,255,255,0.20)' : '1px solid rgba(255,255,255,0.08)',
            outline: '1px solid #00000080',
            cursor: 'pointer',
            transition: 'background-color 0.10s, border-color 0.10s',
            boxSizing: 'border-box',
          }}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
        >
          <span style={{ flex: 1, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT }}>{value}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
          </svg>
        </div>
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '8px', padding: '4px', zIndex: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.40)',
          }}>
            {options.map((opt) => (
              <ModalSelectItem key={opt} label={opt} active={opt === value} onSelect={() => { onChange(opt); setOpen(false); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModalSelectItem({ label, active, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', height: '36px', paddingInline: '12px',
        borderRadius: '6px', cursor: 'pointer',
        backgroundColor: active ? 'rgba(255,255,255,0.08)' : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active || hov ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
        fontSize: '14px', lineHeight: '18px', fontFamily: FONT,
        transition: 'background-color 0.08s',
      }}
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {label}
    </div>
  );
}

// ModalToggle → 统一使用共享 Toggle 组件
const ModalToggle = Toggle;

// ─── 批量生成分镜图弹窗 ───────────────────────────────────────────────────────


function BatchImageModal({ shotCount, onClose, onConfirm }) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'image' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        const merged = list.map((m) => {
          const modelId = m.model_id || m.id;
          const name = m.name || '';
          const caps = m.capabilities || {};
          const resolutions = (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
          return { value: modelId, label: name || modelId, capabilities: caps, resolutions };
        });
        setModelList(merged);
        if (merged.length > 0) {
          const first = merged.find(m => m.is_default) || merged[0];
          setModel(first.value);
          if (first.resolutions.length > 0) {
            setResolution(first.resolutions[0]);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);

  const resolutionOptions = useMemo(() => {
    const selected = modelList.find(m => m.value === model);
    return selected?.resolutions || [];
  }, [model, modelList]);

  const handleModelChange = useCallback((label) => {
    const selected = modelList.find(m => m.label === label);
    if (!selected) return;
    setModel(selected.value);
    const resList = selected.resolutions;
    if (resList.length > 0) {
      setResolution(resList.includes(resolution) ? resolution : resList[0]);
    }
  }, [modelList, resolution]);

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{
        display: 'flex', flexDirection: 'column', width: '400px',
        backgroundColor: '#161616', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
      }}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', padding: '16px 24px' }}>
          <span style={{ flex: 1, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>批量生成分镜图</span>
          <ModalCloseBtn onClick={onClose} />
        </div>
        {/* 内容 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px' }}>
          <div style={{ display: 'flex', gap: '8px', alignSelf: 'stretch', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>待生成的分镜图数量</span>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, flexShrink: 0 }}>{shotCount}个</span>
          </div>
          <ModalSelect
            label="选择模型"
            value={modelsLoading ? '加载中...' : (modelList.find(m => m.value === model)?.label || '请选择')}
            options={modelList.map(m => m.label)}
            onChange={handleModelChange}
          />
          <ModalSelect label="分辨率" value={resolution} options={resolutionOptions} onChange={setResolution} />
        </div>
        {/* 底部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px' }}>
          <ModalGhostBtn onClick={onClose}>取消</ModalGhostBtn>
          <ModalPrimaryBtn onClick={() => { onConfirm({ model, resolution }); onClose(); }}>开始生成</ModalPrimaryBtn>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── 批量生成分镜视频弹窗 ─────────────────────────────────────────────────────

function BatchVideoModal({ shotCount, onClose, onConfirm }) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [resolution, setResolution] = useState('');
  const [duration, setDuration] = useState('');
  const [sound, setSound] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'video' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        const merged = list.map((m) => {
          const modelId = m.model_id || m.id;
          const name = m.name || '';
          const caps = m.capabilities || {};
          const resolutions = (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
          // 时长：优先 supported_durations 数组，其次 supported_duration_range，最后本地兜底
          let durationRange = null;
          const durArr = caps.supported_durations || [];
          if (durArr.length > 0) durationRange = durArr.map(d => String(d).endsWith('s') ? String(d) : String(d) + 's');
          if (!durationRange) durationRange = caps.supported_duration_range || null;
          if (!durationRange) {
            const localCaps = getVideoModelCapabilities(modelId);
            if (localCaps?.outputVideo?.durationRange) durationRange = localCaps.outputVideo.durationRange;
          }
          return { value: modelId, label: name || modelId, capabilities: caps, resolutions, durationRange, is_default: m.is_default };
        });
        setModelList(merged);
        if (merged.length > 0) {
          const first = merged.find(m => m.is_default) || merged[0];
          setModel(first.value);
          if (first.resolutions.length > 0) {
            setResolution(first.resolutions[0]);
          }
          if (first.durationRange) {
            setDuration(Array.isArray(first.durationRange) ? first.durationRange[0] : `${first.durationRange[0]}s`);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);

  const resolutionOptions = useMemo(() => {
    const selected = modelList.find(m => m.value === model);
    return selected?.resolutions || [];
  }, [model, modelList]);

  const durationOptions = useMemo(() => {
    const selected = modelList.find(m => m.value === model);
    if (!selected?.durationRange) return [];
    if (Array.isArray(selected.durationRange)) return selected.durationRange;
    const [min, max] = selected.durationRange;
    return Array.from({ length: max - min + 1 }, (_, i) => `${min + i}s`);
  }, [model, modelList]);

  const handleModelChange = useCallback((label) => {
    const selected = modelList.find(m => m.label === label);
    if (!selected) return;
    setModel(selected.value);
    const resList = selected.resolutions;
    if (resList.length > 0) {
      setResolution(resList.includes(resolution) ? resolution : resList[0]);
    }
    if (selected.durationRange) {
      if (Array.isArray(selected.durationRange)) {
        if (!selected.durationRange.includes(duration)) setDuration(selected.durationRange[0]);
      } else {
        const durSec = parseInt(duration);
        const [minDur, maxDur] = selected.durationRange;
        if (!isNaN(durSec) && durSec >= minDur && durSec <= maxDur) {
          setDuration(duration);
        } else {
          setDuration(`${minDur}s`);
        }
      }
    }
  }, [modelList, resolution, duration]);

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{
        display: 'flex', flexDirection: 'column', width: '400px',
        backgroundColor: '#161616', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
      }}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', padding: '16px 24px' }}>
          <span style={{ flex: 1, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>批量生成分镜视频</span>
          <ModalCloseBtn onClick={onClose} />
        </div>
        {/* 内容 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px' }}>
          <div style={{ display: 'flex', gap: '8px', alignSelf: 'stretch', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>待生成的分镜视频数量</span>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, flexShrink: 0 }}>{shotCount}个</span>
          </div>
          <ModalSelect
            label="选择模型"
            value={modelsLoading ? '加载中...' : (modelList.find(m => m.value === model)?.label || '请选择')}
            options={modelList.map(m => m.label)}
            onChange={handleModelChange}
          />
          <ModalSelect label="分辨率" value={resolution} options={resolutionOptions} onChange={setResolution} />
          <ModalSelect label="时长" value={duration} options={durationOptions} onChange={setDuration} />
          {/* 音效 toggle */}
          <div style={{ display: 'flex', gap: '8px', alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>音效</span>
            <ModalToggle value={sound} onChange={setSound} />
          </div>
        </div>
        {/* 底部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px' }}>
          <ModalGhostBtn onClick={onClose}>取消</ModalGhostBtn>
          <ModalPrimaryBtn onClick={() => { onConfirm({ model, resolution, duration, sound }); onClose(); }}>开始生成</ModalPrimaryBtn>
        </div>
      </div>
    </ModalOverlay>
  );
}

function ModalCloseBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
        backgroundColor: hov ? 'rgba(255,255,255,0.08)' : 'transparent',
        transition: 'background-color 0.10s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── 图片列表辅助组件 ─────────────────────────────────────────────────────────


function ImgUploadBtn({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setHovered(true)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', padding: '0 6px', borderRadius: '6px', cursor: 'pointer',
        background: pressed ? '#222222' : hovered ? '#1A1A1A' : '#161616',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        outline: '1px solid #00000080',
        transition: 'background 100ms, border-color 100ms',
      }}
    >
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: hovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66' }}>{label}</span>
    </div>
  );
}

// 上传占位卡
function ImgUploadCard({ onUpload, projectId, onAssetSelect }) {
  const [hovered, setHovered] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          height: '144px', borderRadius: '6px', flexShrink: 0,
          border: `1px dashed ${hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
          background: hovered ? '#222222' : '#1D1E1E',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; } onUpload?.(file); } e.target.value = ''; }}
        />
        <ImgUploadBtn label="本地上传" onClick={() => fileInputRef.current?.click()} />
        <ImgUploadBtn label="从资产库选择" onClick={() => setAssetPickerOpen(true)} />
      </div>
      <AssetPickerModal accept="image" open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} projectId={projectId} onConfirm={(assets) => { if (onAssetSelect) onAssetSelect(assets); setAssetPickerOpen(false); }} />
    </>
  );
}

// 已生成图片卡
function ImgItem({ settled, imageUrl, onView, onSettledChange }) {
  const [hovered, setHovered] = useState(false);
  const borderColor = settled ? '#2DC3E1' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSettledChange?.(!settled)}
      style={{
        height: '144px', borderRadius: '6px', flexShrink: 0,
        border: `1px solid ${borderColor}`,
        background: '#FFFFFF14', overflow: 'clip', position: 'relative', cursor: 'pointer',
        transition: 'border-color 120ms',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imageUrl
          ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <DotsLoading size={4} color="#2DC3E1" gap={3} />
        }
      </div>
      {/* 顶部定稿 checkbox */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Checkbox checked={settled} onChange={(e) => { e.stopPropagation(); onSettledChange?.(!settled); }} />
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF' , fontWeight: settled ? 600 : 500 }}>定稿</span>
      </div>
      {/* 底部悬停按钮 */}
      {hovered && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          <ImgIconBtn onClick={(e) => { e.stopPropagation(); onView?.(imageUrl); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ImgIconBtn>
          <ImgIconBtn onClick={(e) => { e.stopPropagation(); if (imageUrl) { const a = document.createElement("a"); a.href = imageUrl; a.download = imageUrl.split("/").pop() || "image.jpg"; a.click(); } }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ImgIconBtn>
        </div>
      )}
    </div>
  );
}

// ─── 面板表单内 Select ────────────────────────────────────────────────────────

function PanelSelect({ label, value, options, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);
  const borderColor = open ? 'rgba(45,195,225,0.60)' : hov ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)';
  const outlineColor = open ? 'rgba(45,195,225,0.12)' : '#00000080';
  const outlineWidth = open ? '3px' : '1px';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
      {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>}
      <div ref={ref} style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', height: '36px', width: '100%',
            borderRadius: '8px', paddingInline: '12px', gap: '8px', flexShrink: 0,
            backgroundColor: disabled ? '#131313' : hov ? '#222323' : '#1D1E1E',
            border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : borderColor}`,
            outline: `${outlineWidth} solid ${disabled ? '#00000080' : outlineColor}`,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.10s, border-color 0.10s',
            boxSizing: 'border-box',
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => { if (!disabled) setOpen((v) => !v); }}
          onMouseEnter={() => { if (!disabled) setHov(true); }}
          onMouseLeave={() => setHov(false)}
        >
          <span style={{ flex: 1, fontSize: '14px', lineHeight: '18px', color: disabled ? 'rgba(255,255,255,0.40)' : '#FFFFFF', fontFamily: FONT }}>{value}</span>
          {!disabled && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '8px', padding: '4px', zIndex: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.40)',
          }}>
            {options.map((opt) => (
              <ModalSelectItem key={opt} label={opt} active={opt === value} onSelect={() => { onChange(opt); setOpen(false); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 首尾帧专用上传区（含快捷按钮）────────────────────────────────────────────────

function FrameUploadSlot({ label, media, onUpload, onRemove, shortcutLabel, shortcutImage, shortcutTooltip, projectId }) {
  const fileRef = useRef(null);
  const [hov, setHov] = useState(false);
  const [btn1Hov, setBtn1Hov] = useState(false);
  const [btn1Pressed, setBtn1Pressed] = useState(false);
  const [btn2Hov, setBtn2Hov] = useState(false);
  const [btn2Pressed, setBtn2Pressed] = useState(false);
  const [btn3Hov, setBtn3Hov] = useState(false);
  const [btn3Pressed, setBtn3Pressed] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewPos, setPreviewPos] = useState(null);
  const hoverTimerRef = useRef(null);

  function handleMediaMouseEnter(e) {
    const { clientX, clientY } = e;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (media?.url) setPreviewPos({ x: clientX, y: clientY });
    }, 500);
  }

  function handleMediaMouseMove(e) {
    setPreviewPos(p => p ? { x: e.clientX, y: e.clientY } : p);
  }

  function handleMediaMouseLeave() {
    clearTimeout(hoverTimerRef.current);
    setPreviewPos(null);
  }

 async function handleFile(e) {
   const file = e.target.files[0];
   if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const maxSize = isVideo ? 200 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    const typeLabel = isVideo ? '视频' : isAudio ? '音频' : '图片';
    if (file.size > maxSize) { alert(`抱歉，平台暂不支持上传${maxSize / 1024 / 1024}M以上的${typeLabel}资源！`); e.target.value = ''; return; }
   setUploading(true);
   try {
      const uploadFn = isVideo ? apiUploadCreationVideo : isAudio ? apiUploadCreationAudio : apiUploadCreationImage;
      const result = await uploadFn({ file, category: 'reference', project_id: projectId });
     const url = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';
     onUpload?.({ id: url, url, name: file.name, type: file.type });
   } catch {
     alert('上传失败，请重试');
   }
   setUploading(false);
    e.target.value = '';
  }

  function handleShortcut() {
    if (!shortcutImage) return;
    onUpload?.(shortcutImage);
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
        {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          {media ? (
            <div
              onMouseEnter={handleMediaMouseEnter}
              onMouseMove={handleMediaMouseMove}
              onMouseLeave={handleMediaMouseLeave}
              style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
              <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div
                onClick={() => { clearTimeout(hoverTimerRef.current); setPreviewPos(null); onRemove?.(); }}
                style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </div>
            </div>
          ) : (
            <div
              onMouseEnter={() => setHov(true)}
              onMouseLeave={() => setHov(false)}
              style={{
                width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0,
                border: `1px dashed ${hov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                backgroundColor: '#1D1E1E',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'border-color 0.12s',
              }}
            >
              <div
                onClick={() => fileRef.current?.click()}
                onMouseEnter={() => setBtn1Hov(true)}
                onMouseLeave={() => { setBtn1Hov(false); setBtn1Pressed(false); }}
                onMouseDown={() => setBtn1Pressed(true)}
                onMouseUp={() => setBtn1Pressed(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '6px', borderRadius: '6px',
                  backgroundColor: btn1Pressed ? '#1a1a1a' : btn1Hov ? '#222323' : '#161616',
                  border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
                  cursor: 'pointer', fontSize: '12px', color: btn1Hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
                  fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
                }}
              >
                本地上传
              </div>
              <div
                onClick={() => setAssetPickerOpen(true)}
                onMouseEnter={() => setBtn2Hov(true)}
                onMouseLeave={() => { setBtn2Hov(false); setBtn2Pressed(false); }}
                onMouseDown={() => setBtn2Pressed(true)}
                onMouseUp={() => setBtn2Pressed(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '6px', borderRadius: '6px',
                  backgroundColor: btn2Pressed ? '#1a1a1a' : btn2Hov ? '#222323' : '#161616',
                  border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
                  cursor: 'pointer', fontSize: '12px', color: btn2Hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
                  fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
                }}
              >
                从资产库选择
              </div>
            </div>
          )}
          {/* 快捷按钮：使用当前/下一分镜图 */}
          {!media && (
            <div style={{ position: 'relative' }}>
              <div
                onClick={shortcutImage ? handleShortcut : undefined}
                onMouseEnter={() => setBtn3Hov(true)}
                onMouseLeave={() => { setBtn3Hov(false); setBtn3Pressed(false); }}
                onMouseDown={() => shortcutImage ? setBtn3Pressed(true) : undefined}
                onMouseUp={() => setBtn3Pressed(false)}
                style={{
                  width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0,
                  border: `1px dashed ${btn3Hov && shortcutImage ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  backgroundColor: '#1D1E1E',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: shortcutImage ? 'pointer' : 'default',
                  transition: 'border-color 0.12s',
                  padding: '8px',
                }}
              >
                {shortcutImage ? (
                  <>
                    <div style={{ width: '72px', height: '40px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)', opacity: btn3Hov ? 1 : 0.6, transition: 'opacity 0.12s' }}>
                      <img src={shortcutImage.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, textAlign: 'center' }}>{shortcutLabel}</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="4" width="16" height="12" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2"/>
                      <circle cx="7" cy="8.5" r="1.5" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2"/>
                      <path d="M2 13l4-3 3 2.5 3-4 4 4.5" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: '11px', lineHeight: '14px', color: 'rgba(255,255,255,0.20)', fontFamily: FONT, textAlign: 'center' }}>{shortcutLabel}</span>
                  </>
                )}
              </div>
              {/* tooltip：无分镜图时悬停提示 */}
              {!shortcutImage && shortcutTooltip && btn3Hov && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                  backgroundColor: '#2A2B2B', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px',
                  padding: '6px 10px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999,
                  fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.40)',
                }}>
                  {shortcutTooltip}
                  {/* 小三角 */}
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                    borderTop: '5px solid #2A2B2B',
                  }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <AssetPickerModal accept="image" open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} projectId={projectId} onConfirm={(assets) => {
        if (assets?.length) {
          const a = assets[0];
          onUpload?.({ id: a.id, url: a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url || '', name: a.name || a.filename || '' });
        }
        setAssetPickerOpen(false);
      }} />
      {previewPos && media?.url && createPortal(
        <MediaHoverPreview url={media.url} isVideo={false} mouseX={previewPos.x} mouseY={previewPos.y} />,
        document.body
      )}
    </>
  );
}

// ─── 面板上传区（虚线框）────────────────────────────────────────────────────────

function PanelUploadSlot({ label, onUpload, media, onRemove, accept = 'image/*', projectId, countLabel, mediaList, canAddMore = true, onRemoveItem, onAssetConfirm, onInsert }) {
  const fileRef = useRef(null);
  const [hov, setHov] = useState(false);
  const [addHov, setAddHov] = useState(false);
  const [btn1Hov, setBtn1Hov] = useState(false);
  const [btn1Pressed, setBtn1Pressed] = useState(false);
  const [btn2Hov, setBtn2Hov] = useState(false);
  const [btn2Pressed, setBtn2Pressed] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null); // { url, isVideo }
const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
 const [uploading, setUploading] = useState(false);
const hoverTimerRef = useRef(null);

  function startPreview(e, item) {
    const { clientX, clientY } = e;
    setMousePos({ x: clientX, y: clientY });
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (item?.url) setPreviewMedia({ url: item.url, isVideo: !!item.type?.startsWith('video') });
    }, 500);
  }

  function movePreview(e) {
    setMousePos({ x: e.clientX, y: e.clientY });
  }

  function stopPreview() {
    clearTimeout(hoverTimerRef.current);
    setPreviewMedia(null);
  }

  // 多图模式：mediaList 数组传入时启用
  const isMultiMode = Array.isArray(mediaList);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const maxSize = isVideo ? 200 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    const typeLabel = isVideo ? '视频' : isAudio ? '音频' : '图片';
    if (file.size > maxSize) { alert(`抱歉，平台暂不支持上传${maxSize / 1024 / 1024}M以上的${typeLabel}资源！`); e.target.value = ''; return; }
    setUploading(true);
    try {
      const uploadFn = isVideo ? apiUploadCreationVideo : isAudio ? apiUploadCreationAudio : apiUploadCreationImage;
      const result = await uploadFn({ file, category: 'reference', project_id: projectId });
      const url = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';
      onUpload?.({ id: url, url, name: file.name, type: file.type });
    } catch {
      alert('上传失败，请重试');
    }
    setUploading(false);
    e.target.value = '';
  }

  // 多图模式的单个缩略图尺寸（与单图模式保持一致）
  const THUMB = 120;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
        {/* Label 行：label 左，countLabel 右 */}
        {(label || countLabel) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>}
            {countLabel && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.35)', fontFamily: FONT, flexShrink: 0 }}>{countLabel}</span>}
          </div>
        )}

        {isMultiMode ? (
          /* ── 多图模式 ─────────────────────────────────── */
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
            {/* 已上传的缩略图列表 */}
            {mediaList.map((item, idx) => (
              <div key={item.id || idx}
                onMouseEnter={(e) => startPreview(e, item)}
                onMouseMove={movePreview}
                onMouseLeave={stopPreview}
                style={{ position: 'relative', width: `${THUMB}px`, height: `${THUMB}px`, borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
                {item.type?.startsWith('video') ? (
                  <video src={item.url || null} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                ) : item.type?.startsWith('audio') ? (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#1D1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/><circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/></svg>
                  </div>
                ) : (
                  <img src={item.url || null} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <div
                  onClick={() => { stopPreview(); onRemoveItem ? onRemoveItem(idx) : onRemove?.(); }}
                  style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </div>
              </div>
            ))}
            {/* 添加按钮（上限未达到时显示） */}
            {canAddMore && (
              <div
                onMouseEnter={() => setAddHov(true)}
                onMouseLeave={() => setAddHov(false)}
                style={{
                  width: `${THUMB}px`, height: `${THUMB}px`, borderRadius: '6px', flexShrink: 0,
                  border: `1px dashed ${addHov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  backgroundColor: '#1D1E1E',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'border-color 0.12s', cursor: 'pointer',
                }}
              >
                <div
                  onClick={() => fileRef.current?.click()}
                  onMouseEnter={() => setBtn1Hov(true)}
                  onMouseLeave={() => { setBtn1Hov(false); setBtn1Pressed(false); }}
                  onMouseDown={() => setBtn1Pressed(true)}
                  onMouseUp={() => setBtn1Pressed(false)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '6px', borderRadius: '6px',
                    backgroundColor: btn1Pressed ? '#1a1a1a' : btn1Hov ? '#222323' : '#161616',
                    border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
                    cursor: 'pointer', fontSize: '12px', color: btn1Hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
                    fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
                  }}
                >
                  本地上传
                </div>
                <div
                  onClick={() => setAssetPickerOpen(true)}
                  onMouseEnter={() => setBtn2Hov(true)}
                  onMouseLeave={() => { setBtn2Hov(false); setBtn2Pressed(false); }}
                  onMouseDown={() => setBtn2Pressed(true)}
                  onMouseUp={() => setBtn2Pressed(false)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '6px', borderRadius: '6px',
                    backgroundColor: btn2Pressed ? '#1a1a1a' : btn2Hov ? '#222323' : '#161616',
                    border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
                    cursor: 'pointer', fontSize: '12px', color: btn2Hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
                    fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
                  }}
                >
                  从资产库选择
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── 单图/单视频/单音频模式（原有逻辑）─────────── */
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
            {media ? (
              <div
                onMouseDown={(e) => { if (onInsert) e.preventDefault(); }}
                onClick={() => onInsert?.(media)}
                onMouseEnter={(e) => startPreview(e, media)}
                onMouseMove={movePreview}
                onMouseLeave={stopPreview}
                style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${onInsert ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.12)'}`, cursor: onInsert ? 'pointer' : 'default' }}>
                {media.type?.startsWith('video') ? (
                  <video src={media.url || null} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                ) : media.type?.startsWith('audio') ? (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/><circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/></svg>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingInline: '4px' }}>{media.name}</span>
                  </div>
                ) : (
                  <img src={media.url || null} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <div
                  onClick={() => { stopPreview(); onRemove?.(); }}
                  style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </div>
              </div>
            ) : (
              <div
                onMouseEnter={() => setHov(true)}
                onMouseLeave={() => setHov(false)}
                style={{
                  width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0,
                  border: `1px dashed ${hov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  backgroundColor: '#1D1E1E',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'border-color 0.12s',
                }}
              >
                <div
                  onClick={() => fileRef.current?.click()}
                  onMouseEnter={() => setBtn1Hov(true)}
                  onMouseLeave={() => { setBtn1Hov(false); setBtn1Pressed(false); }}
                  onMouseDown={() => setBtn1Pressed(true)}
                  onMouseUp={() => setBtn1Pressed(false)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '6px', borderRadius: '6px',
                    backgroundColor: btn1Pressed ? '#1a1a1a' : btn1Hov ? '#222323' : '#161616',
                    border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
                    cursor: 'pointer', fontSize: '12px', color: btn1Hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
                    fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
                  }}
                >
                  本地上传
                </div>
                <div
                  onClick={() => setAssetPickerOpen(true)}
                  onMouseEnter={() => setBtn2Hov(true)}
                  onMouseLeave={() => { setBtn2Hov(false); setBtn2Pressed(false); }}
                  onMouseDown={() => setBtn2Pressed(true)}
                  onMouseUp={() => setBtn2Pressed(false)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '6px', borderRadius: '6px',
                    backgroundColor: btn2Pressed ? '#1a1a1a' : btn2Hov ? '#222323' : '#161616',
                    border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
                    cursor: 'pointer', fontSize: '12px', color: btn2Hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
                    fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
                  }}
                >
                  从资产库选择
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <AssetPickerModal
        accept={accept.startsWith('video') ? 'video' : accept.startsWith('image') ? 'image' : accept.startsWith('audio') ? 'audio' : 'all'}
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        projectId={projectId}
        preSelectedIds={isMultiMode ? (mediaList || []).map(m => m.assetId || m.id).filter(id => id && !id.startsWith('blob:')) : (media?.assetId || (!media?.id?.startsWith('blob:') ? media?.id : null)) ? [media.assetId || media.id] : []}
        preSelectedUrls={isMultiMode ? (mediaList || []).map(m => m.url).filter(Boolean) : (media?.url ? [media.url] : [])}
        onConfirm={(assets) => { onAssetConfirm?.(assets); setAssetPickerOpen(false); }}
      />
      {previewMedia && createPortal(
        <MediaHoverPreview url={previewMedia.url} isVideo={previewMedia.isVideo} mouseX={mousePos.x} mouseY={mousePos.y} />,
        document.body
      )}
    </>
  );
}

// ─── 面板内提示词输入框 ────────────────────────────────────────────────────────

const MAX_PROMPT_LEN = 1000;

// ── DOM helpers for atomic mention editing ────────────────────────────────────

function buildMentionPattern(allSubjects) {
  const names = allSubjects.map((s) => s.name).filter(Boolean);
  if (names.length === 0) return null;
  return new RegExp(
    `@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  );
}

function parseSegments(text, allSubjects) {
  const pattern = buildMentionPattern(allSubjects);
  const segments = [];
  let last = 0;

  // 只匹配 @名称 格式
  if (!pattern) {
    if (text) segments.push({ kind: 'text', text });
    return segments;
  }

  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    const name = m[0].slice(1); // 去掉 @
    const subject = allSubjects.find((s) => s.name === name);
    segments.push({ kind: 'mention', name, type: subject?._type ?? 'image' });
    last = m.index + m[0].length;
  }

  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

function serializeEditor(el) {
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.dataset?.mention) {
        // 所有提及统一序列化为 @名称
        out += `@${node.dataset.mention}`;
      } else if (node.tagName === 'BR') {
        out += '\n';
      } else {
        out += node.textContent;
      }
    }
  }
  return out;
}

function rebuildEditorDOM(el, text, allSubjects, typeOverrides = {}) {
  // typeOverrides: { [name]: type } 优先级最高，用于保留已知的正确类型
  const segs = parseSegments(text, allSubjects);
  el.innerHTML = '';
  for (const seg of segs) {
    if (seg.kind === 'text') {
      if (seg.text) el.appendChild(document.createTextNode(seg.text));
    } else {
      const type = typeOverrides[seg.name] ?? seg.type;
      const color = MENTION_TYPE_COLOR[type] ?? '#E2E24B';
      const span = document.createElement('span');
      span.dataset.mention = seg.name;
      span.dataset.mentionType = type;
      span.contentEditable = 'false';
      span.textContent = `@${seg.name}`;
      span.style.cssText = [
        'display:inline-flex', 'align-items:center', 'padding:0 4px',
        'border-radius:4px', 'font-size:14px', 'line-height:21px',
        `background:${color}26`, `color:${color}`,
        `box-shadow:inset 0 0 0 1px ${color}33`,
        'vertical-align:middle', 'user-select:none', 'cursor:default',
      ].join(';');
      el.appendChild(span);
    }
  }
  if (!el.lastChild || el.lastChild.nodeType !== Node.TEXT_NODE) {
    el.appendChild(document.createTextNode(''));
  }
}

function getCaretOffset(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  let offset = 0;
  for (const node of el.childNodes) {
    if (node === range.startContainer || node.contains?.(range.startContainer)) {
      if (node.nodeType === Node.TEXT_NODE) offset += range.startOffset;
      else if (node.dataset?.mention) {
        // 统一为 @名称 的长度
        offset += node.dataset.mention.length + 1;
      }
      break;
    }
    if (node.nodeType === Node.TEXT_NODE) offset += node.textContent.length;
    else if (node.dataset?.mention) {
      offset += node.dataset.mention.length + 1;
    }
    else offset += node.textContent.length;
  }
  return offset;
}

function setCaretOffset(el, targetOffset) {
  let remaining = targetOffset;
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else if (node.dataset?.mention) {
      // 统一为 @名称 的长度
      const len = node.dataset.mention.length + 1;
      if (remaining < len) {
        const range = document.createRange();
        range.setStartAfter(node);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

const PanelPromptInput = forwardRef(function PanelPromptInput({ value, onChange, referenceItems = [] }, ref) {
  const [focused, setFocused] = useState(false);
  const [hov, setHov] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const editorRef = useRef(null);
  const wrapRef = useRef(null);
  const composingRef = useRef(false);
  const suppressSyncRef = useRef(false);
  const allSubjectsRef = useRef([]);
  const typeOverridesRef = useRef({});
  const isBlurringRef = useRef(false);
  const pendingMentionRef = useRef(null); // { name, type } 等待编辑器挂载后插入

  // 暴露 insertMention 方法，供外部（如参考视频卡片点击）调用
  useImperativeHandle(ref, () => ({
    insertMention(name, type) {
      const el = editorRef.current;
      if (el) {
        // 编辑器已挂载，直接插入
        doInsertMention(el, name, type);
      } else {
        // 展示态，先记录 pending，触发 focused=true 后在 useEffect 中插入
        pendingMentionRef.current = { name, type };
        setFocused(true);
      }
    },
  }));

  function doInsertMention(el, name, type) {
    const caretOffset = getCaretOffset(el);
    const currentVal = serializeEditor(el);
    const before = currentVal.slice(0, caretOffset);
    const after = currentVal.slice(caretOffset);
    const newVal = `${before}@${name} ${after}`.slice(0, MAX_PROMPT_LEN);
    const newCaretOffset = caretOffset + name.length + 2;
    const typeOverrides = { ...typeOverridesRef.current, [name]: type };
    typeOverridesRef.current = typeOverrides;
    onChange(newVal);
    suppressSyncRef.current = true;
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      suppressSyncRef.current = false;
      rebuildEditorDOM(editorRef.current, newVal, allSubjectsRef.current, typeOverrides);
      setCaretOffset(editorRef.current, newCaretOffset);
      editorRef.current.focus();
    });
  }

  const borderColor = focused ? 'rgba(45,195,225,0.60)' : hov ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)';
  const outlineColor = focused ? 'rgba(45,195,225,0.12)' : '#00000080';
  const outlineWidth = focused ? '3px' : '1px';

  const allSubjects = referenceItems;
  allSubjectsRef.current = allSubjects;

  // 从当前 DOM 读出已确认的 name→type 映射，防止重建时因同名条目顺序问题丢失正确类型
  function readDOMTypes(el) {
    const map = {};
    for (const node of el.childNodes) {
      if (node.dataset?.mention && node.dataset?.mentionType) {
        map[node.dataset.mention] = node.dataset.mentionType;
      }
    }
    return map;
  }

  function syncToValue(el) {
    if (suppressSyncRef.current || isBlurringRef.current) {
      suppressSyncRef.current = false;
      return;
    }
    const caretOffset = getCaretOffset(el);
    // 把当前 DOM 里已有的类型合并进持久化 ref，防止 rebuild 时丢失
    const domTypes = readDOMTypes(el);
    typeOverridesRef.current = { ...typeOverridesRef.current, ...domTypes };
    const raw = serializeEditor(el);
    const clamped = raw.slice(0, MAX_PROMPT_LEN);
    onChange(clamped);
    rebuildEditorDOM(el, clamped, allSubjects, typeOverridesRef.current);
    setCaretOffset(el, caretOffset);
    const textBefore = clamped.slice(0, caretOffset);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx !== -1) {
      const fragment = textBefore.slice(atIdx + 1);
      if (!fragment.includes(' ') && !fragment.includes('\n')) {
        setMentionQuery(fragment);
        return;
      }
    }
    setMentionQuery(null);
  }

  useEffect(() => {
    if (focused && editorRef.current) {
      const el = editorRef.current;
      // 必须先 focus，否则 window.getSelection() 无法定位光标
      el.focus();
      rebuildEditorDOM(el, value, allSubjects, typeOverridesRef.current);
      // 若有待插入的 mention（点击卡片时编辑器还未挂载），在此消费
      if (pendingMentionRef.current) {
        const { name, type } = pendingMentionRef.current;
        pendingMentionRef.current = null;
        // 光标先移到末尾，再插入
        setCaretOffset(el, value.length);
        doInsertMention(el, name, type);
      } else {
        setCaretOffset(el, value.length);
      }
    }
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  // 原生 beforeinput 监听：React 合成 onBeforeInput 无法 preventDefault，必须用原生事件
  useEffect(() => {
    if (!focused) return;
    const el = editorRef.current;
    if (!el) return;
    function nativeBeforeInput(e) {
      if (composingRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      for (const node of el.childNodes) {
        if (!node.dataset?.mention) continue;
        const nodeRange = document.createRange();
        nodeRange.selectNode(node);
        if (
          range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
          range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0
        ) {
          e.preventDefault();
          return;
        }
      }
    }
    el.addEventListener('beforeinput', nativeBeforeInput);
    return () => el.removeEventListener('beforeinput', nativeBeforeInput);
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setMentionQuery(null); return; }
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    if (e.key === 'Backspace' || e.key === 'Delete') {
      for (const node of el.childNodes) {
        if (!node.dataset?.mention) continue;
        const nodeRange = document.createRange();
        nodeRange.selectNode(node);
        const collapsed = range.collapsed;

        if (collapsed && e.key === 'Backspace') {
          const afterRange = document.createRange();
          afterRange.setStartAfter(node);
          afterRange.collapse(true);
          if (range.compareBoundaryPoints(Range.START_TO_START, afterRange) === 0) {
            e.preventDefault();
            const caretOffset = getCaretOffset(el) - (node.dataset.mention.length + 1);
            node.remove();
            const raw = serializeEditor(el);
            onChange(raw.slice(0, MAX_PROMPT_LEN));
            rebuildEditorDOM(el, raw.slice(0, MAX_PROMPT_LEN), allSubjects);
            setCaretOffset(el, Math.max(0, caretOffset));
            setMentionQuery(null);
            return;
          }
        }
        if (collapsed && e.key === 'Delete') {
          const beforeRange = document.createRange();
          beforeRange.setStartBefore(node);
          beforeRange.collapse(true);
          if (range.compareBoundaryPoints(Range.START_TO_START, beforeRange) === 0) {
            e.preventDefault();
            const caretOffset = getCaretOffset(el);
            node.remove();
            const raw = serializeEditor(el);
            onChange(raw.slice(0, MAX_PROMPT_LEN));
            rebuildEditorDOM(el, raw.slice(0, MAX_PROMPT_LEN), allSubjects);
            setCaretOffset(el, caretOffset);
            setMentionQuery(null);
            return;
          }
        }
        if (!collapsed) {
          const inside =
            range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
            range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0;
          if (inside) {
            e.preventDefault();
            const caretOffset = getCaretOffset(el);
            range.deleteContents();
            const raw = serializeEditor(el);
            onChange(raw.slice(0, MAX_PROMPT_LEN));
            rebuildEditorDOM(el, raw.slice(0, MAX_PROMPT_LEN), allSubjects);
            setCaretOffset(el, Math.max(0, caretOffset));
            setMentionQuery(null);
            return;
          }
        }
      }
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      for (const node of el.childNodes) {
        if (!node.dataset?.mention) continue;
        if (e.key === 'ArrowLeft') {
          const afterRange = document.createRange();
          afterRange.setStartAfter(node);
          afterRange.collapse(true);
          if (range.collapsed && range.compareBoundaryPoints(Range.START_TO_START, afterRange) === 0) {
            e.preventDefault();
            const r = document.createRange();
            r.setStartBefore(node);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            return;
          }
        } else {
          const beforeRange = document.createRange();
          beforeRange.setStartBefore(node);
          beforeRange.collapse(true);
          if (range.collapsed && range.compareBoundaryPoints(Range.START_TO_START, beforeRange) === 0) {
            e.preventDefault();
            const r = document.createRange();
            r.setStartAfter(node);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            return;
          }
        }
      }
    }
  }

  function handleInput() {
    if (composingRef.current || !focused) return;
    const el = editorRef.current;
    if (el) syncToValue(el);
  }

  function handlePaste(e) {
    // 只允许纯文本粘贴，剥除富文本样式（颜色、加粗等）
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (text) {
      document.execCommand('insertText', false, text);
    }
  }

  function handleCompositionStart() { composingRef.current = true; }
  function handleCompositionEnd() {
    composingRef.current = false;
    const el = editorRef.current;
    if (el && focused) syncToValue(el);
  }

  function handleBlur() {
    // 设置失焦标志，防止失焦过程中的 syncToValue 调用
    isBlurringRef.current = true;
    setFocused(false);
    setMentionQuery(null);
    // 在下一帧重置标志
    requestAnimationFrame(() => {
      isBlurringRef.current = false;
    });
  }

  function handleSelectMention(name, type) {
    const el = editorRef.current;
    if (!el) return;
    const caretOffset = getCaretOffset(el);
    const textBefore = value.slice(0, caretOffset);
    const atIdx = textBefore.lastIndexOf('@');
    const before = value.slice(0, atIdx);
    const after = value.slice(caretOffset);

    // 统一插入 @名称
    const newVal = `${before}@${name} ${after}`.slice(0, MAX_PROMPT_LEN);
    const newCaretOffset = atIdx + name.length + 2;
    const typeOverrides = { ...readDOMTypes(el), [name]: type };

    onChange(newVal);
    setMentionQuery(null);
    suppressSyncRef.current = true;
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      suppressSyncRef.current = false;
      rebuildEditorDOM(editorRef.current, newVal, allSubjectsRef.current, typeOverrides);
      setCaretOffset(editorRef.current, newCaretOffset);
    });
  }

  const segments = parseSegments(value, allSubjects);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>提示词</span>
      <div
        ref={wrapRef}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#1D1E1E', borderRadius: '8px',
          border: `1px solid ${borderColor}`, outline: `${outlineWidth} solid ${outlineColor}`,
          padding: '9px 12px', minHeight: '120px', boxSizing: 'border-box',
          transition: 'border-color 0.10s',
          position: 'relative',
        }}
      >
        {focused ? (
          /* 编辑态：contenteditable，mention span 为 contentEditable=false 原子 */
          <div
            key="editor"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            data-placeholder="描述画面内容、风格、镜头… 输入 @ 引入角色/场景/道具"
            style={{
              flex: 1, outline: 'none', background: 'transparent',
              fontSize: '14px', lineHeight: '21px', color: '#FFFFFF', caretColor: '#2DC3E1',
              fontFamily: FONT, wordBreak: 'break-all', whiteSpace: 'pre-wrap',
              overflowY: 'auto', boxSizing: 'border-box',
            }}
            className="[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-[rgba(255,255,255,0.30)] [&:empty]:before:pointer-events-none"
          />
        ) : (
          /* 展示态：渲染 value 字符串，\n 由 pre-wrap 自动换行，mention 高亮 */
          <div
            key="display"
            onClick={() => setFocused(true)}
            style={{
              flex: 1, overflow: 'hidden',
              fontSize: '14px', lineHeight: '21px', fontFamily: FONT,
              wordBreak: 'break-all', whiteSpace: 'pre-wrap',
              cursor: 'text',
              color: value ? '#FFFFFF' : 'rgba(255,255,255,0.30)',
            }}
          >
            {value === '' ? '描述画面内容、风格、镜头… 输入 @ 引入角色/场景/道具' : segments.map((seg, i) =>
              seg.kind === 'mention'
                ? <SubjectTag key={i} name={seg.name} type={seg.type} />
                : <span key={i}>{seg.text}</span>
            )}
          </div>
        )}
        <div style={{ alignSelf: 'stretch', textAlign: 'right', fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, flexShrink: 0 }}>
          {value.length}/{MAX_PROMPT_LEN}
        </div>
      </div>
      {mentionQuery !== null && (
        <ReferenceMentionDropdown
          referenceItems={allSubjects}
          query={mentionQuery}
          onSelect={handleSelectMention}
          onClose={() => setMentionQuery(null)}
          triggerRef={wrapRef}
        />
      )}
    </div>
  );
});

// ─── 生成分镜图面板 ────────────────────────────────────────────────────────────

// 由分镜列表字段拼出提示词输入框的「初始内容」。
// 注意：提示词只是辅助生图/生视频的描述，不是真正控制分镜内容的字段。
// 真正的分镜内容存在 shot 的各列字段里（params/lightShadow/ambientSound/description/narration），
// 由列表直接编辑并实时回传后端；提示词框内的编辑不回写这些字段。
// 因此这里每次打开面板都按 shot 的当前字段重建初始提示词——
// 只有更新了列表字段，提示词框的初始内容才会随之变化。
// 需求：只展示字段内容、不展示字段标题（如「景别：远景」只取「远景」）。
function buildPromptFromShot(shot) {
  const lines = [];

  // 第一行：镜头固定参数（只取值，不带「景别：」等标题）
  const paramParts = [
    shot?.params?.framing,
    shot?.params?.cameraMotion,
    shot?.params?.angle,
    shot?.params?.composition,
    shot?.params?.duration,
  ].filter(Boolean);
  if (paramParts.length) lines.push(paramParts.join('，'));

  // 第二行：光影 + 环境音（只取值，不带标题）
  const atmosphereParts = [
    shot?.lightShadow,
    shot?.ambientSound,
  ].filter(Boolean);
  if (atmosphereParts.length) lines.push(atmosphereParts.join('，'));

  // 第三行：画面描述（纯文本，不含自动插入的标签；标签由用户手动 @ 引入）
  const descParts = [];
  if (shot?.description) descParts.push(shot.description);
  if (descParts.length) lines.push(descParts.join(' '));

  // 第四行：台词分配（去掉「台词分配：」标题，「角色：台词」属于内容予以保留）
  if (shot?.narration?.segments?.length > 0) {
    const dialogues = shot.narration.segments
      .map(seg => `${seg.role}：${seg.lines}`)
      .join('，');
    lines.push(dialogues);
  }

  return lines.join('\n');
}

function RefSlotBtn({ onClick, children }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '22px', paddingInline: '6px', borderRadius: '6px',
        backgroundColor: pressed ? '#1a1a1a' : hov ? '#222323' : '#161616',
        border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
        cursor: 'pointer', fontSize: '12px', lineHeight: '14px',
        color: hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
        fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
      }}
    >
      {children}
    </div>
  );
}

function GenerateImagePanel({ shot, projectId, chars = [], scenes = [], props = [], onClose, onGenerate, onShowToast, generatedImages = [], onSetGeneratedImages, onSettleImage }) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'image' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        const merged = list.map((m) => {
          const modelId = m.model_id || m.id;
          return { value: modelId, label: m.name || modelId, capabilities: m.capabilities || {}, is_default: m.is_default };
        });
        setModelList(merged);
        if (merged.length > 0) {
          const first = merged.find(m => m.is_default) || merged[0];
          setModel(first.value);
          const caps = first.capabilities;
          {
            const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
            if (resList.length > 0) setResolution(resList[0]);
          }
          {
            const durList = caps?.supported_durations;
            if (durList?.length > 0) setDuration(`${durList[0]}s`);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);
  // 提示词：仅暂存在当前弹窗的本地 state，编辑不回写分镜列表字段。
  // 关闭面板时组件卸载、本地态丢弃，下次打开按 shot 当前字段重新生成初始内容。
  // 点击「生成分镜图」时才把 prompt 随 onGenerate 传回后端。
  const [prompt, setPrompt] = useState(() => buildPromptFromShot(shot));
  const [refImages, setRefImages] = useState(() => {
    const images = [];
    // 添加主体参考图——为项目主体补全 url/name（否则标签丢失 type 会变紫色）
    if (shot?.mainRefs?.length > 0) {
      shot.mainRefs.forEach(ref => {
        if (ref?.url && !ref.url.toLowerCase().endsWith(".avif") && !ref.url.includes("/derived/assets/")) { images.push(ref); return; }
        // 从 chars/scenes/props 中查找补齐 url 和 name
        if (ref.type && ref.id) {
          const subjects = ref.type === 'char' ? chars : ref.type === 'scene' ? scenes : props;
          const found = subjects?.find(s => s.id === ref.id);
          if (found?.imageUrl) {
            images.push({ ...ref, url: normalizeImageUrl(found.imageUrl), name: found.name });
            return;
          }
        }
        if (ref?.url && !ref.url.toLowerCase().endsWith(".avif") && !ref.url.includes("/derived/assets/")) images.push(ref);
      });
    }
    return images;
  });
  const [refImgPickerOpen, setRefImgPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [btnHov, setBtnHov] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);
  const [viewImageUrl, setViewImageUrl] = useState(null);
  const [refImgPreview, setRefImgPreview] = useState(null); // { url, x, y }
  const refImgHoverTimer = useRef(null);
  const refFileRef = useRef(null);

  // 获取当前模型支持的分辨率（从后端 capabilities 派生）
  const currentModel = useMemo(() => modelList.find(m => m.value === model), [model, modelList]);
  const availableResolutions = (() => {
    const caps = currentModel?.capabilities || {};
    return (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
  })();

  const maxRefImages = currentModel?.capabilities?.max_reference_images;
  const refCountText = maxRefImages != null ? `${refImages.length}/${maxRefImages}` : null;
  const canAddRef = maxRefImages == null || refImages.length < maxRefImages;

  // 当模型切换时，重置分辨率
  const currentResolutions = (() => {
    const caps = currentModel?.capabilities || {};
    return (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
  })();
  useEffect(() => {
    if (currentResolutions.length > 0) {
      if (!currentResolutions.includes(resolution)) {
        setResolution(currentResolutions[0]);
      }
    }
  }, [model, currentResolutions]);

  async function handleRefImageUpload(file) {
    try {
      const result = await apiUploadCreationImage({
        file,
        category: 'reference',
        project_id: projectId,
      });
      const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';

      // 添加到参考图列表（不再自动插入提示词标签，标签由用户手动 @ 引入）
      setRefImages(prev => [...prev, { id: result.id || result.asset_id || uploadedUrl, url: uploadedUrl, name: file.name }]);

      return result;
    } catch (error) {
      console.error('主体图上传失败:', error);
      onShowToast?.('主体图上传失败', 'error');
      throw error;
    }
  }

  // 从资产库选择参考图
  function handleRefImageAssetConfirm(selectedAssets) {
    if (!selectedAssets || selectedAssets.length === 0) return;
    const newItems = selectedAssets.map(a => ({
      id: a.id,
      assetId: a.id, // 标记来自资产库，用于 preSelectedIds 匹配
      url: normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url),
      name: a.name || a.filename || '',
    }));
    setRefImages(prev => {
      const merged = [...prev, ...newItems];
      return maxRefImages != null ? merged.slice(0, maxRefImages) : merged;
    });
    setRefImgPickerOpen(false);
  }

  async function handleRefFileChange(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) { onShowToast?.('抱歉，平台暂不支持上传20M以上的图片资源！', 'error'); continue; }
      try {
        await handleRefImageUpload(file);
      } catch (error) {
        // 错误已在 handleRefImageUpload 中处理
        // 继续处理下一个文件
      }
    }

    e.target.value = '';
  }

  function removeRefImage(id) {
    setRefImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function handleGenerate() {
    if (loading) return;
    setLoading(true);
    const placeholder = `pending-${Date.now()}`;
    onSetGeneratedImages((prev) => [{ url: null, settled: false, id: placeholder }, ...prev]);
    try {
      const result = await onGenerate?.({ model, resolution, prompt, refImages });
      onSetGeneratedImages((prev) =>
        prev.map((item) => item.id === placeholder ? { ...item, url: result?.url ?? null } : item)
      );
      onShowToast?.('图片生成成功', 'success');
    } catch (err) {
      onSetGeneratedImages((prev) => prev.filter((item) => item.id !== placeholder));
      const status = err?.status;
      const msg = err?.message || '';
      if (msg) {
        console.error('[GenerateImagePanel] 图片生成错误详情:', { status, msg, err });
      }
      if (status === 502 || status === 504 || msg.includes('fetch') || msg.includes('Network')) {
        onShowToast?.('生成服务暂时不可用，请稍后重试', 'error');
      } else if (status === 429) {
        onShowToast?.('生成请求过于频繁，请稍后再试', 'error');
      } else if (status === 401 || status === 403) {
        onShowToast?.('登录已过期，请重新登录', 'error');
      } else if (status === 422) {
        onShowToast?.(msg || '生成参数有误，请检查后重试', 'error');
      } else if (status) {
        onShowToast?.(msg || `生成失败（${status}），请稍后重试`, 'error');
      } else {
        onShowToast?.(msg || '生成失败，请检查网络连接后重试', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  const imageReferenceItems = useMemo(() => {
    return refImages.map((img) => ({
      id: img.id,
      name: img.name || (img.url ? img.url.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图' : '参考图'),
      _type: 'image',
    }));
  }, [refImages]);

  const btnBg = loading ? 'rgba(45,195,225,0.60)' : btnPressed ? '#28b0cc' : btnHov ? '#32cde8' : '#2DC3E1';

  return createPortal(
    <>
      {/* 点击空白关闭 */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'auto' }}
        onMouseDown={onClose}
      />
      <div
        style={{
          position: 'fixed', right: '24px', top: '60px', bottom: '24px',
          width: '600px', zIndex: 901,
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#161616',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-10px 24px 64px rgba(0,0,0,0.60)',
          animation: 'slideInRight 220ms cubic-bezier(0.22,1,0.36,1) forwards',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>生成分镜图</span>
          <ModalCloseBtn onClick={onClose} />
        </div>

        {/* 内容区：左表单 + 右预览 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 左侧表单 */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '419px', flexShrink: 0, padding: '8px 12px 80px 24px', gap: '20px', overflowY: 'auto' }}>
            <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.80)", fontFamily: FONT }}>分镜{String(shot?.number ?? 1).padStart(2, "0")}</span>

            <PanelPromptInput value={prompt} onChange={setPrompt} referenceItems={imageReferenceItems} />
            <PanelSelect label="选择模型" value={modelsLoading ? '加载中...' : (modelList.find(m => m.value === model)?.label || '请选择')} options={modelList.map(m => m.label)} onChange={(label) => {
              const selected = modelList.find(m => m.label === label);
              if (selected) setModel(selected.value);
            }} />

            {/* 参考图 — 多张 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.60)", fontFamily: FONT }}>参考图</span>
                {refCountText && <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.40)", fontFamily: FONT }}>{refCountText}</span>}
              </div>
              {canAddRef && <input ref={refFileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleRefFileChange} />}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {refImages.map((img) => (
                  <div
                    key={img.id}
                    onMouseEnter={(e) => {
                      const { clientX, clientY } = e;
                      clearTimeout(refImgHoverTimer.current);
                      refImgHoverTimer.current = setTimeout(() => {
                        if (img.url) setRefImgPreview({ url: img.url, x: clientX, y: clientY });
                      }, 500);
                    }}
                    onMouseMove={(e) => setRefImgPreview(p => p ? { ...p, x: e.clientX, y: e.clientY } : p)}
                    onMouseLeave={() => { clearTimeout(refImgHoverTimer.current); setRefImgPreview(null); }}
                    style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
                    <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      onClick={() => { clearTimeout(refImgHoverTimer.current); setRefImgPreview(null); removeRefImage(img.id); }}
                      style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                ))}
                {canAddRef && (
                <div
                  style={{
                    width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0,
                    border: '1px dashed rgba(255,255,255,0.08)',
                    backgroundColor: '#1D1E1E',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  <RefSlotBtn onClick={() => refFileRef.current?.click()}>本地上传</RefSlotBtn>
                  <RefSlotBtn onClick={() => setRefImgPickerOpen(true)}>从资产库选择</RefSlotBtn>
                </div>
                )}
              </div>
            </div>
            <AssetPickerModal accept="image" open={refImgPickerOpen} onClose={() => setRefImgPickerOpen(false)} projectId={projectId} preSelectedIds={refImages.map(img => img.assetId).filter(Boolean)} preSelectedUrls={refImages.map(img => img.url).filter(Boolean)} onConfirm={handleRefImageAssetConfirm} />

            <PanelSelect label="分辨率" value={resolution} options={availableResolutions} onChange={setResolution} />

          </div>

          {/* 右侧图片列表 */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
            <ImgUploadCard
              projectId={projectId}
              onUpload={async (file) => {
                try {
                  const isVideo = file.type.startsWith('video/');
                  const isAudio = file.type.startsWith('audio/');
                  const maxSize = isVideo ? 200 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
                  const typeLabel = isVideo ? '视频' : isAudio ? '音频' : '图片';
                 if (file.size > maxSize) { alert(`抱歉，平台暂不支持上传${maxSize / 1024 / 1024}M以上的${typeLabel}资源！`); e.target.value = ''; return; }
                 const uploadFn = isVideo ? apiUploadCreationVideo : isAudio ? apiUploadCreationAudio : apiUploadCreationImage;
                  const result = await uploadFn({ file, category: 'reference', project_id: projectId });
                  const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';
                  onSetGeneratedImages((prev) => [{ url: uploadedUrl, settled: false, id: result.asset_id || result.id || uploadedUrl }, ...prev]);
                  onSettleImage?.(uploadedUrl);
                } catch {
                  onShowToast?.('上传失败，请重试', 'error');
                }
              }}
              onAssetSelect={(assets) => {
                assets.forEach(a => {
                  const url = normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url);
                  if (url) { onSetGeneratedImages((prev) => [{ url, settled: false, id: a.id || url }, ...prev]); onSettleImage?.(url); }
                });
              }}
            />
            {generatedImages.map((img, i) => (
              <ImgItem
                key={img.id ?? img.url + i}
                imageUrl={img.url}
                settled={img.settled}
                onView={setViewImageUrl}
                onSettledChange={(newSettled) => {
                  onSetGeneratedImages((prev) =>
                    prev.map((item, idx) =>
                      idx === i ? { ...item, settled: newSettled } : { ...item, settled: newSettled ? false : item.settled }
                    )
                  );
                  if (newSettled && img.url) onSettleImage?.(img.url);
                }}
              />
            ))}
          </div>
        </div>

        {/* footer: 生成按钮 — 绝对定位于底部 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '419px',
            padding: '16px 24px',
            background: '#161616',
            borderBottomLeftRadius: '16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            onClick={loading ? undefined : handleGenerate}
            onMouseEnter={() => !loading && setBtnHov(true)}
            onMouseLeave={() => { setBtnHov(false); setBtnPressed(false); }}
            onMouseDown={() => !loading && setBtnPressed(true)}
            onMouseUp={() => setBtnPressed(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', height: '36px', borderRadius: '8px', paddingInline: '16px', gap: '4px',
              backgroundColor: btnBg,
              backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
              backgroundOrigin: 'border-box',
              border: '1px solid #FFFFFF33', outline: '1px solid #00000080',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.10s',
              flexShrink: 0,
            }}
          >
            {loading ? (
              <SpinnerIcon color="#090909" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#090909" strokeLinejoin="round" />
                <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#090909" />
                <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: FONT_MEDIUM, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {loading ? '生成中…' : '生成分镜图'}
            </span>
          </div>
        </div>
      </div>
      {viewImageUrl && <MediaViewModal url={viewImageUrl} onClose={() => setViewImageUrl(null)} />}
      {refImgPreview && createPortal(
        <MediaHoverPreview url={refImgPreview.url} isVideo={false} mouseX={refImgPreview.x} mouseY={refImgPreview.y} />,
        document.body
      )}
    </>,
    document.body
  );
}

function GenerateVideoPanel({ shot, projectId, nextShot = null, chars = [], scenes = [], props = [], onClose, onGenerate, onShowToast, onSettleVideo, generatedVideos = [], onSetGeneratedVideos }) {
  // 生成方式 Tab：'all' 全能参考 | 'frame' 首尾帧
  const [tab, setTab] = useState('all');
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [frameModels, setFrameModels] = useState([]);
  const [allModels, setAllModels] = useState([]);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'video' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        const merged = list.map((m) => {
          const modelId = m.model_id || m.id;
          return { value: modelId, label: m.name || modelId, capabilities: m.capabilities || {}, is_default: m.is_default };
        });

        // 按 reference_modes 分类模型
        const frameModes = ['first_frame', 'last_frame', 'start_end', 'multiframe'];
        const isFrameModel = (m) => {
          const refs = m.capabilities?.reference_modes || [];
          return refs.some(r => frameModes.includes(r));
        };
        const frameModels = merged.filter(isFrameModel);
        const isAllRefModel = (m) => {
          const refs = m.capabilities?.reference_modes || [];
          if (refs.length === 0) return true;
          return refs.some(r => !frameModes.includes(r));
        };
        const allModels = merged.filter(isAllRefModel);

        setModelList(merged);
        // 缓存分类列表供 Tab 切换使用
        setFrameModels(frameModels);
        setAllModels(allModels);

        // 默认选中全能参考
        if (allModels.length > 0) {
          const first = allModels.find(m => m.is_default) || allModels[0];
          setModel(first.value);
          const caps = first.capabilities;
          {
            const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
            if (resList.length > 0) setResolution(resList[0]);
          }
          {
            const durList = caps?.supported_durations;
            if (durList?.length > 0) setDuration(`${durList[0]}s`);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);
  const [duration, setDuration] = useState(null);
  const [sound, setSound] = useState(true);
  // 提示词：仅暂存在当前弹窗的本地 state，编辑不回写分镜列表字段。
  // 关闭面板时组件卸载、本地态丢弃，下次打开按 shot 当前字段重新生成初始内容。
  // 点击「生成分镜视频」时才把 prompt 随 onGenerate 传回后端。
  const [prompt, setPrompt] = useState(() => buildPromptFromShot(shot));
  const promptRef = useRef(null);
  const [refSubjects, setRefSubjects] = useState(() => {
    // 从 shot.mainRefs 初始化主体列表，补全 url/name
    if (!shot?.mainRefs?.length) return [];
    return shot.mainRefs.map(ref => {
      if (ref?.url) return ref;
      if (ref?.type && ref?.id) {
        const subjects = ref.type === 'char' ? chars : ref.type === 'scene' ? scenes : props;
        const found = subjects?.find(s => s.id === ref.id);
        if (found?.imageUrl) return { ...ref, url: normalizeImageUrl(found.imageUrl), name: found.name };
      }
      return ref;
    }).filter(ref => ref?.url);
  });
  const [refImages, setRefImages] = useState([]);
  const [refVideo, setRefVideo] = useState(null);
  const [refAudio, setRefAudio] = useState(null);
  const [refFirstFrame, setRefFirstFrame] = useState(null);
  const [refLastFrame, setRefLastFrame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [btnHov, setBtnHov] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);
  const [viewerShot, setViewerShot] = useState(null);

  // 获取当前模型支持的参数（优先从后端 capabilities 派生）
  // 当前 Tab 对应的模型列表
  const tabModels = useMemo(() => {
    return tab === 'frame' ? frameModels : allModels;
  }, [tab, frameModels, allModels]);

  const currentVideoModel = useMemo(() => tabModels.find(m => m.value === model), [model, tabModels]);
  function handleTabChange(newTab) {
    setTab(newTab);
    const newList = newTab === 'frame' ? frameModels : allModels;
    if (newList.length > 0) {
      // 如果当前模型不在新列表中，切到新列表第一个
      const inList = newList.some(m => m.value === model);
      let targetModel = model;
      if (!inList) {
        targetModel = newList[0].value;
        setModel(targetModel);
      }
      // 重置分辨率和时长
      const target = newList.find(m => m.value === targetModel);
      {
        const caps = target?.capabilities;
        const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
        if (resList.length > 0) setResolution(resList[0]);
        const durList = caps?.supported_durations;
        if (durList?.length > 0) setDuration(`${durList[0]}s`);
      }
    }
  }

  const availableResolutions = (() => {
    const caps = currentVideoModel?.capabilities || {};
    return (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
  })();

  // 时长：优先读 supported_durations（字符串数组），兼容旧的 supported_duration_range
  const availableDurations = useMemo(() => {
    const caps = currentVideoModel?.capabilities;
    // 新格式：supported_durations = ["4","5",...,"15"]
    if (caps?.supported_durations?.length > 0) {
      return caps.supported_durations.map(d => `${d}s`);
    }
    // 旧格式兜底：supported_duration_range = [4, 15]
    const range = caps?.supported_duration_range;
    if (range && range.length === 2) {
      const [min, max] = range;
      return Array.from({ length: max - min + 1 }, (_, i) => `${min + i}s`);
    }
    return [];
  }, [currentVideoModel]);

  // 当前模型的前端本地能力表
  const localVideoCaps = useMemo(() => getVideoModelCapabilities(model), [model]);
  // ── 模型能力：参考素材数量上限 ──────────────────────────────────────────────
  const videoCaps = useMemo(() => currentVideoModel?.capabilities || {}, [currentVideoModel]);
  const maxRefImages = videoCaps.max_reference_images ?? null;
  const maxRefVideos = videoCaps.max_reference_videos ?? null;
  const maxRefAudios = videoCaps.max_reference_audios ?? null;
  const showRefVideo = maxRefVideos === null || maxRefVideos > 0;
  const showRefAudio = maxRefAudios === null || maxRefAudios > 0;
  const showRefImages = maxRefImages === null || maxRefImages > 0;
  const showRefSubjects = showRefImages && (
    videoCaps.supports_reference_subjects === true ||
    (videoCaps.supported_generation_modes || []).includes('full') ||
    (videoCaps.supported_generation_modes || []).includes('reference_subjects')
  );
  const imageCount = (showRefSubjects ? refSubjects.length : 0) + refImages.length;
  const canAddImage = maxRefImages === null || imageCount < maxRefImages;
  const imageCountLabel = maxRefImages != null ? `${imageCount}/${maxRefImages}` : null;
  const videoCountLabel = maxRefVideos != null ? `${refVideo ? 1 : 0}/${maxRefVideos}` : null;
  const audioCountLabel = maxRefAudios != null ? `${refAudio ? 1 : 0}/${maxRefAudios}` : null;

  // 模型切换时保留当前分辨率/时长（若新模型支持）
  useEffect(() => {
    if (availableResolutions.length > 0) {
      if (!availableResolutions.includes(resolution)) {
        setResolution(availableResolutions[0]);
      }
    }
    // 时长：若当前时长在新模型时长列表中则保留，否则回退第一个
    if (duration && availableDurations.length > 0 && !availableDurations.includes(duration)) {
      setDuration(availableDurations[0]);
    }
  }, [model, availableResolutions]);

  const videoReferenceItems = useMemo(() => {
    const items = [];
    // 参考主体（保持原始 _type: char/scene/prop，供 MENTION_TABS 中的 "参考主体" tab 筛选）
    refSubjects.forEach(s => {
      items.push({ id: s.id, name: s.name || '参考主体', _type: s._type || s.type || 'char' });
    });
    // 参考图
    refImages.forEach(img => {
      items.push({ id: img.id, name: img.name || (img.url ? img.url.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图' : '参考图'), _type: 'image' });
    });
    // 参考视频
    if (refVideo) {
      items.push({ id: refVideo.id, name: refVideo.name || '参考视频', _type: 'video' });
    }
    // 参考音频
    if (refAudio) {
      items.push({ id: refAudio.id, name: refAudio.name || '参考音频', _type: 'audio' });
    }
    return items;
  }, [refSubjects, refImages, refVideo, refAudio]);

  async function handleRefMediaUpload(file, type = 'image') {
    try {
      const uploadFn = type === 'audio' ? apiUploadCreationAudio
                     : type === 'video' ? apiUploadCreationVideo
                     : apiUploadCreationImage;
      const result = await uploadFn({
        file,
        category: 'reference',
        project_id: projectId,
      });
      const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';

      // 不再自动插入提示词标签，标签由用户手动 @ 引入
      return { id: result.id || result.asset_id || uploadedUrl, url: uploadedUrl, name: file.name, type: file.type };
    } catch (error) {
      console.error('参考媒体上传失败:', error);
      onShowToast?.('参考图上传失败', 'error');
      throw error;
    }
  }

  async function handleGenerate() {
    if (loading) return;
    setLoading(true);
    const placeholder = `pending-${Date.now()}`;
    onSetGeneratedVideos?.((prev) => [{ url: null, settled: false, id: placeholder }, ...prev]);
    try {
      // 收集参考媒体（仅用户手动上传的参考图，不自动附带主体参考图避免误触模型限制）
      const maxRefImages = currentVideoModel?.capabilities?.max_reference_images ?? null;
      const referenceImages = (maxRefImages === null || maxRefImages > 0)
        ? [...refSubjects, ...refImages].map(r => r.url).filter(Boolean).slice(0, maxRefImages ?? 99)
        : [];
      const result = await onGenerate?.({
        model,
        resolution,
        duration,
        sound,
        prompt,
        reference_images: referenceImages.length > 0 ? referenceImages : undefined,
        first_frame_url: refFirstFrame?.url,
        last_frame_url: refLastFrame?.url,
        reference_video_url: refVideo?.url,
        reference_audio_url: refAudio?.url,
      });
      onSetGeneratedVideos?.((prev) =>
        prev.map((item) => item.id === placeholder ? { ...item, url: result?.url ?? null } : item)
      );
      onShowToast?.('视频生成成功', 'success');
    } catch (err) {
      onSetGeneratedVideos?.((prev) => prev.filter((item) => item.id !== placeholder));
      const status = err?.status;
      const msg = err?.message || '';
      if (status === 502 || status === 504 || msg.includes('fetch') || msg.includes('Network')) {
        onShowToast?.('生成服务暂时不可用，请稍后重试', 'error');
      } else if (status === 429) {
        onShowToast?.('生成请求过于频繁，请稍后再试', 'error');
      } else if (status === 401 || status === 403) {
        onShowToast?.('登录已过期，请重新登录', 'error');
      } else if (status === 422) {
        onShowToast?.('生成参数有误，请检查后重试', 'error');
      } else if (status) {
        onShowToast?.(`生成失败（${status}），请稍后重试`, 'error');
      } else {
        onShowToast?.('生成失败，请检查网络连接后重试', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  const btnBg = loading ? 'rgba(45,195,225,0.60)' : btnPressed ? '#28b0cc' : btnHov ? '#32cde8' : '#2DC3E1';

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'auto' }}
        onMouseDown={onClose}
      />
      <div
        style={{
          position: 'fixed', right: '24px', top: '60px', bottom: '24px',
          width: '600px', zIndex: 901,
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#161616',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-10px 24px 64px rgba(0,0,0,0.60)',
          animation: 'slideInRight 220ms cubic-bezier(0.22,1,0.36,1) forwards',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>生成分镜视频</span>
          <ModalCloseBtn onClick={onClose} />
        </div>

        {/* 内容区 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 左侧表单 */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '419px', flexShrink: 0, padding: '8px 12px 80px 24px', gap: '20px', overflowY: 'auto' }}>
            <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.80)", fontFamily: FONT }}>分镜{String(shot?.number ?? 1).padStart(2, "0")}</span>

            {/* Tab：全能参考 / 首尾帧 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', alignSelf: 'stretch' }}>
              <div
                onClick={() => handleTabChange('all')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <span style={{
                  fontSize: '14px', lineHeight: '18px',
                  color: tab === 'all' ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
                  fontFamily: tab === 'all' ? FONT_MEDIUM : FONT,
                  fontWeight: tab === 'all' ? 500 : 400,
                  transition: 'color 0.12s',
                }}>
                  全能参考
                </span>
                {tab === 'all' && (
                  <div style={{ height: '2px', alignSelf: 'stretch', backgroundColor: '#DDDDDD', flexShrink: 0 }} />
                )}
              </div>
              <div
                onClick={() => handleTabChange('frame')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <span style={{
                  fontSize: '14px', lineHeight: '18px',
                  color: tab === 'frame' ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
                  fontFamily: tab === 'frame' ? FONT_MEDIUM : FONT,
                  fontWeight: tab === 'frame' ? 500 : 400,
                  transition: 'color 0.12s',
                }}>
                  首尾帧
                </span>
                {tab === 'frame' && (
                  <div style={{ height: '2px', alignSelf: 'stretch', backgroundColor: '#DDDDDD', flexShrink: 0 }} />
                )}
              </div>
            </div>

            <PanelPromptInput ref={promptRef} value={prompt} onChange={setPrompt} referenceItems={videoReferenceItems} />

            <PanelSelect label="选择模型" value={modelsLoading ? '加载中...' : (tabModels.find(m => m.value === model)?.label || '请选择')} options={tabModels.map(m => m.label)} onChange={(label) => {
              const selected = tabModels.find(m => m.label === label);
              if (selected) setModel(selected.value);
            }} />

            {/* 全能参考字段 */}
            {tab === 'all' && (
              <>
                {showRefSubjects && <PanelUploadSlot projectId={projectId} label="参考主体" countLabel={imageCountLabel} accept="image/*" mediaList={refSubjects} canAddMore={canAddImage} onUpload={async (media) => {
                  if (media.id?.startsWith('blob:')) {
                    // 本地文件，需要上传
                    try {
                      const response = await fetch(media.url);
                      const blob = await response.blob();
                      const file = new File([blob], media.name, { type: media.type });
                      const uploaded = await handleRefMediaUpload(file, 'image');
                      setRefSubjects(prev => [...prev, uploaded]);
                    } catch (error) {
                      // 错误已在 handleRefMediaUpload 中处理
                    }
                  } else {
                    setRefSubjects(prev => [...prev, media]);
                  }
                }} onRemove={() => setRefSubjects([])} onRemoveItem={(idx) => setRefSubjects(prev => prev.filter((_, i) => i !== idx))} onAssetConfirm={(selectedAssets) => {
                  if (!selectedAssets?.length) return;
                  const newItems = selectedAssets.map(a => ({
                    id: a.id,
                    assetId: a.id,
                    url: normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url),
                    name: a.name || a.filename || '',
                  }));
                  setRefSubjects(prev => {
                    const merged = [...prev, ...newItems];
                    return maxRefImages != null ? merged.slice(0, maxRefImages) : merged;
                  });
                }} />}
                {showRefImages && <PanelUploadSlot projectId={projectId} label="参考图" countLabel={imageCountLabel} accept="image/*" mediaList={refImages} canAddMore={canAddImage} onUpload={async (media) => {
                  if (media.id?.startsWith('blob:')) {
                    try {
                      const response = await fetch(media.url);
                      const blob = await response.blob();
                      const file = new File([blob], media.name, { type: media.type });
                      const uploaded = await handleRefMediaUpload(file, 'image');
                      setRefImages(prev => [...prev, uploaded]);
                    } catch (error) {
                      // 错误已处理
                    }
                  } else {
                    setRefImages(prev => [...prev, media]);
                  }
                }} onRemove={() => setRefImages([])} onRemoveItem={(idx) => setRefImages(prev => prev.filter((_, i) => i !== idx))} onAssetConfirm={(selectedAssets) => {
                  if (!selectedAssets?.length) return;
                  const newItems = selectedAssets.map(a => ({
                    id: a.id,
                    assetId: a.id,
                    url: normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url),
                    name: a.name || a.filename || '',
                  }));
                  setRefImages(prev => {
                    const merged = [...prev, ...newItems];
                    return maxRefImages != null ? merged.slice(0, maxRefImages) : merged;
                  });
                }} />}
                {showRefVideo && (
                <PanelUploadSlot projectId={projectId} label="参考视频" countLabel={videoCountLabel} accept="video/mp4,video/quicktime" media={refVideo} onUpload={async (media) => {
                  if (media.id?.startsWith('blob:')) {
                    try {
                      const response = await fetch(media.url);
                      const blob = await response.blob();
                      const file = new File([blob], media.name, { type: media.type });
                      const uploaded = await handleRefMediaUpload(file, 'video');
                      setRefVideo(uploaded);
                    } catch (error) {
                      // 错误已处理
                    }
                  } else {
                    setRefVideo(media);
                  }
                }} onRemove={() => setRefVideo(null)} onAssetConfirm={(assets) => {
                  const a = assets[0];
                  if (!a) return;
                  setRefVideo({ id: a.id, url: a.fileUrl || a.url, name: a.name || '参考视频', type: 'video/mp4' });
                }} onInsert={(media) => {
                  const name = media.name || '参考视频';
                  promptRef.current?.insertMention(name, 'video');
                }} />
                )}
                {showRefAudio && (
                <PanelUploadSlot projectId={projectId} label="参考音频" countLabel={audioCountLabel} accept="audio/mpeg,audio/wav" media={refAudio} onUpload={async (media) => {
                  if (media.id?.startsWith('blob:')) {
                    try {
                      const response = await fetch(media.url);
                      const blob = await response.blob();
                      const file = new File([blob], media.name, { type: media.type });
                      const uploaded = await handleRefMediaUpload(file, 'audio');
                      setRefAudio(uploaded);
                    } catch (error) {
                      // 错误已处理
                    }
                  } else {
                    setRefAudio(media);
                  }
                }} onRemove={() => setRefAudio(null)} onAssetConfirm={(assets) => {
                  const a = assets[0];
                  if (!a) return;
                  setRefAudio({ id: a.id, url: a.fileUrl || a.url, name: a.name || '参考音频', type: 'audio/mpeg' });
                }} onInsert={(media) => {
                  const name = media.name || '参考音频';
                  promptRef.current?.insertMention(name, 'audio');
                }} />
                )}
              </>
            )}

            {/* 首尾帧字段 */}
            {tab === 'frame' && (
              <>
                <FrameUploadSlot
                  label="首帧图"
                  media={refFirstFrame}
                  onUpload={setRefFirstFrame}
                  onRemove={() => setRefFirstFrame(null)}
                  shortcutLabel="使用当前分镜图"
                  shortcutImage={shot?.storyboardImage ?? null}
                  shortcutTooltip="当前分镜尚未生成分镜图"
                  projectId={projectId}
                />
                <FrameUploadSlot
                  label="尾帧图（可选）"
                  media={refLastFrame}
                  onUpload={setRefLastFrame}
                  onRemove={() => setRefLastFrame(null)}
                  shortcutLabel="使用下一分镜图"
                  shortcutImage={nextShot?.storyboardImage ?? null}
                  shortcutTooltip="下一分镜尚未生成分镜图"
                  projectId={projectId}
                />
              </>
            )}

            <PanelSelect label="时长" value={duration} options={availableDurations.length > 0 ? availableDurations : ['5s']} onChange={setDuration} />
            <PanelSelect label="分辨率" value={resolution} options={availableResolutions} onChange={setResolution} />

            {/* 音效 toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>音效</span>
              <ModalToggle value={sound} onChange={setSound} />
            </div>

          </div>

          {/* 右侧视频列表 */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
            <VideoUploadCard
              projectId={projectId}
              onUpload={async (file) => {
                try {
                  const result = await apiUploadStoryboardVideo(projectId, shot.id, file);
                  const videoUrl = result.video_url || result.videoUrl;
                  if (videoUrl) { const nu = normalizeImageUrl(videoUrl); onSetGeneratedVideos?.((prev) => [{ url: nu, settled: false, id: result.id || nu }, ...prev]); onSettleVideo?.(nu, null); }
                } catch {
                  onShowToast?.('视频上传失败，请重试', 'error');
                }
              }}
              onAssetSelect={(assets) => {
                const newItems = assets.map(a => {
                  const url = normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.file_url || a.url);
                  return url ? { url, settled: false, id: a.id || a.asset_id || url } : null;
                }).filter(Boolean);
                onSetGeneratedVideos?.(prev => [...newItems, ...prev]);
                // 只加入列表，不自动定稿；用户点「定稿」checkbox 时才会触发 onSettleVideo
              }}
            />
            {generatedVideos.map((vid, i) => (
              <VideoItem
                key={vid.id || vid.url || i}
                videoUrl={vid.url}
                settled={vid.settled}
                onSettledChange={(newSettled) => {
                  onSetGeneratedVideos?.((prev) =>
                    prev.map((item, idx) => idx === i ? { ...item, settled: newSettled } : { ...item, settled: newSettled ? false : item.settled })
                  );
                  if (newSettled && vid.url) onSettleVideo?.(vid.url);
                }}
                onView={(url) => setViewerShot({
                  videoUrl: url,
                  filename: vid.name,
                  label: `镜头 ${String(shot?.number ?? 1).padStart(2, '0')}`,
                  prompt,
                  model,
                  resolution,
                  duration: undefined,
                  aspectRatio: '16:9',
                  finalized: vid.settled,
                })}
              />
            ))}
          </div>
        </div>

        {/* footer: 生成按钮 — 绝对定位于底部 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '419px',
            padding: '16px 24px',
            background: '#161616',
            borderBottomLeftRadius: '16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            onClick={loading ? undefined : handleGenerate}
            onMouseEnter={() => !loading && setBtnHov(true)}
            onMouseLeave={() => { setBtnHov(false); setBtnPressed(false); }}
            onMouseDown={() => !loading && setBtnPressed(true)}
            onMouseUp={() => setBtnPressed(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', height: '36px', borderRadius: '8px', paddingInline: '16px', gap: '4px',
              backgroundColor: btnBg,
              backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
              backgroundOrigin: 'border-box',
              border: '1px solid #FFFFFF33', outline: '1px solid #00000080',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.10s',
              flexShrink: 0,
            }}
          >
            {loading ? (
              <SpinnerIcon color="#090909" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12.333 2.333H3.667V13.667H12.333V2.333Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.667 3.667H1.333V12.333H3.667V3.667Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14.667 3.667H12.333V12.333H14.667V3.667Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7.333 6.667L9.333 8L7.333 9.333V6.667Z" fill="#090909" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: FONT_MEDIUM, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {loading ? '生成中…' : '生成分镜视频'}
            </span>
          </div>
        </div>
      </div>
      {viewerShot && <ShotViewerModal shot={viewerShot} onClose={() => setViewerShot(null)} />}
    </>,
    document.body
  );
}

// 视频上传占位卡
function VideoUploadCard({ onUpload, projectId, onAssetSelect }) {
  const [hovered, setHovered] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          height: '144px', borderRadius: '6px', flexShrink: 0,
          border: `1px dashed ${hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
          background: hovered ? '#222222' : '#1D1E1E',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.[0]) onUpload?.(e.target.files[0]); e.target.value = ''; }}
        />
        <ImgUploadBtn label="本地上传" onClick={() => fileInputRef.current?.click()} />
        <ImgUploadBtn label="从资产库选择" onClick={() => setAssetPickerOpen(true)} />
      </div>
      <AssetPickerModal accept="video" open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} projectId={projectId} onConfirm={(assets) => { if (onAssetSelect) onAssetSelect(assets); setAssetPickerOpen(false); }} />
    </>
  );
}

// 已生成视频卡
function VideoItem({ settled, videoUrl, onSettledChange, onView }) {
  const [hovered, setHovered] = useState(false);
  const borderColor = settled ? '#2DC3E1' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSettledChange?.(!settled)}
      style={{
        height: '144px', borderRadius: '6px', flexShrink: 0,
        border: `1px solid ${borderColor}`,
        background: '#FFFFFF14', overflow: 'clip', position: 'relative', cursor: 'pointer',
        transition: 'border-color 120ms',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {videoUrl
          ? <video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
          : <DotsLoading size={4} color="#2DC3E1" gap={3} />
        }
      </div>
      {/* 顶部定稿 checkbox */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Checkbox checked={settled} onChange={(e) => { e.stopPropagation(); onSettledChange?.(!settled); }} />
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF' , fontWeight: settled ? 600 : 500 }}>定稿</span>
      </div>
      {/* 底部悬停按钮 */}
      {hovered && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          {videoUrl && (
            <ImgIconBtn onClick={(e) => { e.stopPropagation(); onView?.(videoUrl); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ImgIconBtn>
          )}
          <ImgIconBtn onClick={(e) => { e.stopPropagation(); if (videoUrl) { const a = document.createElement("a"); a.href = videoUrl; a.download = videoUrl.split("/").pop() || "video.mp4"; a.click(); } }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ImgIconBtn>
        </div>
      )}
    </div>
  );
}

// ─── SVG 图标 ─────────────────────────────────────────────────────────────────

const IconBatchImage = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFF" strokeLinejoin="round" />
    <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFF" />
    <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconBatchVideo = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M12.333 2.333H3.667V13.667H12.333V2.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.667 3.667H1.333V12.333H3.667V3.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14.667 3.667H12.333V12.333H14.667V3.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.333 6.667L9.333 8L7.333 9.333V6.667Z" fill="#FFFFFF" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M8.003 11.3V2" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 14H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M14.333 5.667V3H11.333M14.333 5.667V10.333M14.333 5.667H11.333M11.333 3V5.667M11.333 3H10M14.333 10.333V13H11.333M14.333 10.333H11.333M11.333 5.667H10M1.667 5.667V3H4.667M1.667 5.667V10.333M1.667 5.667H4.667M4.667 3V5.667M4.667 3H6M1.667 10.333V13H4.667M1.667 10.333H4.667M4.667 5.667H6M4.667 13V10.333M4.667 13H6M4.667 10.333H6M11.333 13V10.333M11.333 13H10M11.333 10.333H10" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 2.333V3.667" stroke="#090909" strokeLinecap="round" />
    <path d="M8 5.667V7" stroke="#090909" strokeLinecap="round" />
    <path d="M8 9V10.333" stroke="#090909" strokeLinecap="round" />
    <path d="M8 12.333V13.667" stroke="#090909" strokeLinecap="round" />
  </svg>
);

const IconDrag = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path fillRule="evenodd" clipRule="evenodd" d="M6.333 3.333C6.333 4.07 5.736 4.667 5 4.667C4.264 4.667 3.667 4.07 3.667 3.333C3.667 2.597 4.264 2 5 2C5.736 2 6.333 2.597 6.333 3.333ZM5 9.333C5.736 9.333 6.333 8.736 6.333 8C6.333 7.264 5.736 6.667 5 6.667C4.264 6.667 3.667 7.264 3.667 8C3.667 8.736 4.264 9.333 5 9.333ZM5 14C5.736 14 6.333 13.403 6.333 12.667C6.333 11.93 5.736 11.333 5 11.333C4.264 11.333 3.667 11.93 3.667 12.667C3.667 13.403 4.264 14 5 14Z" fill="#FFFFFF"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M12.333 3.333C12.333 4.07 11.736 4.667 11 4.667C10.264 4.667 9.667 4.07 9.667 3.333C9.667 2.597 10.264 2 11 2C11.736 2 12.333 2.597 12.333 3.333ZM11 9.333C11.736 9.333 12.333 8.736 12.333 8C12.333 7.264 11.736 6.667 11 6.667C10.264 6.667 9.667 7.264 9.667 8C9.667 8.736 10.264 9.333 11 9.333ZM11 14C11.736 14 12.333 13.403 12.333 12.667C12.333 11.93 11.736 11.333 11 11.333C10.264 11.333 9.667 11.93 9.667 12.667C9.667 13.403 10.264 14 11 14Z" fill="#FFFFFF"/>
  </svg>
);

const IconAdd = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 10.667V5.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 9V7" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 9V7" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.667 2H2.667C2.298 2 2 2.298 2 2.667V4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11.333 2H13.333C13.702 2 14 2.298 14 2.667V4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11.333 14H13.333C13.702 14 14 13.702 14 13.333V11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.667 14H2.667C2.298 14 2 13.702 2 13.333V11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 2H7" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10.667 8H5.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 14H7" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4.333 4.144V2.604C4.333 2.086 4.753 1.667 5.271 1.667H13.396C13.914 1.667 14.333 2.086 14.333 2.604V10.729C14.333 11.247 13.914 11.667 13.396 11.667H11.839" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10.729 4.333H2.604C2.086 4.333 1.667 4.753 1.667 5.271V13.396C1.667 13.914 2.086 14.333 2.604 14.333H10.729C11.247 14.333 11.667 13.914 11.667 13.396V5.271C11.667 4.753 11.247 4.333 10.729 4.333Z" stroke="#FFFFFF" strokeLinejoin="round"/>
  </svg>
);

const IconDelete = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF" strokeLinejoin="round"/>
    <path d="M6.667 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.333 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1.333 3.333H14.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF" strokeLinejoin="round"/>
  </svg>
);

const IconPlus = ({ color = '#FFFFFF40' }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 2V12M2 7H12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 4L12 12M12 4L4 12" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const IconImagePlaceholder = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="10" rx="2" stroke="#848484" strokeWidth="1.2"/>
    <circle cx="5.5" cy="6.5" r="1.5" stroke="#848484" strokeWidth="1.2"/>
    <path d="M2 11L5 8L7.5 10.5L10 8L14 11" stroke="#848484" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconVideoPlaceholder = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="9" height="10" rx="2" stroke="#848484" strokeWidth="1.2"/>
    <path d="M11 6.5L14 5V11L11 9.5V6.5Z" stroke="#848484" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);

// ─── 删除确认弹窗 ─────────────────────────────────────────────────────────────
// DeleteConfirmModal 已迁移至 ConfirmDialog 共享组件（接受 description 参数渲染镜头编号）

// ─── 参数下拉选择器 ───────────────────────────────────────────────────────────

const PARAM_OPTIONS = {
  framing: ['全景', '中景', '近景', '特写'],
  cameraMotion: ['固定机位', '跟拍镜头', '环绕镜头', '缓推镜头', '缓拉镜头', '左摇镜头', '右摇镜头', '左移镜头', '右移镜头', '上升镜头', '下降镜头'],
  angle: ['平视拍摄', '仰视拍摄', '俯视拍摄', '左侧45度拍摄', '右侧45度拍摄', '正面视角拍摄', '背面视角拍摄', '侧面视角拍摄', '过肩镜头拍摄', '主观镜头拍摄'],
  composition: ['三分法构图', '中心构图', '前景构图', '对角线构图', '对称构图', '框架构图', '三角形构图', '留白构图', '引导线构图'],
  duration: Array.from({ length: 13 }, (_, i) => `${i + 3}s`),
};

const PARAM_LABELS = {
  framing: '景别',
  cameraMotion: '运镜',
  angle: '拍摄角度',
  composition: '构图',
  duration: '时长',
};

function ParamSelect({ field, value, onChange, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, visibility: 'hidden' });

  // Runs after every render so ref.current.offsetHeight is available
  useEffect(() => {
    if (!triggerRef?.current || !ref.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuH = ref.current.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuH + 4 ? rect.bottom + 4 : rect.top - menuH - 4;
    setPos((prev) => {
      if (prev.top === top && prev.left === rect.left && prev.visibility === 'visible') return prev;
      return { top, left: rect.left, visibility: 'visible' };
    });
  });

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target) && triggerRef?.current && !triggerRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, triggerRef]);

  return createPortal(
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        visibility: pos.visibility,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.40)',
        minWidth: '100px',
      }}
    >
      {(PARAM_OPTIONS[field] || []).map((opt) => (
        <div
          key={opt}
          onMouseDown={(e) => { e.preventDefault(); onChange(opt); onClose(); }}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: '18px',
            color: opt === value ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
            backgroundColor: opt === value ? '#161616' : 'transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          }}
          onMouseEnter={(e) => { if (opt !== value) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { if (opt !== value) e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {opt}
        </div>
      ))}
    </div>,
    document.body
  );
}

// ─── 可编辑文本 ───────────────────────────────────────────────────────────────

function EditableText({ value, onChange, placeholder = '点击编辑…', style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const taRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  function activate() { setEditing(true); setDraft(value); }

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  if (editing) {
    return (
      <textarea
        ref={taRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setDraft(value); } }}
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          resize: 'none',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(45,195,225,0.60)',
          borderRadius: '4px',
          padding: '4px 6px',
          fontSize: '14px',
          lineHeight: '20px',
          color: 'rgba(255,255,255,0.60)',
          outline: 'none',
          fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          boxSizing: 'border-box',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      onClick={activate}
      style={{
        flex: 1,
        minHeight: 0,
        fontSize: '14px',
        lineHeight: '20px',
        color: value ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.30)',
        cursor: 'text',
        wordBreak: 'break-all',
        overflowY: 'auto',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        ...style,
      }}
    >
      {value || placeholder}
    </div>
  );
}

// ─── 角色 @ 下拉 ──────────────────────────────────────────────────────────────

function CharMentionDropdown({ chars, query, onSelect, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, visibility: 'hidden' });
  const filtered = chars.filter((c) => c.name.includes(query));

  // Position above the textarea after every render
  useEffect(() => {
    if (!triggerRef?.current || !ref.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuH = ref.current.offsetHeight;
    setPos((prev) => {
      const next = { top: rect.top - menuH - 4, left: rect.left, width: rect.width, visibility: 'visible' };
      if (prev.top === next.top && prev.left === next.left && prev.visibility === 'visible') return prev;
      return next;
    });
  });

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        minWidth: Math.max(pos.width, 120),
        visibility: pos.visibility,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.40)',
        maxHeight: '160px',
        overflowY: 'auto',
      }}
    >
      {filtered.map((c) => (
        <div
          key={c.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(c.name); }}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: '18px',
            color: 'rgba(255,255,255,0.60)',
            cursor: 'pointer',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {c.name}
        </div>
      ))}
    </div>,
    document.body
  );
}

// ─── 主体 @ 下拉（角色/场景/道具，用于提示词输入框）─────────────────────────────

const MENTION_TYPE_LABEL = {
  char: '角色', scene: '场景', prop: '道具',
  image: '参考图', video: '参考视频', audio: '参考音频',
};
const MENTION_TYPE_COLOR = {
  char: '#E2E24B', scene: '#4BE2C3', prop: '#4B9EE2',
  image: '#E8A1FF', video: '#FF8A65', audio: '#66BB6A',
};
const MENTION_TABS = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '参考图' },
  { key: 'char', label: '参考主体' },
  { key: 'video', label: '参考视频' },
  { key: 'audio', label: '参考音频' },
];

function ReferenceMentionDropdown({ referenceItems = [], query, onSelect, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, visibility: 'hidden' });
  const [selectedTab, setSelectedTab] = useState('all');

  const allItems = referenceItems.filter((item) => {
    return item.name && item.name.includes(query);
  });

  useEffect(() => {
    if (!triggerRef?.current || !ref.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuH = ref.current.offsetHeight;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = rect.bottom + 4;
    setPos((prev) => {
      const next = { top, left: rect.left, width: rect.width, visibility: 'visible' };
      if (prev.top === next.top && prev.left === next.left && prev.visibility === 'visible') return prev;
      return next;
    });
  });

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filteredItems = selectedTab === 'all'
    ? allItems
    : selectedTab === 'char'
      ? allItems.filter(item => ['char', 'scene', 'prop'].includes(item._type))
      : allItems.filter(item => item._type === selectedTab);

  // 只显示当前有匹配项的 tab
  const visibleTabs = MENTION_TABS.filter(tab => {
    if (tab.key === 'all') return true;
    if (tab.key === 'char') return allItems.some(item => ['char', 'scene', 'prop'].includes(item._type));
    return allItems.some(item => item._type === tab.key);
  });

  if (filteredItems.length === 0) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        minWidth: Math.max(pos.width, 160),
        visibility: pos.visibility,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.40)',
        maxHeight: '240px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', gap: '2px', padding: '2px 4px 6px', flexShrink: 0 }}>
        {visibleTabs.map(tab => (
          <div
            key={tab.key}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSelectedTab(tab.key)}
            style={{
              padding: '3px 8px', borderRadius: '4px', fontSize: '12px', lineHeight: '16px',
              cursor: 'pointer', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
              color: selectedTab === tab.key ? '#FFFFFF' : 'rgba(255,255,255,0.50)',
              backgroundColor: selectedTab === tab.key ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition: 'background-color 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => { if (selectedTab !== tab.key) e.currentTarget.style.color = 'rgba(255,255,255,0.80)'; }}
            onMouseLeave={(e) => { if (selectedTab !== tab.key) e.currentTarget.style.color = 'rgba(255,255,255,0.50)'; }}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '180px' }}>
      {filteredItems.map((item) => (
        <div
          key={`${item._type}-${item.id}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item.name, item._type);
          }}
          style={{
            padding: '7px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: '18px',
            color: 'rgba(255,255,255,0.60)',
            cursor: 'pointer',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <span style={{
            fontSize: '11px',
            lineHeight: '16px',
            padding: '0 5px',
            borderRadius: '3px',
            backgroundColor: `${MENTION_TYPE_COLOR[item._type] ?? MENTION_TYPE_COLOR.char}22`,
            color: MENTION_TYPE_COLOR[item._type] ?? MENTION_TYPE_COLOR.char,
            flexShrink: 0,
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          }}>
            {MENTION_TYPE_LABEL[item._type] || '其他'}
          </span>
          {item.name}
        </div>
      ))}
      </div>
    </div>,
    document.body
  );
}

// ─── 主体 Tag（提示词展示用）─────────────────────────────────────────────────────

function SubjectTag({ name, type }) {
  const color = MENTION_TYPE_COLOR[type] ?? '#E2E24B';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        paddingInline: '4px',
        borderRadius: '4px',
        fontSize: '14px',
        lineHeight: '21px',
        backgroundColor: `${color}26`,
        color,
        boxShadow: `inset 0 0 0 1px ${color}33`,
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    >
      @{name}
    </span>
  );
}

// ─── 角色替换下拉（点击 label 后弹出）────────────────────────────────────────

function CharReplaceDropdown({ chars, current, onSelect, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, visibility: 'hidden' });

  useEffect(() => {
    if (!triggerRef?.current || !ref.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuH = ref.current.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuH + 4 ? rect.bottom + 4 : rect.top - menuH - 4;
    setPos((prev) => {
      const next = { top, left: rect.left, visibility: 'visible' };
      if (prev.top === next.top && prev.left === next.left && prev.visibility === 'visible') return prev;
      return next;
    });
  });

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target) && triggerRef?.current && !triggerRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, triggerRef]);

  if (chars.length === 0) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        visibility: pos.visibility,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.40)',
        minWidth: '100px',
        maxHeight: '160px',
        overflowY: 'auto',
      }}
    >
      {chars.map((c) => (
        <div
          key={c.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(c.name); }}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: '18px',
            color: c.name === current ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
            backgroundColor: c.name === current ? 'rgba(255,255,255,0.08)' : 'transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          }}
          onMouseEnter={(e) => { if (c.name !== current) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { if (c.name !== current) e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {c.name}
        </div>
      ))}
    </div>,
    document.body
  );
}

// ─── 角色 Tag ─────────────────────────────────────────────────────────────────

function CharTag({ name, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        paddingInline: '4px',
        borderRadius: '4px',
        fontSize: '14px',
        lineHeight: '18px',
        backgroundColor: hov ? 'rgba(226,226,75,0.25)' : 'rgba(226,226,75,0.15)',
        color: '#E2E24B',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.12s',
      }}
    >
      {name}
    </span>
  );
}

// ─── 通用虚线添加格 ───────────────────────────────────────────────────────────

function AddSlotBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : hov ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px dashed ${hov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}`,
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.12s, border-color 0.12s',
      }}
    >
      <IconPlus color={hov ? 'rgba(255,255,255,0.70)' : undefined} />
    </div>
  );
}

// ─── 旁白配音弹窗 ─────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.9,2.0];

function VoiceDubModal({ open, onClose, chars = [], initialData = {}, onSaveGlobal, onSaveCurrent }) {
  const [role, setRole] = useState(initialData.role ?? '旁白');
  const [speed, setSpeed] = useState(initialData.speed ?? 1.0);
  const [volume, setVolume] = useState(initialData.volume ?? 70);
  const [lines, setLines] = useState(initialData.lines ?? '');
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleHov, setRoleHov] = useState(null);
  const roleDropdownRef = useRef(null);
  const [closeBtnHov, setCloseBtnHov] = useState(false);
  const [globalBtnHov, setGlobalBtnHov] = useState(false);
  const [globalBtnPress, setGlobalBtnPress] = useState(false);
  const [saveBtnHov, setSaveBtnHov] = useState(false);
  const [saveBtnPress, setSaveBtnPress] = useState(false);
  const [textareaFocus, setTextareaFocus] = useState(false);
  const volTrackRef = useRef(null);
  const draggingVol = useRef(false);
  const speedTrackRef = useRef(null);
  const draggingSpeed = useRef(false);

  useEffect(() => {
    if (open) {
      setRole(initialData.role ?? '旁白');
      setSpeed(initialData.speed ?? 1.0);
      setVolume(initialData.volume ?? 70);
      setLines(initialData.lines ?? '');
      setRoleOpen(false);
      setGlobalBtnHov(false);
      setGlobalBtnPress(false);
      setSaveBtnHov(false);
      setSaveBtnPress(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function calcSpeedFromX(clientX) {
    const track = speedTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const idx = Math.round(pct * (SPEED_OPTIONS.length - 1));
    setSpeed(SPEED_OPTIONS[idx]);
  }

  function calcVolFromX(clientX) {
    const track = volTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 100)));
    setVolume(pct);
  }

  useEffect(() => {
    if (!open) return;
    function onMove(e) {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      if (draggingVol.current) calcVolFromX(x);
      if (draggingSpeed.current) calcSpeedFromX(x);
    }
    function onUp() { draggingVol.current = false; draggingSpeed.current = false; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 点击下拉框外部时收起
  useEffect(() => {
    if (!roleOpen) return;
    function onDown(e) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setRoleOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [roleOpen]);

  if (!open) return null;

  // 语速 thumb 位置：基于 SPEED_OPTIONS 索引精确对齐
  const speedIdx = SPEED_OPTIONS.indexOf(speed);
  const speedPct = speedIdx >= 0 ? (speedIdx / (SPEED_OPTIONS.length - 1)) * 100 : ((speed - 0.5) / 1.5) * 100;

  // 坐标轴刻度：0.5 / 0.875 / 1.25 / 1.625 / 2.0 → 均匀 5 点
  const SPEED_TICKS = [
    { label: '0.5×', pct: 0 },
    { label: '1.0×', pct: ((1.0 - 0.5) / 1.5) * 100 },
    { label: '1.5×', pct: ((1.5 - 0.5) / 1.5) * 100 },
    { label: '2.0×', pct: 100 },
  ];

  const labelStyle = { fontSize: '13px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT };
  const fieldWrap = { display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' };
  const inputBoxBase = { display: 'flex', alignItems: 'center', height: '36px', width: '100%', borderRadius: '8px', padding: '0 12px', gap: '8px', boxSizing: 'border-box', backgroundColor: '#1D1E1E', outline: '1px solid rgba(0,0,0,0.5)', position: 'relative' };

  // 按钮外层（渐变边框壳）— hover 时边框加强，press 时整体降透明度
  const btnShell = (hov, press) => ({
    display: 'flex', flexDirection: 'column', height: '36px', flexShrink: 0,
    borderRadius: '8px', padding: '1px',
    boxShadow: '3px 3px 8px rgba(0,0,0,0.4)',
    backgroundImage: hov
      ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)'
      : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
    outline: '1px solid rgba(0,0,0,0.5)',
    opacity: press ? 0.75 : 1,
    cursor: 'pointer',
    transition: 'opacity 0.08s',
  });
  // 按钮内层
  const btnInner = () => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexGrow: 1, flexShrink: 1, flexBasis: '0%',
    borderRadius: '7px', paddingInline: '15px', gap: '4px',
    backgroundColor: '#161616',
  });

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '400px', borderRadius: '16px', overflow: 'visible', display: 'flex', flexDirection: 'column', background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', background: '#161616', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>台词分配</span>
          <button type="button" onClick={onClose}
            onMouseEnter={() => setCloseBtnHov(true)} onMouseLeave={() => setCloseBtnHov(false)}
            style={{ background: closeBtnHov ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', transition: 'background 0.1s' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke={closeBtnHov ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px', background: '#161616' }}>

          {/* 配音角色 */}
          <div style={fieldWrap}>
            <span style={labelStyle}>配音角色</span>
            <div ref={roleDropdownRef} style={{ ...inputBoxBase, border: `1px solid ${roleOpen ? 'rgba(45,195,225,0.6)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}
              onClick={() => setRoleOpen((v) => !v)}>
              <span style={{ flex: 1, fontSize: '14px', lineHeight: '18px', color: role ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.25)', fontFamily: FONT }}>{role || '请选择角色'}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: roleOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}><path d="M4 6l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {roleOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', zIndex: 20, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                  onClick={(e) => e.stopPropagation()}>
                  {/* 置顶固定选项：旁白 */}
                  <div
                    onMouseEnter={() => setRoleHov('旁白')} onMouseLeave={() => setRoleHov(null)}
                    onClick={() => { setRole('旁白'); setRoleOpen(false); }}
                    style={{ padding: '9px 12px', fontSize: '14px', lineHeight: '18px', color: role === '旁白' ? '#2DC3E1' : 'rgba(255,255,255,0.80)', fontFamily: FONT, cursor: 'pointer', background: role === '旁白' ? 'rgba(45,195,225,0.08)' : roleHov === '旁白' ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.1s' }}>
                    旁白
                  </div>
                  {chars.length === 0 && (
                    <div style={{ padding: '10px 12px', fontSize: '13px', color: 'rgba(255,255,255,0.30)', fontFamily: FONT }}>暂无角色</div>
                  )}
                  {chars.map((c) => (
                    <div key={c.id ?? c.name}
                      onMouseEnter={() => setRoleHov(c.name)} onMouseLeave={() => setRoleHov(null)}
                      onClick={() => { setRole(c.name); setRoleOpen(false); }}
                      style={{ padding: '9px 12px', fontSize: '14px', lineHeight: '18px', color: c.name === role ? '#2DC3E1' : 'rgba(255,255,255,0.80)', fontFamily: FONT, cursor: 'pointer', background: c.name === role ? 'rgba(45,195,225,0.08)' : roleHov === c.name ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.1s' }}>
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 语速 */}
          <div style={fieldWrap}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={labelStyle}>语速</span>
              <span style={{ fontSize: '12px', lineHeight: '18px', color: '#2DC3E1', fontFamily: FONT }}>{speed.toFixed(1)}×</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', borderRadius: '8px', padding: '10px 12px', boxSizing: 'border-box', backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid rgba(0,0,0,0.5)' }}>
              {/* track 区域，左右各留 7px 让 thumb 不超出 */}
              <div ref={speedTrackRef} style={{ position: 'relative', height: '14px', margin: '0 7px', cursor: 'pointer' }}
                onMouseDown={(e) => { e.preventDefault(); draggingSpeed.current = true; calcSpeedFromX(e.clientX); }}>
                {/* 底轨 */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.10)' }} />
                {/* 已填充 */}
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: '3px', borderRadius: '2px', background: '#2DC3E1', width: `${speedPct}%` }} />
                {/* thumb */}
                <div style={{ position: 'absolute', left: `${speedPct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 0 0 2px #2DC3E1, 0 2px 6px rgba(0,0,0,0.4)', zIndex: 1, pointerEvents: 'none' }} />
              </div>
              {/* 刻度轴：相对于 track 区域（含 7px 边距）精确对齐 */}
              <div style={{ position: 'relative', height: '16px', margin: '0 7px' }}>
                {SPEED_TICKS.map(({ label, pct }) => (
                  <span key={label} style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', fontSize: '11px', lineHeight: '16px', color: 'rgba(255,255,255,0.25)', fontFamily: FONT, whiteSpace: 'nowrap' }}>{label}</span>
                ))}
              </div>
            </div>
          </div>

          {/* 音量 */}
          <div style={fieldWrap}>
            <span style={labelStyle}>音量</span>
            <div style={{ ...inputBoxBase, border: '1px solid rgba(255,255,255,0.08)', cursor: 'default', userSelect: 'none' }}>
              <div
                ref={volTrackRef}
                style={{ flex: 1, height: '20px', display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer' }}
                onMouseDown={(e) => { e.preventDefault(); draggingVol.current = true; calcVolFromX(e.clientX); }}>
                {/* 底轨 */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                {/* 填充段 */}
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: '4px', borderRadius: '2px', background: '#2DC3E1', width: `${volume}%`, pointerEvents: 'none' }} />
                {/* thumb */}
                <div style={{ position: 'absolute', left: `${volume}%`, top: '50%', transform: 'translate(-50%,-50%)', width: '12px', height: '12px', borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 0 0 2px #2DC3E1, 0 2px 6px rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, flexShrink: 0, minWidth: '30px', textAlign: 'right' }}>{volume}%</span>
            </div>
          </div>

          {/* 台词 */}
          <div style={fieldWrap}>
            <span style={labelStyle}>台词</span>
            <textarea
              value={lines}
              onChange={(e) => setLines(e.target.value)}
              onFocus={() => setTextareaFocus(true)}
              onBlur={() => setTextareaFocus(false)}
              placeholder="输入台词内容…"
              style={{ width: '100%', minHeight: '100px', borderRadius: '8px', padding: '10px 12px', boxSizing: 'border-box', background: '#1D1E1E', border: `1px solid ${textareaFocus ? 'rgba(45,195,225,0.6)' : 'rgba(255,255,255,0.08)'}`, outline: '1px solid rgba(0,0,0,0.5)', resize: 'vertical', fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, caretColor: 'rgba(255,255,255,0.80)', transition: 'border-color 0.1s' }}
              className="placeholder:text-[rgba(255,255,255,0.25)]"
            />
          </div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', background: '#161616' }}>
          {/* 全局应用 */}
          <div role="button" style={{ position: 'relative' }}
            onMouseEnter={() => setGlobalBtnHov(true)} onMouseLeave={() => { setGlobalBtnHov(false); setGlobalBtnPress(false); }}
            onMouseDown={() => setGlobalBtnPress(true)} onMouseUp={() => setGlobalBtnPress(false)}
            onClick={() => { onSaveGlobal?.({ role, speed, volume, lines }); onClose(); }}>
            <div style={btnShell(globalBtnHov, globalBtnPress)}>
              <div style={btnInner()}>
                <span style={{ fontSize: '13px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, whiteSpace: 'nowrap' }}>全局应用</span>
              </div>
            </div>
            {globalBtnHov && !globalBtnPress && (
              <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '6px 10px', whiteSpace: 'nowrap', fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.70)', fontFamily: FONT, pointerEvents: 'none', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                把该角色的语速和音量应用到全局
              </div>
            )}
          </div>
          {/* 保存到当前分镜 */}
          <div role="button" style={{ position: 'relative' }}
            onMouseEnter={() => setSaveBtnHov(true)} onMouseLeave={() => { setSaveBtnHov(false); setSaveBtnPress(false); }}
            onMouseDown={() => setSaveBtnPress(true)} onMouseUp={() => setSaveBtnPress(false)}
            onClick={() => { onSaveCurrent?.({ role, speed, volume, lines }); onClose(); }}>
            <div style={btnShell(saveBtnHov, saveBtnPress)}>
              <div style={btnInner()}>
                <span style={{ fontSize: '13px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, whiteSpace: 'nowrap' }}>保存到当前分镜</span>
              </div>
            </div>
            {saveBtnHov && !saveBtnPress && (
              <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '6px 10px', whiteSpace: 'nowrap', fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.70)', fontFamily: FONT, pointerEvents: 'none', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                仅在当前分镜使用该角色的语速和音量
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── 旁白配音列 ───────────────────────────────────────────────────────────────

function NarrationItem({ item, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [closeBtnPos, setCloseBtnPos] = useState(null);
  const labelRef = useRef(null);

  function handleMouseEnter() {
    setHovered(true);
    if (labelRef.current) {
      const r = labelRef.current.getBoundingClientRect();
      setCloseBtnPos({ top: r.top - 4, left: r.right - 10 });
    }
  }

  function handleMouseLeave() {
    setHovered(false);
    setCloseBtnPos(null);
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}
      onClick={onEdit}
    >
      {item.role && (
        <span ref={labelRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {item.role === '旁白'
            ? <span style={{ display: 'inline-flex', alignItems: 'center', paddingInline: '4px', paddingBlock: '0px', borderRadius: '6px', boxShadow: 'inset 0 0 0 1px #FFFFFF14', background: '#8870FF1A', fontFamily: '"AlibabaPuHuiTi 2 55 Regular","Alibaba PuHuiTi 2.0",system-ui,sans-serif', color: '#E8A1FF', fontSize: '14px', lineHeight: '18px', flexShrink: 0 }}>旁白</span>
            : <CharTag name={item.role} />
          }
        </span>
      )}
      {item.lines && (
        <span style={{ fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, wordBreak: 'break-all' }}>
          {item.role ? ' ' : ''}{item.lines}
        </span>
      )}
      {hovered && closeBtnPos && createPortal(
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ position: 'fixed', top: closeBtnPos.top, left: closeBtnPos.left, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(60,60,60,0.95)', border: '1px solid rgba(255,255,255,0.20)', cursor: 'pointer', padding: 0, zIndex: 9999 }}
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
            <path d="M6 2L2 6M2 2l4 4" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>,
        document.body
      )}
    </div>
  );
}

function AddNarrationBtn({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const btnRef = useRef(null);

  function handleMouseEnter() {
    setHovered(true);
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTooltipPos({ x: r.left + r.width / 2, y: r.top });
    }
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { setHovered(false); setTooltipPos(null); }}
        style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hovered ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '4px', cursor: 'pointer', padding: 0, transition: 'background 100ms' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 2v6M2 5h6" stroke="rgba(255,255,255,0.60)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {hovered && tooltipPos && createPortal(
        <div style={{ position: 'fixed', left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, calc(-100% - 6px))', whiteSpace: 'nowrap', background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, pointerEvents: 'none', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          新增角色台词
        </div>,
        document.body
      )}
    </div>
  );
}

function NarrationCol({ segments, onChange, chars, globalVoiceParams = {}, onSaveGlobalVoice }) {
  // dubList: 多条角色+台词记录，每条 { role, speed, volume, lines }
  const [dubList, setDubList] = useState(null);
  // editingIdx: null=新增, number=编辑第几条
  const [editingIdx, setEditingIdx] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 初始化：从 segments 同步记录
  useEffect(() => {
    if (dubList === null && segments.length > 0) {
      const validSegments = segments.filter((s) => s?.lines?.trim());
      if (validSegments.length > 0) {
        const list = validSegments.map((seg) => {
          const globalForRole = seg.role ? (globalVoiceParams[seg.role] ?? {}) : {};
          return {
            role: seg.role ?? '',
            speed: globalForRole.speed ?? 1.0,
            volume: globalForRole.volume ?? 70,
            lines: seg.lines ?? '',
          };
        });
        setDubList(list);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = dubList ?? [];
  const hasContent = list.length > 0;

  function mergeWithGlobal(data) {
    const globalForRole = data?.role ? (globalVoiceParams[data.role] ?? {}) : {};
    return {
      speed: data?.speed ?? globalForRole.speed ?? 1.0,
      volume: data?.volume ?? globalForRole.volume ?? 70,
      role: data?.role ?? '',
      lines: data?.lines ?? '',
    };
  }

  function openAdd() {
    setEditingIdx(null);
    setModalOpen(true);
  }

  function openEdit(idx) {
    setEditingIdx(idx);
    setModalOpen(true);
  }

  function buildNext(data, usesGlobal = false) {
    const next = list.length > 0 ? [...list] : [];
    const entry = usesGlobal ? { ...data, _usesGlobal: true } : data;
    if (editingIdx === null) {
      next.push(entry);
    } else {
      next[editingIdx] = entry;
    }
    return next;
  }

  function handleSaveCurrent(data) {
    const next = buildNext(data);
    setDubList(next);
    onChange(next.map((d) => ({ role: d.role, lines: d.lines })));
    setModalOpen(false);
  }

  function handleSaveGlobal(data) {
    const next = buildNext(data, true);
    setDubList(next);
    onChange(next.map((d) => ({ role: d.role, lines: d.lines })));
    if (data.role) {
      onSaveGlobalVoice?.(data.role, { speed: data.speed, volume: data.volume });
    }
    setModalOpen(false);
  }

  function handleDelete(idx) {
    const next = list.filter((_, i) => i !== idx);
    setDubList(next.length > 0 ? next : null);
    onChange(next.map((d) => ({ role: d.role, lines: d.lines })));
  }

  const modalInitialData = editingIdx !== null && list[editingIdx]
    ? mergeWithGlobal(list[editingIdx])
    : { role: '', speed: 1.0, volume: 70, lines: '' };

  return (
    <div style={{
      width: 'calc(10% - 1px)',
      minWidth: '120px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      alignSelf: 'stretch',
    }}>
      {/* 标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>台词分配</span>
        {hasContent && (
          <AddNarrationBtn onClick={openAdd} />
        )}
      </div>

      {/* 内容区 */}
      {!hasContent ? (
        <AddSlotBtn onClick={openAdd} />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          {list.map((item, idx) => (
            <NarrationItem
              key={idx}
              item={item}
              onEdit={() => openEdit(idx)}
              onDelete={() => handleDelete(idx)}
            />
          ))}
        </div>
      )}

      <VoiceDubModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        chars={chars}
        initialData={modalInitialData}
        onSaveCurrent={handleSaveCurrent}
        onSaveGlobal={handleSaveGlobal}
      />
    </div>
  );
}

// ─── (旧版内联编辑已废弃，保留以备参考) ─────────────────────────────────────

// ─── 主体参考列 ───────────────────────────────────────────────────────────────

function AddSlotDropdown({ anchorRef, onUpload, onAssetPicker, onClose }) {
  const menuRef = useRef(null);
  const [hovIdx, setHovIdx] = useState(null);

  useEffect(() => {
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose, anchorRef]);

  const items = [
    { label: '本地上传', action: onUpload },
    { label: '从资产库选择', action: onAssetPicker },
  ];

  const anchor = anchorRef.current?.getBoundingClientRect();
  if (!anchor) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: anchor.bottom + 4,
        left: anchor.left,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.50)',
        minWidth: '120px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onMouseEnter={() => setHovIdx(i)}
          onMouseLeave={() => setHovIdx(null)}
          onMouseDown={(e) => { e.preventDefault(); item.action(); onClose(); }}
          style={{
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            paddingInline: '10px',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: hovIdx === i ? 'rgba(255,255,255,0.08)' : 'transparent',
            fontSize: '13px',
            color: hovIdx === i ? '#FFFFFF' : 'rgba(255,255,255,0.70)',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            whiteSpace: 'nowrap',
            transition: 'background-color 0.10s, color 0.10s',
          }}
        >
          {item.label}
        </div>
      ))}
    </div>,
    document.body
  );
}

function MainRefCol({ shot, onChange, chars, projectId }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef(null);
  const addBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  function handleImgMouseEnter(e, img) {
    const { clientX, clientY } = e;
    setMousePos({ x: clientX, y: clientY });
    hoverTimerRef.current = setTimeout(() => {
      if (img?.url) setPreviewImg(img.url);
    }, 500);
  }

  function handleImgMouseMove(e) {
    setMousePos({ x: e.clientX, y: e.clientY });
  }

  function handleImgMouseLeave() {
    clearTimeout(hoverTimerRef.current);
    setPreviewImg(null);
  }

  function handleDelete(idx) {
    clearTimeout(hoverTimerRef.current);
    setPreviewImg(null);
    onChange({ ...shot, mainRefs: shot.mainRefs.filter((_, i) => i !== idx) });
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; }

    // 先创建本地预览 URL
    const localUrl = URL.createObjectURL(file);
    const tempRef = { id: localUrl, url: localUrl, name: file.name, type: file.type, uploading: true };
    const newRefs = [...shot.mainRefs, tempRef];
    onChange({ ...shot, mainRefs: newRefs });
    e.target.value = '';

    // 立即上传到后端
    try {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const maxSize = isVideo ? 200 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
      const typeLabel = isVideo ? '视频' : isAudio ? '音频' : '图片';
      if (file.size > maxSize) { alert(`抱歉，平台暂不支持上传${maxSize / 1024 / 1024}M以上的${typeLabel}资源！`); e.target.value = ''; return; }
      const uploadFn = isVideo ? apiUploadCreationVideo : isAudio ? apiUploadCreationAudio : apiUploadCreationImage;
      const result = await uploadFn({ file, category: 'reference', project_id: projectId });
      const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';

      // 更新 mainRefs：替换临时 URL 为后端 URL
      const updatedRefs = newRefs.map(ref =>
        ref.id === localUrl
          ? { id: result.asset_id || result.id || uploadedUrl, url: uploadedUrl, name: file.name, type: file.type, uploaded: true }
          : ref
      );

      // 主体参考图只更新 mainRefs，不回写列表的「画面描述」字段。
      // 参考图标签只在生成弹窗的提示词输入框（画面描述段末尾）出现，由用户决定如何使用。
      onChange({ ...shot, mainRefs: updatedRefs });
    } catch (error) {
      console.error('上传失败', error);
      // 上传失败，移除临时项
      onChange({ ...shot, mainRefs: newRefs.filter(ref => ref.id !== localUrl) });
      // TODO: 显示错误提示
    }
  }

  function handleAssetConfirm(assets) {
    const newRefs = assets.map(a => ({ id: a.id, assetId: a.id, url: (a.fileUrl || a.url) ?? null, name: a.name, type: a.type ?? 'image' }));
    onChange({ ...shot, mainRefs: [...shot.mainRefs, ...newRefs] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '92px', flexShrink: 0 }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
      <AssetPickerModal
        open={assetPickerOpen}
        projectId={projectId}
        onClose={() => setAssetPickerOpen(false)}
        preSelectedIds={shot.mainRefs.map(r => r.assetId).filter(Boolean)}
        preSelectedUrls={shot.mainRefs.map(r => r.url).filter(Boolean)}
        preSelectedSubjectIds={shot.mainRefs.map(r => r.id).filter(Boolean)}
        onConfirm={handleAssetConfirm}
      />
      {dropdownOpen && (
        <AddSlotDropdown
          anchorRef={addBtnRef}
          onUpload={() => fileInputRef.current?.click()}
          onAssetPicker={() => setAssetPickerOpen(true)}
          onClose={() => setDropdownOpen(false)}
        />
      )}

      {/* 可滚动的图片网格：2列，超出2行后可上下滚动 */}
      <div style={{
        width: '92px',
        maxHeight: '92px', // 2行(44px) + 1个gap(4px) = 92px
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexWrap: 'wrap',
       gap: '4px',
       scrollbarWidth: 'none',
     }}>
        {/* 添加按钮始终在第一个槽 */}
        <div ref={addBtnRef} style={{ display: 'inline-flex', flexShrink: 0 }}>
          <AddSlotBtn onClick={() => setDropdownOpen((v) => !v)} />
        </div>
       {shot.mainRefs.map((img, idx) => (
          <div
            key={img.id ?? idx}
            onMouseEnter={(e) => { setHoveredIdx(idx); handleImgMouseEnter(e, img); }}
            onMouseLeave={() => { setHoveredIdx(null); handleImgMouseLeave(); }}
            onMouseMove={handleImgMouseMove}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '4px',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
              border: hoveredIdx === idx ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.06)',
              transition: 'border-color 150ms',
            }}
          >
            {img.url
              ? <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', backgroundColor: img.bgColor ?? '#252525', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', fontFamily: FONT }}>{(img.name ?? '?')[0]}</span>
                </div>
            }
            {hoveredIdx === idx && (
              <div
                onClick={() => handleDelete(idx)}
                style={{
                  position: 'absolute', top: '2px', right: '2px',
                  width: '16px', height: '16px',
                  backgroundColor: 'rgba(0,0,0,0.70)',
                  borderRadius: '3px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
            )}
          </div>
       ))}
     </div>

      {previewImg && createPortal(
        <MediaHoverPreview url={previewImg} isVideo={false} mouseX={mousePos.x} mouseY={mousePos.y} />,
        document.body
      )}
    </div>
  );
}

// ─── 主体参考悬浮预览 ─────────────────────────────────────────────────────────
// ─── 通用媒体悬浮预览（图片 + 视频） ──────────────────────────────────────────
// isVideo=true 时直接用 16:9 fallback 尺寸（视频尺寸无法预知），并自动播放
function MediaHoverPreview({ url, isVideo, mouseX, mouseY }) {
  const [size, setSize] = useState(null);
  const GAP = 16;

  useEffect(() => {
    if (isVideo) {
      // 视频默认按 16:9 预览，实际尺寸等视频加载后更新
      setSize({ w: 16, h: 9 });
    } else {
      setSize(null);
      const img = new Image();
      img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    }
  }, [url, isVideo]);

  if (!size) return null;

  const maxW = window.innerWidth * 0.35;
  const maxH = window.innerHeight * 0.35;
  const ratio = size.w / size.h;

  let previewW, previewH;
  if (ratio >= 1) {
    previewW = maxW;
    previewH = previewW / ratio;
    if (previewH > maxH) { previewH = maxH; previewW = previewH * ratio; }
  } else {
    previewH = maxH;
    previewW = previewH * ratio;
    if (previewW > maxW) { previewW = maxW; previewH = previewW / ratio; }
  }

  let left = mouseX + GAP;
  let top = mouseY + GAP;
  if (left + previewW > window.innerWidth - GAP) left = mouseX - previewW - GAP;
  if (top + previewH > window.innerHeight - GAP) top = mouseY - previewH - GAP;
  left = Math.max(GAP, left);
  top = Math.max(GAP, top);

  return (
    <div
      style={{
        position: 'fixed', left, top,
        width: previewW, height: previewH,
        zIndex: 99999, pointerEvents: 'none',
        borderRadius: '8px', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.12)',
        backgroundColor: '#111',
      }}
    >
      {isVideo ? (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => {
            const { videoWidth: w, videoHeight: h } = e.target;
            if (w && h) setSize({ w, h });
          }}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      )}
    </div>
  );
}

// ─── 主体参考弹窗 ─────────────────────────────────────────────────────────────

function MainRefModal({ shot, onChange, onClose }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  function handleAssetConfirm(assets) {
    const newRefs = assets.map(a => ({ id: a.id, assetId: a.id, url: (a.fileUrl || a.url) ?? null, name: a.name, type: a.type ?? 'image' }));
    onChange({ ...shot, mainRefs: [...shot.mainRefs, ...newRefs] });
  }

  function handleDelete(idx) {
    onChange({ ...shot, mainRefs: shot.mainRefs.filter((_, i) => i !== idx) });
  }

  return (
    <>
      <AssetPickerModal
        accept="image"
        projectId={projectId}
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        preSelectedIds={shot.mainRefs.map(r => r.assetId).filter(Boolean)}
        preSelectedUrls={shot.mainRefs.map(r => r.url).filter(Boolean)}
        preSelectedSubjectIds={shot.mainRefs.map(r => r.id).filter(Boolean)}
        onConfirm={handleAssetConfirm}
      />
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: '800px',
            maxHeight: '600px',
            backgroundColor: '#161616',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px' }}>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
              主体参考
            </span>
            <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
              <IconClose />
            </div>
          </div>

          {/* content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {shot.mainRefs.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'rgba(255,255,255,0.30)', fontSize: '14px', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
                暂无图片
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {shot.mainRefs.map((img, idx) => (
                  <div
                    key={img.id}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      width: '160px',
                      height: '120px',
                      borderRadius: '8px',
                      position: 'relative',
                      overflow: 'hidden',
                      border: hoveredIdx === idx ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.06)',
                      transition: 'border-color 150ms',
                    }}
                  >
                    <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {hoveredIdx === idx && (
                      <div
                        onClick={() => handleDelete(idx)}
                        style={{
                          position: 'absolute', top: '6px', right: '6px',
                          width: '24px', height: '24px',
                          backgroundColor: 'rgba(0,0,0,0.70)',
                          borderRadius: '4px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <IconClose />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px 20px' }}>
            <div
              onClick={() => setAssetPickerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '36px',
                paddingInline: '16px',
                gap: '4px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.60)',
                fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
              }}
            >
              从资产库添加
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── 媒体列（分镜图 / 分镜视频）────────────────────────────────────────────────

function MediaViewModal({ url, onClose }) {
  const { width: modalW, height: modalH } = useModalSize();
  const [closeHov, setCloseHov] = useState(false);
  const [downloadHov, setDownloadHov] = useState(false);
  const [downloadPressed, setDownloadPressed] = useState(false);

  function downloadImage(imageUrl) {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = imageUrl.split('/').pop() || 'image.jpg';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', width: `${modalW}px`, height: `${modalH}px`, borderRadius: '16px', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#161616', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>查看</span>
          <div
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHov ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }}
            onClick={onClose}
            onMouseEnter={() => setCloseHov(true)}
            onMouseLeave={() => setCloseHov(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke={closeHov ? '#FFFFFF' : '#FFFFFFCC'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        {/* image area */}
        <div style={{ flex: 1, display: 'flex', padding: '8px 24px', overflow: 'hidden', flexDirection: 'column', background: '#161616', minHeight: 0 }}>
          <img src={url} alt="" style={{ width: '100%', flex: 1, borderRadius: '8px', objectFit: 'contain', minHeight: 0 }} />
        </div>
        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: '#161616', borderRadius: '0 0 16px 16px', padding: '16px 24px', flexShrink: 0, gap: '12px' }}>
          <div
            style={{ display: 'flex', flexDirection: 'column', height: '36px', flexShrink: 0, borderRadius: '8px', padding: '1px', backgroundImage: downloadHov ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)' : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', boxShadow: '#00000066 3px 3px 8px', outline: '1px solid #00000080', cursor: 'pointer', transition: 'background-image 0.15s' }}
            onClick={() => downloadImage(url)}
            onMouseEnter={() => setDownloadHov(true)}
            onMouseLeave={() => { setDownloadHov(false); setDownloadPressed(false); }}
            onMouseDown={() => setDownloadPressed(true)}
            onMouseUp={() => setDownloadPressed(false)}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, alignSelf: 'stretch', borderRadius: '7px', gap: '4px', paddingInline: '15px', backgroundColor: downloadPressed ? '#222222' : downloadHov ? '#1C1C1C' : '#161616', transition: 'background-color 0.1s' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 2.667V10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.667 12H13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>下载</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ImgIconBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "24px", height: "24px",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "4px",
        backgroundColor: hov ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.50)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background-color 0.10s",
      }}
    >
      {children}
    </div>
  );
}

function MediaIconBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '24px', height: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '4px',
        backgroundColor: hov ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.50)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.10s',
      }}
    >
      {children}
    </div>
  );
}

function MediaCol({ media, onUpload, accept, isVideo, label, onAIGenerate, shotMeta, generating }) {
  const [hovered, setHovered] = useState(false);
  const [viewUrl, setViewUrl] = useState(null);
  const [viewerShot, setViewerShot] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!isVideo && file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; }
    const url = URL.createObjectURL(file);
    onUpload({ id: url, url, name: file.name, type: file.type, file });
    e.target.value = '';
  }
  function handleMouseEnter() {
    setHovered(true);
    if (isVideo && !isEmpty && !generating && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }

  function handleMouseLeave() {
    setHovered(false);
    if (isVideo && !isEmpty && !generating && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  const isEmpty = !media;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch', flex: 1 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => { if (!isEmpty || generating) onAIGenerate?.(); }}
        style={{
          flex: 1,
          minHeight: 0,
          alignSelf: 'stretch',
          borderRadius: '6px',
          position: 'relative',
          overflow: 'hidden',
          cursor: (isEmpty && !generating) ? 'default' : 'pointer',
          ...(isEmpty ? {
            backgroundColor: '#1D1E1E',
            border: '1px dashed rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          } : {
            border: `1px solid ${hovered ? 'rgba(45,195,225,0.50)' : 'rgba(255,255,255,0.06)'}`,
            transition: 'border-color 150ms',
          }),
        }}
      >
        {/* 生成中显示 DotsLoading */}
        {generating && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D1E1E', borderRadius: '6px', zIndex: 2 }}>
            <DotsLoading size={4} color="#2DC3E1" gap={3} />
          </div>
        )}

        {/* 有内容时展示 */}
        {!isEmpty && !generating && (
          isVideo ? (
            <video
              src={media.url}
              ref={videoRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />
          ) : (
            <img src={media.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        )}

        {/* 有内容时 hover 右下角操作按钮 */}
        {!isEmpty && hovered && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '6px 6px',
            backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px',
          }}>
            <MediaIconBtn onClick={(e) => { e.stopPropagation(); if (media?.url) {
              if (isVideo) {
                setViewerShot({ videoUrl: media.url, filename: media.name, label: shotMeta?.label, prompt: shotMeta?.prompt, model: shotMeta?.model, resolution: shotMeta?.resolution, duration: shotMeta?.duration, aspectRatio: shotMeta?.aspectRatio, finalized: shotMeta?.finalized });
              } else {
                setViewUrl(media.url);
              }
            }; }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MediaIconBtn>
            <MediaIconBtn onClick={(e) => { e.stopPropagation(); if (media?.url) { const a = document.createElement('a'); a.href = media.url; a.download = media.name || 'download'; a.click(); } }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MediaIconBtn>
          </div>
        )}

        {/* 空状态默认图标 */}
        {isEmpty && !hovered && !generating && (
          <div style={{
            width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {isVideo ? <IconVideoPlaceholder /> : <IconImagePlaceholder />}
          </div>
        )}

        {/* hover 时弹出按钮（仅空白虚线区域） */}
        {isEmpty && hovered && !generating && (
          <div
            onMouseDown={(e) => { e.stopPropagation(); onAIGenerate?.(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '24px',
              paddingInline: '8px',
              borderRadius: '6px',
              backgroundColor: '#2DC3E1',
              border: '1px solid #FFFFFF33',
              outline: '1px solid rgba(0,0,0,0.50)',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#090909',
              fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
              animation: 'slideUpBounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              animationDelay: '0ms',
              opacity: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {isVideo ? '创作视频' : '创作图片'}
          </div>
        )}
      </div>
      {viewUrl && <MediaViewModal url={viewUrl} onClose={() => setViewUrl(null)} />}
      {viewerShot && <ShotViewerModal shot={viewerShot} onClose={() => setViewerShot(null)} />}
    </div>
  );
}

// ─── 镜头编号列 ───────────────────────────────────────────────────────────────

const NUMBER_BTNS = [
  { key: 'drag', icon: <IconDrag />, label: '拖拽移动分镜' },
  { key: 'add', icon: <IconAdd />, label: '下方添加空分镜' },
  { key: 'copy', icon: <IconCopy />, label: '复制当前分镜' },
  { key: 'delete', icon: <IconDelete />, label: '删除分镜' },
];

function CardActionBtn({ btn, index, onAdd, onCopy, onDeleteRequest, onDragHandlePress }) {
  const [hov, setHov] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const btnRef = useRef(null);

  function handleMouseEnter() {
    setHov(true);
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 6 });
    }
  }

  function handleMouseLeave() {
    setHov(false);
    setTooltipPos(null);
  }

  return (
    <>
      <div
        ref={btnRef}
        onMouseDown={btn.key === 'drag' ? onDragHandlePress : undefined}
        onClick={() => {
          if (btn.key === 'add') onAdd?.();
          if (btn.key === 'copy') onCopy?.();
          if (btn.key === 'delete') onDeleteRequest?.();
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          cursor: btn.key === 'drag' ? 'grab' : 'pointer',
          backgroundColor: hov ? 'rgba(255,255,255,0.08)' : 'transparent',
          animation: 'slideDownBounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          animationDelay: `${index * 50}ms`,
          opacity: 0,
          transition: 'background-color 0.10s',
        }}
      >
        {btn.icon}
      </div>
      {hov && tooltipPos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: 'translateY(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
            backgroundColor: '#090909',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '4px',
            padding: '5px 8px',
            fontSize: '12px',
            lineHeight: '16px',
            color: 'rgba(255,255,255,0.80)',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 24px var(--color-shadow)',
          }}
        >
          {btn.label}
        </div>,
        document.body
      )}
    </>
  );
}

function NumberCol({ number, isHovered, onAdd, onCopy, onDeleteRequest, onDragHandlePress, isSelectMode = false, isSelected = false, onToggleSelect }) {
  return (
    <div
      onClick={isSelectMode ? onToggleSelect : undefined}
      style={{
        width: '40px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isSelectMode ? 'flex-start' : isHovered ? 'flex-start' : 'center',
        paddingTop: isSelectMode ? '12px' : (!isSelectMode && isHovered) ? '12px' : 0,
        paddingBottom: (!isSelectMode && isHovered) ? '12px' : 0,
        gap: '6px',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: isSelectMode ? (isSelected ? 'rgba(45,195,225,0.08)' : 'transparent') : isHovered ? '#111111' : 'transparent',
        borderTopLeftRadius: '12px',
        borderBottomLeftRadius: '12px',
        transition: 'background-color 150ms',
        overflow: 'hidden',
        cursor: isSelectMode ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {isSelectMode ? (
        <>
          <Checkbox checked={isSelected} />
          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '14px', fontWeight: 700, color: '#FFFFFF', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', lineHeight: 1 }}>
            {String(number).padStart(2, '0')}
          </span>
        </>
      ) : (
        <>
          {!isHovered && (
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            }}>
              {String(number).padStart(2, '0')}
            </span>
          )}
          {isHovered && NUMBER_BTNS.map((btn, i) => (
            <CardActionBtn
              key={btn.key}
              btn={btn}
              index={i}
              onAdd={onAdd}
              onCopy={onCopy}
              onDeleteRequest={onDeleteRequest}
              onDragHandlePress={onDragHandlePress}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── 参数触发器（景别/运镜/拍摄角度/构图/时长）────────────────────────────────

function ParamTrigger({ field, label, value, isActive, triggerRefs, onToggle, onClose, onUpdate }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <div
      ref={(el) => { triggerRefs.current[field] = el; }}
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        height: '22px',
        paddingInline: '6px',
        borderRadius: '6px',
        cursor: 'pointer',
        backgroundColor: pressed
          ? 'rgba(255,255,255,0.10)'
          : isActive
          ? 'rgba(255,255,255,0.08)'
          : hov
          ? 'rgba(255,255,255,0.06)'
          : 'transparent',
        border: `1px solid ${isActive ? 'rgba(255,255,255,0.18)' : hov ? 'rgba(255,255,255,0.10)' : 'transparent'}`,
        transition: 'background-color 0.12s, border-color 0.12s',
        userSelect: 'none',
      }}
    >
      <span style={{
        fontSize: '12px',
        color: hov || isActive ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.35)',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        transition: 'color 0.12s',
        whiteSpace: 'nowrap',
      }}>
        {label}：
      </span>
      <span style={{
        fontSize: '12px',
        color: hov || isActive ? '#FFFFFF' : 'rgba(255,255,255,0.80)',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        transition: 'color 0.12s',
        whiteSpace: 'nowrap',
      }}>
        {value || '—'}
      </span>
      {isActive && (
        <ParamSelect
          field={field}
          value={value}
          onChange={onUpdate}
          onClose={onClose}
          triggerRef={{ current: triggerRefs.current[field] }}
        />
      )}
    </div>
  );
}

// ─── 画面描述列 ───────────────────────────────────────────────────────────────

function DescriptionCol({ shot, onChange }) {
  const [activeParam, setActiveParam] = useState(null);
  const triggerRefs = useRef({});

  function updateParam(field, val) {
    onChange({ ...shot, params: { ...shot.params, [field]: val } });
  }

  return (
    <div style={{
      flex: 1,
      minWidth: '300px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      paddingBottom: '8px',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      alignSelf: 'stretch',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flexShrink: 0 }}>
        画面描述
      </span>
      <EditableText
        value={shot.description}
        onChange={(v) => onChange({ ...shot, description: v })}
        placeholder="描述画面内容…"
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flexShrink: 0, marginTop: 'auto' }}>
        {Object.entries(PARAM_LABELS).map(([field, label]) => (
          <ParamTrigger
            key={field}
            field={field}
            label={label}
            value={shot.params[field]}
            isActive={activeParam === field}
            triggerRefs={triggerRefs}
            onToggle={() => setActiveParam(activeParam === field ? null : field)}
            onClose={() => setActiveParam(null)}
            onUpdate={(v) => updateParam(field, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 文本编辑列（光影 / 环境音）──────────────────────────────────────────────

function TextEditCol({ label, value, onChange, isLast = false }) {
  return (
    <div style={{
      width: 'calc(5.695% - 1px)',
      minWidth: '120px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: isLast ? 'none' : '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      alignSelf: 'stretch',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flexShrink: 0 }}>
        {label}
      </span>
      <EditableText value={value} onChange={onChange} placeholder="点击编辑…" />
    </div>
  );
}

// ─── 旁白配音列容器 ───────────────────────────────────────────────────────────

function NarrationColWrapper({ shot, onChange, chars, globalVoiceParams, onSaveGlobalVoice }) {
  return (
    <NarrationCol
      segments={shot.narration.segments}
      onChange={(segs) => onChange({ ...shot, narration: { segments: segs } })}
      chars={chars}
      globalVoiceParams={globalVoiceParams}
      onSaveGlobalVoice={onSaveGlobalVoice}
    />
  );
}

// ─── 主体参考列容器 ───────────────────────────────────────────────────────────

function MainRefColWrapper({ shot, onChange, chars, projectId }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      alignItems: 'flex-start',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
        主体参考
      </span>
      <MainRefCol
        shot={shot}
        onChange={onChange}
        chars={chars}
        projectId={projectId}
      />
    </div>
  );
}

// ─── 媒体列容器 ───────────────────────────────────────────────────────────────

function MediaColWrapper({ label, media, onUpload, accept, isVideo, isLast = false, onAIGenerate, shotMeta, generating }) {
  return (
    <div style={{
      width: 'calc(15% - 1px)',
      minWidth: '160px', maxWidth: '220px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: isLast ? 'none' : '1px solid rgba(255,255,255,0.08)',
      alignSelf: 'stretch',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flexShrink: 0 }}>
        {label}
      </span>
      <MediaCol
        media={media}
        onUpload={onUpload}
        accept={accept}
        isVideo={isVideo}
        label={label}
        onAIGenerate={onAIGenerate}
        shotMeta={shotMeta}
        generating={generating}
      />
    </div>
  );
}

// ─── 分镜行 ───────────────────────────────────────────────────────────────────

function ShotRow({ shot, onChange, onAdd, onCopy, onDelete, chars, isDragging, onDragStart, onDragOver, onDrop, insertBefore, insertAfter, onGenerateImage, onGenerateVideo, globalVoiceParams, onSaveGlobalVoice, projectId, generatingImage, generatingVideo, isSelectMode = false, isSelected = false, onToggleSelect }) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 仅当拖拽动作由「拖拽手柄」按钮发起时才允许排序，鼠标在卡片其他区域拖拽无效。
  const dragFromHandle = useRef(false);
  function armDragHandle() {
    dragFromHandle.current = true;
    // 若只是点击手柄而未真正拖动，mouseup 时清除标记，避免下次从其他区域误触发排序。
    window.addEventListener('mouseup', () => { dragFromHandle.current = false; }, { once: true });
  }

  return (
    <>
      {/* insertion line above */}
      {insertBefore && (
        <div style={{ height: '2px', borderRadius: '1px', backgroundColor: '#2DC3E1', flexShrink: 0, marginBlock: '-4px', zIndex: 10 }} />
      )}
      <div
        draggable={!isSelectMode}
        onDragStart={(e) => {
          if (isSelectMode || !dragFromHandle.current) { e.preventDefault(); return; }
          onDragStart?.();
        }}
        onDragEnd={() => { dragFromHandle.current = false; }}
        onDragOver={(e) => { e.preventDefault(); onDragOver?.(); }}
        onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          minHeight: '140px',
          height: '140px',
          minWidth: '1160px',
          borderRadius: '12px',
          backgroundColor: '#1D1E1E',
          border: `1px solid ${isSelected ? 'rgba(45,195,225,0.60)' : hovered ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: hovered ? 'rgba(0,0,0,0.50) 0px 0px 30px' : 'none',
          flexShrink: 0,
          transition: 'border-color 150ms, box-shadow 150ms, opacity 150ms',
          overflow: 'hidden',
          opacity: isDragging ? 0.40 : 1,
        }}
      >
        <NumberCol
          number={shot.number}
          isHovered={hovered}
          onAdd={onAdd}
          onCopy={onCopy}
          onDeleteRequest={() => setConfirmDelete(true)}
          onDragHandlePress={armDragHandle}
          isSelectMode={isSelectMode}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
        />
        <DescriptionCol shot={shot} onChange={onChange} />
        <TextEditCol
          label="光影"
          value={shot.lightShadow}
          onChange={(v) => onChange({ ...shot, lightShadow: v })}
        />
        <TextEditCol
          label="环境音"
          value={shot.ambientSound}
          onChange={(v) => onChange({ ...shot, ambientSound: v })}
        />
        <NarrationColWrapper shot={shot} onChange={onChange} chars={chars} globalVoiceParams={globalVoiceParams} onSaveGlobalVoice={onSaveGlobalVoice} />
        <MainRefColWrapper shot={shot} onChange={onChange} chars={chars} projectId={projectId} />
        <MediaColWrapper
          label="分镜图"
          media={shot.storyboardImage}
          onUpload={(m) => {
            onChange({ ...shot, storyboardImage: m });
            if (m.file) {
              apiUploadStoryboardImage(projectId, shot.id, m.file)
                .then(result => {
                  const url = normalizeImageUrl(result.url || result.image_url || result.imageUrl);
                  if (url) onChange({ ...shot, storyboardImage: { id: url, url, name: m.name, type: m.type } });
                })
                .catch(err => console.error('[StoryboardPage] 图片上传失败:', err));
            }
          }}
          accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.svg"
          isVideo={false}
          onAIGenerate={onGenerateImage}
          generating={generatingImage}
        />
        <MediaColWrapper
          label="分镜视频"
          media={shot.storyboardVideo}
          onUpload={(m) => {
            onChange({ ...shot, storyboardVideo: m });
            if (m.file) {
              apiUploadStoryboardVideo(projectId, shot.id, m.file)
                .then(result => {
                  const url = normalizeImageUrl(result.video_url || result.videoUrl || result.url);
                  if (url) onChange({ ...shot, storyboardVideo: { id: url, url, name: m.name, type: m.type } });
                })
                .catch(err => console.error('[StoryboardPage] 视频上传失败:', err));
            }
          }}
          accept=".mp4,.webm,.mov,.avi,.mkv"
          isVideo={true}
          isLast={true}
          onAIGenerate={onGenerateVideo}
          generating={generatingVideo}
          shotMeta={{
            label: `镜头 ${String(shot.number).padStart(2, '0')}`,
            prompt: shot.description,
            model: shot.storyboardVideo?.model ?? '—',
            resolution: shot.storyboardVideo?.resolution ?? '—',
            duration: shot.params?.duration ? parseFloat(shot.params.duration) : undefined,
            aspectRatio: '16:9',
            finalized: shot.storyboardVideo?.finalized ?? false,
          }}
        />
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`此操作不可撤销，镜头 ${String(shot.number).padStart(2, '0')} 将被永久删除。`}
          confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
          onCancel={() => setConfirmDelete(false)}
          zIndex={9998}
        />
      )}
      {/* insertion line below */}
      {insertAfter && (
        <div style={{ height: '2px', borderRadius: '1px', backgroundColor: '#2DC3E1', flexShrink: 0, marginBlock: '-4px', zIndex: 10 }} />
      )}
    </>
  );
}

// ─── 默认数据 ─────────────────────────────────────────────────────────────────

function makeShot(number, overrides = {}) {
  return {
    id: `shot-${number}-${Date.now()}-${Math.random()}`,
    number,
    description: '',
    params: { framing: '全景', cameraMotion: '固定机位', angle: '平视拍摄', composition: '三分法构图', duration: '3s' },
    lightShadow: '',
    ambientSound: '',
    narration: { segments: [] },
    mainRefs: [],
    storyboardImage: null,
    storyboardVideo: null,
    ...overrides,
  };
}

const INITIAL_SHOTS = [
  makeShot(1, {
    description: '夜晚，城市街道，霓虹灯闪烁。主角独自走在雨中，雨水打湿了他的外套，他停下脚步，抬头望向远处的高楼大厦，若有所思。',
    params: { framing: '远景', cameraMotion: '缓慢拉近', angle: '平视', composition: '三分线构图', duration: '3s' },
    lightShadow: '全局柔光，阳光穿过树叶缝隙',
    ambientSound: '微微的风声',
  }),
  makeShot(2, {
    description: '室内，咖啡馆，午后阳光斜射进来。女主角坐在窗边，手捧咖啡，目光落在窗外的行人身上，嘴角微微上扬。',
    params: { framing: '中景', cameraMotion: '固定', angle: '平视', composition: '三分线构图', duration: '3s' },
    lightShadow: '全局柔光，阳光穿过树叶缝隙',
    ambientSound: '微微的风声',
  }),
  makeShot(3, {
    description: '黄昏，公园小径，落叶飘零。两人并肩而行，偶尔对视，空气中弥漫着淡淡的暧昧与不舍。',
    params: { framing: '全景', cameraMotion: '跟随', angle: '平视', composition: '三分线构图', duration: '3s' },
    lightShadow: '黄昏暖光',
    ambientSound: '微微的风声',
  }),
];

// ─── 主页面 ───────────────────────────────────────────────────────────────────

const EPISODES = ['第一集', '第二集'];

export default function StoryboardPage({ projectId, projectName = '两只老虎的奇遇', projectRatio, chars = [], scenes = [], props = [], episodes = EPISODES, initialEpisodeIndex = null, onUnlockStep, onVideoGenerated, onGenerateStoryboards, generateError = null, isGenerating: homeIsGenerating = false, completedEpisodesCount = 0 }) {

  const activeEpisodes = episodes.length > 0 ? episodes : EPISODES;
  // 用 peekCache 同步读取缓存，第一次渲染直接呈现旧数据，避免空状态闪烁
  const [shots, setShots] = useState(() => {
    if (!projectId) return [];
    const cachedEpisodes = episodes.length > 0
      ? episodes
      : (peekCache(K.episodes(projectId), MEDIUM.CONTENT) ?? []);
    const targetIdx = (initialEpisodeIndex != null && initialEpisodeIndex >= 0 && initialEpisodeIndex < cachedEpisodes.length)
      ? initialEpisodeIndex : 0;
    const initialEpisode = cachedEpisodes[targetIdx];
    if (!initialEpisode || typeof initialEpisode === 'string') return [];
    const episodeId = initialEpisode?.id ?? '';
    if (!episodeId) return [];
    // 先找 episode 级缓存，找不到 fallback 到 :all（:all 是项目全量分镜，同样可用）
    const raw =
      peekCache(K.storyboards(projectId, episodeId), MEDIUM.CONTENT) ??
      peekCache(K.storyboards(projectId), MEDIUM.CONTENT);
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map(be => enrichMainRefs(normalizeStoryboard(be), chars));
  });
  const [globalVoiceParams, setGlobalVoiceParams] = useState({});
  const [episode, setEpisode] = useState(() => {
    const idx = (initialEpisodeIndex != null && initialEpisodeIndex >= 0 && initialEpisodeIndex < activeEpisodes.length)
      ? initialEpisodeIndex : 0;
    return activeEpisodes[idx] ?? '第一集';
  });
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 用户是否手动操作过（添加/删除分镜），如果操作过就不再展示智能分镜失败的错误态
  const hasManuallyInteracted = useRef(false);

  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingTexts = ['正在智能分镜中', '请稍等', '等待时间大约5分钟', '请耐心等待'];

  useEffect(() => {
    if (!isGenerating && !homeIsGenerating) return;
    const timer = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % loadingTexts.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isGenerating, homeIsGenerating]);

  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState(false);
  const [generatingImageShotIds, setGeneratingImageShotIds] = useState(new Set());
  const [generatingVideoShotIds, setGeneratingVideoShotIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [batchExpanded, setBatchExpanded] = useState(false);
  const batchBtnRef = useRef(null);
  const [downloadMode, setDownloadMode] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState(new Set());
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  // 单镜头生成面板
  const [imagePanel, setImagePanel] = useState(null); // { shot }
  const [videoPanel, setVideoPanel] = useState(null); // { shot }
  const [genImageHistoryMap, setGenImageHistoryMap] = useState({}); // { [shotId]: generatedImages[] }
  const [genVideoHistoryMap, setGenVideoHistoryMap] = useState({}); // { [shotId]: generatedVideos[] }

  // 页面加载时从后端获取剧本数据
  useEffect(() => {
    if (!projectId) return;
    if (typeof episode === 'string') return;

    const episodeId = getEpisodeId(episode);
    if (!episodeId) return;

    // 优先订阅带 episodeId 的 key，fallback 订阅 :all
    const cacheKey = K.storyboards(projectId, episodeId);
    const cacheKeyAll = K.storyboards(projectId);

    const normalizeShots = (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(be => enrichMainRefs(normalizeStoryboard(be), chars));
    };

    apiGetStoryboards(projectId, { episode_id: episodeId })
      .then((data) => {
        if (!Array.isArray(data)) return;
        const normalized = normalizeShots(data);
        if (normalized.length > 0) {
          // 有数据：直接覆盖（正常加载 / 刷新场景）
          setShots(normalized);
        } else {
          // 空数组：只有在当前 shots 也为空时才清空，避免剧本定稿后
          // episode ID 变更导致 API 用新 ID 查不到数据而误清已有分镜
          setShots((prev) => (prev.length > 0 ? prev : normalized));
        }
      })
      .catch((err) => {
        console.error('[StoryboardPage] 加载剧本失败:', err);
      });

    const unsub1 = subscribe(cacheKey, (data) => {
      if (!Array.isArray(data)) return;
      const normalized = normalizeShots(data);
      if (normalized.length > 0) {
        setShots(normalized);
      } else {
        setShots((prev) => (prev.length > 0 ? prev : normalized));
      }
    });
    const unsub2 = subscribe(cacheKeyAll, (data) => {
      if (!Array.isArray(data)) return;
      const normalized = normalizeShots(data);
      if (normalized.length > 0) {
        setShots(normalized);
      } else {
        setShots((prev) => (prev.length > 0 ? prev : normalized));
      }
    });

    return () => { unsub1(); unsub2(); };
  }, [projectId, episode?.id, chars]);

  useEffect(() => {
    if (activeEpisodes.length > 0 && !activeEpisodes.some(ep => getEpisodeId(ep) === getEpisodeId(episode))) {
      setEpisode(activeEpisodes[0]);
    }
  }, [activeEpisodes]);

  // episode 还是字符串（episodes prop 尚未到位）时，订阅 :all key
  // 一旦有数据写入就尝试把 episode 切换到真实对象
  useEffect(() => {
    if (typeof episode !== 'string') return;
    if (!projectId) return;
    const unsub = subscribe(K.storyboards(projectId), (data) => {
      if (activeEpisodes.length > 0) {
        setEpisode(activeEpisodes[0]);
      }
    });
    return unsub;
  }, [projectId, episode, activeEpisodes]);

  useEffect(() => {
    if (!batchExpanded) return;
    function handleMouseDown(e) {
      if (batchBtnRef.current && !batchBtnRef.current.contains(e.target)) {
        setBatchExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [batchExpanded]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // 轮询任务直到完成或超时
  // isSuccessPayload: 可选谓词，若返回 true 则即使 status 为 running 也停止轮询
  async function pollTask(taskId, isSuccessPayload) {
    const MAX_POLLS = 150;
    const INTERVAL = 3000;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, INTERVAL));
      const t = await apiGetTask(taskId);
      // 终态
      if (t.status !== 'pending' && t.status !== 'running') return t;
      // 后端修复后 running 态也可携带 results：有可播放视频就提前返回
      if (typeof isSuccessPayload === 'function' && isSuccessPayload(t)) return t;
    }
    throw new Error('任务超时，请重试');
  }

  // 从轮询响应中归一化提取视频 URL（兼容 result/ results/ video_url/ videoUrl）
  function extractVideoUrlFromTask(t) {
    // 1. task.result（单数，创建模块风格）
    if (t.result && typeof t.result === 'object') {
      const url = t.result.video_url || t.result.videoUrl;
      if (url) return url;
    }
    // 2. task.results（数组）
    if (Array.isArray(t.results)) {
      for (const r of t.results) {
        if (!r) continue;
        const url = r.video_url || r.videoUrl;
        if (url) return url;
      }
    }
    // 3. task.videos
    if (Array.isArray(t.videos)) {
      for (const v of t.videos) {
        if (!v) continue;
        const url = v.url || v.video_url || v.videoUrl;
        if (url) return url;
      }
    }
    return null;
  }

  // 从轮询响应中归一化提取图片 URL（兼容 result / results / images）
  function extractImageUrlFromTask(t) {
    if (t.result && typeof t.result === 'object') {
      const url = t.result.image_url || t.result.imageUrl || t.result.url || t.result.original_url || t.result.originalUrl;
      if (url) return url;
    }
    if (Array.isArray(t.results)) {
      for (const result of t.results) {
        if (!result) continue;
        const url = result.image_url || result.imageUrl || result.url || result.original_url || result.originalUrl;
        if (url) return url;
      }
    }
    if (Array.isArray(t.images)) {
      for (const image of t.images) {
        if (!image) continue;
        const url = image.original_url || image.originalUrl || image.image_url || image.imageUrl || image.url || image.thumbnail_url || image.thumbnailUrl;
        if (url) return url;
      }
    }
    return null;
  }

  function hasImageTaskResult(t) {
    return extractImageUrlFromTask(t) !== null;
  }

  // 视频任务终态判定：有可播放视频即视为成功
  function hasVideoTaskResult(t) {
    return extractVideoUrlFromTask(t) !== null;
  }

  async function startBatchGenImages(params) {
    if (generatingImages) return;
    setGeneratingImages(true);
    const episodeId = getEpisodeId(episode);
    let successCount = 0;
    let failCount = 0;

    for (const shot of shots) {
      setGeneratingImageShotIds(prev => new Set([...prev, shot.id]));
      try {
        const taskResp = await apiGenerateStoryboardImage(projectId, shot.id, {
          model: params.model,
          resolution: params.resolution,
          prompt: params.prompt,
          aspect_ratio: projectRatio,
          reference_images: (params.refImages || []).map(r => toAbsoluteUrl(typeof r === 'string' ? r : r.url)).filter(url => url && !url.toLowerCase().endsWith(".avif") && !url.includes("/derived/assets/")),
        });
        const task = await pollTask(taskResp.id, hasImageTaskResult);
        if (task.status === 'completed' || task.status === 'partial' || hasImageTaskResult(task)) {
          const imageUrl = extractImageUrlFromTask(task);
          if (imageUrl) {
            const normalizedUrl = normalizeImageUrl(imageUrl);
            setShots((prev) => prev.map((s) => s.id === shot.id
              ? { ...s, storyboardImage: { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg' } }
              : s
            ));
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('[StoryboardPage] 生成分镜图失败:', err);
        failCount++;
      } finally {
        setGeneratingImageShotIds(prev => {
          const next = new Set(prev);
          next.delete(shot.id);
          return next;
        });
      }
    }
    setGeneratingImages(false);
    if (failCount > 0) {
      showToast(`分镜图生成完成，成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
    } else {
      showToast('分镜图生成完成');
    }
  }

  async function startBatchGenVideos(params) {
    if (generatingVideos) return;
    setGeneratingVideos(true);
    const episodeId = getEpisodeId(episode);
    let successCount = 0;
    let failCount = 0;

    for (const shot of shots) {
      setGeneratingVideoShotIds(prev => new Set([...prev, shot.id]));
      try {
        const durationValue = (() => {
          if (!params.duration) return undefined;
          const parsed = parseFloat(params.duration);
          return isNaN(parsed) ? undefined : parsed;
        })();
        const taskResp = await apiGenerateStoryboardVideo(projectId, shot.id, {
          model: params.model,
          resolution: params.resolution,
          duration: durationValue,
          sound_effect: params.sound,
          prompt: params.prompt,
          ratio: projectRatio,
          reference_images: (params.refImages || []).map(r => toAbsoluteUrl(typeof r === 'string' ? r : r.url)).filter(url => url && !url.toLowerCase().endsWith(".avif") && !url.includes("/derived/assets/")),
        });
        const task = await pollTask(taskResp.id, hasVideoTaskResult);
        const videoUrl = extractVideoUrlFromTask(task);
        if (videoUrl) {
          if (videoUrl) {
            const normalizedUrl = normalizeImageUrl(videoUrl);
            const updatedVideo = { id: `vid-${shot.id}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4' };
            setShots((prev) => prev.map((s) => s.id === shot.id
              ? { ...s, storyboardVideo: updatedVideo }
              : s
            ));
            // 持久化到后端，避免刷新后视频列消失
            apiUpdateStoryboard(projectId, shot.id, { video_url: normalizedUrl }).catch(console.error);
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('[StoryboardPage] 生成分镜视频失败:', err);
        failCount++;
      } finally {
        setGeneratingVideoShotIds(prev => {
          const next = new Set(prev);
          next.delete(shot.id);
          return next;
        });
      }
    }
    setGeneratingVideos(false);
    onVideoGenerated?.(activeEpisodes.findIndex(ep => getEpisodeId(ep) === getEpisodeId(episode)));
    if (failCount > 0) {
      showToast(`分镜视频生成完成，成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
    } else {
      showToast('分镜视频生成完成');
    }
  }

  function handleBatchDownload() {
    const assets = shots.flatMap((s) => {
      const items = [];
      if (s.storyboardImage?.url) items.push({ url: s.storyboardImage.url, name: `shot-${s.number}-image.jpg` });
      if (s.storyboardVideo?.url) items.push({ url: s.storyboardVideo.url, name: `shot-${s.number}-video.mp4` });
      return items;
    });
    if (assets.length === 0) { showToast('暂无可下载的素材', 'warning'); return; }
    assets.forEach(({ url, name }) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    showToast(`已下载 ${assets.length} 个素材`, 'success');
  }

  /* ── 批量下载模式 ── */
  function enterDownloadMode() {
    setDownloadMode(true);
    setSelectedShotIds(new Set());
  }

  function exitDownloadMode() {
    setDownloadMode(false);
    setSelectedShotIds(new Set());
  }

  function toggleSelectAll() {
    setSelectedShotIds(prev => {
      if (prev.size === shots.length) return new Set();
      return new Set(shots.map(s => s.id));
    });
  }

  function toggleShotSelection(id) {
    setSelectedShotIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDownloadImages() {
    const ids = [...selectedShotIds];
    if (ids.length === 0) { showToast('暂无可下载的分镜图', 'warning'); return; }
    try {
      const blob = await apiBatchDownloadStoryboardImages(projectId, ids);
      triggerDownload(blob, 'storyboard-images.zip');
      showToast(`已下载 ${ids.length} 个分镜图`, 'success');
    } catch (err) {
      console.error('批量下载图片失败:', err);
      showToast('批量下载图片失败', 'error');
    }
  }

  async function handleDownloadVideos() {
    const ids = [...selectedShotIds];
    if (ids.length === 0) { showToast('暂无可下载的分镜视频', 'warning'); return; }
    try {
      const blob = await apiBatchDownloadStoryboardVideos(projectId, ids);
      triggerDownload(blob, 'storyboard-videos.zip');
      showToast(`已下载 ${ids.length} 个分镜视频`, 'success');
    } catch (err) {
      console.error('批量下载视频失败:', err);
      showToast('批量下载视频失败', 'error');
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleStartEdit() {
    showToast('剪辑功能即将上线', 'warning');
  }

  useEffect(() => {
    if (shots.length > 0) onUnlockStep?.('storyboard');
  }, [shots.length]);

  function updateShot(id, next) {
    setShots((prev) => prev.map((s) => (s.id === id ? next : s)));
    apiUpdateStoryboard(projectId, id, toBackendStoryboard(next)).catch((err) => {
      console.error('[StoryboardPage] 更新分镜失败:', err);
    });
  }

  function addShotAfter(id) {
    const idx = shots.findIndex((s) => s.id === id);
    const newShot = makeShot(idx + 2);

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(newShot), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), chars);
        setShots((prev) => {
          const next = [...prev.slice(0, idx + 1), shotWithRealId, ...prev.slice(idx + 1)];
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }

  function copyShot(id) {
    const idx = shots.findIndex((s) => s.id === id);
    const original = shots[idx];
    const copy = { ...original, id: undefined };

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(copy), episode_id: getEpisodeId(episode) })
      .then((created) => {
        // 合并原始富数据 + 后端生成的 ID
        const shotWithRealId = { ...copy, ...enrichMainRefs(normalizeStoryboard(created), chars) };
        setShots((prev) => {
          const next = [...prev.slice(0, idx + 1), shotWithRealId, ...prev.slice(idx + 1)];
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 复制分镜失败:', err);
      });
  }

  function deleteShot(id) {
    apiDeleteStoryboard(projectId, id)
      .then(() => {
        setShots((prev) => {
          const next = prev.filter((s) => s.id !== id);
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));

          // 使用原子操作更新所有分镜的顺序
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);

          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 删除分镜失败:', err);
      });
  }

  function addNewShot() {
    const newNumber = shots.length + 1;
    const newShot = makeShot(newNumber);

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(newShot), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), chars);
        hasManuallyInteracted.current = true;
        setShots((prev) => [...prev, shotWithRealId]);
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }

  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setShots((prev) => {
      const dragIdx = prev.findIndex((s) => s.id === dragId);
      if (dragIdx === -1) return prev;
      const next = [...prev];
      const [dragged] = next.splice(dragIdx, 1);
      if (targetId === '__before_first') {
        next.unshift(dragged);
      } else if (targetId === '__after_last') {
        next.push(dragged);
      } else {
        const targetIdx = next.findIndex((s) => s.id === targetId);
        if (targetIdx === -1) return prev;
        next.splice(targetIdx, 0, dragged);
      }
      const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
      apiReorderStoryboards(projectId, reordered.map(s => s.id)).catch(console.error);
      return reordered;
    });
    setDragId(null);
    setOverId(null);
  }

  // 判断是否显示 loading / 错误态
  // homeIsGenerating 期间如果已有分镜数据，直接展示数据，不再显示全屏 loading
  const showGeneratingLoading = (isGenerating || homeIsGenerating) && shots.length === 0;
  const showGeneratingError = !!generateError && shots.length === 0 && !hasManuallyInteracted.current;

  if (showGeneratingLoading) {
    return (
      <div style={{
        position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '16px',
        backgroundColor: '#161616', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <DotsLoading size={4} color="#2DC3E1" gap={4} />
        <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '12px', color: '#FFFFFF99' }}>
          {loadingTexts[loadingTextIndex]}
        </span>
      </div>
    );
  }

  if (showGeneratingError) {
    return (
      <div style={{
        position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '24px',
        backgroundColor: '#161616', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="16" cy="16" r="15" stroke="#FFFFFF66" strokeWidth="1.5" />
          <circle cx="10" cy="13" r="2" fill="#FFFFFF66" />
          <circle cx="22" cy="13" r="2" fill="#FFFFFF66" />
          <path d="M10 23 Q16 19 22 23" stroke="#FFFFFF66" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '14px', color: '#FFFFFF99' }}>
          糟糕，智能分镜失败了，待会儿再试试吧！
        </span>
        <button
          type="button"
          onClick={() => {
            setIsGenerating(true);
            onGenerateStoryboards?.().finally(() => setIsGenerating(false));
          }}
          className="[font-synthesis:none] flex items-center justify-center px-[16px] h-9 rounded-lg bg-btn-accent-bg-normal hover:bg-btn-accent-bg-hover active:bg-btn-accent-bg-active border border-btn-accent-border [outline:1px_solid_var(--color-stroke-outline)] shrink-0 cursor-pointer"
          style={{
            backgroundImage: 'linear-gradient(157.78deg, #7AE5B94D 2.88%, #7AE5B900 56.77%)',
          }}
        >
          <span className="text-btn-accent-text text-[14px] font-medium leading-[18px]" style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>
            重新提取分镜
          </span>
        </button>
        <button
          type="button"
          onClick={addNewShot}
          className="[font-synthesis:none] flex items-center justify-center px-[16px] h-9 rounded-lg bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border [outline:1px_solid_var(--color-stroke-outline)] [box-shadow:var(--color-shadow)_3px_3px_8px] shrink-0 cursor-pointer"
        >
          <span className="text-btn-primary-text text-[14px] font-normal leading-[18px]" style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>
            手动添加分镜
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
    <div style={{
      position: 'absolute',
      inset: 0,
      marginBottom: '24px',
      marginRight: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      backgroundColor: '#161616',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '24px',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', fontFamily: FONT }}>
            {projectName}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M5.5 3.5L9 7L5.5 10.5" stroke="#FFFFFF40" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <EpisodeSelector episodes={activeEpisodes} value={episode} onChange={setEpisode} />
        </div>
        {/* 后台分镜生成中提示：有数据时不全屏 loading，改用居中 inline 状态条 */}
        {homeIsGenerating && shots.length > 0 && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: '6px',
            height: '28px', padding: '0 10px', borderRadius: '6px',
            background: 'rgba(45,195,225,0.08)',
            border: '1px solid rgba(45,195,225,0.2)',
            pointerEvents: 'none',
            flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, animation: 'spin 1.2s linear infinite' }}>
              <circle cx="6" cy="6" r="4.5" stroke="rgba(45,195,225,0.3)" strokeWidth="1.5" />
              <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="#2DC3E1" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: FONT, fontSize: '12px', color: '#2DC3E1', whiteSpace: 'nowrap' }}>
              后台还在抽取分镜，已完成 {completedEpisodesCount}/{activeEpisodes.length} 集
            </span>
          </div>
        )}
        <div ref={batchBtnRef} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {downloadMode ? (
            <>
              {/* 已选数量 / 总数 */}
              <span style={{
                fontFamily: FONT,
                fontSize: '14px',
                lineHeight: '18px',
                color: 'rgba(255,255,255,0.45)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}>
                已选 {selectedShotIds.size} / {shots.length}
              </span>

              {/* 全选 / 取消全选 — checkbox + 文字 */}
              <label
                onClick={toggleSelectAll}
                className="flex items-center gap-[4px] h-[36px] px-[16px] cursor-pointer select-none shrink-0"
              >
                {/* checkbox — 按组件规范，p-[2px] 外层 + token 类名 + border-solid + outline */}
                <div className="flex items-center gap-0 p-[2px] cursor-pointer">
                  <div className={
                    "relative rounded-sm shrink-0 border border-solid w-[16px] h-[16px] [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 " +
                    (selectedShotIds.size === shots.length
                      ? "bg-checkbox-bg-active border-checkbox-border-active"
                      : "bg-checkbox-bg-normal border-checkbox-border-normal")
                  }>
                    {selectedShotIds.size === shots.length && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%" }}>
                        <path d="M3.333 8L6.667 11.333L13.333 4.667"
                          stroke="#FFFFFF"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                {/* 文字 */}
                <span style={{
                  fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: '#FFFFFF',
                  whiteSpace: 'nowrap',
                }}>
                  {selectedShotIds.size === shots.length ? '取消全选' : '全选'}
                </span>
              </label>

              {/* 下载图片 */}
              <GhostBtn icon={<IconDownload />} onClick={handleDownloadImages}>
                下载图片
              </GhostBtn>

              {/* 下载视频 */}
              <GhostBtn icon={<IconDownload />} onClick={handleDownloadVideos}>
                下载视频
              </GhostBtn>

              {/* 取消 — Secondary 按钮 */}
              <SecondaryBtn onClick={exitDownloadMode}>
                取消
              </SecondaryBtn>
            </>
          ) : (
            <>
              {batchExpanded ? (
                <>
                  <GhostBtn icon={<IconBatchImage />} onClick={() => { setBatchExpanded(false); setShowImageModal(true); }} loading={generatingImages || generatingVideos} disabled={generatingImages || generatingVideos}>批量生成分镜图</GhostBtn>
                  <GhostBtn icon={<IconBatchVideo />} onClick={() => { setBatchExpanded(false); setShowVideoModal(true); }} loading={generatingImages || generatingVideos} disabled={generatingImages || generatingVideos}>批量生成分镜视频</GhostBtn>
                </>
              ) : (
                <GhostBtn icon={<IconBatchImage />} onClick={() => setBatchExpanded(true)} loading={generatingImages || generatingVideos} disabled={generatingImages || generatingVideos}>批量生成</GhostBtn>
              )}
              <GhostBtn icon={<IconDownload />} onClick={enterDownloadMode} disabled={generatingImages || generatingVideos}>批量下载</GhostBtn>
              <PrimaryBtn icon={<IconEdit />} onClick={handleStartEdit}>开始剪辑</PrimaryBtn>
            </>
          )}
        </div>
      </div>

      {/* 分镜标题 + 镜头数 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontWeight: 500 }}>
          分镜
        </span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '16px', borderRadius: '999px', padding: '0 5px', backgroundColor: 'rgba(255,255,255,0.10)' }}>
          <span style={{ fontSize: '12px', lineHeight: '100%', color: 'rgba(255,255,255,0.80)', fontFamily: 'AlibabaPuHuiTi_2_55_Regular, "Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>{shots.length}</span>
        </div>
      </div>

      {/* 分镜列表 */}
      <div
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}
        onDragEnd={() => { setDragId(null); setOverId(null); }}
      >
        {/* top sentinel — drop zone for placing before the first card */}
        {dragId && (
          <div
            style={{ height: '8px', flexShrink: 0, marginBottom: '-8px' }}
            onDragOver={(e) => { e.preventDefault(); setOverId('__before_first'); }}
            onDrop={(e) => { e.preventDefault(); handleDrop('__before_first'); }}
          />
        )}
        {shots.map((shot, idx) => (
          <ShotRow
            key={shot.id}
            shot={shot}
            projectId={projectId}
            onChange={(next) => updateShot(shot.id, next)}
            onAdd={() => addShotAfter(shot.id)}
            onCopy={() => copyShot(shot.id)}
            onDelete={() => deleteShot(shot.id)}
            chars={chars}
            isDragging={dragId === shot.id}
            insertBefore={(overId === shot.id || (overId === '__before_first' && idx === 0)) && dragId !== shot.id}
            insertAfter={overId === '__after_last' && idx === shots.length - 1 && dragId !== shot.id}
            onDragStart={() => setDragId(shot.id)}
            onDragOver={() => { if (dragId && dragId !== shot.id) setOverId(shot.id); }}
            onDrop={() => handleDrop(shot.id)}
            onGenerateImage={() => {
              // 打开面板前，检查历史列表是否已初始化，若为空则用定稿结果初始化
              setGenImageHistoryMap((prev) => {
                const shotId = shot.id;
                if (!prev[shotId] || prev[shotId].length === 0) {
                  const initialized = { ...prev };
                  if (shot.storyboardImage?.url) {
                    initialized[shotId] = [{ url: shot.storyboardImage.url, settled: true, id: shot.storyboardImage.id }];
                  } else {
                    initialized[shotId] = [];
                  }
                  return initialized;
                }
                return prev;
              });
              setImagePanel({ shot });
            }}
            onGenerateVideo={() => {
              // 打开面板前，检查历史列表是否已初始化，若为空则用定稿结果初始化
              setGenVideoHistoryMap((prev) => {
                const shotId = shot.id;
                if (!prev[shotId] || prev[shotId].length === 0) {
                  const initialized = { ...prev };
                  if (shot.storyboardVideo?.url) {
                    initialized[shotId] = [{ url: shot.storyboardVideo.url, settled: true, id: shot.storyboardVideo.id }];
                  } else {
                    initialized[shotId] = [];
                  }
                  return initialized;
                }
                return prev;
              });
              setVideoPanel({ shot, nextShot: shots[idx + 1] ?? null });
            }}
            globalVoiceParams={globalVoiceParams}
            onSaveGlobalVoice={(role, params) => setGlobalVoiceParams((prev) => ({ ...prev, [role]: params }))}
            generatingImage={generatingImageShotIds.has(shot.id)}
            generatingVideo={generatingVideoShotIds.has(shot.id)}
            isSelectMode={downloadMode}
            isSelected={selectedShotIds.has(shot.id)}
            onToggleSelect={() => toggleShotSelection(shot.id)}
          />
        ))}
        {/* bottom sentinel — drop zone for placing after the last card */}
        {dragId && (
          <div
            style={{ height: '40px', flexShrink: 0 }}
            onDragOver={(e) => { e.preventDefault(); setOverId('__after_last'); }}
            onDrop={(e) => { e.preventDefault(); handleDrop('__after_last'); }}
          />
        )}

        {/* 新增行按钮 */}
        <div
          onClick={addNewShot}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '40px',
            minWidth: '1160px',
            borderRadius: '12px',
            border: '1px dashed rgba(255,255,255,0.12)',
            cursor: 'pointer',
            flexShrink: 0,
            gap: '6px',
            color: 'rgba(255,255,255,0.40)',
            fontSize: '14px',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.70)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
          }}
        >
          <IconPlus color="currentColor" />
          添加空白分镜
        </div>
      </div>
    </div>
    {showImageModal && (
      <BatchImageModal
        shotCount={shots.length}
        onClose={() => setShowImageModal(false)}
        onConfirm={(params) => startBatchGenImages(params)}
      />
    )}
    {showVideoModal && (
      <BatchVideoModal
        shotCount={shots.length}
        onClose={() => setShowVideoModal(false)}
        onConfirm={(params) => startBatchGenVideos(params)}
      />
    )}
    {showDownloadModal && (
      <BatchDownloadModal
        shots={shots}
        onClose={() => setShowDownloadModal(false)}
        onConfirm={(items) => {
          items.forEach(({ url, name }) => {
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          });
          if (items.length > 0) showToast(`已下载 ${items.length} 个素材`, 'success');
        }}
      />
    )}
    {imagePanel && (
      <GenerateImagePanel
        shot={imagePanel.shot}
        chars={chars}
        projectId={projectId}
        scenes={scenes}
        props={props}
        generatedImages={genImageHistoryMap[imagePanel.shot?.id] ?? []}
        onSetGeneratedImages={(updater) => {
          const shotId = imagePanel.shot?.id;
          setGenImageHistoryMap((prev) => ({
            ...prev,
            [shotId]: typeof updater === 'function' ? updater(prev[shotId] ?? []) : updater,
          }));
        }}
        onClose={() => setImagePanel(null)}
        onShowToast={showToast}
       onSettleImage={(imageUrl) => {
         const n = normalizeImageUrl(imageUrl);
         setShots((prev) => {
           const updated = prev.map((s) => s.id === imagePanel.shot.id
             ? { ...s, storyboardImage: { id: n, url: n, name: '分镜图', type: 'image/jpeg' } }
             : s
           );
           apiUpdateStoryboard(projectId, imagePanel.shot.id, toBackendStoryboard(updated.find(s => s.id === imagePanel.shot.id))).catch(console.error);
           return updated;
         });
       }}
      onGenerate={async (params) => {
        const shot = imagePanel.shot;
        try {
          setGeneratingImageShotIds(prev => new Set([...prev, shot.id]));
          const taskResp = await apiGenerateStoryboardImage(projectId, shot.id, { model: params.model, resolution: params.resolution, prompt: params.prompt, aspect_ratio: projectRatio, reference_images: (params.refImages || []).map(r => toAbsoluteUrl(typeof r === 'string' ? r : r.url)).filter(url => url && !url.toLowerCase().endsWith(".avif") && !url.includes("/derived/assets/")) });
          const task = await pollTask(taskResp.id, hasImageTaskResult);
          if (task.status === 'completed' || task.status === 'partial' || hasImageTaskResult(task)) {
             const imageUrl = extractImageUrlFromTask(task);
             if (imageUrl) {
               const normalizedUrl = normalizeImageUrl(imageUrl);
               setShots((prev) => prev.map((s) => s.id === shot.id && !s.storyboardImage
                 ? { ...s, storyboardImage: { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg' } }
                 : s
               ));
               return { url: normalizedUrl };
             }
           }
           throw new Error('生成失败，请重试');
         } catch (err) {
          console.error('[StoryboardPage] 生成分镜图失败:', err);
          throw err;
        } finally {
          setGeneratingImageShotIds(prev => {
            const next = new Set(prev); next.delete(shot.id); return next;
          });
        }
      }}
      />
    )}
    {videoPanel && (
      <GenerateVideoPanel
        shot={videoPanel.shot}
        projectId={projectId}
        nextShot={videoPanel.nextShot}
        chars={chars}
        scenes={scenes}
        props={props}
        generatedVideos={genVideoHistoryMap[videoPanel.shot?.id] ?? []}
        onSetGeneratedVideos={(updater) => {
          const shotId = videoPanel.shot?.id;
          setGenVideoHistoryMap((prev) => ({
            ...prev,
            [shotId]: typeof updater === 'function' ? updater(prev[shotId] ?? []) : updater,
          }));
        }}
        onClose={() => setVideoPanel(null)}
        onShowToast={showToast}
        onSettleVideo={(videoUrl) => {
          const n = normalizeImageUrl(videoUrl);
          const shotId = videoPanel.shot.id;
          setShots((prev) => {
            const updated = prev.map((s) => s.id === shotId
              ? { ...s, storyboardVideo: { id: n, url: n, name: 'generated.mp4', type: 'video/mp4' } }
              : s
            );
            return updated;
          });
          // API 调用放在 setShots 外面，避免在 state updater 内产生副作用
          apiUpdateStoryboard(projectId, shotId, { video_url: n })
            .then((res) => console.log('[onSettleVideo] video_url 保存成功，后端返回:', JSON.stringify(res)))
            .catch((err) => console.error('[onSettleVideo] video_url 保存失败', err));
        }}
       onGenerate={async (params) => {
         const shot = videoPanel.shot;
         try {
           setGeneratingVideoShotIds(prev => new Set([...prev, shot.id]));
           // 解析时长：将"Ns"格式转为数字
           const durationValue = (() => {
              if (!params.duration) return undefined;
              const parsed = parseFloat(params.duration);
              return isNaN(parsed) ? undefined : parsed;
            })();
            const taskResp = await apiGenerateStoryboardVideo(projectId, shot.id, {
                model: params.model,
                resolution: params.resolution,
                duration: durationValue,
                sound_effect: params.sound,
                prompt: params.prompt,
                ratio: projectRatio,
                reference_images: (params.reference_images || (params.refImages || []).map(r => toAbsoluteUrl(typeof r === 'string' ? r : r.url)).filter(url => url && !url.toLowerCase().endsWith(".avif") && !url.includes("/derived/assets/"))),
                first_frame_url: toAbsoluteUrl(params.first_frame_url),
                last_frame_url: toAbsoluteUrl(params.last_frame_url),
                reference_video_url: toAbsoluteUrl(params.reference_video_url),
                reference_audio_url: toAbsoluteUrl(params.reference_audio_url),
              });
            const task = await pollTask(taskResp.id, hasVideoTaskResult);
            const videoUrl = extractVideoUrlFromTask(task);
            if (videoUrl) {
              const normalizedUrl = normalizeImageUrl(videoUrl);
              // 将参考素材信息一并存入 shot，供查看弹窗展示
              const refInfo = {
                referenceImages: params.reference_images?.length > 0 ? params.reference_images : undefined,
                firstFrameUrl: params.first_frame_url || undefined,
                lastFrameUrl: params.last_frame_url || undefined,
                referenceVideoUrl: params.reference_video_url || undefined,
                referenceAudioUrl: params.reference_audio_url || undefined,
              };
              setShots((prev) => {
                const updated = prev.map((s) => s.id === shot.id && !s.storyboardVideo
                  ? { ...s, storyboardVideo: { id: `vid-${shot.id}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4' }, ...refInfo }
                  : s
                );
                // 若该分镜尚无视频（首次生成），自动持久化到后端
                const wasEmpty = !prev.find(s => s.id === shot.id)?.storyboardVideo;
                if (wasEmpty) {
                  apiUpdateStoryboard(projectId, shot.id, { video_url: normalizedUrl }).catch(console.error);
                }
                return updated;
              });
              onVideoGenerated?.(activeEpisodes.findIndex(ep => getEpisodeId(ep) === getEpisodeId(episode)));
              return { url: normalizedUrl };
            }
            // 终态但没有视频 — 发送 toast 提示失败
            const failStatuses = ['failed', 'cancelled', 'canceled', 'expired', 'error'];
            if (failStatuses.includes(task.status) || (!task.result && !task.results?.length)) {
              const errMsg = task.error_msg || task.errorMsg
              || (Array.isArray(task.results) && task.results[0]?.error)
              || (task.status ? `任务状态: ${task.status}` : '');
              throw Object.assign(new Error(errMsg || '视频生成失败'), { status: task.status });
            }
            throw new Error('生成失败，请重试');
          } catch (err) {
           console.error('[StoryboardPage] 生成分镜视频失败:', err);
           throw err;
         } finally {
           setGeneratingVideoShotIds(prev => {
             const next = new Set(prev); next.delete(shot.id); return next;
           });
         }
       }}
      />
    )}
    {toast && createPortal(
      <div style={{
        position: 'fixed',
        top: '25vh',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
        animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}>
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
