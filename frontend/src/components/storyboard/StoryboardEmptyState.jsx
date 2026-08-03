import { Button } from '../ui';
import StoryboardContentArea from './StoryboardContentArea';

function StartStoryboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14.333 5.667V3H11.333M14.333 5.667V10.333M14.333 5.667H11.333M11.333 3V5.667M11.333 3H10M14.333 10.333V13H11.333M14.333 10.333H11.333M11.333 5.667H10M1.667 5.667V3H4.667M1.667 5.667V10.333M1.667 5.667H4.667M4.667 3V5.667M4.667 3H6M1.667 10.333V13H4.667M1.667 10.333H4.667M4.667 5.667H6M4.667 13V10.333M4.667 13H6M4.667 10.333H6M11.333 13V10.333M11.333 13H10M11.333 10.333H10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2.333V3.667M8 5.667V7M8 9V10.333M8 12.333V13.667" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export default function StoryboardEmptyState({
  showError,
  header,
  projectRatio,
  timeline,
  onContentBlankClick,
  onStart,
  onResetActiveShot,
  storyboardPageRef,
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
      display: 'flex', flexDirection: 'column',
      backgroundColor: 'var(--color-dark-bg)',
      overflow: 'hidden', boxSizing: 'border-box',
    }} ref={storyboardPageRef} onClick={(event) => {
      if (event.target.closest('[data-storyboard-shot-row="true"], [data-storyboard-finalized-card="true"], [data-storyboard-header="true"], button, input, textarea, select, [role="button"]')) return;
      onResetActiveShot?.();
    }}>
      <StoryboardContentArea
        header={header}
        onContentBlankClick={onContentBlankClick}
        projectRatio={projectRatio}
        timeline={timeline}
      >
        {showError ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
            <div style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
              <span>抱歉，加载数据失败，请</span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ margin: 0, padding: 0, border: 0, background: 'transparent', color: '#2DC3E1', font: 'inherit', cursor: 'pointer' }}
              >
                刷新
              </button>
              <span>重试</span>
            </div>
          </div>
        ) : (
          <div style={{
            flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent',
            backgroundImage: 'linear-gradient(rgb(6, 6, 6), rgb(6, 6, 6))',
          }}>
            <Button type="button" variant="accent" size="large" icon={<StartStoryboardIcon />} onClick={onStart}>
              开始智能分镜
            </Button>
          </div>
        )}
      </StoryboardContentArea>
    </div>
  );
}
