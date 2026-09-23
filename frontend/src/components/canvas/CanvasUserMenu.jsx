/**
 * @file CanvasUserMenu.jsx
 * @structure-index
 *
 * ─── 交互区 ─────────────────────────────────────────────────────
 *   CanvasUserMenu 画布右上角用户信息和账户菜单
 */

import AccountMenu from '../AccountMenu';

export default function CanvasUserMenu({ currentUser, onLogout, onOpenProfile }) {
  return (
    <div className="absolute right-[24px] top-[18px] z-20 flex items-end">
      <AccountMenu
        nickname={currentUser.nickname ?? ''}
        phone={currentUser.phone_bound ? (currentUser.phone ?? '已绑定') : '未绑定'}
        wechat={currentUser.wechat_bound ? (currentUser.wechat ?? '已绑定') : '未绑定'}
        avatarUrl={currentUser.avatar_url ?? ''}
        onLogout={onLogout}
        onOpenProfile={onOpenProfile}
        isAdmin={currentUser.is_admin ?? false}
      />
    </div>
  );
}
