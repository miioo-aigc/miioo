/**
 * @file ScriptProgressCard.jsx
 * @description 项目总览中的单集剧本进度卡片。
 */

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const STATUS_CONFIG = {
  pending: {
    background: '#FFFFFF08',
    border: '#FFFFFF14',
    tags: [{ label: '未分镜', dashed: true }],
  },
  storyboarded: {
    background: '#2DC3E10A',
    border: '#2DC3E14D',
    tags: [{ label: '已分镜', dim: false }],
  },
  generated: {
    background: '#2DC3E10A',
    border: '#2DC3E14D',
    tags: [{ label: '已分镜', dim: true }, { label: '剪辑中' }],
  },
  edited: {
    background: '#52BF920A',
    border: '#52BF924D',
    tags: [{ label: '完成', success: true }],
  },
};

const LEGACY_STATUS_MAP = {
  pending: 'pending',
  storyboarded: 'storyboarded',
  generated: 'generated',
  edited: 'edited',
};

function ProgressTag({ label, dashed = false, dim = false, success = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '5px',
        padding: '4px 6px',
        background: dashed ? '#00000033' : success ? '#18251399' : '#06252C99',
        border: dashed ? '1px dashed #FFFFFF33' : `1px solid ${success ? '#52BF924D' : '#2DC3E14D'}`,
        opacity: dim ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: '12px',
          lineHeight: '12px',
          color: dashed ? '#FFFFFFCC' : success ? '#52BF92CC' : '#2DC3E1CC',
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function ScriptProgressCard({ title, status = 'pending', onClick }) {
  const normalizedStatus = LEGACY_STATUS_MAP[status] || 'pending';
  const config = STATUS_CONFIG[normalizedStatus];
  const isClickable = Boolean(onClick) && normalizedStatus !== 'pending';

  return (
    <div
      style={{
        height: '80px',
        minWidth: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '3px',
        padding: '12px',
        boxSizing: 'border-box',
        borderRadius: '5px',
        background: config.background,
        border: `1px solid ${config.border}`,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 80ms ease',
      }}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `查看${title}的分镜` : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      onMouseEnter={(event) => {
        if (!isClickable) return;
        event.currentTarget.style.backgroundColor = normalizedStatus === 'edited' ? '#52BF9218' : '#2DC3E118';
        event.currentTarget.style.borderColor = normalizedStatus === 'edited' ? '#52BF9270' : '#2DC3E170';
        event.currentTarget.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(event) => {
        if (!isClickable) return;
        event.currentTarget.style.backgroundColor = config.background;
        event.currentTarget.style.borderColor = config.border;
        event.currentTarget.style.boxShadow = 'none';
        event.currentTarget.style.transform = 'translateY(0)';
      }}
      onMouseDown={(event) => {
        if (isClickable) event.currentTarget.style.transform = 'translateY(1px)';
      }}
      onMouseUp={(event) => {
        if (isClickable) event.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '14px',
          color: '#FFFFFF',
        }}
        title={title}
      >
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '12px', alignSelf: 'stretch' }}>
        {config.tags.map((tag) => <ProgressTag key={tag.label} {...tag} />)}
      </div>
    </div>
  );
}
