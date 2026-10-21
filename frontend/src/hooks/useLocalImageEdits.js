import { useEffect } from 'react';
import { localImagesFor, loadLocalImages, removeLocalImage, saveLocalImage, savePendingImage, useLocalImageEditStore } from '../stores/LocalImageEdits';
import { showGlobalToast } from '../stores/toastStore';
import { useCreationStore } from '../stores/creationStore';
import { accountCreationEditScope } from '../utils/CreationEditScope';

export default function useLocalImageEdits(inputScope) {
  const ownerId = useCreationStore((state) => state.ownerId);
  const scope = accountCreationEditScope(inputScope, ownerId);
  const images = useLocalImageEditStore((state) => localImagesFor(state, scope));
  useEffect(() => {
    loadLocalImages(scope).catch(() => showGlobalToast('本地编辑图片读取失败，请重试', 'error'));
  }, [scope]);
  return {
    scope,
    images,
    save: Object.assign((image) => saveLocalImage(scope, image), { scope, pending: (pending) => savePendingImage(scope, pending) }),
    remove: (id) => removeLocalImage(scope, id).catch(() => showGlobalToast('本地图片删除失败，请重试', 'error')),
  };
}
