import useCanvasCollections from './UseCanvasCollections';
import useCanvasCollectionActions from './UseCanvasCollectionActions';
import CanvasCollectionSidebar from './CanvasCollectionSidebar';
import CanvasCollectionDialogs from './CanvasCollectionDialogs';
import CanvasLibraryContents from './CanvasLibraryContents';
import CanvasLibraryReadError from './CanvasLibraryReadError';
import { EmptyAssetState } from './AssetsEmptyState';

/** 集合级编排；目录业务以集合身份挂载，切换时销毁旧选择与目录状态。 */
export default function CanvasAssetLibraryPanel() {
  const library = useCanvasCollections();
  const actions = useCanvasCollectionActions(library);
  return <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
    <CanvasCollectionSidebar library={library} busy={actions.busy} onAction={actions.open} />
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {library.error ? <CanvasLibraryReadError busy={library.loading} onRetry={() => library.refresh()} />
        : library.collection ? <CanvasLibraryContents key={library.collection.id} collection={library.collection} />
          : <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-[12px] px-[24px] text-center text-[14px] text-text-secondary">
            {library.loading ? '加载中...' : <><EmptyAssetState /><p>暂无画布资产，请先创建画布项目</p></>}
          </div>}
    </div>
    <CanvasCollectionDialogs actions={actions} />
  </div>;
}
