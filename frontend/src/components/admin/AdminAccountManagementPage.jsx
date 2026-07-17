import { useCallback, useEffect, useState } from 'react';
import {
  apiGetAdminUserAccounts,
  apiUpdateAdminUserAccount,
} from '../../api/admin';
import AdminAccountEditModal from './AdminAccountEditModal';
import AdminAccountFilters from './AdminAccountFilters';
import AdminAccountTable from './AdminAccountTable';
import {
  FONT_MEDIUM,
  FONT_REGULAR,
  formatDateTime,
  getErrorMessage,
  mapAccountFilterValue,
} from './adminSharedUtils';

const ACCOUNT_PAGE_SIZE = 20;

function createAccountEditDraft(item) {
  if (!item) return null;
  return {
    id: item.id,
    displayId: item.displayId || '',
    nickname: item.nickname || '',
    phone: item.currentPhone || '',
    isActive: Boolean(item.isActive),
    isAdmin: Boolean(item.isAdmin),
  };
}

export default function AdminAccountManagementPage({
  refreshSignal = 0,
  showToast,
}) {
  const [query, setQuery] = useState({
    page: 1,
    keyword: '',
    activeFilter: 'all',
    adminFilter: 'all',
  });
  const [draftKeyword, setDraftKeyword] = useState('');
  const [accountData, setAccountData] = useState({
    list: [],
    total: 0,
    page: 1,
    pageSize: ACCOUNT_PAGE_SIZE,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [accountEditDraft, setAccountEditDraft] = useState(null);
  const [accountEditOpen, setAccountEditOpen] = useState(false);

  const loadAccounts = useCallback(async ({
    page,
    keyword,
    activeFilter,
    adminFilter,
    force = true,
  } = {}) => {
    const nextPage = Number(page || query.page || 1);
    const nextKeyword = typeof keyword === 'string' ? keyword : query.keyword;
    const nextActiveFilter = typeof activeFilter === 'string' ? activeFilter : query.activeFilter;
    const nextAdminFilter = typeof adminFilter === 'string' ? adminFilter : query.adminFilter;
    setLoading(true);
    try {
      const payload = await apiGetAdminUserAccounts({
        page: nextPage,
        pageSize: ACCOUNT_PAGE_SIZE,
        keyword: nextKeyword,
        isActive: mapAccountFilterValue(nextActiveFilter, 'active'),
        isAdmin: mapAccountFilterValue(nextAdminFilter, 'admin'),
        force,
      });
      setQuery({
        page: payload.page,
        keyword: nextKeyword,
        activeFilter: nextActiveFilter,
        adminFilter: nextAdminFilter,
      });
      setDraftKeyword(nextKeyword);
      setAccountData(payload);
    } catch (error) {
      showToast?.(getErrorMessage(error, '账号管理列表加载失败'), 'error');
    } finally {
      setLoading(false);
    }
  }, [query.activeFilter, query.adminFilter, query.keyword, query.page, showToast]);

  useEffect(() => {
    // refreshSignal 表示管理员外部数据刷新；此处必须重新请求列表。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccounts({ force: true });
  }, [loadAccounts, refreshSignal]);

  const applyUpdatedAccount = useCallback((updatedAccount) => {
    if (!updatedAccount?.id) return;
    setAccountData((current) => ({
      ...current,
      list: current.list.map((item) => (item.id === updatedAccount.id ? updatedAccount : item)),
    }));
  }, []);

  const handleOpenAccountEditor = (item) => {
    setAccountEditDraft(createAccountEditDraft(item));
    setAccountEditOpen(true);
  };

  const handleCloseAccountEditor = () => {
    if (actionLoadingKey.startsWith('edit:')) return;
    setAccountEditOpen(false);
    setAccountEditDraft(null);
  };

  const handleSubmitAccountEdit = async () => {
    if (!accountEditDraft?.id) return;
    setActionLoadingKey(`edit:${accountEditDraft.id}`);
    try {
      const updated = await apiUpdateAdminUserAccount(accountEditDraft.id, {
        nickname: accountEditDraft.nickname,
        phone: accountEditDraft.phone,
        isActive: accountEditDraft.isActive,
        isAdmin: accountEditDraft.isAdmin,
      });
      applyUpdatedAccount(updated);
      setAccountEditOpen(false);
      setAccountEditDraft(null);
      showToast?.('账号信息已更新', 'success');
    } catch (error) {
      showToast?.(getErrorMessage(error, '账号信息更新失败'), 'error');
    } finally {
      setActionLoadingKey('');
    }
  };

  const handleQuickAccountUpdate = async (item, payload, successMessage, actionKey) => {
    setActionLoadingKey(`${actionKey}:${item.id}`);
    try {
      const updated = await apiUpdateAdminUserAccount(item.id, payload);
      applyUpdatedAccount(updated);
      setAccountEditDraft((current) => {
        if (!current || current.id !== item.id) return current;
        return createAccountEditDraft(updated);
      });
      showToast?.(successMessage, 'success');
    } catch (error) {
      showToast?.(getErrorMessage(error, '账号状态更新失败'), 'error');
    } finally {
      setActionLoadingKey('');
    }
  };

  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-300 p-[20px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <div className="text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
            账号管理
          </div>
          <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
            沿用现有后台表格视图，支持搜索、筛选、编辑账号资料，并直接切换账号启用状态和管理员权限。
          </div>
        </div>
        <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
          当前页 {accountData.page} / {Math.max(1, Math.ceil((accountData.total || 0) / (accountData.pageSize || ACCOUNT_PAGE_SIZE)))}
        </div>
      </div>

      <div className="mt-[16px]">
        <AdminAccountFilters
          keyword={draftKeyword}
          onKeywordChange={setDraftKeyword}
          activeFilter={query.activeFilter}
          adminFilter={query.adminFilter}
          onActiveFilterChange={(value) => setQuery((current) => ({ ...current, activeFilter: value }))}
          onAdminFilterChange={(value) => setQuery((current) => ({ ...current, adminFilter: value }))}
          onSearch={() => loadAccounts({
            page: 1,
            keyword: draftKeyword.trim(),
            activeFilter: query.activeFilter,
            adminFilter: query.adminFilter,
          })}
          onReset={() => {
            setDraftKeyword('');
            setQuery((current) => ({
              ...current,
              activeFilter: 'all',
              adminFilter: 'all',
            }));
            loadAccounts({
              page: 1,
              keyword: '',
              activeFilter: 'all',
              adminFilter: 'all',
            });
          }}
          loading={loading}
        />
      </div>

      <div className="mt-[16px] rounded-medium border border-stroke-normal bg-neutral-300 p-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-[8px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
          <span>共 {accountData.total} 个账号</span>
          <span>支持资料编辑、启停和权限切换</span>
        </div>

        <div className="mt-[16px]">
          <AdminAccountTable
            items={accountData.list}
            total={accountData.total}
            page={accountData.page}
            pageSize={accountData.pageSize || ACCOUNT_PAGE_SIZE}
            hasMore={accountData.hasMore}
            loading={loading}
            actionLoadingKey={actionLoadingKey}
            formatDateTime={formatDateTime}
            onPrev={() => loadAccounts({
              page: Math.max(1, accountData.page - 1),
              keyword: query.keyword,
              activeFilter: query.activeFilter,
              adminFilter: query.adminFilter,
            })}
            onNext={() => loadAccounts({
              page: accountData.page + 1,
              keyword: query.keyword,
              activeFilter: query.activeFilter,
              adminFilter: query.adminFilter,
            })}
            onEdit={handleOpenAccountEditor}
            onToggleActive={(item) => handleQuickAccountUpdate(
              item,
              { isActive: !item.isActive },
              item.isActive ? '账号已停用' : '账号已启用',
              'active',
            )}
            onToggleAdmin={(item) => handleQuickAccountUpdate(
              item,
              { isAdmin: !item.isAdmin },
              item.isAdmin ? '已取消管理员权限' : '已设为管理员',
              'admin',
            )}
          />
        </div>
      </div>

      <AdminAccountEditModal
        open={accountEditOpen}
        draft={accountEditDraft}
        saving={actionLoadingKey.startsWith('edit:')}
        onClose={handleCloseAccountEditor}
        onChange={(field, value) => setAccountEditDraft((current) => (current ? { ...current, [field]: value } : current))}
        onSubmit={handleSubmitAccountEdit}
      />
    </div>
  );
}
