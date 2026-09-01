import { createPortal } from 'react-dom';
import { useToastStore } from '../../stores/toastStore';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function ToastIcon({ type }) {
  if (type === 'success') {
    return <span aria-hidden="true" style={{ color: '#52BF92', fontSize: '16px', lineHeight: 1 }}>✓</span>;
  }
  if (type === 'error') {
    return <span aria-hidden="true" style={{ color: '#F75F5F', fontSize: '16px', lineHeight: 1 }}>×</span>;
  }
  if (type === 'warning') {
    return <span aria-hidden="true" style={{ color: '#EB8B14', fontSize: '16px', lineHeight: 1 }}>!</span>;
  }
  return null;
}

export default function GlobalToast() {
  const toast = useToastStore((state) => state.toast);
  if (!toast) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, pointerEvents: 'none' }}>
      <div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]" style={{ whiteSpace: 'nowrap', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
        <ToastIcon type={toast.type} />
        <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>{toast.message}</span>
      </div>
    </div>,
    document.body,
  );
}

