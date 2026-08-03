import LoadingAnimation from '../LoadingAnimation';

export default function StoryboardLoadingState({ loadingText, storyboardPageRef }) {
  return (
    <div
      ref={storyboardPageRef}
      style={{
        position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '8px',
        backgroundColor: '#161616', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <LoadingAnimation width={200} />
      <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99', whiteSpace: 'nowrap' }}>
        {loadingText}
      </span>
    </div>
  );
}
