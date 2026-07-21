/**
 * @file ScriptProgress.jsx
 * @description 项目总览“资产概况”中的剧本进度容器。
 */

import ScriptProgressCard from './ScriptProgressCard';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function EmptyScriptProgress() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0' }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="6" width="24" height="20" rx="3" stroke="#FFFFFF26" strokeWidth="1.5" />
        <path d="M4 12H28M11 6V12M21 6V12" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 17H24M8 21H18" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>暂无剧集</span>
    </div>
  );
}

export default function ScriptProgress({ episodes = [], episodeStatuses = {} }) {
  return (
    <section
      style={{
        width: '1000px',
        maxWidth: '100%',
        borderRadius: '8px',
        padding: '16px',
        background: '#1D1E1E',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '14px', color: '#FFFFFF' }}>剧本进度</span>
        {episodes.length > 0 && <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF80' }}>共 {episodes.length} 集</span>}
      </div>
      {episodes.length === 0 ? (
        <EmptyScriptProgress />
      ) : (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: '12px',
          height: '172px',
          maxHeight: '172px',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: '2px',
          boxSizing: 'border-box',
        }}>
          {episodes.map((episode, index) => {
            const episodeNumber = episode.episode_number || index + 1;
            const title = episode.title || episode.name || `第${episodeNumber}集`;
            return (
              <ScriptProgressCard
                key={episode.id || index}
                title={`${String(episodeNumber).padStart(2, '0')}.${title}`}
                status={episodeStatuses[index] || episode.status || 'pending'}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
