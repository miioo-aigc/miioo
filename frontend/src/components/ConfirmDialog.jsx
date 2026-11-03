import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import ModalCloseButton from './ui/ModalCloseButton';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

/**
 * 全局二次确认弹窗组件
 * 2026-11-03：支持多段内容、忙碌状态和可选焦点管理，复用于资产库删除确认。
 * @param {React.ReactNode} children - 可选多段正文，替代 description
 * @param {boolean} busy - 提交中禁止关闭与重复提交
 * @param {boolean} manageFocus - 启用焦点管理与 Escape 关闭
 *
 * @param {string}   title           - 标题
 * @param {string}   description     - 内容描述
 * @param {string}   [confirmText='确认']  - 确认按钮文案
 * @param {string}   [cancelText='取消']   - 取消按钮文案
 * @param {boolean}  [showCancel=true]    - 是否显示取消按钮
 * @param {'danger'|'orange'} [confirmVariant='danger'] - 确认按钮样式
 * @param {function} onConfirm       - 点击确认回调
 * @param {function} onCancel        - 点击取消 / 关闭回调
 * @param {number}   [zIndex=9999]   - 弹窗层级
 */
export default function ConfirmDialog({
  title,
  description,
  children,
  busy = false,
  manageFocus = false,
  confirmText = '确认',
  cancelText = '取消',
  showCancel = true,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  zIndex = 9999,
}) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!manageFocus) return;
    const previous = document.activeElement;
    dialogRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [manageFocus]);
  const handleCancel = (event) => { if (!busy) onCancel?.(event); };
  const handleKeyDown = (event) => {
    if (!manageFocus) return;
    if (event.key === 'Escape') { event.stopPropagation(); handleCancel(); }
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]'));
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
      event.preventDefault(); first.focus();
    }
  };
  const isOrange = confirmVariant === 'orange';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-surface-overlay)',
      }}
      onClick={handleCancel}
    >
      <div
        ref={dialogRef}
        tabIndex={manageFocus ? -1 : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy || undefined}
        onKeyDown={handleKeyDown}
        style={{
          width: '400px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '85vh',
          borderRadius: '16px',
          backgroundColor: 'var(--color-surface-modal)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontSynthesis: 'none',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          boxShadow: '0px 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 标题栏 ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '16px',
            paddingBlock: '16px',
            paddingInline: '24px',
          }}
        >
          <span
            style={{
              flex: 1,
              fontFamily: FONT_MEDIUM,
              fontWeight: 500,
              fontSize: '16px',
              lineHeight: '20px',
              color: '#FFFFFF',
            }}
          >
            {title}
          </span>
          <ModalCloseButton disabled={busy} onClick={handleCancel} />
        </div>

        {/* ── 内容区 ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflowY: 'auto',
            gap: '16px',
            fontFamily: FONT,
            fontSize: '14px',
            lineHeight: '175%',
            color: 'rgba(255,255,255,0.6)',
            paddingBlock: '8px',
            paddingInline: '24px',
          }}
        >
          {children ?? <p
            style={{
              margin: 0,
              alignSelf: 'stretch',
              fontFamily: FONT,
              fontSize: '14px',
              lineHeight: '175%',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {description}
          </p>}
        </div>

        {/* ── 按钮区 ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
            gap: '12px',
            paddingBlock: '16px',
            paddingInline: '24px',
          }}
        >
          {/* 取消按钮 */}
          {showCancel && (
            <Button disabled={busy} variant="secondary" onClick={handleCancel}>
              {cancelText}
            </Button>
          )}

          {/* 确认按钮 */}
          {isOrange ? (
            <button
              disabled={busy}
              type="button"
              onClick={(event) => { if (!busy) onConfirm?.(event); }}
              className="flex h-9 shrink-0 items-center justify-center rounded-lg border px-[16px] text-sm/[18px] font-medium text-white transition-colors cursor-pointer"
              style={{
                fontFamily: FONT_MEDIUM,
                backgroundColor: '#E87B35',
                borderColor: 'rgba(255,255,255,0.20)',
              }}
            >
              {confirmText}
            </button>
          ) : (
            <Button loading={busy} variant="danger" onClick={(event) => { if (!busy) onConfirm?.(event); }}>
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
