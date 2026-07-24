export default function StoryboardContentArea({ header, children, timeline }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--color-surface-base)', backgroundImage: 'none' }}>
      <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--color-dark-bg)', backgroundImage: 'none', boxSizing: 'border-box' }}>
        <div style={{ padding: '16px 24px 12px', boxSizing: 'border-box' }}>
          {header}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 24px', backgroundColor: 'transparent', backgroundImage: 'linear-gradient(rgb(6, 6, 6), rgb(6, 6, 6))', boxSizing: 'border-box' }}>
          {children}
        </div>
      </section>
      <section style={{ flexShrink: 0, minHeight: '167px', display: 'flex', alignItems: 'stretch', overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--color-dark-bg)', backgroundImage: 'none', padding: '16px 24px', boxSizing: 'border-box' }}>
        {timeline}
      </section>
    </div>
  );
}
