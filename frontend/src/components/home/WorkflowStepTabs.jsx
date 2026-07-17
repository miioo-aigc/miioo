import { PulsingBorder } from '@paper-design/shaders-react';

const STEP_TABS = [
  {
    key: 'global',
    label: '项目总览',
    alwaysEnabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M7.667 6.667V2H2V6.667H7.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M14 14V9.333H8.333V14H14Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M10.333 2V6.667H14V2H10.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M2 9.333V14H5.667V9.333H2Z" stroke="#FFFFFF" strokeLinejoin="round" />
      </svg>
    ),
    activeWidth: 110,
    activeIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="gs_active_0" x1="4.83333" y1="2" x2="4.83333" y2="6.66667" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="gs_active_1" x1="11.1667" y1="9.33337" x2="11.1667" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="gs_active_2" x1="12.1667" y1="2" x2="12.1667" y2="6.66667" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="gs_active_3" x1="3.83333" y1="9.33337" x2="3.83333" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
        </defs>
        <path d="M7.66667 6.66667V2H2V6.66667H7.66667Z" fill="url(#gs_active_0)" stroke="url(#gs_active_0)" strokeLinejoin="round"/>
        <path d="M14 14V9.33337H8.33337V14H14Z" fill="url(#gs_active_1)" stroke="url(#gs_active_1)" strokeLinejoin="round"/>
        <path d="M10.3334 2V6.66667H14V2H10.3334Z" fill="url(#gs_active_2)" stroke="url(#gs_active_2)" strokeLinejoin="round"/>
        <path d="M2 9.33337V14H5.66667V9.33337H2Z" fill="url(#gs_active_3)" stroke="url(#gs_active_3)" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'script',
    label: '剧本',
    alwaysEnabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M1.667 2.333H5.333C6.806 2.333 8 3.527 8 5V14C8 12.896 7.105 12 6 12H1.667V2.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M14.333 2.333H10.667C9.194 2.333 8 3.527 8 5V14C8 12.896 8.895 12 10 12H14.333V2.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
      </svg>
    ),
    activeWidth: 80,
    activeIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="sc_active_0" x1="4.833" y1="2.333" x2="4.833" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sc_active_1" x1="11.167" y1="2.333" x2="11.167" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
        </defs>
        <path d="M1.667 2.333H5.333C6.806 2.333 8 3.527 8 5V14C8 12.896 7.105 12 6 12H1.667V2.333Z" fill="url(#sc_active_0)" stroke="url(#sc_active_0)" strokeLinejoin="round"/>
        <path d="M14.333 2.333H10.667C9.194 2.333 8 3.527 8 5V14C8 12.896 8.895 12 10 12H14.333V2.333Z" fill="url(#sc_active_1)" stroke="url(#sc_active_1)" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'subject',
    label: '主体',
    alwaysEnabled: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M3.333 3.333H10.667H12.667V14.667H3.333V3.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.333 3.333L10.667 1.333V3.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 9.333C8.736 9.333 9.333 8.736 9.333 8C9.333 7.264 8.736 6.667 8 6.667C7.264 6.667 6.667 7.264 6.667 8C6.667 8.736 7.264 9.333 8 9.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.667 11.333H9.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    activeWidth: 80,
    activeIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="_64i21n0" x1="7" y1="1.333" x2="7" y2="3.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="_64i21n1" x1="7" y1="1.333" x2="7" y2="3.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="_64i21n2" x1="8" y1="3.333" x2="8" y2="14.667" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="_64i21n3" x1="8" y1="3.333" x2="8" y2="14.667" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
        </defs>
        <path d="M3.333 3.333L10.667 1.333V3.333" fill="url(#_64i21n0)" />
        <path d="M3.333 3.333L10.667 1.333V3.333" stroke="url(#_64i21n1)" strokeLinejoin="round" />
        <path d="M3.333 3.333H10.667H12.667V14.667H3.333V3.333Z" fill="url(#_64i21n2)" stroke="url(#_64i21n3)" strokeLinejoin="round" />
        <path d="M8 9.333C8.736 9.333 9.333 8.736 9.333 8C9.333 7.264 8.736 6.667 8 6.667C7.264 6.667 6.667 7.264 6.667 8C6.667 8.736 7.264 9.333 8 9.333Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.667 11.333H9.333" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'storyboard',
    label: '分镜',
    alwaysEnabled: false,
    activeWidth: 80,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.333 8C11.333 6.159 9.841 4.667 8 4.667C6.159 4.667 4.667 6.159 4.667 8C4.667 9.841 6.159 11.333 8 11.333C9.841 11.333 11.333 9.841 11.333 8Z" stroke="#FFFFFF" />
        <path d="M8 9C7.448 9 7 8.552 7 8C7 7.448 7.448 7 8 7C8.552 7 9 7.448 9 8C9 8.552 8.552 9 8 9Z" fill="#FFFFFF" />
      </svg>
    ),
    activeIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="sb_active_0" x1="3.167" y1="2" x2="3.167" y2="5.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sb_active_1" x1="3.167" y1="10.667" x2="3.167" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sb_active_2" x1="12.833" y1="10.667" x2="12.833" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sb_active_3" x1="12.833" y1="2" x2="12.833" y2="5.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sb_active_4" x1="8" y1="4.667" x2="8" y2="11.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
        </defs>
        <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="url(#sb_active_0)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="url(#sb_active_1)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="url(#sb_active_2)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="url(#sb_active_3)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.333 8C11.333 6.159 9.841 4.667 8 4.667C6.159 4.667 4.667 6.159 4.667 8C4.667 9.841 6.159 11.333 8 11.333C9.841 11.333 11.333 9.841 11.333 8Z" stroke="url(#sb_active_4)" />
        <path d="M8 9C7.448 9 7 8.552 7 8C7 7.448 7.448 7 8 7C8.552 7 9 7.448 9 8C9 8.552 8.552 9 8 9Z" fill="url(#sb_active_4)" />
      </svg>
    ),
  },
  {
    key: 'edit',
    label: '剪辑',
    alwaysEnabled: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M14.333 5.667V3H11.333M14.333 5.667V10.333M14.333 5.667H11.333M11.333 3V5.667M11.333 3H10M14.333 10.333V13H11.333M14.333 10.333H11.333M11.333 5.667H10M1.667 5.667V3H4.667M1.667 5.667V10.333M1.667 5.667H4.667M4.667 3V5.667M4.667 3H6M1.667 10.333V13H4.667M1.667 10.333H4.667M4.667 5.667H6M4.667 13V10.333M4.667 13H6M4.667 10.333H6M11.333 13V10.333M11.333 13H10M11.333 10.333H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 2.333V3.667" stroke="#FFFFFF" strokeLinecap="round" />
        <path d="M8 5.667V7" stroke="#FFFFFF" strokeLinecap="round" />
        <path d="M8 9V10.333" stroke="#FFFFFF" strokeLinecap="round" />
        <path d="M8 12.333V13.667" stroke="#FFFFFF" strokeLinecap="round" />
      </svg>
    ),
  },
];

function WorkflowStepTabs({ activeStep, onStepChange, unlockedSteps }) {
  return (
    <div className="flex items-center gap-24 absolute" style={{ left: 'calc(50% - 9px)', top: '50%', translate: '-50% -50%' }}>
      <div className="flex items-center gap-24">
        {STEP_TABS.map((tab) => {
          const isActive = tab.key === activeStep;
          const activeIndex = STEP_TABS.findIndex(t => t.key === activeStep);
          const tabIndex = STEP_TABS.findIndex(t => t.key === tab.key);
          // Steps before or at the current active step are always accessible
          const isDisabled = !tab.alwaysEnabled && !unlockedSteps.has(tab.key) && !isActive && tabIndex > activeIndex;

          if (isActive) {
            return (
              <div
                key={tab.key}
                className="flex flex-col items-start gap-0 rounded-full relative p-0 h-[32px]"
                style={{ cursor: 'pointer' }}
                onClick={() => onStepChange(tab.key)}
              >
                <PulsingBorder
                  speed={1} roundness={1} thickness={0.1} softness={0.75}
                  intensity={0.2} bloom={0.25} spots={2} spotSize={0.5}
                  pulse={0.25} smoke={0.3} smokeSize={0.6}
                  scale={1} rotation={0} aspectRatio="auto"
                  frame={tab.key === 'subject' ? 6788171.039985808 : 2135739.739999904}
                  colors={['#0DC1FD']}
                  colorBack="#00000000"
                  className="h-[32px] rounded-full shrink-0 bg-black"
                  style={{ width: `${tab.activeWidth ?? 110}px` }}
                />
                <div className="flex items-center gap-[4px] absolute p-0" style={{ left: '50%', top: '50%', translate: '-50% -50%' }}>
                  {tab.activeIcon ?? tab.icon}
                  <span
                    className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-transparent bg-clip-text text-sm/[18px]"
                    style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(93.3% -0.043 -0.030) 0%, 31.4%, oklab(75.5% -0.102 -0.072) 100%)' }}
                  >
                    {tab.label}
                  </span>
                </div>
              </div>
            );
          }

          if (isDisabled) {
            return (
              <div
                key={tab.key}
                className="flex flex-col h-[32px] rounded-full p-px [outline:1px_solid_#00000080]"
                style={{ backgroundImage: 'linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', pointerEvents: 'none' }}
              >
                <div className="flex items-center grow shrink basis-[0%] rounded-full px-[15px] gap-[4px] self-stretch justify-center bg-[#090909]">
                  <span style={{ opacity: 0.4, display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
                  <span className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF66] text-sm/[18px]">
                    {tab.label}
                  </span>
                </div>
              </div>
            );
          }

          // alwaysEnabled, non-active
          return (
            <div
              key={tab.key}
              className="flex flex-col h-[32px] rounded-full p-px [outline:1px_solid_#00000080] cursor-pointer"
              style={{ backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)' }}
              onClick={() => onStepChange(tab.key)}
            >
              <div className="flex items-center grow shrink basis-[0%] rounded-full px-[15px] gap-[4px] self-stretch justify-center bg-[#090909] hover:bg-[#1D1E1E] transition-colors">
                {tab.icon}
                <span className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-sm/[18px]">
                  {tab.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { WorkflowStepTabs };
