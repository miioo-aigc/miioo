import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { invalidate } from '../../utils/cache';
import { K } from '../../utils/cacheKeys';
import { FONT, FONT_MEDIUM } from '../../utils/fonts';
import { apiGetProjects, apiDeleteProject, apiUpdateProject, apiDownloadProjectAssets } from '../../api/project';
import { apiGetProjectAssetsPage, calcProjectAssetsLimit, apiBatchDeleteAssets, apiUpdateAsset, apiDeleteAsset, apiDownloadAsset } from '../../api/assets';
import { apiDeleteSubject, apiGetSubjects } from '../../api/subject';
import GhostButton from './GhostButton';
import DotsLoading from '../../components/DotsLoading';
import ConfirmDialog from '../../components/ConfirmDialog';
import ProjectListItem from './ProjectListItem';
import WaveformBars from '../../components/WaveformBars';
import AudioCard from './AudioCard';
import FavFilterCheckbox from './FavFilterCheckbox';
import MoreMenu from './MoreMenu';
import StarIcon from '../../components/StarIcon';
import TrashIcon from './TrashIcon';
import DownloadIcon from './DownloadIcon';
import VideoFrameThumbnail from './VideoFrameThumbnail';

import AssetDetailModal from './AssetDetailModal';
import ShotDetailModal from './ShotDetailModal';
import SubjectAssetDetailModal from './SubjectAssetDetailModal';
import ShotVideoDetailModal from './ShotVideoDetailModal';
import { EmptyProjectAssets } from './EmptyAssetState';
import '../../App.css';
import AssetCard from './AssetCard';
import PlainBtn from './PlainBtn';
import ProjectAssetCard from './ProjectAssetCard';

const PROJECT_CATEGORY_TABS = [
  { key: 'chars', label: '角色' },
  { key: 'scenes', label: '场景' },
  { key: 'props', label: '道具' },
  { key: 'storyboard_img', label: '分镜图' },
  { key: 'storyboard_video', label: '分镜视频' },
  { key: 'audio', label: '音频' },
  { key: 'final', label: '成片' },
];

const SUBJECT_CARD_CATEGORIES = new Set(['chars', 'scenes', 'props', 'storyboard_img', 'storyboard_video']);

const TOAST_PORTAL_ID = 'assets-toast-portal';

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '24px',
      paddingTop: '16px',
      paddingLeft: '24px',
      paddingRight: '24px',
      height: '48px',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: isActive ? FONT_MEDIUM : FONT,
              fontSize: '14px',
              lineHeight: '18px',
              color: isActive ? '#FFFFFF' : '#FFFFFF99',
              transition: 'color 0.12s',
            }}
            onClick={() => onChange(tab.key)}
          >
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModuleTabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      paddingLeft: '24px',
      paddingRight: '24px',
      gap: '24px',
      borderBottom: '1px solid #FFFFFF14',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: '2px solid transparent',
              paddingTop: '12px',
              paddingBottom: '6px',
              cursor: 'pointer',
              fontFamily: isActive ? FONT_MEDIUM : FONT,
              fontSize: '16px',
              color: isActive ? '#2DC3E1' : '#FFFFFF99',
              transition: 'color 0.12s',
            }}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

const MOCK_PROJECTS = [
  { id: 'p1', name: '星际迷途', count: 24 },
  { id: 'p2', name: '暗夜追踪', count: 18 },
  { id: 'p3', name: '光影之间', count: 31 },
  { id: 'p4', name: '未来边界', count: 9 },
];

function notifyProjectAssetsDeleted(projectId) {
  if (!projectId) return;
  window.dispatchEvent(new CustomEvent('project-assets:deleted', { detail: { projectId } }));
}

export default function ProjectAssetsPanel() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeCategory, setActiveCategory] = useState('chars');
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [favOnly, setFavOnly] = useState(false);
  const [assetsMap, setAssetsMap] = useState({});
  // 每个 [projectId+category] 的分页状态：{ cursor, hasMore, loading, rawList }
  const [pageMeta, setPageMeta] = useState({});
  const sentinelRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const pageKey = (projectId, category) => `${projectId}__${category}`;

  // 首屏加载：切换项目或 tab 时触发
  async function loadFirstPage(projectId, category) {
    const key = pageKey(projectId, category);
    // 清掉旧非分页接口写入的 localStorage 缓存，防止过期分组数据覆盖新结果
    invalidate(K.projectAssets(projectId), 'local');
    setPageMeta(prev => ({ ...prev, [key]: { cursor: null, hasMore: false, loading: true, rawList: [] } }));
    try {
      const limit = calcProjectAssetsLimit(category);
      const result = await apiGetProjectAssetsPage(projectId, { category, limit });
      setAssetsMap(prev => ({ ...prev, [category]: result.grouped[category] ?? [] }));
      setPageMeta(prev => ({
        ...prev,
        [key]: { cursor: result.nextCursor, hasMore: result.hasMore, loading: false, rawList: result.rawList },
      }));
    } catch (err) {
      console.error('[ProjectAssetsPanel] 加载失败:', err);
      setPageMeta(prev => ({ ...prev, [key]: { cursor: null, hasMore: false, loading: false, rawList: [] } }));
    }
  }

  // 加载更多
  async function loadMorePage(projectId, category) {
    const key = pageKey(projectId, category);
    const meta = pageMeta[key];
    if (!meta || meta.loading || !meta.hasMore) return;
    setPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      const limit = calcProjectAssetsLimit(category);
      const result = await apiGetProjectAssetsPage(projectId, { category, limit, cursor: meta.cursor });
      const accumulated = [...(meta.rawList || []), ...result.rawList];
      const regrouped = groupByCategory(accumulated);
      setAssetsMap(prev => ({ ...prev, [category]: regrouped[category] ?? [] }));
      setPageMeta(prev => ({
        ...prev,
        [key]: { cursor: result.nextCursor, hasMore: result.hasMore, loading: false, rawList: accumulated },
      }));
    } catch (err) {
      console.error('[ProjectAssetsPanel] 加载更多失败:', err);
      setPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false } }));
    }
  }

  useEffect(() => {
    apiGetProjects().then((list) => {
      const sorted = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setProjects(sorted);
      setActiveProject((prev) => prev ?? sorted[0]?.id ?? null);
    });
  }, []);

  // 项目或 tab 切换时加载首屏
  useEffect(() => {
    if (activeProject == null) return;
    loadFirstPage(activeProject, activeCategory);
  }, [activeProject, activeCategory]);

  // IntersectionObserver 触底加载更多
  useEffect(() => {
    if (!sentinelRef.current || !scrollContainerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && activeProject) {
          loadMorePage(activeProject, activeCategory);
        }
      },
      { root: scrollContainerRef.current, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [activeProject, activeCategory, pageMeta]);

  const categoryAssets = assetsMap[activeCategory] || [];
  const filtered = favOnly ? categoryAssets.filter((a) => a.starred) : categoryAssets;

  function toggleStar(id) {
    const current = assetsMap[activeCategory]?.find((a) => a.id === id);
    const newStarred = !current?.starred;
    apiUpdateAsset(id, { is_starred: newStarred }).catch(console.error);
    setAssetsMap((prev) => ({
      ...prev,
      [activeCategory]: prev[activeCategory].map((a) => a.id === id ? { ...a, starred: newStarred } : a),
    }));
  }

  async function deleteAsset(id, singleImageId = null) {
    // singleImageId 存在时表示删除单张图，否则删除整个主体
    const SUBJECT_TYPE_MAP = { chars: 'character', scenes: 'scene', props: 'prop' };
    const isSubjectCategory = !!SUBJECT_TYPE_MAP[activeCategory];
    try {
      if (singleImageId) {
        await apiDeleteAsset(singleImageId, { projectId: activeProject });
        const targetAsset = assetsMap[activeCategory]?.find((a) => a.id === id);
        const remainingImages = (targetAsset?.images || []).filter((img) => img.id !== singleImageId);
        if (isSubjectCategory && remainingImages.length === 0 && targetAsset?.subject_id) {
          // 最后一张图删掉 → 删除主体实体本身
          await apiDeleteSubject(activeProject, targetAsset.subject_id).catch(() => {});
        }
        setAssetsMap((prev) => ({
          ...prev,
          [activeCategory]: prev[activeCategory].map((asset) => {
            if (asset.id === id && asset.images) {
              const filtered = asset.images.filter((img) => img.id !== singleImageId);
              if (filtered.length === 0) {
                return null;
              }
              return {
                ...asset,
                images: filtered,
                imageCount: filtered.length,
                url: filtered[0]?.url || asset.url,
              };
            }
            return asset;
          }).filter(Boolean),
        }));
        showToast('删除成功', 'success');
        // 触发主体页面更新：删除图后重新拉取该类型主体，notify 会推给 SubjectPage 的 subscribe
        const subjectType = SUBJECT_TYPE_MAP[activeCategory];
        if (subjectType && activeProject) {
          apiGetSubjects(activeProject, { type: subjectType }).catch(() => {});
        }
      } else {
        const asset = assetsMap[activeCategory]?.find((a) => a.id === id);
        if (asset && asset.images) {
          await apiBatchDeleteAssets(asset.images.map((img) => img.id), { projectId: activeProject });
        } else {
          await apiDeleteAsset(id, { projectId: activeProject });
        }
        // 删除全部图片后，同步删除主体实体
        if (isSubjectCategory && asset?.subject_id) {
          await apiDeleteSubject(activeProject, asset.subject_id).catch(() => {});
        }
        setAssetsMap((prev) => ({
          ...prev,
          [activeCategory]: prev[activeCategory].filter((a) => a.id !== id),
        }));
        showToast('删除成功', 'success');
        // 整个主体删除也同步更新
        const subjectType = SUBJECT_TYPE_MAP[activeCategory];
        if (subjectType && activeProject) {
          apiGetSubjects(activeProject, { type: subjectType }).catch(() => {});
        }
      }
      notifyProjectAssetsDeleted(activeProject);
    } catch (err) {
      console.error('删除资产失败', err);
      showToast('删除失败', 'error');
    }
  }

  async function deleteSelected() {
    const ids = [...selected];
    const SUBJECT_TYPE_MAP = { chars: 'character', scenes: 'scene', props: 'prop' };
    const isSubjectCategory = !!SUBJECT_TYPE_MAP[activeCategory];
    try {
      // 对于主体卡片（chars/scenes/props），需要删除该主体下的所有图片
      if (SUBJECT_CARD_CATEGORIES.has(activeCategory)) {
        const allImageIds = [];
        const subjectIds = [];
        ids.forEach((cardId) => {
          const card = assetsMap[activeCategory]?.find((a) => a.id === cardId);
          if (card && card.images) {
            allImageIds.push(...card.images.map((img) => img.id));
          } else {
            allImageIds.push(cardId);
          }
          if (isSubjectCategory && card?.subject_id) subjectIds.push(card.subject_id);
        });
        await apiBatchDeleteAssets(allImageIds, { projectId: activeProject });
        // 同步删除主体实体
        for (const subjectId of subjectIds) {
          await apiDeleteSubject(activeProject, subjectId).catch(() => {});
        }
        const subjectType = SUBJECT_TYPE_MAP[activeCategory];
        if (subjectType && activeProject) {
          apiGetSubjects(activeProject, { type: subjectType }).catch(() => {});
        }
      } else {
        await apiBatchDeleteAssets(ids, { projectId: activeProject });
      }

      setAssetsMap((prev) => ({
        ...prev,
        [activeCategory]: prev[activeCategory].filter((a) => !selected.has(a.id)),
      }));
      setSelected(new Set());
      notifyProjectAssetsDeleted(activeProject);
    } catch (err) {
      console.error('批量删除资产失败', err);
      showToast('删除失败', 'error');
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const allIds = filtered.map((a) => a.id);
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
    setSelected(isAllSelected ? new Set() : new Set(allIds));
  }

  function exitBatch() {
    setBatchMode(false);
    setSelected(new Set());
  }

  function handleRenameProject(project) {
    setRenameTarget(project);
    setRenameValue(project.name);
  }

  function confirmRename() {
    if (!renameTarget || !renameValue.trim()) return;
    apiUpdateProject(renameTarget.id, { name: renameValue.trim() }).then(() => {
      setProjects((prev) => prev.map((p) => p.id === renameTarget.id ? { ...p, name: renameValue.trim() } : p));
      setRenameTarget(null);
    }).catch(console.error);
  }

  function handleDeleteProject(project) {
    setDeleteTarget(project);
  }

  function confirmDeleteProject() {
    if (!deleteTarget) return;
    apiDeleteProject(deleteTarget.id).then(() => {
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (activeProject === deleteTarget.id) {
        setActiveProject(null);
        setAssetsMap({});
      }
      setDeleteTarget(null);
    }).catch(console.error);
  }

  function handleDownloadProject(project) {
    apiDownloadProjectAssets(project.id).catch(console.error);
  }

  async function downloadAsset(assetId, assetName) {
    try {
      const blob = await apiDownloadAsset(assetId, { prefer_origin: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = assetName || 'asset';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载失败', err);
    }
  }

  function getSelectedDownloadItems() {
    const selectedIds = [...selected];
    const items = [];

    selectedIds.forEach((cardId) => {
      const card = assetsMap[activeCategory]?.find((asset) => asset.id === cardId);
      if (!card) return;

      if (Array.isArray(card.images) && card.images.length > 0) {
        card.images.forEach((image, index) => {
          items.push({
            id: image.id,
            name: card.images.length > 1 ? `${card.name || 'asset'}-${index + 1}` : (card.name || 'asset'),
          });
        });
        return;
      }

      items.push({
        id: card.id,
        name: card.name || 'asset',
      });
    });

    return items;
  }

  async function downloadSelected() {
    const items = getSelectedDownloadItems();
    if (items.length === 0) return;

    for (const item of items) {
      await downloadAsset(item.id, item.name);
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{
        width: '220px',
        flexShrink: 0,
        paddingTop: '16px',
        paddingBottom: '16px',
        paddingLeft: '12px',
        paddingRight: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        borderRight: '1px solid #FFFFFF14',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '4px 8px 8px 8px',
          fontFamily: FONT,
          fontSize: '14px',
          color: '#FFFFFF99',
          letterSpacing: '0.02em',
        }}>项目列表</div>
        {projects.map((p) => (
          <ProjectListItem
            key={p.id}
            project={{ ...p, onRename: () => handleRenameProject(p), onDelete: () => handleDeleteProject(p), onDownload: () => handleDownloadProject(p) }}
            active={activeProject === p.id}
            onClick={() => { setActiveProject(p.id); exitBatch(); }}
          />
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <TabBar tabs={PROJECT_CATEGORY_TABS} active={activeCategory} onChange={(k) => {
            setActiveCategory(k);
            setFavOnly(false);
            exitBatch();
            // useEffect([activeProject, activeCategory]) 会自动触发首屏加载
          }} />
          {batchMode ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: '24px', paddingRight: '24px', gap: '8px', flex: 1, height: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>已选 {selected.size} 项</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GhostButton onClick={selectAll}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M14 6.667V13C14 13.552 13.552 14 13 14H3C2.448 14 2 13.552 2 13V3C2 2.448 2.448 2 3 2H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.333 6.667L8.667 9.333L13.667 2.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>全选</span>
                </GhostButton>
                <GhostButton onClick={downloadSelected}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, rotate: '180deg', transformOrigin: '50% 50%' }}>
                    <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>下载</span>
                </GhostButton>
                <PlainBtn onClick={() => setBatchDeleteConfirm(true)} danger>
                  <TrashIcon color="#F75F5F" />
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#F75F5F', whiteSpace: 'nowrap' }}>删除</span>
                </PlainBtn>
                <PlainBtn onClick={exitBatch}>
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFFCC', whiteSpace: 'nowrap' }}>取消</span>
                </PlainBtn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px', paddingRight: '24px', height: '48px', flexShrink: 0 }}>
              <GhostButton onClick={() => setBatchMode(true)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M11.333 1.667H2.667C2.114 1.667 1.667 2.114 1.667 2.667V11.333C1.667 11.886 2.114 12.333 2.667 12.333H11.333C11.886 12.333 12.333 11.886 12.333 11.333V2.667C12.333 2.114 11.886 1.667 11.333 1.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
                  <path d="M14.667 4.334V14C14.667 14.368 14.368 14.667 14 14.667H4.334" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.333 6.829L6.333 8.67L9.667 5.24" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>批量操作</span>
              </GhostButton>
            </div>
          )}
        </div>

        <div ref={scrollContainerRef} style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: '16px',
          paddingBottom: '24px',
          paddingLeft: '24px',
          paddingRight: '24px',
          ...(filtered.length === 0 ? {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          } : activeCategory === 'audio' ? {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          } : {
            display: 'grid',
            gridTemplateColumns: SUBJECT_CARD_CATEGORIES.has(activeCategory) && !['storyboard_img', 'storyboard_video'].includes(activeCategory)
              ? 'repeat(auto-fill, minmax(160px, 1fr))'
              : 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '8px',
            alignContent: 'flex-start',
          }),
        }}>
          {filtered.length === 0 ? (
            <EmptyProjectAssets category={activeCategory} />
          ) : filtered.map((asset) => (
            activeCategory === 'audio' ? (
              <AudioCard
                key={asset.id}
                name={asset.name}
                duration={asset.duration}
                starred={asset.starred}
                selected={batchMode && selected.has(asset.id)}
                batchMode={batchMode}
                onSelect={() => toggleSelect(asset.id)}
                onStar={() => toggleStar(asset.id)}
                onDownload={() => downloadAsset(asset.id, asset.name)}
                onDelete={() => deleteAsset(asset.id)}
              />
            ) : SUBJECT_CARD_CATEGORIES.has(activeCategory) ? (
              <ProjectAssetCard
                key={asset.id}
                name={asset.name}
                desc={asset.description}
                url={asset.url || null}
                selected={batchMode && selected.has(asset.id)}
                batchMode={batchMode}
                onSelect={() => toggleSelect(asset.id)}
                onDownload={() => downloadAsset(asset.id, asset.name)}
                onDelete={(imageId) => deleteAsset(asset.id, imageId)}
                onShowToast={showToast}
                asset={asset}
                category={activeCategory}
              />
            ) : (
              <AssetCard
                key={asset.id}
                name={asset.name}
                bgColor={asset.bgColor || '#252525'}
                url={asset.url || null}
                starred={asset.starred}
                selected={batchMode && selected.has(asset.id)}
                batchMode={batchMode}
                assetType={activeCategory === 'storyboard_img' ? 'shot' : activeCategory === 'storyboard_video' ? 'shot_video' : 'asset'}
                onSelect={() => toggleSelect(asset.id)}
                onStar={() => toggleStar(asset.id)}
                onDownload={() => downloadAsset(asset.id, asset.name)}
                onDelete={() => deleteAsset(asset.id)}
                asset={asset}
              />
            )
          ))}
          {/* 滚动加载哨兵 */}
          <div ref={sentinelRef} style={{ width: '100%', height: '1px', flexShrink: 0 }} />
          {pageMeta[pageKey(activeProject, activeCategory)]?.loading && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '16px 0', flexShrink: 0 }}>
              <span style={{ fontFamily: FONT, fontSize: '13px', color: '#FFFFFF40' }}>加载中…</span>
            </div>
          )}
        </div>
      </div>

      {/* Rename Modal — matches ProjectList RenameModal */}
      {renameTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={() => setRenameTarget(null)}
        >
          <div
            style={{
              width: '400px',
              background: '#161616',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                background: '#161616',
              }}
            >
              <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
                重命名
              </span>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  padding: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '8px 24px', background: '#161616' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)' }}>
                  项目名称
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '36px',
                    paddingLeft: '12px',
                    paddingRight: '6px',
                    borderRadius: '8px',
                    background: '#1D1E1E',
                    border: '1px solid rgba(255,255,255,0.08)',
                    outline: '1px solid #00000080',
                    outlineOffset: '0',
                  }}
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameTarget(null); }}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontFamily: FONT,
                      fontSize: '14px',
                      lineHeight: '18px',
                      color: '#FFFFFF',
                      caretColor: '#2DC3E1',
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '16px 24px',
                background: '#161616',
              }}
            >
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  padding: '0 16px',
                  gap: '4px',
                  boxShadow: 'rgba(0,0,0,0.4) 3px 3px 8px',
                  background: '#161616',
                  border: '1px solid rgba(255,255,255,0.05)',
                  outline: '1px solid #00000080',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                取消
              </button>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  boxShadow: 'rgba(0,0,0,0.4) 3px 3px 8px',
                  outline: '1px solid #00000080',
                  padding: '1px',
                  backgroundImage: !renameValue.trim()
                    ? 'linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)'
                    : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
                  opacity: !renameValue.trim() ? 0.5 : 1,
                  cursor: !renameValue.trim() ? 'not-allowed' : 'pointer',
                }}
                onClick={renameValue.trim() ? confirmRename : undefined}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexGrow: 1,
                    borderRadius: '7px',
                    padding: '0 15px',
                    gap: '4px',
                    background: '#161616',
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                    确认
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal — matches ProjectList DeleteProjectDialog */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              width: '360px',
              background: '#161616',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              boxShadow: '#00000099 0px 8px 32px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
                  确定要删除吗？
                </span>
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)' }}>
                  「{deleteTarget.name}」将被永久删除，无法恢复。
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: 0, flexShrink: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  boxShadow: '#00000066 3px 3px 8px',
                  backgroundColor: '#161616',
                  border: '1px solid #FFFFFF14',
                  outline: '1px solid #00000080',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  backgroundColor: '#D13B3B',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  fontFamily: FONT_MEDIUM,
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: '#FFFFFF',
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch delete confirmation */}
      {batchDeleteConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`将删除已选中的 ${selected.size} 项及其所有相关内容，删除后无法恢复。`}
          confirmText="删除"
          onCancel={() => setBatchDeleteConfirm(false)}
          onConfirm={() => {
            setBatchDeleteConfirm(false);
            deleteSelected();
            exitBatch();
          }}
          zIndex={100}
        />
      )}
      {toast && createPortal(
        <div style={{
          position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, pointerEvents: 'none',
          animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            {toast.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
            {toast.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round"/></svg>
            )}
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: FONT }}>{toast.msg}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

