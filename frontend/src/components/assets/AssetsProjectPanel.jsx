/**
 * @file AssetsProjectPanel.jsx
 * @structure-index
 *
 * 项目资产业务面板：持有项目/资产 API、筛选分页、批量动作和详情副作用，
 * 通过显式 props 组合展示组件，不把页面入口或目录入口作为隐式依赖。
 *
 * ─── 状态与数据流 ───────────────────────────────────
 *   项目、当前分类、资产数据、批量选择和弹窗状态                  L61–L96
 *   首屏/追加分页、主体元数据覆盖和项目列表加载                    L118–L213
 *
 * ─── 业务动作 ───────────────────────────────────────
 *   单项/批量删除、项目重命名/删除/复制/下载、资产下载               L226–L356
 *
 * ─── 页面组合 ───────────────────────────────────────
 *   项目列表、分类工具栏、AssetsProjectGrid、分页滚动层和弹窗       L357–L486
 *
 * ─── 更新记录 ───────────────────────────────────────
 *   2026-07-16  页面入口收敛；补充资产选择引用；抽离项目重命名/删除弹窗和资产卡片网格
 *   2026-07-17  统一按来源移除资产，并同步清理主体卡片与分页原始数据
 *   2026-07-24 项目列表按创建时间正序，与资产选择弹窗保持一致
 *   2026-07-28 删除主体单张资产时保持主体卡片标识稳定，详情弹窗仅移除缩略图
 *   2026-07-29 修复分镜卡片在临界宽度下网格行高不足导致的上下行重叠
 *   2026-08-03 主体删除后同步刷新资产库当前分类，避免保留旧主体资产卡片
 *   2026-08-03 统一项目资产下载文件名，并让详情弹窗通过资产下载接口获取文件
 *   2026-08-04 资产库结果列表排除主体参考过程资产；保留被其他主体引用的源结果资产
 *   2026-08-04 过滤改为读取主体详情，避免主体摘要不返回 reference_images 导致过滤失效
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { apiGetProjectAssetsPage, groupByCategory, calcProjectAssetsLimit, apiRemoveAssets, apiUpdateAsset, apiDownloadAsset } from '../../api/assets';
import { apiGetSubjects, apiGetSubjectDetail, apiGetEpisodes } from '../../api/subject';
import { apiGetProjects, apiDeleteProject, apiUpdateProject, apiCopyProject, apiDownloadProjectAssets } from '../../api/project';
import { apiGetStoryboards, apiListStoryboardMediaCandidates, apiDownloadStoryboardMediaCandidate } from '../../api/storyboard';
import { invalidate } from '../../utils/cache';
import { K } from '../../utils/cacheKeys';
import { useAssetFilter } from '../../hooks/useAssetFilter';
import { useAssetPagination } from '../../hooks/useAssetPagination';
import { useAssetSelection } from '../../hooks/useAssetSelection';
import { getAssetPageKey, getAssetSubjectType, getProjectBatchDeleteRequest, getProjectDownloadItems, SUBJECT_CARD_CATEGORIES } from '../../utils/assetsBatchAdapter';
import { downloadBlob } from '../../utils/downloadBlob';
import { getBlobExtension, getProjectAssetDownloadFilename } from '../../utils/projectAssetFilename';
import { getSubjectReferenceImageIdentities, getSubjectReferenceImagesFromResponse, getSubjectReferenceSnapshot, isExplicitReferenceMedia } from '../../utils/referenceMediaAdapter';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { normalizeStoryboard } from '../../utils/storyboardDataAdapter';
import ConfirmDialog from '../ConfirmDialog';
import { AssetsTabBar } from './AssetsTabs';
import AssetsBatchToolbar from './AssetsBatchToolbar';
import AssetsProjectListItem from './AssetsProjectListItem';
import AssetsScrollableContent from './AssetsScrollableContent';
import { EmptyProjectAssets } from './AssetsEmptyState';
import { AssetsProjectRenameModal } from './AssetsProjectModals';
import AssetsProjectGrid from './AssetsProjectGrid';
import StoryboardMediaDetailModal from '../storyboard/StoryboardMediaDetailModal';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const PROJECT_CATEGORY_TABS = [
  { key: 'chars', label: '角色' },
  { key: 'scenes', label: '场景' },
  { key: 'props', label: '道具' },
  { key: 'storyboard', label: '分镜' },
  { key: 'audio', label: '音频' },
  { key: 'final', label: '成片' },
];

// 参考图是主体创作的输入素材，不是项目资产库中的结果资产。
// 后端历史数据可能把参考图错误地写入 subject_id，不能只依赖 category/subject_id
// 判断归属；这里按主体详情中的参考图 ID 和地址，在资产库展示边界再次排除。
function getReferenceIdentitySets(subjects = []) {
  const references = [];
  (Array.isArray(subjects) ? subjects : []).forEach((subject) => {
    const subjectReferences = [
      ...getSubjectReferenceImagesFromResponse(subject),
      ...(getSubjectReferenceSnapshot(
        subject?.project_id ?? subject?.projectId,
        subject?.id ?? subject?.subject_id ?? subject?.subjectId,
      ) || []),
    ];
    const identities = getSubjectReferenceImageIdentities(subjectReferences);
    if (identities.ids.length === 0 && identities.urls.length === 0) return;
    references.push({
      subjectId: subject?.id ?? subject?.subject_id ?? subject?.subjectId ?? null,
      ids: new Set(identities.ids.map((id) => String(id))),
      urls: new Set(identities.urls.map((url) => normalizeImageUrl(url) || String(url))),
    });
  });
  return references;
}

function isReferenceAsset(asset, references) {
  const assetId = asset?.id ?? asset?.asset_id ?? asset?.assetId;
  const subjectId = asset?.subject_id ?? asset?.subjectId ?? null;
  const urls = [
    asset?.file_url,
    asset?.fileUrl,
    asset?.original_url,
    asset?.originalUrl,
    asset?.preview_url,
    asset?.previewUrl,
    asset?.thumbnail_url,
    asset?.thumbnailUrl,
    asset?.url,
  ].filter(Boolean);
  return references.some((reference) => {
    // A 主体的结果图被 B 作为参考图时，仍然是 A 的结果资产，不能从资产库隐藏。
    // 只有参考图资产属于引用它的主体，或本身没有主体归属时，才视为过程素材。
    const belongsToReferencingSubject = subjectId == null
      || reference.subjectId == null
      || String(subjectId) === String(reference.subjectId);
    if (!belongsToReferencingSubject) return false;
    return (assetId != null && reference.ids.has(String(assetId)))
      || urls.some((url) => reference.urls.has(normalizeImageUrl(url) || String(url)));
  });
}

async function filterReferenceAssetsForLibrary(projectId, category, assets) {
  if (!projectId || !Array.isArray(assets) || assets.length === 0) return assets;
  const subjectType = getAssetSubjectType(category);
  if (!subjectType) return assets;
  try {
    const subjects = await apiGetSubjects(projectId, { type: subjectType });
    // `/subjects` 是卡片摘要，历史后端不会在这里返回 reference_images；
    // 必须再读主体详情，才能在刷新资产库后识别上传/绑定的参考过程素材。
    const detailedSubjects = await Promise.all(
      (Array.isArray(subjects) ? subjects : []).map(async (subject) => {
        const subjectId = subject?.id ?? subject?.subject_id ?? subject?.subjectId;
        if (!subjectId) return subject;
        try {
          const detail = await apiGetSubjectDetail(projectId, subjectId);
          return { ...subject, ...detail, project_id: projectId };
        } catch (error) {
          console.warn('[ProjectAssetsPanel] 获取主体参考图详情失败:', error);
          return { ...subject, project_id: projectId };
        }
      }),
    );
    const references = getReferenceIdentitySets(detailedSubjects);
    return assets.filter((asset) => !isExplicitReferenceMedia(asset) && !isReferenceAsset(asset, references));
  } catch (error) {
    // 资产库加载不能因主体详情接口偶发失败而整体变成空态；失败时保留原列表。
    console.warn('[ProjectAssetsPanel] 参考图资产过滤失败，保留原始资产列表:', error);
    return assets;
  }
}

// subjectType：本次删除影响的主体类别（'character'|'scene'|'prop'），
// 让 Home 只刷新对应类别的主体，避免误刷/覆盖其它类别的卡片。
// deletedAssets 保留 subjectId，供主体页、分镜页和资产选择弹窗精确同步。
function notifyProjectAssetsDeleted(projectId, subjectType, records = []) {
  if (!projectId) return;
  const deletedAssets = records
    .map((asset) => ({
      assetId: asset?.id ?? asset?.asset_id ?? null,
      subjectId: asset?.subject_id ?? asset?.subjectId ?? null,
    }))
    .filter((asset) => asset.assetId != null)
    .map((asset) => ({ ...asset, assetId: String(asset.assetId), subjectId: asset.subjectId == null ? null : String(asset.subjectId) }));
  window.dispatchEvent(new CustomEvent('project-assets:deleted', {
    detail: {
      projectId,
      subjectType,
      assetIds: deletedAssets.map((asset) => asset.assetId),
      deletedAssets,
    },
  }));
}

export default function AssetsProjectPanel() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const {
    activeCategory,
    handleCategoryChange,
    filterAssets,
  } = useAssetFilter('chars');
  const {
    batchMode,
    selected,
    selectedCount,
    enterBatch,
    toggleSelect,
    selectAll: selectAllAssets,
    exitBatch,
  } = useAssetSelection();
  const [assetsMap, setAssetsMap] = useState({});
  // 每个 [projectId+category] 的分页状态：{ cursor, hasMore, loading, rawList }
  const {
    pageMeta,
    startPage,
    markPageLoading,
    completeFirstPage,
    completeMorePage,
    failFirstPage,
    failMorePage,
    removeFromRawList,
  } = useAssetPagination();
  const sentinelRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [storyboardDetail, setStoryboardDetail] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // 资产库卡片的名称/描述以「主体」为准，而非资产记录自身。
  // 主体页面编辑名称/描述只更新 subjects 表，不会回写到关联资产，
  // 因此这里按 subject_id 用主体的最新名称/描述覆盖卡片展示，保证两端一致。
  const applySubjectMeta = useCallback(async (projectId, category, cards) => {
      const subjectType = getAssetSubjectType(category);
    if (!subjectType || !Array.isArray(cards) || cards.length === 0) return cards;
    try {
      const subjects = await apiGetSubjects(projectId, { type: subjectType });
      const metaById = new Map();
      (subjects || []).forEach((s) => {
        if (s?.id == null) return;
        metaById.set(String(s.id), {
          name: s.name,
          description: s.description ?? s.desc ?? '',
        });
      });
      if (metaById.size === 0) return cards;
      return cards.map((card) => {
        const meta = card.subject_id != null ? metaById.get(String(card.subject_id)) : null;
        if (!meta) return card;
        return {
          ...card,
          name: meta.name ?? card.name,
          description: meta.description ?? card.description,
        };
      });
    } catch (err) {
      console.warn('[ProjectAssetsPanel] 同步主体名称/描述失败:', err);
      return cards;
    }
  }, []);

  // 首屏加载：切换项目或 tab 时触发
  const loadFirstPage = useCallback(async (projectId, category) => {
    const key = getAssetPageKey(projectId, category);
    // 清掉旧非分页接口写入的 localStorage 缓存，防止过期分组数据覆盖新结果
    invalidate(K.projectAssets(projectId), 'local');
    startPage(key);
    try {
      if (category === 'storyboard') {
        const [storyboards, episodes] = await Promise.all([
          // 资产库只需要分镜基础信息和媒体字段，不需要加载生成参数。
          apiGetStoryboards(projectId, { include_gen_params: false }),
          apiGetEpisodes(projectId).catch(() => []),
        ]);
        const episodeNumberById = new Map(
          (episodes || []).map((episode, index) => [
            String(episode.id),
            episode.episode_number ?? episode.episodeNumber ?? episode.number ?? index + 1,
          ]),
        );
        const cards = (await Promise.all((storyboards || []).map(async (shot) => {
          // 资产库与分镜页统一消费归一化后的镜头数据，兼容后端扁平字段和前端嵌套媒体字段。
          const normalizedShot = normalizeStoryboard(shot) || shot;
          let candidates = [];
          try {
            candidates = await apiListStoryboardMediaCandidates(projectId, shot.id);
          } catch (error) {
            console.warn('[ProjectAssetsPanel] 获取分镜候选媒体失败:', error);
          }
          if (candidates.length === 0) {
            const fallback = [
              normalizedShot.storyboardImage || shot.image_url || shot.imageUrl
                ? {
                    id: normalizedShot.storyboardImage?.id || shot.image_asset_id || shot.image_url || shot.imageUrl,
                    url: normalizedShot.storyboardImage?.url || shot.image_url || shot.imageUrl,
                    thumbnail_url: normalizedShot.storyboardImage?.thumbnail_url || shot.image_url || shot.imageUrl,
                    media_type: 'image',
                    is_finalized: true,
                    source: 'storyboard-existing',
                  }
                : null,
              normalizedShot.storyboardVideo || shot.video_url || shot.videoUrl
                ? {
                    id: normalizedShot.storyboardVideo?.id || shot.video_asset_id || shot.video_url || shot.videoUrl,
                    url: normalizedShot.storyboardVideo?.url || shot.video_url || shot.videoUrl,
                    thumbnail_url: normalizedShot.storyboardVideo?.thumbnail_url || shot.video_thumbnail_url || null,
                    poster_url: normalizedShot.storyboardVideo?.poster_url || shot.video_thumbnail_url || null,
                    media_type: 'video',
                    is_finalized: !normalizedShot.storyboardImage && !shot.image_url && !shot.imageUrl,
                    source: 'storyboard-existing',
                  }
                : null,
            ].filter((item) => item?.url);
            candidates = fallback;
          }
          // 资产库只展示已经有真实媒体地址的候选，纯分镜数据不生成空卡片。
          candidates = candidates.filter((item) => item?.url || item?.file_url || item?.fileUrl);
          if (candidates.length === 0) return null;
          const active = candidates.find((item) => item.is_finalized) || candidates[0];
          const episodeNumber = episodeNumberById.get(String(shot.episode_id ?? shot.episodeId))
            ?? shot.episode_number
            ?? shot.episodeNumber
            ?? '';
          const shotNumber = normalizedShot.number ?? shot.shot_number ?? shot.number ?? '';
          return {
            id: shot.id,
            name: `第${episodeNumber}集_分镜${String(shotNumber).padStart(2, '0')}`,
            description: '',
            url: active?.thumbnail_url || active?.poster_url || active?.url || null,
            videoUrl: active?.media_type === 'video' ? active.url : null,
            assetType: active?.media_type || null,
            candidates,
            storyboard: { ...shot, ...normalizedShot, number: shotNumber },
            project_id: projectId,
          };
        }))).filter(Boolean);
        setAssetsMap((prev) => ({ ...prev, [category]: cards }));
        completeFirstPage(key, { cursor: null, hasMore: false, rawList: [] });
        return;
      }
      const limit = calcProjectAssetsLimit(category);
      const result = await apiGetProjectAssetsPage(projectId, { category, limit });
      const filteredRawList = await filterReferenceAssetsForLibrary(projectId, category, result.rawList);
      const cards = await applySubjectMeta(projectId, category, groupByCategory(filteredRawList)[category] ?? []);
      setAssetsMap(prev => ({ ...prev, [category]: cards }));
      completeFirstPage(key, {
        cursor: result.nextCursor,
        hasMore: result.hasMore,
        rawList: filteredRawList,
      });
    } catch (err) {
      console.error('[ProjectAssetsPanel] 加载失败:', err);
      failFirstPage(key);
    }
  }, [applySubjectMeta, completeFirstPage, failFirstPage, startPage]);

  // 加载更多
  const loadMorePage = useCallback(async (projectId, category) => {
    const key = getAssetPageKey(projectId, category);
    const meta = pageMeta[key];
    if (!meta || meta.loading || !meta.hasMore) return;
    markPageLoading(key);
    try {
      const limit = calcProjectAssetsLimit(category);
      const result = await apiGetProjectAssetsPage(projectId, { category, limit, cursor: meta.cursor });
      const accumulated = [...(meta.rawList || []), ...result.rawList];
      const filteredAccumulated = await filterReferenceAssetsForLibrary(projectId, category, accumulated);
      const regrouped = groupByCategory(filteredAccumulated);
      const cards = await applySubjectMeta(projectId, category, regrouped[category] ?? []);
      setAssetsMap(prev => ({ ...prev, [category]: cards }));
      completeMorePage(key, {
        cursor: result.nextCursor,
        hasMore: result.hasMore,
        rawList: filteredAccumulated,
      });
    } catch (err) {
      console.error('[ProjectAssetsPanel] 加载更多失败:', err);
      failMorePage(key);
    }
  }, [applySubjectMeta, completeMorePage, failMorePage, markPageLoading, pageMeta]);

  useEffect(() => {
    apiGetProjects().then((list) => {
      const sortedProjects = Array.isArray(list)
        ? [...list].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
        : [];
      setProjects(sortedProjects);
      setActiveProject((prev) => prev ?? sortedProjects[0]?.id ?? null);
    });
  }, []);

  // 项目或 tab 切换时加载首屏
  useEffect(() => {
    if (activeProject == null) return;
    const frame = requestAnimationFrame(() => {
      loadFirstPage(activeProject, activeCategory);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeProject, activeCategory, loadFirstPage]);

  // 主体页删除主体后，资产库可能仍然挂载在页面中。先移除旧卡片，
  // 再重新请求当前分类，保证资产库与“从资产库选择”读取同一份最新结果。
  useEffect(() => {
    const handleSubjectDeleted = (event) => {
      const detail = event.detail || {};
      if (!detail.subjectId || (detail.projectId && detail.projectId !== activeProject)) return;
      const categoryBySubjectType = {
        character: 'chars',
        scene: 'scenes',
        prop: 'props',
      };
      const deletedCategory = categoryBySubjectType[detail.subjectType];
      if (!deletedCategory || deletedCategory !== activeCategory || activeProject == null) return;

      setAssetsMap((prev) => ({ ...prev, [deletedCategory]: [] }));
      const frame = requestAnimationFrame(() => {
        loadFirstPage(activeProject, deletedCategory);
      });
      return () => cancelAnimationFrame(frame);
    };

    window.addEventListener('subject:deleted', handleSubjectDeleted);
    return () => window.removeEventListener('subject:deleted', handleSubjectDeleted);
  }, [activeProject, activeCategory, loadFirstPage]);

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
  }, [activeProject, activeCategory, loadMorePage, pageMeta]);

  const categoryAssets = assetsMap[activeCategory] || [];
  const filtered = filterAssets(categoryAssets);

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
    const subjectType = getAssetSubjectType(activeCategory);
    const currentAssets = assetsMap[activeCategory] || [];
    const card = currentAssets.find((asset) => asset.id === id);
    const records = singleImageId
      ? [card?.images?.find((image) => image.id === singleImageId) || { id: singleImageId }]
      : (card?.images?.length ? card.images : [card || { id }]);
    const removedIds = records.map((asset) => asset.id);
    const pageKey = getAssetPageKey(activeProject, activeCategory);
    try {
      await apiRemoveAssets(records, { projectId: activeProject, subjectType, deleteMode: 'project' });
      removeFromRawList(pageKey, removedIds);
      setAssetsMap((prev) => {
        const nextAssets = (prev[activeCategory] || []).flatMap((asset) => {
          if (asset.id !== id) return [asset];
          const remaining = (asset.images || []).filter((image) => !removedIds.includes(image.id));
          if (!singleImageId || remaining.length === 0) return [];
          return [{
            ...asset,
            images: remaining,
            imageCount: remaining.length,
            url: remaining[0]?.url || null,
            fileUrl: remaining[0]?.fileUrl || null,
          }];
        });
        return { ...prev, [activeCategory]: nextAssets };
      });
      if (subjectType && activeProject) {
        apiGetSubjects(activeProject, { type: subjectType }).catch(() => {});
      }
      notifyProjectAssetsDeleted(activeProject, subjectType, records);
    } catch (err) {
      console.error('删除资产失败', err);
    }
  }

  async function deleteSelected() {
    const { records, subjectType } = getProjectBatchDeleteRequest({
      selectedIds: selected,
      category: activeCategory,
      assets: assetsMap[activeCategory] || [],
    });
    const removedIds = records.map((asset) => asset.id);
    const pageKey = getAssetPageKey(activeProject, activeCategory);
    try {
      await apiRemoveAssets(records, { projectId: activeProject, subjectType, deleteMode: 'project' });
      removeFromRawList(pageKey, removedIds);
      const selectedIds = new Set(selected);
      setAssetsMap((prev) => ({
        ...prev,
        [activeCategory]: (prev[activeCategory] || []).filter((asset) => !selectedIds.has(asset.id)),
      }));
      exitBatch();
      notifyProjectAssetsDeleted(activeProject, subjectType, records);
    } catch (err) {
      console.error('批量删除资产失败', err);
    }
  }

  function selectAll() {
    const allIds = filtered.map((a) => a.id);
    selectAllAssets(allIds);
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

  function handleCopyProject(project) {
    apiCopyProject(project.id).then((created) => {
      if (!created || !created.id) return;
      setProjects((prev) => [created, ...prev]);
    }).catch(console.error);
  }

  async function handleDownloadProject(project) {
    try {
      const filename = `${(project.name || '项目').replace(/[\\/:*?"<>|]/g, '_')}.zip`;
      const result = await apiDownloadProjectAssets(project.id);
      if (result?.type === 'url') {
        const anchor = document.createElement('a');
        anchor.href = result.value;
        anchor.download = filename;
        anchor.target = '_blank';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } else {
        downloadBlob(result?.value, filename);
      }
      showToast('项目下载成功', 'success');
    } catch (err) {
      console.error('[ProjectAssetsPanel] 下载项目失败:', err);
      showToast('项目下载失败，请重试', 'error');
    }
  }

  async function downloadAsset(assetId, assetName, storyboardAsset = null) {
    try {
      const activeProjectInfo = projects.find((project) => project.id === activeProject);
      const categoryLabel = PROJECT_CATEGORY_TABS.find((tab) => tab.key === activeCategory)?.label || activeCategory;
      if (activeCategory === 'storyboard' && storyboardAsset?.storyboard) {
        const media = storyboardAsset.candidates?.find((item) => item.id === assetId) || storyboardAsset.candidates?.[0];
        if (media?.id) {
          const blob = await apiDownloadStoryboardMediaCandidate(activeProject, storyboardAsset.storyboard.id, media.id);
          downloadBlob(blob, getProjectAssetDownloadFilename({
            projectName: activeProjectInfo?.name,
            categoryLabel,
            assetName,
            extension: getBlobExtension(blob),
          }));
          return;
        }
      }
      const blob = await apiDownloadAsset(assetId, { prefer_origin: true });
      downloadBlob(blob, getProjectAssetDownloadFilename({
        projectName: activeProjectInfo?.name,
        categoryLabel,
        assetName,
        extension: getBlobExtension(blob),
      }));
    } catch (err) {
      console.error('下载失败', err);
    }
  }

  function getSelectedDownloadItems() {
    return getProjectDownloadItems({
      selectedIds: selected,
      assets: assetsMap[activeCategory] || [],
    });
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
          <AssetsProjectListItem
            key={p.id}
            project={p}
            active={activeProject === p.id}
            onClick={() => { setActiveProject(p.id); exitBatch(); }}
            onRename={() => handleRenameProject(p)}
            onCopy={() => handleCopyProject(p)}
            onDelete={() => handleDeleteProject(p)}
            onDownload={() => handleDownloadProject(p)}
          />
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <AssetsTabBar tabs={PROJECT_CATEGORY_TABS} active={activeCategory} onChange={(k) => {
            handleCategoryChange(k);
            exitBatch();
            // useEffect([activeProject, activeCategory]) 会自动触发首屏加载
          }} />
          <AssetsBatchToolbar
            batchMode={batchMode}
            selectedCount={selectedCount}
            onEnterBatch={enterBatch}
            onSelectAll={selectAll}
            onDownload={downloadSelected}
            onDelete={() => setBatchDeleteConfirm(true)}
            onCancel={exitBatch}
          />
        </div>

        <AssetsScrollableContent
          items={filtered}
          activeCategory={activeCategory}
          subjectCardCategories={SUBJECT_CARD_CATEGORIES}
          scrollContainerRef={scrollContainerRef}
          sentinelRef={sentinelRef}
          loading={pageMeta[getAssetPageKey(activeProject, activeCategory)]?.loading}
          emptyState={<EmptyProjectAssets category={activeCategory} />}
        >
          <AssetsProjectGrid
            assets={filtered}
            activeCategory={activeCategory}
            subjectCardCategories={SUBJECT_CARD_CATEGORIES}
            batchMode={batchMode}
            selected={selected}
            onSelect={toggleSelect}
            onStar={toggleStar}
            onDownload={downloadAsset}
            onDelete={deleteAsset}
            onShowToast={showToast}
          onOpenStoryboardDetail={(asset) => setStoryboardDetail({
              name: asset.name,
              shot: asset.storyboard,
              candidates: asset.candidates || [],
              media: asset.candidates?.find((item) => item.is_finalized) || asset.candidates?.[0],
            })}
          />
        </AssetsScrollableContent>
      </div>

      {renameTarget && (
        <AssetsProjectRenameModal
          value={renameValue}
          onChange={setRenameValue}
          onClose={() => setRenameTarget(null)}
          onConfirm={confirmRename}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`「${deleteTarget.name}」将被永久删除，无法恢复。`}
          confirmText="删除"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteProject}
        />
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
          }}
          zIndex={100}
        />
      )}
      {storyboardDetail && (
        <StoryboardMediaDetailModal
          shot={storyboardDetail.shot}
          candidates={storyboardDetail.candidates}
          media={storyboardDetail.media}
          onClose={() => setStoryboardDetail(null)}
          readOnlyFinalize
          onDownload={async (media) => {
            try {
              const blob = await apiDownloadStoryboardMediaCandidate(activeProject, storyboardDetail.shot.id, media.id);
              const activeProjectInfo = projects.find((project) => project.id === activeProject);
              downloadBlob(blob, getProjectAssetDownloadFilename({
                projectName: activeProjectInfo?.name,
                categoryLabel: '分镜',
                assetName: storyboardDetail.name,
                extension: getBlobExtension(blob),
              }));
            } catch (error) {
              console.error('[ProjectAssetsPanel] 下载分镜候选媒体失败:', error);
              showToast('下载失败，请重试', 'error');
            }
          }}
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
