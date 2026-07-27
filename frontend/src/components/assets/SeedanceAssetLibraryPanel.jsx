/**
 * @file SeedanceAssetLibraryPanel.jsx
 * @structure-index
 *
 * ─── 页面区块 ───────────────────────────────────────
 *   SeedanceAssetLibraryPanel：Seedance2.0素材库子 Tab 和文件夹网格
 *   真人素材组：从真人素材接口读取，空数据时仅展示录入入口
 *   SeedanceFolderDetail：打开文件夹后的图片/视频列表与上传入口
 *   AddVirtualGroupCard：虚拟人像素材库的新建素材组入口
 *   ConfirmDialog / AssetsProjectRenameModal：删除确认与素材库重命名
 *   CreationLiveMaterialModal：复用创作模块的真人素材录入流程
 *
 * ─── 更新记录 ───────────────────────────────────────
 *   2026-07-24  按 Paper 设计稿新增真人人像素材库 UI，抽离文件夹卡片
 *   2026-07-24  按 Paper 设计稿校准「录入新的真人」卡片的渐变、描边和文字颜色
 *   2026-07-24  统一录入卡片和文件夹卡片的 270×180 基准比例及宽度边界
 *   2026-07-24  卡片不再因少量内容拉伸，网格间距固定为 16px
 *   2026-07-24  增加素材库重命名和删除二次确认交互
 *   2026-07-24  复用创作模块真人素材弹窗，接入扫码录入和认证流程
 *   2026-07-24  增加文件夹详情页，接入真人素材图片上传与真实列表
 *   2026-07-27  支持文件夹上传图片和视频素材，并按媒体类型展示
 *   2026-07-27  按官方规则增加图片、视频和音频上传前校验
 *   2026-07-24  增加虚拟人像素材库卡片网格和新建素材组入口
 *   2026-07-24  接入 AIGC 素材组真实接口，真人与虚拟素材组按类型隔离
 *   2026-07-27  详情页素材卡片增加悬停预览、删除确认和删除后列表同步
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Tabs from '../ui/Tabs';
import ConfirmDialog from '../ConfirmDialog';
import CreationLiveMaterialModal from '../creation/CreationLiveMaterialModal';
import CreationToast from '../creation/CreationToast';
import { AssetsProjectRenameModal } from './AssetsProjectModals';
import {
  apiDeleteLiveMaterialGroup,
  apiDeleteLiveMaterialAsset,
  apiCreateAigcMaterialGroup,
  apiListLiveMaterialAssets,
  apiListLiveMaterialGroups,
  apiUploadLiveMaterialAsset,
  apiUpdateLiveMaterialGroup,
} from '../../api/liveMaterials';
import SeedanceFolderCard from './SeedanceFolderCard';
import SeedanceFolderDetail from './SeedanceFolderDetail';
import AddVirtualGroupCard from './AddVirtualGroupCard';
import { createVideoFirstFrame, validateSeedanceUpload } from './seedanceUploadValidation';
import SeedanceResolutionDialog from './SeedanceResolutionDialog';
import SeedanceAssetPreviewModal from './SeedanceAssetPreviewModal';

const SUB_TABS = [
  { value: 'real', label: '真人人像' },
  { value: 'virtual', label: '虚拟人像' },
];

function AddRealPersonCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-[3/2] flex w-full min-w-[216px] max-w-[270px] items-center justify-self-center rounded-[8px] border border-solid border-white/12 p-[12px] text-white/80 transition-colors hover:border-white/25 hover:text-white"
      style={{
        backgroundImage: 'linear-gradient(121.71deg, oklab(0.2 0 0) 0.7%, oklab(0.274 -0.039 -0.028) 99.92%)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      aria-label="录入新的真人"
    >
      <span className="flex items-center gap-[6px] text-[14px] leading-[18px] text-white/80" style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>
        <svg width="20" height="20" viewBox="0 0 102.4 102.4" aria-hidden="true"><path d="M50.035 10.618a41.697 41.697 0 1 0 41.698 41.697 41.744 41.744 0 0 0-41.698-41.697Zm0 76.77a35.072 35.072 0 1 1 35.072-35.073 35.072 35.072 0 0 1-35.072 35.073Z" fill="currentColor" /><path d="M66.163 55.388H33.907a3.072 3.072 0 1 1 0-6.145h32.256a3.072 3.072 0 1 1 0 6.145Zm-16.128 16.127a3.072 3.072 0 0 1-3.072-3.072V36.188a3.072 3.072 0 0 1 6.144 0v32.255a3.072 3.072 0 0 1-3.072 3.072Z" fill="currentColor" /></svg>
        录入新的真人
      </span>
    </button>
  );
}

export default function SeedanceAssetLibraryPanel() {
  const [activeTab, setActiveTab] = useState('real');
  const [folders, setFolders] = useState([]);
  const [virtualFolders, setVirtualFolders] = useState([]);
  const [liveMaterialModalOpen, setLiveMaterialModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderAssets, setFolderAssets] = useState([]);
  const [folderAssetsLoading, setFolderAssetsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [assetDeleteTarget, setAssetDeleteTarget] = useState(null);
  const [deletingAsset, setDeletingAsset] = useState(false);
  const toastTimerRef = useRef(null);
  const assetPollRef = useRef(null);
  const uploadedAssetNamesRef = useRef(new Map());
  const uploadedAssetPostersRef = useRef(new Map());

  const showToast = useCallback((message, type = 'error', duration = 3000) => {
    clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const handleTabChange = (value) => {
    setActiveTab(value);
    setActiveFolder(null);
    setFolderAssets([]);
  };

  const mapGroupToFolder = useCallback(async (group) => {
    let assets = [];
    try {
      assets = await apiListLiveMaterialAssets(group.id);
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 获取素材组预览失败', error);
    }
    return {
      id: group.id,
      name: group.name || '未命名素材组',
      count: group.asset_count ?? assets.length,
      images: assets.slice(0, 2).map((asset) => (
        uploadedAssetPostersRef.current.get(asset.id)
          || asset.poster_url
          || asset.posterUrl
          || asset.thumbnail_url
          || asset.thumbnailUrl
          || asset.preview_url || (
          ['video', 'audio'].includes(String(asset.asset_type || '').toLowerCase())
            ? null
            : asset.asset_ref_url
        )
      )).filter(Boolean),
      groupType: group.group_type,
    };
  }, []);

  const refreshFolders = useCallback(async () => {
    try {
      const groups = await apiListLiveMaterialGroups();
      const realGroups = groups.filter((group) => String(group.group_type || '').toUpperCase() !== 'AIGC');
      const aigcGroups = groups.filter((group) => String(group.group_type || '').toUpperCase() === 'AIGC');
      const [nextFolders, nextVirtualFolders] = await Promise.all([
        Promise.all(realGroups.map(mapGroupToFolder)),
        Promise.all(aigcGroups.map(mapGroupToFolder)),
      ]);
      setFolders(nextFolders);
      setVirtualFolders(nextVirtualFolders);
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 刷新素材库失败', error);
    }
  }, [mapGroupToFolder]);

  useEffect(() => {
    const refreshTimer = setTimeout(() => refreshFolders(), 0);
    return () => clearTimeout(refreshTimer);
  }, [refreshFolders]);

  const handleDelete = (folder) => setDeleteTarget(folder);

  const handleOpenFolder = async (folder) => {
    setActiveFolder(folder);
    setFolderAssets([]);
    setFolderAssetsLoading(true);
    try {
      const assets = await apiListLiveMaterialAssets(folder.id, { refresh: true });
      setFolderAssets(assets.map((asset) => ({
        ...asset,
        name: uploadedAssetNamesRef.current.get(asset.id) || asset.name,
        posterUrl: uploadedAssetPostersRef.current.get(asset.id)
          || asset.poster_url
          || asset.posterUrl
          || asset.thumbnail_url
          || asset.thumbnailUrl,
      })));
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 获取文件夹素材失败', error);
      showToast('素材加载失败，请返回后重试');
    } finally {
      setFolderAssetsLoading(false);
    }
  };

  const startAssetStatusPolling = useCallback((groupId) => {
    if (assetPollRef.current) return;
    assetPollRef.current = setInterval(async () => {
      try {
        const assets = await apiListLiveMaterialAssets(groupId, { refresh: true });
        setFolderAssets(assets.map((asset) => ({
          ...asset,
          name: uploadedAssetNamesRef.current.get(asset.id) || asset.name,
          posterUrl: uploadedAssetPostersRef.current.get(asset.id)
            || asset.poster_url
            || asset.posterUrl
            || asset.thumbnail_url
            || asset.thumbnailUrl,
        })));
        const allDone = assets.every((asset) => {
          const status = (asset.status || '').toLowerCase();
          return status !== 'pending' && status !== 'processing';
        });
        if (allDone) {
          clearInterval(assetPollRef.current);
          assetPollRef.current = null;
          await refreshFolders();
        }
      } catch (error) {
        console.warn('[SeedanceAssetLibraryPanel] 刷新真人素材审核状态失败', error);
      }
    }, 4000);
  }, [refreshFolders]);

  const handleUploadAsset = async (file) => {
    if (!activeFolder) return;
    const validation = await validateSeedanceUpload(file);
    if (validation.error || !validation.type) {
      if (validation.errorCode === 'resolution') {
        setResolutionDialogOpen(true);
        return;
      }
      showToast(validation.error || '当前素材类型暂不支持上传', 'error', 5000);
      return;
    }
    setUploading(true);
    try {
      let firstFrameUrl = null;
      if (validation.type === 'video') {
        try {
          firstFrameUrl = await createVideoFirstFrame(file);
        } catch (error) {
          console.warn('[SeedanceAssetLibraryPanel] 生成视频首帧失败，将使用视频预览', error);
        }
      }
      const asset = await apiUploadLiveMaterialAsset(activeFolder.id, file, validation.type, file.name);
      if (asset?.id) {
        uploadedAssetNamesRef.current.set(asset.id, file.name);
        if (firstFrameUrl) uploadedAssetPostersRef.current.set(asset.id, firstFrameUrl);
      }
      setFolderAssets((current) => [{
        ...asset,
        name: file.name,
        localFile: validation.type === 'video' ? file : null,
        posterUrl: firstFrameUrl
          || asset?.poster_url
          || asset?.posterUrl
          || asset?.thumbnail_url
          || asset?.thumbnailUrl,
      }, ...current]);
      await refreshFolders();
      startAssetStatusPolling(activeFolder.id);
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 上传真人素材失败', error);
      showToast('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDeleteAsset = async () => {
    if (!assetDeleteTarget || deletingAsset) return;
    setDeletingAsset(true);
    try {
      await apiDeleteLiveMaterialAsset(assetDeleteTarget.id);
      setFolderAssets((current) => current.filter((asset) => asset.id !== assetDeleteTarget.id));
      setPreviewAsset((current) => current?.id === assetDeleteTarget.id ? null : current);
      setAssetDeleteTarget(null);
      await refreshFolders();
      showToast('素材已删除', 'success');
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 删除素材失败', error);
      showToast('删除失败，请重试');
    } finally {
      setDeletingAsset(false);
    }
  };

  const handleEdit = (folder) => {
    setRenameTarget(folder);
    setRenameValue(folder.name);
  };

  const handleRename = async () => {
    const nextName = renameValue.trim();
    if (!renameTarget || !nextName) return;

    try {
      const updated = await apiUpdateLiveMaterialGroup(renameTarget.id, { name: nextName });
      const updateFolderName = (current) => current.map((folder) => (
        folder.id === renameTarget.id ? { ...folder, name: updated.name || nextName } : folder
      ));
      setFolders(updateFolderName);
      setVirtualFolders(updateFolderName);
      setActiveFolder((current) => current?.id === renameTarget.id
        ? { ...current, name: updated.name || nextName }
        : current);
      setRenameTarget(null);
      setRenameValue('');
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 保存真人素材库名称失败', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDeleteLiveMaterialGroup(deleteTarget.id);
      const removeFolder = (current) => current.filter((folder) => folder.id !== deleteTarget.id);
      setFolders(removeFolder);
      setVirtualFolders(removeFolder);
      setDeleteTarget(null);
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 删除真人素材库失败', error);
    }
  };

  const handleOpenLiveMaterialModal = () => {
    setLiveMaterialModalOpen(true);
    refreshFolders();
  };

  const handleCloseLiveMaterialModal = () => {
    setLiveMaterialModalOpen(false);
    refreshFolders();
  };

  const handleCreateVirtualGroup = async () => {
    try {
      const group = await apiCreateAigcMaterialGroup({ name: '未命名素材组' });
      const folder = await mapGroupToFolder(group);
      setVirtualFolders((current) => [folder, ...current]);
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 创建AIGC素材组失败', error);
      showToast('新建素材组失败，请重试');
    }
  };

  const handleBackToFolders = () => {
    setActiveFolder(null);
    setFolderAssets([]);
    refreshFolders();
  };

  useEffect(() => () => {
    clearTimeout(toastTimerRef.current);
    clearInterval(assetPollRef.current);
    uploadedAssetNamesRef.current.clear();
    uploadedAssetPostersRef.current.clear();
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="seedance素材库">
      <div className="flex h-[48px] shrink-0 items-start justify-between px-[24px]">
        <Tabs options={SUB_TABS} value={activeTab} onChange={handleTabChange} variant="plain-ghost" gap="24px" />
      </div>
      {activeFolder ? (
        <>
          <SeedanceFolderDetail
            folder={activeFolder}
            assets={folderAssets}
            loading={folderAssetsLoading}
            uploading={uploading}
            onBack={handleBackToFolders}
            onUpload={handleUploadAsset}
            onPreview={setPreviewAsset}
            onDelete={setAssetDeleteTarget}
          />
        </>
      ) : activeTab === 'real' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(216px,270px))] content-start justify-start gap-[16px] overflow-y-auto px-[24px] py-[6px]">
          <AddRealPersonCard onClick={handleOpenLiveMaterialModal} />
          {folders.map((folder) => (
            <SeedanceFolderCard
              key={folder.id}
              {...folder}
              onOpen={() => handleOpenFolder(folder)}
              onEdit={() => handleEdit(folder)}
              onDelete={() => handleDelete(folder)}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(216px,270px))] content-start justify-start gap-[16px] overflow-y-auto px-[24px] py-[6px]">
          <AddVirtualGroupCard onClick={handleCreateVirtualGroup} />
          {virtualFolders.map((folder) => (
            <SeedanceFolderCard
              key={folder.id}
              {...folder}
              onOpen={() => handleOpenFolder(folder)}
              onEdit={() => handleEdit(folder)}
              onDelete={() => handleDelete(folder)}
            />
          ))}
        </div>
      )}

      {renameTarget && (
        <AssetsProjectRenameModal
          value={renameValue}
          onChange={setRenameValue}
          onConfirm={handleRename}
          onClose={() => {
            setRenameTarget(null);
            setRenameValue('');
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`「${deleteTarget.name}」将被永久删除，无法恢复。`}
          confirmText="删除"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {assetDeleteTarget && (
        <ConfirmDialog
          title="确认删除"
          description={`「${assetDeleteTarget.name || '该素材'}」删除后无法恢复，确定要删除吗？`}
          confirmText={deletingAsset ? '删除中...' : '删除'}
          onConfirm={handleConfirmDeleteAsset}
          onCancel={() => { if (!deletingAsset) setAssetDeleteTarget(null); }}
          zIndex={2100}
        />
      )}

      <CreationLiveMaterialModal
        open={liveMaterialModalOpen}
        qrOnly
        onClose={handleCloseLiveMaterialModal}
        onCreated={handleCloseLiveMaterialModal}
      />
      <SeedanceResolutionDialog open={resolutionDialogOpen} onClose={() => setResolutionDialogOpen(false)} />
      <SeedanceAssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
      <CreationToast toasts={toast ? [toast] : []} />
    </section>
  );
}
