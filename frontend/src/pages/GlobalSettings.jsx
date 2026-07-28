/**
 * @file GlobalSettings.jsx
 * @structure-index
 *
 * ─── 全局常量 & 配置 ───────────────────────────────────────────────
 *   ScriptPage 懒加载定义                                        L40
 *   FONT / FONT_MEDIUM                                           L58–L59
 *   VISUAL_STYLES                                                L62
 *
 * ─── 结果/状态展示组件 ───────────────────────────────────────────
 *   <StatCard>                                                   L79
 *   EPISODE_STATUS / <EpisodeCard> / <EpisodeGrid>               L165 / L171 / L229
 *   SubjectOverviewCard（主体概览容器）                            L752
 *
 * ─── 表单与业务交互组件 ─────────────────────────────────────────
 *   <TextInput> / <TextArea>                                     L289 / L354
 *   <CoverUpload>                                                L403
 *   <ProjectNameHeading>                                         L518
 *
 * ─── 主页面入口 ─────────────────────────────────────────────────
 *   export default function GlobalSettings()                      L577
 *     ├─ [状态] name / description / coverUrl / isSaving          L609–L612
 *     ├─ [Ref] saveTimerRef / onProjectUpdateRef                   L613–L614
 *     ├─ [函数] saveImmediately()                                  L618
 *     ├─ [副作用] onProjectUpdate 引用同步                         L615
 *     ├─ [副作用] 表单变更 debounce 自动保存                           L646
 *     └─ [渲染] ScriptPage 通过 Suspense 按需加载                    L717
 *
 * ─── 更新记录 ──────────────────────────────────────────────────────
 *   2026-07-15  修复 ScriptPage 草稿回调引用缺失，统一使用 onScriptDraftContentChange
 *   2026-07-15  修正懒加载、Suspense、主入口副作用与各定义的实际结构索引行号
 *   2026-07-15  将封面上传按钮迁移到 Button 基础能力
 *   2026-07-15  将文件选择器移出按钮内容树
 *   2026-07-15  校正 props 同步副作用的结构索引行号
 *   2026-07-16  由 Home 按项目 ID 重建页面实例，移除同步草稿的级联 effect
 *   2026-07-21  抽离资产概况中的 ScriptProgress 与 ScriptProgressCard
 *   2026-07-21  资产概况剧本、角色、场景、道具内容区限制为两行并支持区域内滚动
 *   2026-07-22  资产概况四类卡片统一为四列固定占比，数量不足四张时保留空列
 *   2026-07-23  资产概况外层容器补齐 100% 高度，匹配总览页容器布局反馈
 *   2026-07-23  收敛资产概况滚动边界，避免内容撑出总览外层容器
 *   2026-07-23  按页面反馈将资产概况外层底部内边距调整为 0px
 *   2026-07-27  资产概况跳转主体页时仅查看已有结果，不重复触发主体抽取
 *   2026-07-28  剧集进度按项目工作流解锁状态展示，视频生成不直接标记“剪辑中”
 */

import { lazy, Suspense, useState, useRef, useCallback, useEffect } from 'react';

const ScriptPage = lazy(() => import('./ScriptPage'));
import { apiUploadProjectCover } from '../api/project';
import { normalizeImageUrl } from '../utils/imageUrl';
import { Button, Tabs, TextField, OptionTabs } from '../components/ui';
import { ScriptProgress } from '../components/project';
import { CharIcon, SceneIcon, PropIcon } from '../components/subject/SubjectTypeIcons';
import styleXianxia from '../assets/styles/xianxia-3d.avif';
import styleSuspenseAnime from '../assets/styles/suspense-anime-2d.avif';
import styleCyberpunk from '../assets/styles/cyberpunk-3d.avif';
import stylePixar from '../assets/styles/pixar-style.avif';
import styleWuxia from '../assets/styles/wuxia-cg.avif';
import styleGhibli from '../assets/styles/ghibli-style.avif';
import styleShinkai from '../assets/styles/shinkai-style.avif';
import styleAncientChinese from '../assets/styles/ancient-chinese.avif';
import styleUrbanWorkplace from '../assets/styles/urban-workplace.avif';
import stylePostApocalyptic from '../assets/styles/post-apocalyptic.avif';
import styleLiveActionSuspense from '../assets/styles/live-action-suspense.avif';
import styleMagicEpic from '../assets/styles/magic-epic-3d.avif';
import styleJpkr2d from '../assets/styles/jpkr-2d.avif';
import styleInkGuofeng from '../assets/styles/ink-guofeng-2d.avif';
import styleDarkGothic from '../assets/styles/dark-gothic-2d.avif';
import styleLiveActionGufeng from '../assets/styles/live-action-gufeng.avif';
import styleUrbanEmotion from '../assets/styles/urban-emotion.avif';
import styleXianxiaFantasy from '../assets/styles/xianxia-fantasy.avif';
import styleLiveActionHorror from '../assets/styles/live-action-horror.avif';
import styleRealisticEra from '../assets/styles/realistic-era.avif';
import styleFutureScifi from '../assets/styles/future-scifi.avif';
import styleWuxiaWar from '../assets/styles/wuxia-war.avif';
import styleRural from '../assets/styles/rural-style.avif';

// ─────────────────────────────────────────────────────────────────────────────

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

// 视觉风格映射（与 NewProjectModal 完全对齐）
const VISUAL_STYLES = {
  custom:                        { label: '自定义',      coverImg: null },
  'xianxia-3d':                  { label: '3D国漫仙侠',  coverImg: styleXianxia },
  'suspense-anime-2d':           { label: '2D悬疑恐怖',  coverImg: styleSuspenseAnime },
  'cyberpunk-3d':                { label: '3D赛博朋克',  coverImg: styleCyberpunk },
  'ghibli-style':                { label: '宫崎骏风格',  coverImg: styleGhibli },
  'shinkai-style':               { label: '新海诚风格',  coverImg: styleShinkai },
  'ancient-chinese-live-action': { label: '3D国风正剧',  coverImg: styleAncientChinese },
  'magic-epic-3d':               { label: '3D魔幻史诗',  coverImg: styleMagicEpic },
  'pixar-style':                 { label: '3D Q版',      coverImg: stylePixar },
  'wuxia-cg':                    { label: '武侠CG',      coverImg: styleWuxia },
  'jpkr-2d':                     { label: '日韩二次元',  coverImg: styleJpkr2d },
  'ink-guofeng-2d':              { label: '2D写意古风',  coverImg: styleInkGuofeng },
  'dark-gothic-2d':              { label: '暗黑哥特',    coverImg: styleDarkGothic },
  'live-action-gufeng':          { label: '古风写实',    coverImg: styleLiveActionGufeng },
  'urban-emotion':               { label: '都市情感',    coverImg: styleUrbanEmotion },
  'xianxia-fantasy':             { label: '仙侠玄幻',    coverImg: styleXianxiaFantasy },
  'live-action-horror':          { label: '悬疑恐怖',    coverImg: styleLiveActionHorror },
  'post-apocalyptic-modern':     { label: '末日废土',    coverImg: stylePostApocalyptic },
  'realistic-era':               { label: '写实年代剧',  coverImg: styleRealisticEra },
  'future-scifi':                { label: '未来科幻',    coverImg: styleFutureScifi },
  'urban-workplace':             { label: '都市职场',    coverImg: styleUrbanWorkplace },
  'wuxia-war':                   { label: '武侠战争',    coverImg: styleWuxiaWar },
  'rural-style':                 { label: '乡土风格',    coverImg: styleRural },
  'live-action-suspense':        { label: '真人悬疑',    coverImg: styleLiveActionSuspense },
};

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, count, images = [], onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isClickable = !!onClick;
  const hasImages = images.length > 0;
  const gridImages = images.slice(0, 6);

  return (
    <div
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isClickable && setPressed(true)}
      onMouseUp={() => isClickable && setPressed(false)}
      onClick={onClick}
      style={{
        height: '200px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderRadius: '8px',
        padding: '16px',
        position: 'relative',
        background: pressed ? '#252525' : hovered ? '#222222' : '#1D1E1E',
        border: `1px solid ${hovered ? '#FFFFFF26' : '#FFFFFF14'}`,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* header inside card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '100%', color: '#FFFFFF' }}>{label}</span>
        <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', color: '#FFFFFF99' }}>{count ?? 0} 个</span>
      </div>
      {/* content area */}
      {hasImages ? (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: '4px',
          minHeight: 0,
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderRadius: '4px', overflow: 'hidden', background: '#FFFFFF08' }}>
              {gridImages[i] && (
                <img src={gridImages[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="24" height="24" rx="4" stroke="#FFFFFF26" strokeWidth="1.5" />
            <circle cx="12" cy="13" r="2.5" stroke="#FFFFFF26" strokeWidth="1.5" />
            <path d="M4 22L10 16L14 20L20 13L28 22" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33' }}>暂无素材</span>
        </div>
      )}
      {isClickable && hovered && (
        <div style={{
          position: 'absolute', bottom: '10px', right: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '20px', height: '20px', borderRadius: '9999px',
          background: '#FFFFFF14', zIndex: 1,
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 12L12 4M12 4H6M12 4V10" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Episode grid ───────────────────────────────────────────────────────────

const EPISODE_STATUS = {
  edited:    { bg: '#003422', border: '#52BF9266', color: '#52BF92', label: '已剪辑定稿' },
  generated: { bg: '#06252C', border: '#2DC3E166', color: '#2DC3E1', label: '已生成视频，待剪辑' },
  pending:   { bg: '#FFFFFF08', border: '#FFFFFF14', color: '#FFFFFF99', label: '未生成视频' },
};

function EpisodeCard({ index, status = 'pending', onClick }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const s = EPISODE_STATUS[status] || EPISODE_STATUS.pending;
  const label = String(index + 1).padStart(2, '0');
  const isClickable = status === 'generated' || status === 'edited';

  const handleMouseEnter = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setHovered(true);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        onClick={isClickable ? onClick : undefined}
        style={{
          width: '100%',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '5px',
          background: s.bg,
          border: `1px solid ${s.border}`,
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'opacity 0.12s',
          opacity: hovered && isClickable ? 0.7 : 1,
        }}
      >
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '100%', color: s.color }}>{label}</span>
      </div>
      {hovered && (
        <div style={{
          position: 'fixed',
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: 'translate(-50%, -100%)',
          background: '#2A2A2A',
          border: '1px solid #FFFFFF14',
          borderRadius: '6px',
          padding: '6px 10px',
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>
            第{index + 1}集 · {s.label}{isClickable ? ' · 点击跳转' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

function EpisodeGrid({ episodes = [], statuses = {}, onEpisodeClick }) {
  const total = episodes.length;
  const isEmpty = total === 0;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      borderRadius: '8px',
      padding: '16px',
      background: '#1D1E1E',
      border: '1px solid #FFFFFF14',
      height: '200px',
      boxSizing: 'border-box',
    }}>
      {/* header inside card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '100%', color: '#FFFFFF' }}>剧集结构</span>
        {!isEmpty && <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', color: '#FFFFFF99' }}>共 {total} 集</span>}
      </div>
      {isEmpty ? (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="6" width="24" height="20" rx="3" stroke="#FFFFFF26" strokeWidth="1.5" />
            <path d="M4 12H28" stroke="#FFFFFF26" strokeWidth="1.5" />
            <path d="M11 6V12" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M21 6V12" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="8" y="16" width="4" height="3" rx="1" fill="#FFFFFF26" />
            <rect x="14" y="16" width="4" height="3" rx="1" fill="#FFFFFF26" />
            <rect x="20" y="16" width="4" height="3" rx="1" fill="#FFFFFF26" />
          </svg>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33' }}>暂无剧集</span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(32px, 1fr))',
          gap: '6px',
          overflowY: 'auto',
          alignContent: 'flex-start',
          flex: 1,
          paddingRight: '2px',
        }}>
          {episodes.map((_, i) => (
            <EpisodeCard key={i} index={i} status={statuses[i] ?? 'pending'} onClick={() => onEpisodeClick?.(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Text input ─────────────────────────────────────────────────────────────

function TextInput({ value, onChange, placeholder, maxLength }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '36px',
        width: '100%',
        borderRadius: '8px',
        paddingLeft: '12px',
        paddingRight: '6px',
        background: focused ? '#252525' : hovered ? '#222222' : '#1D1E1E',
        border: `1px solid ${focused ? '#FFFFFF33' : '#FFFFFF14'}`,
        outline: focused ? '1px solid #2DC3E180' : '1px solid #00000080',
        boxSizing: 'border-box',
        transition: 'background 0.2s, border-color 0.2s, outline 0.2s',
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="placeholder:text-[#FFFFFF66]"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '18px',
          color: '#FFFFFF',
        }}
      />
      {maxLength !== undefined && (
        <span
          style={{
            fontFamily: FONT,
            fontSize: '12px',
            lineHeight: '18px',
            color: 'rgba(255, 255, 255, 0.4)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

// ── Textarea ───────────────────────────────────────────────────────────────

function TextArea({ value, onChange, placeholder, maxLength }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <textarea
        value={value}
        onChange={(e) => {
          let v = e.target.value;
          if (maxLength !== undefined) v = v.slice(0, maxLength);
          onChange(v);
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          height: '72px',
          width: '100%',
          borderRadius: '8px',
          padding: '9px 12px',
          background: focused ? '#252525' : hovered ? '#222222' : '#1D1E1E',
          border: `1px solid ${focused ? '#FFFFFF33' : '#FFFFFF14'}`,
          outline: focused ? '1px solid #2DC3E180' : '1px solid #00000080',
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '18px',
          color: value ? '#FFFFFF' : '#FFFFFF66',
          resize: 'none',
          boxSizing: 'border-box',
          transition: 'background 0.2s, border-color 0.2s, outline 0.2s',
        }}
      />
      {maxLength !== undefined && (
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33', textAlign: 'right' }}>
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

// ── Cover upload ───────────────────────────────────────────────────────────

function CoverUpload({ coverUrl, onUpload, isSaving }) {
  const [hovered, setHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; }
    e.target.value = '';

    setIsUploading(true);
    try {
      const url = await apiUploadProjectCover(file);
      if (url) onUpload(url);
    } catch (err) {
      console.error('[CoverUpload] 上传失败', err);
    } finally {
      setIsUploading(false);
    }
  };

  const busy = isUploading || isSaving;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={coverUrl ? '更换项目封面' : '上传项目封面'}
        onClick={() => !busy && fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !busy && fileInputRef.current?.click(); } }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          // 设计稿 h-65 = 260px；有封面时保持同高
          height: '260px',
          borderRadius: '8px',
          gap: '8px',
          alignSelf: 'stretch',
          background: coverUrl ? 'transparent' : '#1D1E1E',
          // 设计稿 border-width:1.5px dashed border-[#FFFFFF1A]；悬停时变亮
          border: coverUrl ? 'none' : `1.5px dashed ${hovered ? '#FFFFFF33' : '#FFFFFF1A'}`,
          cursor: busy ? 'not-allowed' : 'pointer',
          overflow: 'hidden',
          position: 'relative',
          transition: 'border-color 0.2s',
          opacity: busy ? 0.6 : 1,
          boxSizing: 'border-box',
        }}
      >
        {coverUrl ? (
          <>
            <img src={normalizeImageUrl(coverUrl)} alt="项目封面" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {busy && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '8px',
              }}>
                <div style={{
                  width: '24px', height: '24px',
                  border: '2px solid #FFFFFF33',
                  borderTopColor: '#FFFFFF',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF99' }}>
                  {isUploading ? '上传中...' : '保存中...'}
                </span>
              </div>
            )}
            {hovered && !busy && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '8px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="#FFFFFF99" strokeWidth="1.5" />
                  <circle cx="8.5" cy="8.5" r="1.5" stroke="#FFFFFF99" strokeWidth="1.5" />
                  <path d="M3 15l5-5 4 4 3-3 6 6" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF99' }}>点击更换封面</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 图标：静默态 #FFFFFF33，悬停态 #FFFFFF66 */}
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', flexShrink: 0 }}>
              <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" style={{ transition: 'stroke 0.2s' }} />
              <circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" style={{ transition: 'stroke 0.2s' }} />
              <path d="M3 15l5-5 4 4 3-3 6 6" fill="none" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.2s' }} />
            </svg>
            {/* 文字：gap-0.5 = 2px */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: hovered ? '#FFFFFF99' : '#FFFFFF66', transition: 'color 0.2s' }}>点击上传封面图片</span>
              <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33' }}>支持 JPG、PNG，建议尺寸 16:9</span>
            </div>
          </>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </>
  );
}

// ── Project name heading (editable inline) ─────────────────────────────────

function ProjectNameHeading({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef(null);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const stopEdit = () => setEditing(false);

  return editing ? (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={stopEdit}
      onKeyDown={(e) => { if (e.key === 'Enter') stopEdit(); }}
      style={{
        fontFamily: FONT_MEDIUM,
        fontWeight: 500,
        fontSize: '20px',
        lineHeight: '24px',
        color: '#FFFFFF',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        borderBottom: '1px solid #FFFFFF33',
        padding: '0 2px',
        minWidth: '120px',
      }}
      autoFocus
    />
  ) : (
    <div
      style={{
        fontFamily: FONT_MEDIUM,
        fontWeight: 500,
        fontSize: '20px',
        lineHeight: '24px',
        color: '#FFFFFF',
        cursor: 'text',
        borderBottom: hovered ? '1px solid #FFFFFF33' : '1px solid transparent',
        padding: '0 2px',
        transition: 'border-color 0.15s',
      }}
      onClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {value || '项目名称'}
    </div>
  );
}

// ── Subject Image Card ─────────────────────────────────────────────────────

const ArrowUpRightIcon = () => (
  <svg viewBox="0 0 81.92 81.92" width="16" height="16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M0-0.001h81.92v81.92H0z" fill="#000000" style={{ opacity: 0.01 }} />
    <path d="M24.148 64.038a2.94 2.94 0 0 1-4.155-0.091 2.94 2.94 0 0 1-0.123-4.114l0.036-0.037 36.505-36.509a2.94 2.94 0 0 1 4.155 0.091 2.94 2.94 0 0 1 0.123 4.119l-0.032 0.036-36.509 36.505z" fill="#FFFFFFCC" />
    <path d="M63.169 55.791a3.004 3.004 0 0 1-6.003 0.046V23.692a3.004 3.004 0 0 1 6.003-0.045v32.149z" fill="#FFFFFFCC" />
    <path d="M28.176 26.669a3.004 3.004 0 0 1-0.046-5.999H60.229a3.004 3.004 0 0 1 0.046 5.999H28.18z" fill="#FFFFFFCC" />
  </svg>
);

// 按主体类型返回对应占位图标
const SUBJECT_TYPE_ICON = {
  char:  (size) => <CharIcon size={size} />,
  scene: (size) => <SceneIcon size={size} />,
  prop:  (size) => <PropIcon size={size} />,
};

/**
 * SubjectImageCard
 * 主体概览卡片，支持三种交互态：
 *   default  — 静止态
 *   hovered  — 鼠标悬停，边框加亮 + 轻微白色蒙层
 *   active   — 鼠标按下 / selected，边框变蓝 + 轻压暗蒙层
 *
 * Props
 *   subject   { id, name, imageUrl }  主体数据
 *   type      'char' | 'scene' | 'prop'  决定无图占位图标
 *   selected  boolean                  激活态（蓝色边框）
 *   onClick   () => void               点击回调，不传则卡片不可交互
 */
function SubjectImageCard({ subject, type = 'char', selected = false, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const hasImage = !!subject.imageUrl;
  const placeholderIcon = SUBJECT_TYPE_ICON[type] ?? SUBJECT_TYPE_ICON.char;
  const isClickable = !!onClick;

  // ── 边框颜色：激活 > 悬停 > 默认 ──────────────────────────────
  const borderColor = selected
    ? '#2DC3E1'
    : hovered
    ? '#FFFFFF26'
    : '#FFFFFF14';

  // ── 背景色：有图时压暗按下；无图时亮化悬停/压暗按下 ──────────
  const bgColor = hasImage
    ? 'transparent'
    : pressed ? '#2A2B2B' : '#262727';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isClickable && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
      style={{
        width: '100%',
        height: '140px',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        outline: selected ? '2px solid #2DC3E133' : 'none',
        outlineOffset: '1px',
        boxSizing: 'border-box',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.12s',
        flexShrink: 0,
      }}
    >
      {/* 图片 */}
      {hasImage && (
        <img
          src={subject.imageUrl}
          alt={subject.name || ''}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: pressed ? 0.82 : 1,
            transition: 'opacity 0.12s',
          }}
        />
      )}

      {/* 无图占位图标：水平居中，向上偏移避免与底部渐变重叠 */}
      {!hasImage && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, calc(-50% - 10px))',
          pointerEvents: 'none',
        }}>
          {placeholderIcon(32)}
        </div>
      )}

      {/* 底部渐变 + 主体名称（始终渲染，匹配 Paper 设计稿） */}
      <div style={{
        position: 'absolute',
        bottom: -1,
        left: -1,
        right: -1,
        height: '73px',          // h-18.25 × 4px = 73px
        paddingTop: '18px',      // pt-4.5
        paddingBottom: '12px',   // pb-3
        paddingLeft: '16px',     // px-4
        paddingRight: '16px',
        display: 'flex',
        alignItems: 'flex-end',
        backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 0%, oklab(0% 0 0) 100%)',
        borderRadius: '0 0 8px 8px',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '16px',
          color: '#FFFFFF',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
          flex: 1,
          minWidth: 0,
        }}>
          {subject.name || '未命名'}
        </span>
      </div>

      {/* 悬停 / 按下蒙层（图片卡片用，无图卡片靠背景色变化表达） */}
      {hasImage && hovered && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: pressed ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
          transition: 'background 0.12s',
        }} />
      )}
    </div>
  );
}

function SubjectOverviewCard({ label, type = 'char', subjects = [], emptyLabel, onNavigate }) {
  const finalizedCount = subjects.filter(s => s.imageUrl).length;
  const total = subjects.length;
  const emptyIcon = SUBJECT_TYPE_ICON[type] ?? SUBJECT_TYPE_ICON.char;
  return (
    <div style={{ width: '1000px', borderRadius: '8px', padding: '16px', background: '#1D1E1E', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', flexShrink: 0 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', color: '#FFFFFF' }}>{label}</span>
          <span style={{ fontFamily: FONT, fontSize: '12px', color: '#FFFFFF80' }}>定稿：{finalizedCount}/{total}</span>
        </div>
        {onNavigate && (
          <button
            type="button"
            title={`打开${label}主体页`}
            aria-label={`打开${label}主体页`}
            onClick={onNavigate}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, lineHeight: 0 }}
          >
            <ArrowUpRightIcon />
          </button>
        )}
      </div>

      {/* 内容区 */}
      {total === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0' }}>
          {emptyIcon(32)}
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33' }}>
            {emptyLabel || `暂无${label}`}
          </span>
        </div>
      ) : (
        /* gap-2 = 8px，对应 Paper 设计稿 */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          alignContent: 'start',
          gap: '8px',
          maxHeight: '288px',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: '2px',
          boxSizing: 'border-box',
        }}>
          {subjects.map((subject) => (
            <SubjectImageCard
              key={subject.id}
              subject={subject}
              type={type}
              onClick={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Overview tab constants ─────────────────────────────────────────────────

const TAB_OPTIONS = [
  { value: 'overview', label: '资产概况' },
  { value: 'info', label: '项目信息' },
  { value: 'team', label: '团队管理' },
];

// ── Main ───────────────────────────────────────────────────────────────────

export default function GlobalSettings({
  projectName = '',
  projectId,
  projectDescription = '',
  projectCoverUrl = '',
  projectRatio = '16:9',
  projectStyle = 'xianxia-3d',
  projectCreationType = 'dialogue',
  onProjectUpdate,
  onBack,
  activeStep,
  onGoToSubject,
  isSubjectUnlocked = false,
  scriptFinalizedSinceExtraction = false,
  onScriptFinalized,
  onEpisodesChange,
  chars = [],
  scenes = [],
  props = [],
  episodes = [],
  scriptPhase,
  onScriptPhaseChange,
  scriptHasStarted,
  onScriptHasStartedChange,
  scriptContent,
  onScriptContentChange,
  scriptDraftContent,
  onScriptDraftContentChange,
  episodeStatuses = {},
  onGoToStoryboard,
}) {
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState(projectDescription);
  const [coverUrl, setCoverUrl] = useState(projectCoverUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const saveTimerRef = useRef(null);
  const onProjectUpdateRef = useRef(onProjectUpdate);
  useEffect(() => { onProjectUpdateRef.current = onProjectUpdate; }, [onProjectUpdate]);

  // 立即保存函数（返回 Promise）
  const saveImmediately = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const hasChanges =
      name !== projectName ||
      description !== projectDescription ||
      coverUrl !== projectCoverUrl;

    if (hasChanges && projectId && onProjectUpdateRef.current) {
      const updates = {};
      if (name !== projectName) updates.name = name;
      if (description !== projectDescription) updates.description = description;
      if (coverUrl !== projectCoverUrl) updates.cover_url = coverUrl;

      if (Object.keys(updates).length > 0) {
        setIsSaving(true);
        try {
          await onProjectUpdateRef.current(updates);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  // 自动保存：name, description, coverUrl 变化时 debounce 调用 onProjectUpdate
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // 只有当值与初始 props 不同时才保存
    const hasChanges =
      name !== projectName ||
      description !== projectDescription ||
      coverUrl !== projectCoverUrl;

    console.log('[GlobalSettings] useEffect triggered', {
      hasChanges,
      projectId,
      hasOnProjectUpdate: !!onProjectUpdate,
      coverUrl,
      projectCoverUrl,
      coverChanged: coverUrl !== projectCoverUrl
    });

    if (hasChanges && projectId && onProjectUpdateRef.current) {
      console.log('[GlobalSettings] Setting save timer');
      saveTimerRef.current = setTimeout(async () => {
        const updates = {};
        if (name !== projectName) updates.name = name;
        if (description !== projectDescription) updates.description = description;
        if (coverUrl !== projectCoverUrl) updates.cover_url = coverUrl;

        console.log('[GlobalSettings] Calling onProjectUpdate with:', updates);

        if (Object.keys(updates).length > 0) {
          setIsSaving(true);
          try {
            await onProjectUpdateRef.current(updates);
          } finally {
            setIsSaving(false);
          }
        }
      }, 800);
    }

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  // 回调通过 ref 保持最新身份，避免父页面每次渲染都重启 debounce 定时器。
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onProjectUpdate 已由 onProjectUpdateRef 同步
  }, [name, description, coverUrl, projectId, projectName, projectDescription, projectCoverUrl]);

  if (activeStep === 'script') {
    return (
      <div
        style={{
          flex: '1 1 0%',
          overflow: 'hidden',
          padding: '0px 24px 24px 0px',
          height: '100%',
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
        }}
      >
        <Suspense fallback={<div style={{ flex: '1 1 0%', minHeight: 0 }} />}>
          <ScriptPage
            projectId={projectId}
            projectName={projectName}
            projectVisualStyle={projectStyle}
            projectAspectRatio={projectRatio}
            projectCreationType={projectCreationType}
            onGoToSubject={onGoToSubject}
            isSubjectUnlocked={isSubjectUnlocked}
            scriptFinalizedSinceExtraction={scriptFinalizedSinceExtraction}
            onScriptFinalized={onScriptFinalized}
            onEpisodesChange={onEpisodesChange}
            phase={scriptPhase}
            onPhaseChange={onScriptPhaseChange}
            hasStarted={scriptHasStarted}
            onHasStartedChange={onScriptHasStartedChange}
            scriptContent={scriptContent}
            onScriptContentChange={onScriptContentChange}
            draftContent={scriptDraftContent}
            onDraftContentChange={onScriptDraftContentChange}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div style={{ flex: '1 1 0%', overflow: 'auto', padding: '0px 24px 24px 0px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ borderRadius: '16px', padding: '16px 24px 0px', background: '#161616', border: '1px solid #FFFFFF14', minHeight: 0, height: '100%', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* 面包屑：返回箭头 + 项目名称 + 分割线 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', alignSelf: 'stretch', paddingBottom: '12px', paddingTop: '6px', borderBottom: '1px solid #FFFFFF14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0, rotate: '90deg', transformOrigin: '50% 50%', cursor: 'pointer' }}
              onClick={async () => { await saveImmediately(); onBack?.(); }}>
              <path d="M12 6L8 10L4 6" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>{name || '项目名称'}</span>
          </div>
        </div>

        {/* Tab 分页器 */}
        <Tabs options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} variant="underline-ghost" gap="24px" />

        {/* 资产概况 Tab */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '16px', paddingBottom: '0px', alignSelf: 'stretch', flex: '1 1 0%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
            <ScriptProgress episodes={episodes} episodeStatuses={episodeStatuses} />
            <SubjectOverviewCard label="角色" type="char" subjects={chars} onNavigate={isSubjectUnlocked || chars.length > 0 ? () => onGoToSubject?.('char', { fromOverview: true }) : undefined} />
            <SubjectOverviewCard label="场景" type="scene" subjects={scenes} onNavigate={isSubjectUnlocked || scenes.length > 0 ? () => onGoToSubject?.('scene', { fromOverview: true }) : undefined} />
            <SubjectOverviewCard label="道具" type="prop" subjects={props} emptyLabel="暂无道具" onNavigate={isSubjectUnlocked || props.length > 0 ? () => onGoToSubject?.('prop', { fromOverview: true }) : undefined} />
          </div>
        )}

        {/* 项目信息 Tab */}
        {activeTab === 'info' && (
          // py-5 = 20px，gap-5 = 20px，水平居中，内容宽度 600px (w-150)
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', paddingTop: '20px', paddingBottom: '20px', alignSelf: 'stretch' }}>

            {/* 项目名称 */}
            <div style={{ display: 'flex', gap: '14px', width: '600px', alignItems: 'center' }}>
              <div style={{ width: '56px', flexShrink: 0, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFB3' }}>项目名称</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TextField
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入项目名称"
                  maxLength={30}
                />
              </div>
            </div>

            {/* 项目描述 */}
            <div style={{ display: 'flex', gap: '14px', width: '600px' }}>
              <div style={{ width: '56px', flexShrink: 0, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFB3', paddingTop: '9px' }}>项目描述</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TextField
                  multiline
                  height="100px"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简单描述一下这个项目…"
                  maxLength={300}
                />
              </div>
            </div>

            {/* 视觉风格 */}
            <div style={{ display: 'flex', gap: '14px', width: '600px', height: '200px', flexShrink: 0 }}>
              <div style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFB3', paddingTop: '2px', flexShrink: 0 }}>视觉风格</div>
              {/* 风格卡片 — 只读展示，200×200 */}
              <div style={{ width: '200px', height: '200px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', position: 'relative', background: '#2A2A2A' }}>
                {VISUAL_STYLES[projectStyle]?.coverImg && (
                  <img src={VISUAL_STYLES[projectStyle].coverImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                {/* 底部渐变 + 风格名 — h-26 = 104px */}
                <div style={{
                  position: 'absolute', bottom: -1, left: 0, right: 0,
                  height: '104px',
                  paddingTop: '18px', paddingBottom: '12px', paddingLeft: '16px', paddingRight: '16px',
                  display: 'flex', alignItems: 'flex-end',
                  backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 0%, oklab(0% 0 0) 100%)',
                  borderRadius: '0 0 6px 6px',
                }}>
                  <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF' }}>
                    {VISUAL_STYLES[projectStyle]?.label || '未设置'}
                  </span>
                </div>
              </div>
            </div>

            {/* 画面比例 */}
            <div style={{ display: 'flex', gap: '14px', width: '600px', alignItems: 'center' }}>
              <div style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFB3', flexShrink: 0 }}>画面比例</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <OptionTabs
                  layout="flex"
                  showRatioIcon
                  value={projectRatio}
                  onChange={() => {/* 只读，比例在创建时确定 */}}
                  options={[
                    { value: '16:9', label: '16:9' },
                    { value: '9:16', label: '9:16' },
                  ]}
                />
              </div>
            </div>

            {/* 创作类型 */}
            <div style={{ display: 'flex', gap: '14px', width: '600px', alignItems: 'center' }}>
              <div style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFB3', flexShrink: 0 }}>创作类型</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <OptionTabs
                  layout="flex"
                  value={projectCreationType}
                  onChange={() => {/* 只读，类型在创建时确定 */}}
                  options={[
                    { value: 'dialogue', label: '剧情对白' },
                    { value: 'narration', label: '旁白解说' },
                  ]}
                />
              </div>
            </div>

            {/* 项目封面 */}
            <div style={{ display: 'flex', gap: '14px', width: '600px' }}>
              <div style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFB3', flexShrink: 0, paddingTop: '2px' }}>项目封面</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CoverUpload coverUrl={coverUrl} onUpload={setCoverUrl} isSaving={isSaving} />
              </div>
            </div>

          </div>
        )}

        {/* 团队管理 Tab */}
        {activeTab === 'team' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '60px', paddingBottom: '60px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF33' }}>团队管理功能即将上线</span>
          </div>
        )}

      </div>
    </div>
  );
}
