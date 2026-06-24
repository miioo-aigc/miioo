import { IconPlus } from '../../../components/StoryboardIcons';

/**
 * "添加空白分镜" 按钮 / Empty shot add button.
 * 纯 presentational，通过 onClick 回调与父组件通信。
 */
export default function AddShotButton({ onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '40px',
        minWidth: '1160px',
        borderRadius: '12px',
        border: '1px dashed rgba(255,255,255,0.12)',
        cursor: 'pointer',
        flexShrink: 0,
        gap: '6px',
        color: 'rgba(255,255,255,0.40)',
        fontSize: '14px',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        transition: 'border-color 150ms, color 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.70)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
      }}
    >
      <IconPlus color="currentColor" />
      添加空白分镜
    </div>
  );
}
