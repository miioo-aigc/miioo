export function getAssetFolderGridSizing(width, gap) {
  const columns = Math.max(1, Math.floor((width + gap) / (216 + gap)));
  const cardWidth = Math.max(0, Math.min(270, (width - (columns - 1) * gap) / columns));
  return { columns, cardWidth };
}
