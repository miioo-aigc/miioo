/**
 * @file FileUploadButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   FileUploadButton 只提供上传入口按钮的通用视觉，不处理文件、API 或业务状态
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   通过 onClick 将点击行为交给调用方，不依赖业务域、页面或 Store
 */
import Button from './Button';

export default function FileUploadButton({ children, onClick, disabled = false, className = '', ...props }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      disabled={disabled}
      className={`!h-6 !px-[6px] !rounded-[6px] !border-white/10 !bg-[#161616] !shadow-none hover:!border-white/20 hover:!bg-[#1A1A1A] active:!bg-[#222222] ${className}`}
      contentClassName="!text-[12px] !leading-4 !font-normal !text-white/40 group-hover:!text-white/80"
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  );
}
