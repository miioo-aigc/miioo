import { useEffect } from 'react';
import { localImagesFor, loadLocalImages, removeLocalImage, saveLocalImage, useLocalImageEditStore } from '../stores/LocalImageEdits';
import { showGlobalToast } from '../stores/toastStore';

export default function useLocalImageEdits(scope) {
  const images = useLocalImageEditStore((state) => localImagesFor(state, scope));
  useEffect(() => {
    loadLocalImages(scope).catch(() => showGlobalToast('本地编辑图片读取失败，请重试', 'error'));
  }, [scope]);
  return {
    scope,
    images,
    save: (image) => saveLocalImage(scope, image),
    remove: (id) => removeLocalImage(scope, id).catch(() => showGlobalToast('本地图片删除失败，请重试', 'error')),
  };
}
