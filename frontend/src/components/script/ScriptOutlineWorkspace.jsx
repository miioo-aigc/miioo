/**
 * @file ScriptOutlineWorkspace.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   ScriptOutlineWorkspace 展示后端返回的结构化剧本编排内容
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-21  新增结构化剧本内容展示
 *   2026-07-21  移除编排内容容器外描边并将内边距设为 0
 *   2026-07-21  将下一步按钮移交给页面父级编排容器
 *   2026-07-21  将编排模块内部间距调整为 8px，并细化主体分组标题样式
 *   2026-07-21  将四个一级编排模块之间的间距调整为 16px
 *   2026-07-21  将主体模块标题底部内边距调整为 0
 *   2026-07-21  结构设定为空时回填项目详情中的后端设定
 *   2026-07-21  将整体设定中的枚举值转换为中文展示名称
 *   2026-07-21  兼容后端 world_setting 世界观字段
 *   2026-07-21  将定位器移至表单外侧并保持右侧 32px 间距
 *   2026-07-21  增加定位器悬停展开文字的 300ms 滑入动画
 *   2026-07-21  定位器支持点击滚动、滚动同步高亮和标题顶部对齐
 *   2026-07-21  将整体设定、剧本设计和主体分组表单统一为 12px 外轮廓圆角
 *   2026-07-21  修复表单外轮廓描边被内部边框覆盖导致的缺角
 *   2026-07-21  修复整体设定和剧本设计表单底部描边显示不完整
 *   2026-07-21  将表单外轮廓改为内嵌描边，避免底边被内容层覆盖
 */
import { useEffect, useRef, useState } from 'react';
import { getCreationTypeLabel, getVisualStyleLabel } from '../../config/projectDisplayNames';
import ScriptEpisodeOutline from './ScriptEpisodeOutline';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function SectionTitle({ children, compactBottom = false }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: compactBottom ? '8px 0 0' : '8px 0', color: '#FFFFFF', fontFamily: FONT, fontSize: '18px', lineHeight: '22px', fontWeight: 600 }}><span style={{ width: '2px', height: '18px', flexShrink: 0, background: '#FFFFFF' }} />{children}</div>;
}

function Value({ children }) {
  return <div style={{ minWidth: 0, padding: '8px 12px', color: '#FFFFFFCC', fontFamily: FONT, fontSize: '14px', lineHeight: '20px', wordBreak: 'break-word' }}>{children || '—'}</div>;
}

function KeyValueTable({ rows, rounded = true, showBottomBorder = false }) {
  return (
    <div style={{ display: 'flex', width: '100%', flexShrink: 0, flexDirection: 'column', border: rounded ? '1px solid transparent' : 0, borderBottom: showBottomBorder ? '1px solid #3E3D3D' : undefined, borderRadius: rounded ? '12px' : 0, boxShadow: rounded ? 'inset 0 0 0 1px #3E3D3D' : undefined, isolation: rounded ? 'isolate' : undefined, overflow: 'hidden', boxSizing: 'border-box' }}>
      {rows.map(([label, value], index) => (
        <div key={label} style={{ display: 'flex', width: '100%', minHeight: '44px', borderBottom: index === rows.length - 1 ? 0 : '1px solid #3E3D3D', boxSizing: 'border-box' }}>
          <div style={{ width: '160px', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#FFFFFF14', borderRight: '1px solid #3E3D3D', color: '#FFFFFFCC', fontFamily: FONT, fontSize: '14px', lineHeight: '20px', boxSizing: 'border-box' }}>{label}</div>
          <div style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}><Value>{value}</Value></div>
        </div>
      ))}
    </div>
  );
}

function SubjectGroup({ title, items }) {
  return (
    <div>
      <div style={{ padding: '4px 0 8px', color: '#FFFFFFCC', fontFamily: FONT, fontSize: '16px', lineHeight: '20px' }}>{title}（{items.length}）</div>
      {items.length === 0 ? <div style={{ display: 'flex', minHeight: '44px', border: '1px solid #3E3D3D', borderRadius: '12px', overflow: 'hidden' }}><Value>暂无内容</Value></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #3E3D3D', borderRadius: '12px', overflow: 'hidden' }}>
          {items.map((item, index) => <KeyValueTable key={item.id || `${item.name}-${index}`} rounded={false} showBottomBorder={index < items.length - 1} rows={[[item.name || '未命名', item.description]]} />)}
        </div>
      )}
    </div>
  );
}

function OutlineLocator({ activeIndex, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const labels = ['整体设定', '剧本设计', '主体', '分集剧情'];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'absolute', top: '50%', left: 'calc(100% + 32px)', display: 'flex', width: 'max-content', minWidth: 'max-content', flexDirection: 'column', gap: '8px', transform: 'translateY(-50%)', zIndex: 2, padding: 0, overflow: 'visible', whiteSpace: 'nowrap' }}
    >
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          aria-label={`定位到${label}`}
          aria-current={activeIndex === index ? 'true' : undefined}
          onClick={() => onSelect(index)}
          style={{ display: 'flex', width: 'max-content', minWidth: 'max-content', alignItems: 'center', gap: '6px', minHeight: '20px', padding: '2px', border: 0, background: 'transparent', color: '#FFFFFF', opacity: activeIndex === index ? 1 : 0.5, overflow: 'visible', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
        >
          <div style={{ width: '2px', height: '12px', flexShrink: 0, background: '#DDDDDD' }} />
          <div style={{ display: 'block', width: 'max-content', minWidth: 'max-content', whiteSpace: 'nowrap', color: '#FFFFFF', fontFamily: FONT, fontSize: '12px', lineHeight: '16px', transform: hovered ? 'translateX(0)' : 'translateX(-12px)', opacity: hovered ? 1 : 0, pointerEvents: 'none', overflow: 'visible', transition: 'transform 300ms cubic-bezier(0.22, 1.2, 0.36, 1), opacity 300ms ease' }}>{label}</div>
        </button>
      ))}
    </div>
  );
}

export default function ScriptOutlineWorkspace({ data, projectSettings, onResplit, onRegenerateEpisode, onAddEpisode, onPatchStructure, onDeleteEpisode, episodeActionLoading, episodeActionError, selectedModel, hideEpisodeActions = false }) {
  const scrollContainerRef = useRef(null);
  const sectionRefs = useRef([]);
  const [activeSection, setActiveSection] = useState(0);
  const settings = {
    visualStyle: data?.overallSettings?.visualStyle || projectSettings?.visualStyle || '',
    aspectRatio: data?.overallSettings?.aspectRatio || projectSettings?.aspectRatio || '',
    creationType: data?.overallSettings?.creationType || projectSettings?.creationType || '',
  };
  const design = data?.scriptDesign || {};
  const subjects = data?.subjects || { characters: [], scenes: [], props: [] };
  const episodes = data?.episodes || [];

  const scrollToSection = (index) => {
    const container = scrollContainerRef.current;
    const target = sectionRefs.current[index];
    if (!container || !target) return;
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    container.scrollTo({ top: container.scrollTop + targetTop - containerTop, behavior: 'smooth' });
    setActiveSection(index);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return undefined;
    let frameId = null;
    const updateActiveSection = () => {
      frameId = null;
      const containerTop = container.getBoundingClientRect().top + 2;
      let nextIndex = 0;
      sectionRefs.current.forEach((section, index) => {
        if (section && section.getBoundingClientRect().top <= containerTop) nextIndex = index;
      });
      setActiveSection((current) => (current === nextIndex ? current : nextIndex));
    };
    const handleScroll = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(updateActiveSection);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    updateActiveSection();
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [episodes.length]);

  return (
    <div style={{ position: 'relative', display: 'flex', width: 'min(960px, 100%)', height: '100%', minHeight: 0, flexDirection: 'column', overflow: 'visible', padding: 0, border: 0, borderRadius: '16px', background: '#060606', color: '#FFFFFF', fontFamily: FONT, boxSizing: 'border-box' }}>
      <div ref={scrollContainerRef} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ display: 'flex', width: '100%', maxWidth: '960px', margin: '0 auto', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
          <section ref={(node) => { sectionRefs.current[0] = node; }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><SectionTitle>整体设定</SectionTitle><KeyValueTable rows={[['视觉风格', getVisualStyleLabel(settings.visualStyle)], ['画面比例', settings.aspectRatio], ['创作类型', getCreationTypeLabel(settings.creationType)]]} /></section>
          <section ref={(node) => { sectionRefs.current[1] = node; }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><SectionTitle>剧本设计</SectionTitle><KeyValueTable rows={[['故事梗概', design.synopsis], ['故事背景', design.background], ['世界观设定', design.world], ['核心冲突', design.conflict]]} /></section>
          <section ref={(node) => { sectionRefs.current[2] = node; }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><SectionTitle compactBottom>主体</SectionTitle><SubjectGroup title="角色" items={subjects.characters} /><SubjectGroup title="场景" items={subjects.scenes} /><SubjectGroup title="道具" items={subjects.props} /></section>
          <ScriptEpisodeOutline sectionRef={(node) => { sectionRefs.current[3] = node; }} episodes={episodes} revision={data?.revision || 0} selectedModel={selectedModel} onResplit={onResplit} onRegenerate={onRegenerateEpisode} onAdd={onAddEpisode} onPatch={onPatchStructure} onDelete={onDeleteEpisode} actionLoading={episodeActionLoading} actionError={episodeActionError} hideEpisodeActions={hideEpisodeActions} />
        </div>
      </div>
      <OutlineLocator activeIndex={activeSection} onSelect={scrollToSection} />
    </div>
  );
}
