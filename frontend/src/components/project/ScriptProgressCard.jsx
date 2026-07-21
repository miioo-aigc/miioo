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

export default function ScriptProgressCard({ title, status = 'pending' }) {
  const normalizedStatus = LEGACY_STATUS_MAP[status] || 'pending';
  const config = STATUS_CONFIG[normalizedStatus];

  return (
    <div
      style={{
        height: '80px',
        minWidth: 0,
        flex: '1 1 200px',
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
