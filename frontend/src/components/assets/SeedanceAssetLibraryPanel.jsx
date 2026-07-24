/**
 * @file SeedanceAssetLibraryPanel.jsx
 * @structure-index
 *
 * ─── 页面区块 ───────────────────────────────────────
 *   SeedanceAssetLibraryPanel：Seedance2.0素材库子 Tab 和文件夹网格
 *   真人素材组：从真人素材接口读取，空数据时仅展示录入入口
 *   SeedanceFolderDetail：打开文件夹后的真实图片列表与上传入口
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
 */

import { useCallback, useEffect, useState } from 'react';
import Tabs from '../ui/Tabs';
import ConfirmDialog from '../ConfirmDialog';
import CreationLiveMaterialModal from '../creation/CreationLiveMaterialModal';
import { AssetsProjectRenameModal } from './AssetsProjectModals';
import {
  apiDeleteLiveMaterialGroup,
  apiListLiveMaterialAssets,
  apiListLiveMaterialGroups,
  apiUploadLiveMaterialAsset,
  apiUpdateLiveMaterialGroup,
} from '../../api/liveMaterials';
import SeedanceFolderCard from './SeedanceFolderCard';
import SeedanceFolderDetail from './SeedanceFolderDetail';

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
  const [liveMaterialModalOpen, setLiveMaterialModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderAssets, setFolderAssets] = useState([]);
  const [folderAssetsLoading, setFolderAssetsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const handleTabChange = (value) => {
    setActiveTab(value);
    setActiveFolder(null);
    setFolderAssets([]);
    setDetailError('');
  };

  const refreshFolders = useCallback(async () => {
    try {
      const groups = await apiListLiveMaterialGroups();
      const nextFolders = await Promise.all(groups.map(async (group) => {
        let assets = [];
        try {
          assets = await apiListLiveMaterialAssets(group.id);
        } catch (error) {
          console.warn('[SeedanceAssetLibraryPanel] 获取真人素材预览失败', error);
        }
        return {
          id: group.id,
          name: group.name || '未命名',
          count: assets.length,
          images: assets.slice(0, 2).map((asset) => asset.preview_url || asset.asset_ref_url).filter(Boolean),
        };
      }));
      setFolders(nextFolders);
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 刷新真人素材库失败', error);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = setTimeout(() => refreshFolders(), 0);
    return () => clearTimeout(refreshTimer);
  }, [refreshFolders]);

  const handleDelete = (folder) => setDeleteTarget(folder);

  const handleOpenFolder = async (folder) => {
    setActiveFolder(folder);
    setFolderAssets([]);
    setDetailError('');
    setFolderAssetsLoading(true);
    try {
      const assets = await apiListLiveMaterialAssets(folder.id, { refresh: true });
      setFolderAssets(assets);
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 获取文件夹素材失败', error);
      setDetailError('素材加载失败，请返回后重试');
    } finally {
      setFolderAssetsLoading(false);
    }
  };

  const handleUploadAsset = async (file) => {
    if (!activeFolder) return;
    if (!file.type.startsWith('image/')) {
      setDetailError('仅支持上传图片格式');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setDetailError('图片大小不能超过 30MB');
      return;
    }
    setUploading(true);
    setDetailError('');
    try {
      const asset = await apiUploadLiveMaterialAsset(activeFolder.id, file, 'image');
      setFolderAssets((current) => [asset, ...current]);
      await refreshFolders();
    } catch (error) {
      console.warn('[SeedanceAssetLibraryPanel] 上传真人素材失败', error);
      setDetailError('上传失败，请重试');
    } finally {
      setUploading(false);
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
      setFolders((current) => current.map((folder) => (
        folder.id === renameTarget.id ? { ...folder, name: updated.name || nextName } : folder
      )));
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
      setFolders((current) => current.filter((folder) => folder.id !== deleteTarget.id));
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

  const handleBackToFolders = () => {
    setActiveFolder(null);
    setFolderAssets([]);
    setDetailError('');
    refreshFolders();
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Seedance2.0素材库">
      <div className="flex h-[48px] shrink-0 items-start justify-between px-[24px]">
        <Tabs options={SUB_TABS} value={activeTab} onChange={handleTabChange} variant="plain-ghost" gap="24px" />
      </div>
      {activeTab === 'real' && activeFolder ? (
        <>
          <SeedanceFolderDetail
            folder={activeFolder}
            assets={folderAssets}
            loading={folderAssetsLoading}
            uploading={uploading}
            onBack={handleBackToFolders}
            onUpload={handleUploadAsset}
          />
          {detailError ? <div className="shrink-0 px-[24px] pb-[8px] text-[13px] leading-[18px] text-text-danger">{detailError}</div> : null}
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
        <div className="flex flex-1 items-center justify-center text-[14px] leading-[18px] text-text-hint">暂无虚拟人像素材</div>
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

      <CreationLiveMaterialModal
        open={liveMaterialModalOpen}
        qrOnly
        onClose={handleCloseLiveMaterialModal}
        onCreated={handleCloseLiveMaterialModal}
      />
    </section>
  );
}
