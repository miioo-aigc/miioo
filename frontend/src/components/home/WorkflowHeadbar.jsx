import AccountMenu from '../AccountMenu';
import { CreationManualButton, LoginButton } from './HomeHeaderActions';
import { WorkflowStepTabs } from './WorkflowStepTabs';

function WorkflowHeadbar({ activeStep, onStepChange, unlockedSteps, isLoggedIn, currentUser, onLoginClick, onLogout, onOpenProfile, onLogoClick, onGoToAdmin }) {
  return (
    <div className="[font-synthesis:none] flex items-center justify-between gap-[37px] self-stretch h-[60px] relative shrink-0 antialiased px-24">
      {/* Logo */}
      <svg width="80" height="25" viewBox="0 0 80 25" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, cursor: 'pointer' }} onClick={onLogoClick} role="button" aria-label="返回首页">
        <path d="M28.3 7.265H32.862V24.161H28.3V7.265Z" fill="#FFFFFF" />
        <path d="M35.903 7.265H40.465V24.161H35.903V7.265Z" fill="#FFFFFF" />
        <path d="M15.206 21.204C15.206 22.837 13.882 24.16 12.249 24.16C10.616 24.16 9.292 22.837 9.292 21.204C9.292 19.571 10.616 18.247 12.249 18.247C13.882 18.247 15.206 19.571 15.206 21.204Z" fill="#00D4FF" />
        <path fillRule="evenodd" clipRule="evenodd" d="M0 24.161L0 3.295H0.056H0.472C1.175 5.75 2.626 7.89 4.562 9.453V24.161H0Z" fill="#FFFFFF" />
        <path fillRule="evenodd" clipRule="evenodd" d="M24.498 24.161H19.936V9.453C21.872 7.89 23.323 5.75 24.026 3.295H24.442H24.498L24.498 24.161Z" fill="#FFFFFF" />
        <path d="M55.333 15.713C55.333 13.847 53.82 12.334 51.954 12.334C50.087 12.334 48.575 13.847 48.575 15.713C48.575 17.579 50.087 19.092 51.954 19.092V24.161C47.288 24.161 43.506 20.378 43.506 15.713C43.506 11.047 47.288 7.265 51.954 7.265C56.619 7.265 60.401 11.047 60.401 15.713C60.401 20.378 56.619 24.161 51.954 24.161V19.092C53.82 19.092 55.333 17.579 55.333 15.713Z" fill="#FFFFFF" />
        <path d="M74.931 15.713C74.931 13.847 73.418 12.334 71.552 12.334C69.686 12.334 68.173 13.847 68.173 15.713C68.173 17.579 69.686 19.092 71.552 19.092V24.161C66.887 24.161 63.105 20.378 63.105 15.713C63.105 11.047 66.887 7.265 71.552 7.265C76.218 7.265 80 11.047 80 15.713C80 20.378 76.218 24.161 71.552 24.161V19.092C73.418 19.092 74.931 17.579 74.931 15.713Z" fill="#FFFFFF" />
        <path d="M35.734 0C37.274 0 38.522 1.248 38.522 2.788C38.522 4.327 37.274 5.575 35.734 5.575C35.243 5.575 34.783 5.449 34.382 5.226C35.239 4.75 35.818 3.837 35.818 2.788C35.818 1.739 35.239 0.825 34.382 0.349C34.783 0.127 35.243 0 35.734 0Z" fill="#00D4FF" style={{ opacity: 0.4 }} />
        <path d="M38.437 0C39.977 0 41.225 1.248 41.225 2.788C41.225 4.327 39.977 5.575 38.437 5.575C37.947 5.575 37.486 5.449 37.086 5.226C37.942 4.75 38.522 3.837 38.522 2.788C38.522 1.739 37.942 0.825 37.086 0.349C37.486 0.127 37.947 0 38.437 0Z" fill="#00D4FF" style={{ opacity: 0.2 }} />
        <path d="M35.818 2.788C35.818 4.327 34.57 5.575 33.03 5.575C31.491 5.575 30.243 4.327 30.243 2.788C30.243 1.248 31.491 0 33.03 0C34.57 0 35.818 1.248 35.818 2.788Z" fill="#00D4FF" style={{ opacity: 0.6 }} />
        <path d="M33.115 2.788C33.115 4.327 31.867 5.575 30.327 5.575C28.788 5.575 27.54 4.327 27.54 2.788C27.54 1.248 28.788 0 30.327 0C31.867 0 33.115 1.248 33.115 2.788Z" fill="#00D4FF" />
        <path fillRule="evenodd" clipRule="evenodd" d="M12.249 12.165C17.842 12.165 22.559 8.416 24.026 3.295H24.442C24.479 3.684 24.498 4.078 24.498 4.477C24.498 11.242 19.014 16.727 12.249 16.727C5.484 16.727 0 11.242 0 4.477C0 4.078 0.019 3.684 0.056 3.295H0.472C1.939 8.416 6.656 12.165 12.249 12.165Z" fill="#FFFFFF" />
      </svg>

      {/* Right: 创作手册 + user */}
      <div className="flex items-center gap-24 p-0">
        <CreationManualButton />
        {isLoggedIn ? (
          <AccountMenu
            nickname={currentUser.nickname ?? ''}
            phone={currentUser.phone_bound ? (currentUser.phone ?? '已绑定') : '未绑定'}
            wechat={currentUser.wechat_bound ? (currentUser.wechat ?? '已绑定') : '未绑定'}
            avatarUrl={currentUser.avatar_url ?? ''}
            onLogout={onLogout}
            onOpenProfile={onOpenProfile}
            isAdmin={currentUser.is_admin ?? false}
            onGoToAdmin={onGoToAdmin}
          />
        ) : (
          <LoginButton onClick={onLoginClick} />
        )}
      </div>

      <WorkflowStepTabs activeStep={activeStep} onStepChange={onStepChange} unlockedSteps={unlockedSteps} />

    </div>
  );
}

export { WorkflowHeadbar };
