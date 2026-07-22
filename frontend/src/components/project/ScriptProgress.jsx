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
      <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" aria-hidden="true">
        <path d="M535.289 181.853A227.043 220.806 90 0 0 817.074 471.599V900.824a37.841 36.801 90 0 1-36.801 37.841H283.46A132.441 128.803 90 0 1 154.657 806.223V295.376a113.522 110.403 90 0 1 110.403-113.523h270.229zM283.46 749.462a56.761 55.201 90 0 0 0 113.522H743.472v-113.522H283.46zM726.175 118.66a19.185 18.659 90 0 1 34.593 0l9.347 23.084a165.249 160.709 90 0 0 82.803 88.054l26.423 12.109a20.055 19.504 90 0 1 0 36.402l-27.969 12.79a165.098 160.563 90 0 0-81.625 85.141l-9.09 21.417a19.147 18.621 90 0 1-34.372 0l-9.053-21.38a165.136 160.599 90 0 0-81.698-85.179l-27.969-12.79a20.055 19.504 90 0 1 0-36.44l26.423-12.109A165.212 160.673 90 0 0 716.828 141.819l9.311-23.159z" fill="#FFFFFF33" />
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
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          alignContent: 'start',
          gap: '12px',
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
