import { useState } from 'react';
import { Select } from '../ui';
import { getEpisodeId } from './storyboardControlUtils';

function getStoryboardEpisodeLabel(episode) {
  if (!episode) return '';
  if (typeof episode === 'string') return episode;
  const number = episode.episode_number != null
    ? String(episode.episode_number).padStart(2, '0')
    : '';
  const title = episode.title || (episode.episode_number != null ? `第${episode.episode_number}集` : '');
  return number ? `${number}.${title}` : title;
}

function EpisodeSelector({ episodes, value, onChange }) {
  const options = (episodes || []).map((episode) => ({
    value: getEpisodeId(episode),
    label: getStoryboardEpisodeLabel(episode),
  }));
  const valueId = getEpisodeId(value);
  return (
    <Select
      value={valueId}
      displayValue={getStoryboardEpisodeLabel(value)}
      options={options}
      width="180px"
      hideTriggerBorder
      triggerStyle={{
        height: '32px',
        borderRadius: '6px',
        padding: '0 12px',
        background: '#FFFFFF14',
      }}
      selectedOptionColor="#FFFFFF"
      selectedOptionBackground="rgba(255,255,255,0.08)"
      onChange={(nextId) => {
        const nextEpisode = (episodes || []).find((item) => getEpisodeId(item) === nextId);
        if (nextEpisode) onChange(nextEpisode);
      }}
    />
  );
}

// ─── 批量生成弹窗已迁移至 components/storyboard/BatchGenerateModals.jsx ───

function ModalCloseBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
        backgroundColor: hov ? 'rgba(255,255,255,0.08)' : 'transparent',
        transition: 'background-color 0.10s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}


export { EpisodeSelector, ModalCloseBtn };
