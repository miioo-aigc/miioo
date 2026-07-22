/**
 * @file ScriptOutlineLoading.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   ScriptOutlineLoading 剧本编排页骨架和光影加载反馈
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-21  新增编排页结构化内容加载态
 *   2026-07-22  调整解析加载态主体分组标题的水平内边距为 0
 */
const SHIMMER_STYLE = `
  @keyframes script-outline-shimmer {
    0% { transform: translateX(-120%); opacity: 0; }
    12% { opacity: .65; }
    58% { opacity: .35; }
    100% { transform: translateX(220%); opacity: 0; }
  }
  @keyframes script-outline-sweep {
    0%, 100% { opacity: .08; }
    50% { opacity: .26; }
  }
`;

const sectionRows = {
  '整体设定': ['视觉风格', '画面比例', '创作类型'],
  '剧本设计': ['故事梗概', '故事背景', '世界观设定', '核心冲突'],
};

function SkeletonTable({ labels }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {labels.map((label, index) => (
        <div key={label} style={{ display: 'flex', minHeight: '48px', marginTop: index === 0 ? 0 : '-1px' }}>
          <div style={{ width: '160px', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#222222', border: '1px solid #3E3D3D', color: '#FFFFFFCC', fontSize: '14px', lineHeight: '18px' }}>{label}</div>
          <div className="script-outline-skeleton-cell" style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', padding: '12px', overflow: 'hidden', border: '1px solid #3E3D3D', background: '#080808' }}>
            <div style={{ height: '20px', width: '100%', background: 'linear-gradient(270deg, #222222, #454545, #3F3F3F)', animation: 'script-outline-sweep 2.2s ease-in-out infinite' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '42%', background: 'linear-gradient(90deg, transparent, rgba(222,250,255,.32), transparent)', filter: 'blur(12px)', animation: 'script-outline-shimmer 2.6s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonSection({ title, labels }) {
  return (
    <section style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0', color: '#FFFFFF', fontSize: '18px', lineHeight: '22px', fontWeight: 600 }}>
        <span style={{ width: '2px', height: '18px', flexShrink: 0, background: '#FFFFFF' }} />
        {title}
      </div>
      <SkeletonTable labels={labels} />
    </section>
  );
}

function SkeletonSubjectSection() {
  return (
    <section style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0', color: '#FFFFFF', fontSize: '18px', lineHeight: '22px', fontWeight: 600 }}><span style={{ width: '2px', height: '18px', background: '#FFFFFF' }} />主体</div>
      {['角色（0）', '场景（0）', '道具（0）'].map((label) => (
        <div key={label} style={{ marginBottom: '8px' }}>
          <div style={{ padding: '4px 0', color: '#FFFFFFCC', fontSize: '16px', lineHeight: '20px' }}>{label}</div>
          <SkeletonTable labels={['']} />
        </div>
      ))}
    </section>
  );
}

export default function ScriptOutlineLoading({ finalSectionTitle = '分集剧情' }) {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div aria-label="正在解析剧本" role="status" style={{ position: 'relative', display: 'flex', width: 'min(960px, 100%)', minHeight: '100%', flexDirection: 'column', gap: '12px', overflow: 'visible', padding: '16px 24px', border: '1px solid #FFFFFF14', borderRadius: '16px', background: '#060606', color: '#FFFFFF', boxSizing: 'border-box' }}>
        <SkeletonSection title="整体设定" labels={sectionRows['整体设定']} />
        <SkeletonSection title="剧本设计" labels={sectionRows['剧本设计']} />
        <SkeletonSubjectSection />
        <section style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0', color: '#FFFFFF', fontSize: '18px', lineHeight: '22px', fontWeight: 600 }}><span style={{ width: '2px', height: '18px', background: '#FFFFFF' }} />{finalSectionTitle}（0）</div>
          <div style={{ height: '60px', overflow: 'hidden', padding: '12px', border: '1px solid #3E3D3D', background: '#080808', boxSizing: 'border-box' }}><div style={{ height: '20px', background: 'linear-gradient(270deg, #222222, #454545, #3F3F3F)', animation: 'script-outline-sweep 2.2s ease-in-out infinite' }} /></div>
        </section>
        <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', width: '52%', height: '2px', transform: 'translate(-50%, -50%)', background: 'linear-gradient(90deg, transparent, rgba(218,250,255,.7), transparent)', filter: 'blur(10px)', animation: 'script-outline-shimmer 2.6s ease-in-out infinite' }} />
      </div>
    </>
  );
}
