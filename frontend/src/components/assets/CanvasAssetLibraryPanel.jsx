import useCanvasLibraryProjectActions from './UseCanvasLibraryProjectActions';
import CanvasLibraryProjectDialogs from './CanvasLibraryProjectDialogs';
import useCanvasLibraryProjects from './UseCanvasLibraryProjects';
import CanvasCollectionSidebar from './CanvasCollectionSidebar';
import CanvasLibraryContents from './CanvasLibraryContents';
import CanvasLibraryReadError from './CanvasLibraryReadError';
import { EmptyAssetState } from './AssetsEmptyState';
import DotsLoading from '../DotsLoading';

/** 项目入口与画布选择编排；目录业务仍以集合身份挂载，切换时清除旧目录和选择。 */
export default function CanvasAssetLibraryPanel() {
  const library = useCanvasLibraryProjects();
  const projectActions = useCanvasLibraryProjectActions(library);
  return <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
    <CanvasCollectionSidebar library={library} busy={library.loading || projectActions.busy} onAction={projectActions.open} />
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {library.error ? <CanvasLibraryReadError busy={library.loading} onRetry={() => library.refresh()} />
        : library.collection ? <CanvasLibraryContents key={library.collection.id} collection={library.collection} />
          : <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-[12px] px-[24px] text-center text-[14px] text-text-secondary">
            {library.loading ? <DotsLoading size={5} color="#2DC3E1" gap={4} /> : <><EmptyAssetState /><p>暂无画布资产，请先创建画布项目</p></>}
          </div>}
    </div>
    <CanvasLibraryProjectDialogs actions={projectActions} />
  </div>;
}
