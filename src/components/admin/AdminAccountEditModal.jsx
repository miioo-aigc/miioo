const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_REGULAR = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={`relative inline-flex h-[28px] w-[48px] shrink-0 items-center rounded-full border transition-all ${
        checked
          ? 'border-blue-alpha-60 bg-blue-300'
          : 'border-stroke-normal bg-neutral-500'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute h-[22px] w-[22px] rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-[4px]'
        }`}
      />
    </button>
  );
}

function FieldLabel({ title, description }) {
  return (
    <div className="mb-[8px]">
      <div className="text-font-size-14 text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
        {title}
      </div>
      {description ? (
        <div className="mt-[4px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
          {description}
        </div>
      ) : null}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, disabled = false }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-[44px] w-full rounded-medium border border-stroke-normal bg-neutral-100 px-[14px] text-font-size-14 text-text-primary outline-none transition-all placeholder:text-text-hint focus:border-blue-alpha-60 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ fontFamily: FONT_REGULAR }}
    />
  );
}

function FooterButton({ children, onClick, disabled = false, variant = 'primary' }) {
  const styleMap = {
    primary: 'bg-blue-300 text-neutral-500 hover:brightness-110',
    secondary: 'border border-stroke-normal bg-neutral-200 text-text-primary hover:border-white-20',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-[40px] rounded-medium px-[16px] text-font-size-14 transition-all ${
        styleMap[variant]
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      style={{ fontFamily: FONT_MEDIUM }}
    >
      {children}
    </button>
  );
}

export default function AdminAccountEditModal({
  open,
  draft,
  saving = false,
  onClose,
  onChange,
  onSubmit,
}) {
  if (!open || !draft) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black-70 px-[24px] py-[24px]">
      <div
        className="w-full max-w-[560px] rounded-medium border border-stroke-normal bg-neutral-300 p-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <div className="text-[20px] leading-[24px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
              编辑账号
            </div>
            <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
              当前账号：{draft.displayId || draft.nickname || '未命名账号'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-[32px] rounded-medium px-[10px] text-font-size-12 text-text-secondary transition-all hover:bg-white-10 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontFamily: FONT_MEDIUM }}
          >
            关闭
          </button>
        </div>

        <div className="mt-[20px] space-y-[18px]">
          <div>
            <FieldLabel title="昵称" description="支持管理员直接修正当前账号昵称。" />
            <TextInput
              value={draft.nickname}
              onChange={(value) => onChange('nickname', value)}
              placeholder="请输入昵称"
              disabled={saving}
            />
          </div>

          <div>
            <FieldLabel title="手机号" description="手机号将作为当前绑定手机号写入账号，需保持唯一。" />
            <TextInput
              value={draft.phone}
              onChange={(value) => onChange('phone', value.replace(/\D/g, '').slice(0, 11))}
              placeholder="请输入 11 位手机号"
              disabled={saving}
            />
          </div>

          <div className="grid gap-[16px] md:grid-cols-2">
            <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[16px]">
              <FieldLabel title="启用状态" description="停用后该账号无法继续作为有效登录账号使用。" />
              <div className="flex items-center justify-between gap-[12px]">
                <span className="text-font-size-13 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                  {draft.isActive ? '当前启用中' : '当前已停用'}
                </span>
                <Toggle
                  checked={draft.isActive}
                  onChange={(value) => onChange('isActive', value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[16px]">
              <FieldLabel title="管理员权限" description="开启后该账号可看到管理员控制台入口。" />
              <div className="flex items-center justify-between gap-[12px]">
                <span className="text-font-size-13 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                  {draft.isAdmin ? '当前为管理员' : '当前为普通用户'}
                </span>
                <Toggle
                  checked={draft.isAdmin}
                  onChange={(value) => onChange('isAdmin', value)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-[24px] flex justify-end gap-[8px]">
          <FooterButton variant="secondary" onClick={onClose} disabled={saving}>
            取消
          </FooterButton>
          <FooterButton onClick={onSubmit} disabled={saving}>
            {saving ? '保存中...' : '保存账号'}
          </FooterButton>
        </div>
      </div>
    </div>
  );
}
