/**
 * @file HomeHeader.jsx
 * @structure-index
 *
 * ─── 展示层 ─────────────────────────────────────────────────────
 *   HomeHeader                                                   首页无项目状态下的 Logo、创作手册和认证入口组合
 *
 * ─── 依赖边界 ──────────────────────────────────────────────────
 *   仅接收认证资料和显式动作回调；不读取 Home 状态、不调用 API、不执行存储副作用。
 *
 * ─── 更新记录 ──────────────────────────────────────────────────
 *   2026-07-16  从 Home.jsx 抽离无项目头部组合；认证判断与业务回调由页面传入
 */

import AccountMenu from '../AccountMenu';
import { CreationManualButton, LoginButton } from './HomeHeaderActions';
import HomeLogo from './HomeLogo';

export default function HomeHeader({
  activeKey,
  isLoggedIn,
  currentUser = {},
  onLogoClick,
  onLoginClick,
  onLogout,
  onOpenProfile,
  onGoToAdmin,
  storageUsage,
  onGoToAssets,
}) {
  return (
    <div className="flex items-center px-24 py-12 justify-between gap-[37px] self-stretch">
      <HomeLogo clickable={activeKey !== 'home'} onClick={onLogoClick} />
      <div className="flex items-center gap-16 p-0">
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
    </div>
  );
}
