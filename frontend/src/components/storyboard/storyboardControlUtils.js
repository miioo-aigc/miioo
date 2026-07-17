export function getEpisodeLabel(ep) {
  if (!ep) return '';
  if (typeof ep === 'string') return ep;
  const label = ep.title || `第${ep.episode_number}集` || JSON.stringify(ep);
  return label.length > 20 ? label.slice(0, 20) + '…' : label;
}

export function getEpisodeId(ep) {
  if (!ep) return '';
  if (typeof ep === 'string') return ep;
  return ep.id ?? '';
}
