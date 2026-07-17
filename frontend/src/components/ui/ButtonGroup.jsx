/**
 * 按钮组只负责排列，不管理按钮状态或业务逻辑。
 */
export function ButtonGroup({ children, className = '', ...props }) {
  return (
    <div className={`flex items-center justify-end gap-[12px] ${className}`} {...props}>
      {children}
    </div>
  );
}

export default ButtonGroup;
