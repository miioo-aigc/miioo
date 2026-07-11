const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_REGULAR = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function StatusBadge({ tone = 'default', label }) {
  const toneClass = {
    success: 'border-green-alpha-40 bg-green-alpha-10 text-text-success',
    warning: 'border-yellow-alpha-40 bg-yellow-alpha-10 text-yellow-300',
    info: 'border-blue-alpha-40 bg-blue-alpha-10 text-blue-300',
    default: 'border-stroke-normal bg-neutral-200 text-text-secondary',
  };

  return (
    <span
      className={`inline-flex h-[28px] items-center rounded-[999px] border px-[10px] text-font-size-12 ${toneClass[tone] || toneClass.default}`}
      style={{ fontFamily: FONT_MEDIUM }}
    >
      {label}
    </span>
  );
}

function RowAction({ children, onClick, disabled = false, variant = 'default' }) {
  const variantClass = {
    default: 'border-stroke-normal bg-neutral-200 text-text-primary hover:border-white-20',
    danger: 'border-red-alpha-40 bg-red-alpha-10 text-red-300 hover:border-red-alpha-60',
    primary: 'border-blue-alpha-40 bg-blue-alpha-10 text-blue-300 hover:border-blue-alpha-60',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-[32px] rounded-medium border px-[12px] text-font-size-12 transition-all ${
        variantClass[variant] || variantClass.default
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      style={{ fontFamily: FONT_MEDIUM }}
    >
      {children}
    </button>
  );
}

function EmptyState({ loading }) {
  return (
    <div
      className="flex min-h-[220px] items-center justify-center rounded-medium border border-dashed border-stroke-normal bg-neutral-200 text-font-size-14 text-text-secondary"
      style={{ fontFamily: FONT_REGULAR }}
    >
      {loading ? '账号列表加载中...' : '当前没有匹配到账号'}
    </div>
  );
}

export default function AdminAccountTable({
  items,
  total,
  page,
  pageSize,
  hasMore,
  loading = false,
  actionLoadingKey = '',
  onPrev,
  onNext,
  onEdit,
  onToggleActive,
  onToggleAdmin,
  formatDateTime,
}) {
  if (!items.length) {
    return <EmptyState loading={loading} />;
  }

  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stroke-normal bg-neutral-300 text-left">
              {['展示号', '账号信息', '手机号信息', '最近登录', '状态', '创建时间', '操作'].map((label) => (
                <th
                  key={label}
                  className="px-[16px] py-[14px] text-font-size-12 text-text-hint"
                  style={{ fontFamily: FONT_MEDIUM }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const loadingEdit = actionLoadingKey === `edit:${item.id}`;
              const loadingToggleActive = actionLoadingKey === `active:${item.id}`;
              const loadingToggleAdmin = actionLoadingKey === `admin:${item.id}`;
              return (
                <tr key={item.id} className="border-b border-stroke-normal last:border-b-0">
                  <td className="px-[16px] py-[16px] text-font-size-13 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                    {item.displayId || '未生成展示号'}
                  </td>
                  <td className="px-[16px] py-[16px]">
                    <div className="min-w-[180px]">
                      <div className="text-font-size-14 text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
                        {item.nickname || '未命名账号'}
                      </div>
                      <div className="mt-[6px] flex flex-wrap gap-[8px]">
                        <StatusBadge tone={item.isAdmin ? 'info' : 'default'} label={item.isAdmin ? '管理员' : '普通用户'} />
                        <StatusBadge tone={item.isActive ? 'success' : 'warning'} label={item.isActive ? '启用中' : '已停用'} />
                      </div>
                    </div>
                  </td>
                  <td className="px-[16px] py-[16px]">
                    <div className="min-w-[220px] space-y-[6px] text-font-size-12 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                      <div>当前：{item.currentPhone || '未记录'}</div>
                      <div>注册：{item.registeredPhone || '未记录'}</div>
                      <div>最近登录：{item.lastLoginPhone || '未记录'}</div>
                    </div>
                  </td>
                  <td className="px-[16px] py-[16px] text-font-size-13 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                    {formatDateTime(item.lastLoginAt)}
                  </td>
                  <td className="px-[16px] py-[16px]">
                    <div className="flex min-w-[140px] flex-wrap gap-[8px]">
                      <StatusBadge tone={item.isActive ? 'success' : 'warning'} label={item.isActive ? '账号正常' : '账号停用'} />
                      <StatusBadge tone={item.isAdmin ? 'info' : 'default'} label={item.isAdmin ? '后台可管控' : '普通权限'} />
                    </div>
                  </td>
                  <td className="px-[16px] py-[16px] text-font-size-13 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="px-[16px] py-[16px]">
                    <div className="flex min-w-[260px] flex-wrap gap-[8px]">
                      <RowAction onClick={() => onEdit(item)} disabled={loadingEdit || loading} variant="primary">
                        {loadingEdit ? '处理中...' : '编辑账号'}
                      </RowAction>
                      <RowAction onClick={() => onToggleActive(item)} disabled={loadingToggleActive || loading} variant={item.isActive ? 'danger' : 'default'}>
                        {loadingToggleActive ? '处理中...' : item.isActive ? '停用账号' : '启用账号'}
                      </RowAction>
                      <RowAction onClick={() => onToggleAdmin(item)} disabled={loadingToggleAdmin || loading}>
                        {loadingToggleAdmin ? '处理中...' : item.isAdmin ? '取消管理员' : '设为管理员'}
                      </RowAction>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-[12px] border-t border-stroke-normal px-[16px] py-[14px]">
        <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
          共 {total} 个账号，每页 {pageSize} 条
        </div>
        <div className="flex items-center gap-[8px]">
          <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
            第 {page} 页
          </span>
          <RowAction onClick={onPrev} disabled={loading || page <= 1}>
            上一页
          </RowAction>
          <RowAction onClick={onNext} disabled={loading || !hasMore}>
            下一页
          </RowAction>
        </div>
      </div>
    </div>
  );
}
