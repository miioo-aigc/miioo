export function creationImageIdentity(card) {
  return card.creationAssetId || card.assetId || card.backendId || card.id;
}

export function creationEditScope(card) {
  return `creation:${creationImageIdentity(card) || card.originalUrl || card.imageUrl}`;
}

export function visibleCreationEdits(images, listedImages) {
  const ids = new Set();
  const urls = new Set();
  for (const card of listedImages) {
    if (card.type && card.type !== 'image') continue;
    if (card.status !== 'done') continue;
    for (const id of [card.creationAssetId, card.assetId, card.backendId, card.id]) {
      if (id) ids.add(String(id));
    }
    if (card.originalUrl) urls.add(card.originalUrl);
  }
  return images.filter((image) => {
    if (image.pending) return true;
    const id = creationImageIdentity(image);
    const url = image.originalUrl || image.remoteUrl;
    if ((id && ids.has(String(id))) || (url && urls.has(url))) return false;
    if (id) ids.add(String(id));
    if (url) urls.add(url);
    return true;
  });
}
