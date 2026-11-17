export function getAssetFolderGridSizing(width, gap, minCardWidth = 216, maxCardWidth = 270) {
  const columns = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
  const cardWidth = Math.max(0, Math.min(maxCardWidth, (width - (columns - 1) * gap) / columns));
  return { columns, cardWidth };
}
