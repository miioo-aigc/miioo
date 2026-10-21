import { useCreationStore } from './creationStore';
import { creationEditOwner } from '../utils/CreationEditScope';

export function syncCreationImageEdit(image) {
  if (!image.scope?.startsWith('creation:')) return;
  const store = useCreationStore.getState();
  if (!store.ownerId || creationEditOwner(image.scope) !== store.ownerId) return;
  const generations = store.generationsByTab.image;
  const generationId = `image-edit:${image.id}`;
  const existing = generations.find((generation) => generation.id === generationId);
  const assetId = image.creationAssetId || image.backendId;
  const originalUrl = image.originalUrl || image.remoteUrl;
  const listed = generations.some((generation) => generation.id !== generationId && generation.cards.some((card) =>
    card.status === 'done' && (
      (assetId && [card.id, card.assetId, card.backendId].some((id) => id && String(id) === String(assetId))) ||
      (originalUrl && [card.originalUrl, card.imageUrl].includes(originalUrl))
    )
  ));
  if (!image.pending && listed) {
    if (existing) store.deleteGeneration('image', generationId);
    return;
  }
  const card = {
    id: assetId || image.id, assetId, backendId: assetId,
    type: 'image', status: image.status, imageUrl: image.imageUrl,
    originalUrl, localEdit: !assetId, editRecordId: image.id, editScope: image.scope,
  };
  const generation = {
    id: generationId, createdAt: existing?.createdAt || image.created_at,
    prompt: image.prompt || '', model: image.model, ratio: image.ratio,
    resolution: image.resolution, cards: [card],
  };
  if (!existing) store.addGeneration('image', generation);
  else useCreationStore.setState((state) => ({ generationsByTab: {
    ...state.generationsByTab,
    image: state.generationsByTab.image.map((item) => item.id === generationId ? generation : item),
  } }));
}

export function removeCreationImageEdit(record) {
  if (useCreationStore.getState().ownerId && creationEditOwner(record.scope) === useCreationStore.getState().ownerId) {
    useCreationStore.getState().deleteGeneration('image', `image-edit:${record.id}`);
  }
}
