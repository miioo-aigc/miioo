import AccountMenu from '../AccountMenu';
import HomeLogo from './HomeLogo';
import { CreationManualButton, LoginButton } from './HomeHeaderActions';
import { WorkflowStepTabs } from './WorkflowStepTabs';

function WorkflowHeadbar({ activeStep, onStepChange, unlockedSteps, isLoggedIn, currentUser, onLoginClick, onLogout, onOpenProfile, onLogoClick, onGoToAdmin, storageUsage, onGoToAssets }) {
  return (
    <div className="[font-synthesis:none] flex items-center justify-between gap-[37px] self-stretch h-[60px] relative shrink-0 antialiased px-24">
      {/* 2026-10-29 与首页共用品牌标志及默认尺寸。 */}
      <HomeLogo clickable onClick={onLogoClick} />

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
            storageUsage={storageUsage}
            onGoToAssets={onGoToAssets}
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
