import { FONT } from '../../../utils/fonts';

/** 后台生成中时居中的 inline 状态条 */
export default function GeneratingProgressBar({ completedEpisodesCount, totalEpisodes }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex', alignItems: 'center', gap: '6px',
      height: '28px', padding: '0 10px', borderRadius: '6px',
      background: 'rgba(45,195,225,0.08)',
      border: '1px solid rgba(45,195,225,0.2)',
      pointerEvents: 'none',
      flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, animation: 'spin 1.2s linear infinite' }}>
        <circle cx="6" cy="6" r="4.5" stroke="rgba(45,195,225,0.3)" strokeWidth="1.5" />
        <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="#2DC3E1" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: '12px', color: '#2DC3E1', whiteSpace: 'nowrap' }}>
        后台还在抽取分镜，已完成 {completedEpisodesCount}/{totalEpisodes} 集
      </span>
    </div>
  );
}
