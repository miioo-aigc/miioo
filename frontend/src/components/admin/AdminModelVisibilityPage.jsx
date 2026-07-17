import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiGetAdminModelVisibility,
  apiUpdateAdminModelVisibility,
} from '../../api/admin';
import AdminModelVisibilityFilters from './AdminModelVisibilityFilters';
import AdminModelVisibilityTable from './AdminModelVisibilityTable';
import { FONT_MEDIUM, FONT_REGULAR, getErrorMessage } from './adminSharedUtils';

function buildProviderOptions(items = []) {
  const map = new Map();
  items.forEach((item) => {
    if (!item?.providerType) return;
    if (!map.has(item.providerType)) {
      map.set(item.providerType, item.providerName || item.providerType);
    }
  });
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

export default function AdminModelVisibilityPage({
  refreshSignal = 0,
  showToast,
}) {
  const [query, setQuery] = useState({
    page: 1,
    keyword: '',
    providerType: 'all',
    category: 'all',
  });
  const [draftKeyword, setDraftKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [providerOptions, setProviderOptions] = useState([]);
  const [pageError, setPageError] = useState('');
  const [pageData, setPageData] = useState({
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
    visibleTotal: 0,
  });

  const loadPage = useCallback(async ({
    page,
    keyword,
    providerType,
    category,
    force = true,
  } = {}) => {
    const nextPage = Number(page || query.page || 1);
    const nextKeyword = typeof keyword === 'string' ? keyword : query.keyword;
    const nextProviderType = typeof providerType === 'string' ? providerType : query.providerType;
    const nextCategory = typeof category === 'string' ? category : query.category;
    setLoading(true);
    try {
      setPageError('');
      const payload = await apiGetAdminModelVisibility({
        page: nextPage,
        pageSize: 20,
        keyword: nextKeyword || undefined,
        providerType: nextProviderType === 'all' ? undefined : nextProviderType,
        category: nextCategory === 'all' ? undefined : nextCategory,
        force,
      });
      setQuery({
        page: payload.page,
        keyword: nextKeyword,
        providerType: nextProviderType,
        category: nextCategory,
      });
      setDraftKeyword(nextKeyword);
      setPageData(payload);
      if (nextPage === 1) {
        setProviderOptions(buildProviderOptions(payload.list));
      }
    } catch (error) {
      const message = getErrorMessage(error, '模型开放列表加载失败');
      setPageError(message);
      showToast?.(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [query.category, query.keyword, query.page, query.providerType, showToast]);

  const loadProviderOptions = useCallback(async () => {
    try {
      const payload = await apiGetAdminModelVisibility({
        page: 1,
        pageSize: 100,
        force: true,
      });
      setProviderOptions(buildProviderOptions(payload.list));
    } catch {
      // Ignore provider option warmup failures and let main page load surface the error.
    }
  }, []);

  useEffect(() => {
    // refreshSignal 表示管理员外部数据刷新；此处必须重新请求列表和筛选项。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage({ force: true });
    loadProviderOptions();
  }, [loadPage, loadProviderOptions, refreshSignal]);

  const handleToggleModelVisibility = async (item, nextVisible) => {
    const rowKey = `${item.providerType}:${item.category}:${item.modelId}`;
    const previousList = pageData.list;
    const previousVisibleTotal = pageData.visibleTotal;
    setPageData((current) => ({
      ...current,
      visibleTotal: current.visibleTotal + (nextVisible ? 1 : -1),
      list: current.list.map((entry) => (
        entry.providerType === item.providerType && entry.category === item.category && entry.modelId === item.modelId
          ? { ...entry, isVisible: nextVisible }
          : entry
      )),
    }));
    setSavingKey(rowKey);
    try {
      const updated = await apiUpdateAdminModelVisibility(item.providerType, item.category, item.modelId, {
        is_visible: nextVisible,
      });
      setPageData((current) => ({
        ...current,
        list: current.list.map((entry) => (
          entry.providerType === item.providerType && entry.category === item.category && entry.modelId === item.modelId
            ? {
              ...entry,
              isVisible: updated?.isVisible ?? nextVisible,
              updatedAt: updated?.updatedAt ?? entry.updatedAt,
            }
            : entry
        )),
      }));
      showToast?.(`${item.name} 已${nextVisible ? '开放' : '关闭'}`, 'success');
    } catch (error) {
      setPageData((current) => ({
        ...current,
        visibleTotal: previousVisibleTotal,
        list: previousList,
      }));
      showToast?.(getErrorMessage(error, '模型开放状态更新失败'), 'error');
    } finally {
      setSavingKey('');
    }
  };

  const headerSummary = useMemo(
    () => `共 ${pageData.total} 个模型，当前开放 ${pageData.visibleTotal} 个`,
    [pageData.total, pageData.visibleTotal],
  );

  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-300 p-[20px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <div className="text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
            模型开放
          </div>
          <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
            分页控制普通用户是否还能看到并使用具体模型。关闭后，普通用户端会隐藏该模型，强行提交也会被后端拦截。
          </div>
        </div>
        <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
          {headerSummary}
        </div>
      </div>

      <div className="mt-[16px]">
        <AdminModelVisibilityFilters
          keyword={draftKeyword}
          onKeywordChange={setDraftKeyword}
          providerType={query.providerType}
          onProviderTypeChange={(value) => setQuery((current) => ({ ...current, providerType: value }))}
          category={query.category}
          onCategoryChange={(value) => setQuery((current) => ({ ...current, category: value }))}
          providerOptions={providerOptions}
          loading={loading}
          onSearch={() => loadPage({
            page: 1,
            keyword: draftKeyword.trim(),
            providerType: query.providerType,
            category: query.category,
          })}
          onReset={() => {
            setDraftKeyword('');
            setQuery((current) => ({
              ...current,
              providerType: 'all',
              category: 'all',
            }));
            loadPage({
              page: 1,
              keyword: '',
              providerType: 'all',
              category: 'all',
            });
          }}
        />
      </div>

      {pageError ? (
        <div className="mt-[16px] rounded-medium border border-red-alpha-40 bg-red-alpha-10 px-[16px] py-[12px] text-font-size-14 text-red-300" style={{ fontFamily: FONT_REGULAR }}>
          {pageError}
        </div>
      ) : null}

      <div className="mt-[16px]">
        <AdminModelVisibilityTable
          items={pageData.list}
          total={pageData.total}
          page={pageData.page}
          pageSize={pageData.pageSize}
          hasMore={pageData.hasMore}
          loading={loading}
          savingKey={savingKey}
          onPrev={() => loadPage({
            page: Math.max(1, pageData.page - 1),
            keyword: query.keyword,
            providerType: query.providerType,
            category: query.category,
          })}
          onNext={() => loadPage({
            page: pageData.page + 1,
            keyword: query.keyword,
            providerType: query.providerType,
            category: query.category,
          })}
          onToggle={handleToggleModelVisibility}
        />
      </div>
    </div>
  );
}
