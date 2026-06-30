import { useMemo, useState } from 'react';
import AdminAccountManagementPage from '../components/admin/AdminAccountManagementPage';
import AdminConsoleSidebar from '../components/admin/AdminConsoleSidebar';
import AdminDisplaySettingsPage from '../components/admin/AdminDisplaySettingsPage';
import AdminModelVisibilityPage from '../components/admin/AdminModelVisibilityPage';
import AdminOverviewPanel from '../components/admin/AdminOverviewPanel';
import AdminVoiceLibraryPage from '../components/admin/AdminVoiceLibraryPage';
import { ActionButton, FONT_MEDIUM, FONT_REGULAR } from '../components/admin/adminShared';

const SECTIONS = [
  { key: 'overview', label: '总览', description: '先查看整体状态，再进入对应模块处理。' },
  { key: 'display', label: '展示配置', description: '维护推荐图区、社群二维码和 API 卡片显示。' },
  { key: 'models', label: '模型开放', description: '分页控制普通用户可见模型与开放状态。' },
  { key: 'voices', label: '音色库', description: '分页维护 miioo 系统音色、试听与编辑。' },
  { key: 'accounts', label: '账号管理', description: '沿用现有表格分页处理账号资料和权限。' },
];

function EmptyAdminState({ onBackHome }) {
  return (
    <div className="rounded-medium border border-red-alpha-40 bg-red-alpha-10 p-[20px]">
      <div className="text-[18px] leading-[22px] text-red-300" style={{ fontFamily: FONT_MEDIUM }}>
        当前账号无管理员权限
      </div>
      <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
        管理员控制台仅对管理员开放。请返回首页后使用具备管理员权限的账号重新进入。
      </div>
      <div className="mt-[16px]">
        <ActionButton onClick={onBackHome}>返回首页</ActionButton>
      </div>
    </div>
  );
}

export default function AdminConsolePage({
  currentUser,
  onBackHome,
  showToast,
}) {
  const [activeSection, setActiveSection] = useState('overview');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const isAdmin = Boolean(currentUser?.is_admin);

  const activeSectionMeta = useMemo(
    () => SECTIONS.find((item) => item.key === activeSection) || SECTIONS[0],
    [activeSection],
  );

  const currentPanel = useMemo(() => {
    const sharedProps = {
      currentUser,
      refreshSignal,
      showToast,
    };

    switch (activeSection) {
      case 'display':
        return <AdminDisplaySettingsPage {...sharedProps} />;
      case 'models':
        return <AdminModelVisibilityPage {...sharedProps} />;
      case 'voices':
        return <AdminVoiceLibraryPage {...sharedProps} />;
      case 'accounts':
        return <AdminAccountManagementPage {...sharedProps} />;
      case 'overview':
      default:
        return (
          <AdminOverviewPanel
            {...sharedProps}
            onNavigate={setActiveSection}
          />
        );
    }
  }, [activeSection, currentUser, refreshSignal, showToast]);

  return (
    <div className="h-full min-h-0 overflow-y-auto px-[32px] py-[24px]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-[20px]">
        <div className="flex flex-wrap items-start justify-between gap-[16px]">
          <div>
            <div className="text-[28px] leading-[32px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
              管理员控制台
            </div>
            <div className="mt-[10px] max-w-[760px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
              管理员能力已拆分为多个独立子页。每个模块各自拉取和保存自己的数据，避免单接口失败拖垮整页，并保留现有视觉与入口结构。
            </div>
          </div>

          <div className="flex flex-wrap gap-[8px]">
            {isAdmin ? (
              <ActionButton
                variant="secondary"
                onClick={() => setRefreshSignal((current) => current + 1)}
              >
                刷新当前页
              </ActionButton>
            ) : null}
            <ActionButton onClick={onBackHome}>返回首页</ActionButton>
          </div>
        </div>

        {!isAdmin ? (
          <EmptyAdminState onBackHome={onBackHome} />
        ) : (
          <div className="grid gap-[20px] xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="flex flex-col gap-[12px]">
              <AdminConsoleSidebar
                sections={SECTIONS}
                activeSection={activeSection}
                onChange={setActiveSection}
              />
              <div className="rounded-medium border border-stroke-normal bg-neutral-300 p-[16px]">
                <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                  当前模块
                </div>
                <div className="mt-[8px] text-font-size-14 text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
                  {activeSectionMeta.label}
                </div>
                <div className="mt-[6px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                  {activeSectionMeta.description}
                </div>
                <div className="mt-[12px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                  当前管理员：{currentUser?.nickname || currentUser?.phone || '管理员账号'}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              {currentPanel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
