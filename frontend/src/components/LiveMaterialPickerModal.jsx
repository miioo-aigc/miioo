import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  LIVE_MATERIAL_AUTH_COMPLETED_EVENT,
  apiCreateLiveMaterialAsset,
  apiCreateLiveMaterialAuthSession,
  apiUploadLiveMaterialAsset,
  apiListLiveMaterialAssets,
  apiListLiveMaterialGroups,
} from '../api/liveMaterials';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov'];

function fileMatchesAssetType(file, assetType) {
  const normalizedType = String(assetType || 'image').trim().toLowerCase();
  const fileType = String(file?.type || '').toLowerCase();
  const fileName = String(file?.name || '').toLowerCase();
  const extensionList = normalizedType === 'video' ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
  if (normalizedType === 'video' && fileType.startsWith('video/')) return true;
  if (normalizedType === 'image' && fileType.startsWith('image/')) return true;
  return extensionList.some((suffix) => fileName.endsWith(suffix));
}

function acceptForAssetType(assetType) {
  return (String(assetType || 'image').trim().toLowerCase() === 'video'
    ? VIDEO_EXTENSIONS
    : IMAGE_EXTENSIONS
  ).join(',');
}

function StatusTag({ status }) {
  const normalized = String(status || '').trim().toLowerCase();
  const palette = normalized === 'active'
    ? { bg: 'rgba(45,195,225,0.16)', color: '#7FE7F8', text: 'Active' }
    : normalized === 'failed'
      ? { bg: 'rgba(255,102,102,0.16)', color: '#FF9A9A', text: 'Failed' }
      : { bg: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.72)', text: 'Processing' };
  return (
    <span
      style={{
        height: '24px',
        borderRadius: '999px',
        padding: '0 10px',
        display: 'inline-flex',
        alignItems: 'center',
        background: palette.bg,
        color: palette.color,
        fontSize: '12px',
        lineHeight: '16px',
        fontFamily: FONT_MEDIUM,
      }}
    >
      {palette.text}
    </span>
  );
}

function GhostButton({ label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={{
        height: '36px',
        borderRadius: '8px',
        padding: '0 14px',
        border: '1px solid rgba(255,255,255,0.14)',
        background: disabled ? 'rgba(255,255,255,0.06)' : '#1D1D1D',
        color: disabled ? 'rgba(255,255,255,0.35)' : '#FFFFFF',
        fontSize: '14px',
        fontFamily: FONT,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function PrimaryButton({ label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={{
        height: '36px',
        borderRadius: '8px',
        padding: '0 16px',
        border: '1px solid rgba(255,255,255,0.14)',
        background: disabled ? 'rgba(45,195,225,0.35)' : '#2DC3E1',
        color: '#090909',
        fontSize: '14px',
        fontFamily: FONT_MEDIUM,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export default function LiveMaterialPickerModal({
  open,
  onClose,
  onConfirm,
  source = 'creation',
  projectId = null,
  storyboardId = null,
  returnPath = '/',
  selectedGroupId = '',
  selectedAssetIds = [],
  refreshToken = 0,
  onShowToast,
}) {
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [authStarting, setAuthStarting] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [assets, setAssets] = useState([]);
  const [activeAssetIds, setActiveAssetIds] = useState([]);
  const [uploadType, setUploadType] = useState('image');
  const [uploadName, setUploadName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingUploadError, setPendingUploadError] = useState('');
  const fileInputRef = useRef(null);

  const currentGroup = useMemo(
    () => groups.find((item) => item.id === groupId) || null,
    [groups, groupId]
  );

  const selectedAssets = useMemo(
    () => assets.filter((item) => activeAssetIds.includes(item.id)),
    [assets, activeAssetIds]
  );

  const loadGroups = async (preferredGroupId = '') => {
    setGroupsLoading(true);
    try {
      const list = await apiListLiveMaterialGroups();
      setGroups(Array.isArray(list) ? list : []);
      const fallbackGroupId = preferredGroupId || selectedGroupId || list?.[0]?.id || '';
      if (fallbackGroupId) {
        setGroupId(fallbackGroupId);
      }
    } catch (error) {
      onShowToast?.(error?.message || '获取真人素材组失败', 'error');
    } finally {
      setGroupsLoading(false);
    }
  };

  const loadAssets = async (nextGroupId = groupId) => {
    if (!nextGroupId) {
      setAssets([]);
      return;
    }
    setAssetsLoading(true);
    try {
      const list = await apiListLiveMaterialAssets(nextGroupId);
      setAssets(Array.isArray(list) ? list : []);
    } catch (error) {
      onShowToast?.(error?.message || '获取真人素材失败', 'error');
    } finally {
      setAssetsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setGroupId(selectedGroupId || '');
    setActiveAssetIds(Array.isArray(selectedAssetIds) ? selectedAssetIds : []);
    setPendingFileName('');
    setPendingUploadError('');
    setDragActive(false);
    void loadGroups(selectedGroupId || '');
  }, [open, selectedGroupId, selectedAssetIds]);

  useEffect(() => {
    if (!open) return;
    void loadAssets(groupId);
  }, [open, groupId, refreshToken]);

  useEffect(() => {
    if (!open) return;
    const handleAuthCompleted = (event) => {
      const nextGroupId = event?.detail?.group?.id || '';
      void loadGroups(nextGroupId);
    };
    window.addEventListener(LIVE_MATERIAL_AUTH_COMPLETED_EVENT, handleAuthCompleted);
    return () => {
      window.removeEventListener(LIVE_MATERIAL_AUTH_COMPLETED_EVENT, handleAuthCompleted);
    };
  }, [open, selectedGroupId]);

  if (!open) return null;

  const toggleAsset = (asset) => {
    if (String(asset?.status || '').trim().toLowerCase() !== 'active') return;
    setActiveAssetIds((prev) => (
      prev.includes(asset.id)
        ? prev.filter((item) => item !== asset.id)
        : [...prev, asset.id]
    ));
  };

  const handleStartAuth = async () => {
    setAuthStarting(true);
    try {
      const result = await apiCreateLiveMaterialAuthSession({
        source,
        project_id: projectId,
        storyboard_id: storyboardId,
        return_path: returnPath,
      });
      const h5Link = result?.h5_link || result?.h5Link;
      if (!h5Link) throw new Error('后端未返回认证链接');
      window.location.href = h5Link;
    } catch (error) {
      onShowToast?.(error?.message || '发起真人认证失败', 'error');
      setAuthStarting(false);
    }
  };

  const handleUploadFile = async (file) => {
    if (!groupId) {
      setPendingUploadError('请先选择或认证一个真人素材组');
      onShowToast?.('请先选择或认证一个真人素材组', 'error');
      return;
    }
    if (!(file instanceof File)) {
      setPendingUploadError('请选择要上传的图片或视频文件');
      onShowToast?.('请选择要上传的图片或视频文件', 'error');
      return;
    }
    if (!fileMatchesAssetType(file, uploadType)) {
      const message = uploadType === 'video'
        ? '当前仅支持上传 mp4 / mov 视频文件'
        : '当前仅支持上传 jpg / jpeg / png / gif / webp 图片文件';
      setPendingUploadError(message);
      onShowToast?.(message, 'error');
      return;
    }
    setPendingUploadError('');
    setPendingFileName(file.name || '');
    setUploading(true);
    try {
      const asset = await apiUploadLiveMaterialAsset(groupId, {
        file,
        asset_type: uploadType,
        name: uploadName.trim(),
      });
      setUploadName('');
      setPendingFileName('');
      await loadAssets(groupId);
      onShowToast?.(
        `已提交真人素材，当前状态：${asset?.status || 'Processing'}，可稍后点击“刷新状态”查看结果`,
        'success'
      );
    } catch (error) {
      setPendingUploadError(error?.message || '上传真人素材失败');
      onShowToast?.(error?.message || '创建真人素材失败', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleChooseFile = () => {
    if (uploading) return;
    fileInputRef.current?.click?.();
  };

  const handleInputChange = async (event) => {
    const nextFile = event?.target?.files?.[0];
    if (!nextFile) return;
    await handleUploadFile(nextFile);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (uploading) return;
    const nextFile = event.dataTransfer?.files?.[0];
    if (!nextFile) return;
    await handleUploadFile(nextFile);
  };

  const handleConfirm = () => {
    if (!currentGroup || selectedAssets.length === 0) {
      onShowToast?.('请先选择至少一个 Active 真人素材', 'error');
      return;
    }
    onConfirm?.({
      group: currentGroup,
      assets: selectedAssets,
    });
    onClose?.();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0,0,0,0.56)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: '960px',
          maxHeight: '80vh',
          borderRadius: '16px',
          background: '#161616',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 72px rgba(0,0,0,0.48)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
              选择真人素材
            </span>
            <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)' }}>
              先完成真人认证，再上传素材公网地址；仅 `Active` 状态素材可用于生成。
            </span>
          </div>
          <GhostButton label="关闭" onClick={onClose} />
        </div>

        <div style={{ padding: '0 24px 18px', display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: '16px', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <PrimaryButton label={authStarting ? '跳转中…' : '去认证新真人'} onClick={handleStartAuth} disabled={authStarting} />
              <GhostButton label="刷新真人组" onClick={() => loadGroups(groupId)} disabled={groupsLoading} />
            </div>

            <div style={{ borderRadius: '12px', background: '#1D1D1D', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0, overflow: 'auto' }}>
              <div style={{ fontFamily: FONT_MEDIUM, fontSize: '13px', color: '#FFFFFF' }}>真人组</div>
              {groupsLoading && <div style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(255,255,255,0.60)' }}>加载中…</div>}
              {!groupsLoading && groups.length === 0 && (
                <div style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '20px', color: 'rgba(255,255,255,0.48)' }}>
                  暂无真人组，先完成一次真人认证再回来选择。
                </div>
              )}
              {groups.map((item) => {
                const active = item.id === groupId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGroupId(item.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: '10px',
                      border: `1px solid ${active ? 'rgba(45,195,225,0.65)' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? 'rgba(45,195,225,0.10)' : '#181818',
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>
                      {item.name || `真人组 ${item.upstream_group_id || item.id.slice(0, 8)}`}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.56)' }}>
                      素材数 {item.asset_count ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            <div style={{ borderRadius: '12px', background: '#1D1D1D', border: '1px solid rgba(255,255,255,0.06)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontFamily: FONT_MEDIUM, fontSize: '13px', color: '#FFFFFF' }}>上传真人素材</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleChooseFile}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!uploading) setDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!uploading) setDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const relatedTarget = event.relatedTarget;
                    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
                    setDragActive(false);
                  }}
                  onDrop={handleDrop}
                  style={{
                    height: '72px',
                    borderRadius: '10px',
                    border: `1px dashed ${dragActive ? 'rgba(45,195,225,0.72)' : 'rgba(255,255,255,0.14)'}`,
                    background: dragActive ? 'rgba(45,195,225,0.10)' : '#141414',
                    color: '#FFFFFF',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontFamily: FONT_MEDIUM, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF' }}>
                    {uploading
                      ? `上传中…${pendingFileName ? ` ${pendingFileName}` : ''}`
                      : dragActive
                        ? '松开即可立即上传'
                        : '拖拽文件到这里，或点击选择文件'}
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '17px', color: 'rgba(255,255,255,0.56)' }}>
                    {uploadType === 'video'
                      ? '支持 mp4 / mov，选择后会自动上传到对象存储并创建真人素材'
                      : '支持 jpg / jpeg / png / gif / webp，选择后会自动上传到对象存储并创建真人素材'}
                  </span>
                </button>
                <select
                  value={uploadType}
                  onChange={(event) => {
                    setUploadType(event.target.value);
                    setPendingUploadError('');
                    setPendingFileName('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  style={{
                    height: '72px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: '#141414',
                    color: '#FFFFFF',
                    padding: '0 12px',
                    fontFamily: FONT,
                    fontSize: '13px',
                  }}
                >
                  <option value="image">图片</option>
                  <option value="video">视频</option>
                </select>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptForAssetType(uploadType)}
                  onChange={handleInputChange}
                  style={{ display: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  value={uploadName}
                  onChange={(event) => setUploadName(event.target.value)}
                  placeholder="素材名称（选填）"
                  style={{
                    flex: '1 1 220px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: '#141414',
                    color: '#FFFFFF',
                    padding: '0 12px',
                    fontFamily: FONT,
                    fontSize: '13px',
                  }}
                />
                <GhostButton label="刷新状态" onClick={() => loadAssets(groupId)} disabled={assetsLoading || !groupId} />
                <PrimaryButton label={uploading ? '上传中…' : '选择文件上传'} onClick={handleChooseFile} disabled={uploading} />
              </div>
              {(pendingFileName || pendingUploadError) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {pendingFileName && !uploading && (
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.56)' }}>
                      最近选择：{pendingFileName}
                    </span>
                  )}
                  {pendingUploadError && (
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '18px', color: '#FF9A9A' }}>
                      {pendingUploadError}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, borderRadius: '12px', background: '#1D1D1D', border: '1px solid rgba(255,255,255,0.06)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontFamily: FONT_MEDIUM, fontSize: '13px', color: '#FFFFFF' }}>
                  真人素材列表
                </span>
                {currentGroup && (
                  <span style={{ fontFamily: FONT, fontSize: '12px', color: 'rgba(255,255,255,0.56)' }}>
                    当前真人组：{currentGroup.name || currentGroup.upstream_group_id || currentGroup.id.slice(0, 8)}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px' }}>
                {assetsLoading && <div style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(255,255,255,0.60)' }}>加载中…</div>}
                {!assetsLoading && assets.length === 0 && (
                  <div style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '20px', color: 'rgba(255,255,255,0.48)' }}>
                    当前真人组还没有素材，先拖入或选择一条图片 / 视频素材。
                  </div>
                )}
                {assets.map((asset) => {
                  const active = activeAssetIds.includes(asset.id);
                  const selectable = String(asset.status || '').trim().toLowerCase() === 'active';
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => toggleAsset(asset)}
                      style={{
                        textAlign: 'left',
                        borderRadius: '12px',
                        border: `1px solid ${active ? 'rgba(45,195,225,0.65)' : 'rgba(255,255,255,0.08)'}`,
                        background: active ? 'rgba(45,195,225,0.10)' : '#181818',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        cursor: selectable ? 'pointer' : 'not-allowed',
                        opacity: selectable ? 1 : 0.72,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>
                          {asset.name || asset.upstream_asset_id || asset.id.slice(0, 8)}
                        </span>
                        <StatusTag status={asset.status} />
                      </div>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.56)' }}>
                        类型：{asset.asset_type || '-'}
                      </span>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.44)', wordBreak: 'break-all' }}>
                        {asset.preview_url || asset.source_url || asset.asset_ref_url || '-'}
                      </span>
                      {asset.error_message && (
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '18px', color: '#FF9A9A' }}>
                          {asset.error_message}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '20px', color: 'rgba(255,255,255,0.60)' }}>
                已选 {selectedAssets.length} 项{currentGroup ? `，真人组：${currentGroup.name || currentGroup.upstream_group_id || currentGroup.id.slice(0, 8)}` : ''}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <GhostButton label="取消" onClick={onClose} />
                <PrimaryButton label="确认使用" onClick={handleConfirm} disabled={!currentGroup || selectedAssets.length === 0} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
