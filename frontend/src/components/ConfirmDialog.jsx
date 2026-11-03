import { createPortal } from 'react-dom';
import { Button } from './ui';
import ModalCloseButton from './ui/ModalCloseButton';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

/**
 * 全局二次确认弹窗组件
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
  confirmText = '确认',
  cancelText = '取消',
  showCancel = true,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  zIndex = 9999,
}) {
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
      onClick={onCancel}
    >
      <div
        style={{
          width: '400px',
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
          <ModalCloseButton onClick={onCancel} />
        </div>

        {/* ── 内容区 ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            paddingBlock: '8px',
            paddingInline: '24px',
          }}
        >
          <p
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
          </p>
        </div>

        {/* ── 按钮区 ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingBlock: '16px',
            paddingInline: '24px',
          }}
        >
          {/* 取消按钮 */}
          {showCancel && (
            <Button variant="secondary" onClick={onCancel}>
              {cancelText}
            </Button>
          )}

          {/* 确认按钮 */}
          {isOrange ? (
            <button
              type="button"
              onClick={onConfirm}
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
            <Button variant="danger" onClick={onConfirm}>
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
