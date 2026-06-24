import { memo } from 'react';
import { FONT } from '../utils/fonts';

function getEpisodeLabel(ep) { return typeof ep === 'string' ? ep : (ep?.label || ep?.name || '第N集'); }
function getEpisodeId(ep) { return typeof ep === 'string' ? ep : (ep?.id || ep?.value || ep?.label || ''); }

const EPISODE_ITEM_H = 36;
const EPISODE_MAX_VISIBLE = 10;

function EpisodeSelector({ episodes, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignSelf: 'stretch' }}>
      {(episodes || []).map((ep) => {
        const isActive = (getEpisodeId(ep) === getEpisodeId(value)) || (ep === value);
        return (
          <div key={getEpisodeId(ep)} onClick={() => onChange?.(ep)}
            style={{ display: 'flex', alignItems: 'center', height: `${EPISODE_ITEM_H}px`, paddingInline: '10px', borderRadius: '6px', cursor: 'pointer', backgroundColor: isActive ? '#FFFFFF14' : 'transparent', transition: 'background-color 100ms' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: isActive ? '#FFFFFF' : '#FFFFFF66', whiteSpace: 'nowrap' }}>{getEpisodeLabel(ep)}</span>
          </div>
        );
      })}
    </div>
  );
}
export default memo(EpisodeSelector);
