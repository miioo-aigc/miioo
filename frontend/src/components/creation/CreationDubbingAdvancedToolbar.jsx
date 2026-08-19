import { Button, Select, Tooltip } from '../ui';
import CreationDubbingEffectsMenu from './CreationDubbingEffectsMenu';

function EmotionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PauseIcon() {
  return <span aria-hidden="true" style={{ fontSize: '12px', lineHeight: '16px', color: 'currentColor' }}>&lt;#&gt;</span>;
}

function InterjectionIcon() {
  return <span aria-hidden="true" style={{ fontSize: '12px', lineHeight: '16px', color: 'currentColor' }}>( )</span>;
}

function EffectsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 82 82" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M52.56 15.32 70.07 6.66a3.57 3.57 0 0 0 1.59-4.66 3.29 3.29 0 0 0-4.46-1.66L47.77 9.95a3.51 3.51 0 0 0-1.91 3.16v26.14a15 15 0 0 0-8.83-2.89c-8.56 0-15.52 7.28-15.52 16.22s6.96 16.21 15.52 16.21 15.53-7.27 15.53-16.21V15.32ZM37.03 61.79c-4.88 0-8.84-4.13-8.84-9.21s3.96-9.22 8.84-9.22 8.83 4.13 8.83 9.22-3.95 9.21-8.83 9.21ZM22.86 38.4a2.67 2.67 0 0 0 1.26-3.43 2.47 2.47 0 0 0-3.26-1.38c-7.13 3.23-10.4 11.88-7.31 19.33a2.53 2.53 0 0 0 3.28 1.31 2.66 2.66 0 0 0 1.33-3.4 9.83 9.83 0 0 1-.12-7.24 9.28 9.28 0 0 1 4.82-5.19Zm39.62 14.86a2.49 2.49 0 0 0-3.16-1.54 2.65 2.65 0 0 0-1.57 3.26c1.62 4.93-.88 10.3-5.6 12.02a2.59 2.59 0 0 0-1.69 1.98 2.69 2.69 0 0 0 .83 2.52c.7.61 1.66.79 2.51.46 7.34-2.67 11.22-11.03 8.68-18.7Z" fill="currentColor" />
    </svg>
  );
}

const TOOL_BUTTON_STYLE = { height: '32px' };

export default function CreationDubbingAdvancedToolbar({ hasTextSelection = false, disabled = false }) {
  const emotionUnavailable = !disabled && !hasTextSelection;
  const emotionTooltip = hasTextSelection
    ? '给选中文本并添加情绪，让语音表达更生动'
    : '请先选中一段文本以添加情绪';

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginLeft: '4px' }}
      onMouseDown={(event) => {
        if (!disabled) event.preventDefault();
      }}
    >
      <Tooltip label={emotionTooltip} offset={8}>
        <Button
          variant={hasTextSelection ? 'accent' : 'secondary'}
          icon={<EmotionIcon />}
          disabled={disabled}
          aria-disabled={emotionUnavailable || undefined}
          aria-label="情绪"
          className={emotionUnavailable ? 'hover:!bg-btn-primary-bg-normal active:!bg-btn-primary-bg-normal' : ''}
          style={{ ...TOOL_BUTTON_STYLE, paddingLeft: '18px', paddingRight: '18px', cursor: emotionUnavailable ? 'not-allowed' : undefined }}
          contentClassName="!text-[12px] !leading-[16px]"
          onClick={(event) => {
            if (emotionUnavailable) event.preventDefault();
          }}
          onKeyDown={(event) => {
            if (emotionUnavailable && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
          }}
        >
          情绪
        </Button>
      </Tooltip>
      <Tooltip
        label={'在文中插入停顿，精准掌控音频节奏\n支持选择预设时长，或直接输入秒数'}
        offset={8}
        multiline
      >
        <Button variant="secondary" icon={<PauseIcon />} disabled={disabled} aria-label="停顿" style={TOOL_BUTTON_STYLE}>
          停顿
        </Button>
      </Tooltip>
      <Tooltip
        label={'点击插入或输入生动的语气词，让语音更具感染力\n系统仅支持预设库内的语气词标签'}
        offset={8}
        multiline
      >
        <Button variant="secondary" icon={<InterjectionIcon />} disabled={disabled} aria-label="语气词" style={TOOL_BUTTON_STYLE}>
          语气词
        </Button>
      </Tooltip>
      <Select
        displayValue="叠加效果器"
        menuContent={() => <CreationDubbingEffectsMenu />}
        menuPlacement="up"
        menuRole="dialog"
        menuAriaLabel="叠加效果器设置"
        menuWidth="400px"
        menuMaxHeight="none"
        menuStyle={{ padding: '8px', border: '1px solid #FFFFFF0D', boxShadow: '#00000066 0px 4px 16px', overflow: 'visible' }}
        startIcon={<EffectsIcon />}
        disabled={disabled}
        width="auto"
        triggerStyle={{ height: '32px', minWidth: '132px', paddingLeft: '12px', paddingRight: '6px' }}
        displayTextStyle={{
          display: 'block',
          flex: '1 1 0%',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: "'AlibabaPuHuiTi_2_55_Regular', 'Alibaba PuHuiTi 2.0', system-ui, sans-serif",
          fontSize: '12px',
          lineHeight: '16px',
          color: 'rgba(255, 255, 255, 0.8)',
        }}
      />
    </div>
  );
}
