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
 *   2026-07-29  真人素材上传后立即刷新审核状态，并持续轮询审核终态
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
import { createVideoFirstFrame, validateSeedanceUpload } from './SeedanceUploadValidation';
import SeedanceResolutionDialog from './SeedanceResolutionDialog';
import SeedanceAssetPreviewModal from './SeedanceAssetPreviewModal';

const SUB_TABS = [
  { value: 'real', label: '真人人像' },
  { value: 'virtual', label: '虚拟人像' },
];
const VIDEO_POSTER_STORAGE_KEY = 'seedance-video-posters';

function getStoredVideoPoster(assetId) {
  if (!assetId) return null;
  try {
    const posters = JSON.parse(localStorage.getItem(VIDEO_POSTER_STORAGE_KEY) || '{}');
    return posters[assetId] || null;
  } catch {
    return null;
  }
}

function storeVideoPoster(assetId, posterUrl) {
  if (!assetId || !posterUrl) return;
  try {
    const posters = JSON.parse(localStorage.getItem(VIDEO_POSTER_STORAGE_KEY) || '{}');
    localStorage.setItem(VIDEO_POSTER_STORAGE_KEY, JSON.stringify({ ...posters, [assetId]: posterUrl }));
  } catch {
    // 本地存储空间不足时仍使用当前会话中的首帧和视频原生首帧。
  }
}

function getLiveAssetType(asset) {
  const type = String(asset?.asset_type || asset?.assetType || asset?.type || 'image').toLowerCase();
  return type.startsWith('video/') ? 'video' : type;
}

function getLiveAssetUrl(asset) {
  const assetType = getLiveAssetType(asset);
  const mediaUrl = asset?.source_url
    || asset?.sourceUrl
    || asset?.file_url
    || asset?.fileUrl
    || asset?.preview_url
    || asset?.previewUrl;
  if (mediaUrl) return mediaUrl;
  return assetType === 'video' || assetType === 'audio'
    ? null
    : asset?.asset_ref_url || asset?.assetRefUrl || null;
}

function getLiveAssetPoster(asset) {
  return asset?.poster_url
    || asset?.posterUrl
    || asset?.thumbnail_url
    || asset?.thumbnailUrl
    || asset?.cover_url
    || asset?.coverUrl
    || asset?.first_frame_url
    || asset?.firstFrameUrl
    || null;
}

function getLiveAssetStatus(asset) {
  return String(asset?.status || '').trim().toLowerCase();
}

function isLiveAssetApproved(asset) {
  return ['active', 'approved', 'success', 'succeeded', 'completed', 'complete', 'ready', 'done'].includes(getLiveAssetStatus(asset));
}

function isLiveAssetRejected(asset) {
  return ['failed', 'rejected', 'reject', 'invalid', 'error'].includes(getLiveAssetStatus(asset));
}

function isLiveAssetPending(asset) {
  return !isLiveAssetApproved(asset) && !isLiveAssetRejected(asset);
}

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
  const assetPollTargetRef = useRef(null);
  const assetPollRequestRef = useRef(false);
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
      assets = await apiListLiveMaterialAssets(group.id, { refresh: true });
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 获取素材组预览失败', error);
    }
    return {
      id: group.id,
      name: group.name || '未命名素材组',
      count: group.asset_count ?? assets.length,
      images: assets.filter(isLiveAssetApproved).slice(0, 2).map((asset) => {
        const assetType = getLiveAssetType(asset);
        const posterUrl = uploadedAssetPostersRef.current.get(asset.id) || getStoredVideoPoster(asset.id) || getLiveAssetPoster(asset);
        const mediaUrl = getLiveAssetUrl(asset);
        if (!mediaUrl && !posterUrl) return null;
        return assetType === 'video'
          ? { url: mediaUrl, type: 'video', posterUrl }
          : { url: posterUrl || mediaUrl, type: assetType, posterUrl };
      }).filter((preview) => preview?.url),
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
        posterUrl: uploadedAssetPostersRef.current.get(asset.id) || getStoredVideoPoster(asset.id) || getLiveAssetPoster(asset),
      })));
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 获取文件夹素材失败', error);
      showToast('素材加载失败，请返回后重试');
    } finally {
      setFolderAssetsLoading(false);
    }
  };

  const applyServerAssets = useCallback((assets, previousAssets = []) => {
    const previousById = new Map(previousAssets.map((asset) => [asset.id, asset]));
    const serverIds = new Set(assets.map((asset) => asset.id));
    const localPendingAssets = previousAssets.filter((asset) => asset.id && !serverIds.has(asset.id) && isLiveAssetPending(asset));
    return [...localPendingAssets, ...assets].map((asset) => {
      const previous = previousById.get(asset.id);
      if (previous) {
        const previousHasMedia = Boolean(
          previous.preview_url
          || previous.previewUrl
          || previous.source_url
          || previous.sourceUrl
          || previous.file_url
          || previous.fileUrl
          || previous.posterUrl
          || previous.poster_url
        );
        const serverHasMedia = Boolean(
          asset.preview_url
          || asset.previewUrl
          || asset.source_url
          || asset.sourceUrl
          || asset.file_url
          || asset.fileUrl
          || getLiveAssetPoster(asset)
        );
        // 轮询只改变审核字段，避免用服务端新对象替换已有媒体节点导致图片/视频闪刷。
        // 仅当旧对象还没有任何媒体地址、服务端首次补齐地址时合并一次媒体字段。
        if (previousHasMedia || !serverHasMedia) {
          return {
            ...previous,
            status: asset.status || previous.status,
            error_message: asset.error_message || previous.error_message,
            updated_at: asset.updated_at || previous.updated_at,
          };
        }
      }
      const nextAsset = {
        ...asset,
        name: uploadedAssetNamesRef.current.get(asset.id) || asset.name || previous?.name,
        posterUrl: uploadedAssetPostersRef.current.get(asset.id) || getStoredVideoPoster(asset.id) || getLiveAssetPoster(asset) || previous?.posterUrl,
      };
      return nextAsset;
    });
  }, []);

  const stopAssetStatusPolling = useCallback(() => {
    clearInterval(assetPollRef.current);
    assetPollRef.current = null;
    assetPollTargetRef.current = null;
    assetPollRequestRef.current = false;
  }, []);

  const startAssetStatusPolling = useCallback((groupId, targetAssetId = null) => {
    if (assetPollRef.current && assetPollTargetRef.current?.groupId === groupId) return;
    stopAssetStatusPolling();
    assetPollTargetRef.current = { groupId, assetId: targetAssetId };

    const refreshStatus = async () => {
      if (assetPollRequestRef.current) return;
      assetPollRequestRef.current = true;
      try {
        const assets = await apiListLiveMaterialAssets(groupId, { refresh: true });
        const targetAsset = targetAssetId ? assets.find((asset) => asset.id === targetAssetId) : null;
        setFolderAssets((current) => {
          return applyServerAssets(assets, current);
        });
        // 目标素材尚未出现在刷新结果中时不能停止，否则会跳过上游审核同步。
        if (targetAsset && (isLiveAssetApproved(targetAsset) || isLiveAssetRejected(targetAsset))) {
          stopAssetStatusPolling();
          await refreshFolders();
        }
      } catch (error) {
        console.warn('[SeedanceAssetLibraryPanel] 刷新真人素材审核状态失败', error);
      } finally {
        assetPollRequestRef.current = false;
      }
    };

    assetPollRef.current = setInterval(refreshStatus, 4000);
    refreshStatus();
  }, [applyServerAssets, refreshFolders, stopAssetStatusPolling]);

  const handleUploadAsset = async (file) => {
    if (!activeFolder) return;
    const placeholderId = `uploading-${Date.now()}`;
    const placeholderType = String(file.type || '').toLowerCase().startsWith('video/') ? 'video' : 'image';
    const uploadingPlaceholder = {
      id: placeholderId,
      name: file.name,
      asset_type: placeholderType,
      uploadState: 'uploading',
      status: 'uploading',
    };
    setFolderAssets((current) => [uploadingPlaceholder, ...current]);
    const validation = await validateSeedanceUpload(file);
    if (validation.error || !validation.type) {
      setFolderAssets((current) => current.filter((asset) => asset.id !== placeholderId));
      if (validation.errorCode === 'resolution') {
        setResolutionDialogOpen(true);
        return;
      }
      showToast(validation.error || '当前素材类型暂不支持上传', 'error', 5000);
      return;
    }
    setUploading(true);
    try {
      const asset = await apiUploadLiveMaterialAsset(activeFolder.id, file, validation.type, file.name);
      if (asset?.id) {
        uploadedAssetNamesRef.current.set(asset.id, file.name);
      }
      const pendingAsset = {
        ...asset,
        name: file.name,
        // 上传接口的初始状态不能代表审核结果，先强制进入审核中。
        status: 'pending',
        localFile: validation.type === 'video' ? file : null,
        posterUrl: getLiveAssetPoster(asset),
      };
      setFolderAssets((current) => [pendingAsset, ...current.filter((item) => item.id !== placeholderId && item.id !== pendingAsset.id)]);
      // 与创作模块保持一致：上传成功后无条件启动素材组审核轮询。
      // 审核同步由 assets?refresh=true 触发，不能依赖上传接口返回的初始 status。
      startAssetStatusPolling(activeFolder.id, asset.id);

      // 首帧生成不阻塞上传请求，避免浏览器无法解码视频时导致接口永远不被调用。
      if (validation.type === 'video' && asset?.id) {
        createVideoFirstFrame(file)
          .then((firstFrameUrl) => {
            uploadedAssetPostersRef.current.set(asset.id, firstFrameUrl);
            storeVideoPoster(asset.id, firstFrameUrl);
            setFolderAssets((current) => current.map((item) => (
              item.id === asset.id ? { ...item, posterUrl: firstFrameUrl } : item
            )));
          })
          .catch((error) => {
            console.warn('[SeedanceAssetLibraryPanel] 生成视频首帧失败，将使用视频预览', error);
          });
      }
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 上传真人素材失败', error);
      setFolderAssets((current) => current.filter((item) => item.id !== placeholderId));
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
    stopAssetStatusPolling();
    uploadedAssetNamesRef.current.clear();
    uploadedAssetPostersRef.current.clear();
  }, [stopAssetStatusPolling]);

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
