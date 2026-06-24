import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCreationStore } from '../stores/creationStore';
import Checkbox from './Checkbox';
import { generationsToFlatList } from '../utils/creativeDaysAdapter';
import { apiGetProjects } from '../api/project';
import { apiGetAssetsPage, enrichWithStoryboards } from '../api/assets';
import { apiListCreationImages, apiListCreationVideos, apiListCreationAudios } from '../api/creation';
import { normalizeImageUrl } from '../utils/imageUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// accept='image' → 只允许图片类资产；'video' → 只允许视频类资产；'audio' → 只允许音频类资产；'all' → 不限制
const PROJECT_SUB_TABS_ALL = ['角色', '场景', '道具', '分镜图', '分镜视频', '音频', '成片'];
const PROJECT_SUB_TABS_IMAGE = ['角色', '场景', '道具', '分镜图'];
const PROJECT_SUB_TABS_VIDEO = ['分镜视频'];
const PROJECT_SUB_TABS_AUDIO = ['音频'];
const CREATIVE_SUB_TABS_ALL = ['图片', '视频', '配音'];
const CREATIVE_SUB_TABS_IMAGE = ['图片'];
const CREATIVE_SUB_TABS_VIDEO = ['视频'];
const CREATIVE_SUB_TABS_AUDIO = ['配音'];


// 子 Tab → projectAssetsMap 的 key
const SUB_TAB_KEY_MAP = {
  '角色': 'chars',
  '场景': 'scenes',
  '道具': 'props',
  '分镜图': 'storyboard_img',
  '分镜视频': 'storyboard_video',
  '音频': 'audio',
  '成片': 'final_cut',
  '图片': 'images',
  '视频': 'videos',
  '配音': 'dubbing',
};

// 子 Tab → 后端 category / asset_type 过滤参数
// 数组表示该 tab 需要拉取多个 category 的资产（如分镜图包含 storyboard + reference）
const SUB_TAB_CATEGORY_MAP = {
  '角色':   { category: 'character' },
  '场景':   { category: 'scene' },
  '道具':   { category: 'prop' },
  '分镜图': { category: ['storyboard', 'reference'], asset_type: 'image' },
  '分镜视频': { category: ['storyboard', 'reference'], asset_type: 'video' },
  '音频':   { category: ['audio', 'reference'] },
  '成片':   { category: 'film' },
};

function AssetCard({ asset, isSelected, isHovered, isDisabled, onMouseEnter, onMouseMove, onMouseLeave, onClick, compact = false }) {
  return (
    <div
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        width: compact ? 'calc((100% - 32px) / 3)' : '175px',
        height: compact ? '135px' : '208px',
        borderRadius: '10px', overflow: 'hidden',
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#1C1C1C',
        border: `1px solid ${isSelected ? '#FFFFFF33' : isHovered ? 'rgba(255,255,255,0.2)' : '#FFFFFF0F'}`,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 100ms',
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {/* 图片区 */}
      <div style={{
        height: compact ? '100%' : '168px', flexShrink: 0, position: 'relative',
        background: asset.url ? 'transparent' : (asset.bgColor || '#252525'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {asset.asset_type === 'video' && (asset.posterUrl || asset.url) ? (
          // 视频卡片：优先用封面图显示（清晰、快速），无封面时回退到 video 标签加载首帧
          asset.posterUrl ? (
            <img src={asset.posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHovered && !isSelected ? 0.85 : 1, transition: 'opacity 100ms' }} />
          ) : (
            <video
              src={asset.url}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHovered && !isSelected ? 0.85 : 1, transition: 'opacity 100ms' }}
              muted
              playsInline
              preload="metadata"
            />
          )
        ) : asset.url ? (
          <img src={asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHovered && !isSelected ? 0.85 : 1, transition: 'opacity 100ms' }} />
        ) : asset.type === 'audio' ? (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M12 26V8l16-3v18" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="26" r="4" stroke="#FFFFFF26" strokeWidth="1.5"/>
            <circle cx="24" cy="23" r="4" stroke="#FFFFFF26" strokeWidth="1.5"/>
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="3" y="6" width="26" height="20" rx="3" stroke="#FFFFFF26" strokeWidth="1.5" />
            <circle cx="11" cy="13" r="2.5" stroke="#FFFFFF26" strokeWidth="1.5" />
            <path d="M4 22L10 15L15 20L20 14L28 22" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        )}
        {/* 复选框 */}
        <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
          <Checkbox checked={isSelected} hovered={isHovered} disabled={isDisabled} />
        </div>
        {/* 收藏图标（仅创作资产有 starred 字段时显示） */}
        {asset.starred && (
          <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z" fill="#F0B429" stroke="#F0B429" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      {/* 底部标签 */}
      {!compact && (
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: '#1C1C1C', flex: 1 }}>
        <span style={{
          fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
        }}>{asset.name || '未命名'}</span>
      </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="16" fill="#FFFFFF05" />
        <path d="M22 42C22 38.686 24.686 36 28 36H46L52 42H72C75.314 42 78 44.686 78 48V68C78 71.314 75.314 74 72 74H28C24.686 74 22 71.314 22 68V42Z" fill="#FFFFFF0A" stroke="#FFFFFF1A" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="34" y="50" width="32" height="16" rx="3" fill="#FFFFFF0D" stroke="#FFFFFF14" strokeWidth="1" />
        <path d="M34 66L42 56L48 62L54 55L66 66" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="60" cy="54" r="2.5" stroke="#FFFFFF26" strokeWidth="1.5" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF40' }}>资产库暂无资产</span>
    </div>
  );
}

export default function AssetPickerModal({
  open,
  onClose,
  onConfirm,
  // accept: 'image' | 'video' | 'all'  控制可选资产类型
  accept = 'all',
  // projectId: 当前项目 ID，传入后会从后端拉取真实项目列表和资产数据
  projectId = null,
  // creativeAssets: { images: [], videos: [], dubbing: [] }  创作资产；未传时从 store 读取
  creativeAssets: creativeAssetsProp = null,
  // preSelectedIds: string[]  已存在的资产ID，打开时默认选中且不可取消
  preSelectedIds = [],
  // preSelectedUrls: string[]  已存在资产的图片URL，打开时默认选中且不可取消（用于跨ID来源匹配，如主体参考图）
  preSelectedUrls = [],
  // preSelectedSubjectIds: string[]  已存在资产对应的主体ID，打开时默认选中且不可取消（最可靠的跨来源匹配键）
  preSelectedSubjectIds = [],
}) {
  const generationsByTab = useCreationStore((s) => s.generationsByTab);
  const favorites = useCreationStore((s) => s.favorites);

  // 创作资产本地缓存（弹窗内懒加载，避免依赖 CreationPage 初始化）
  const [localCreativeAssets, setLocalCreativeAssets] = useState(null);
  const [creativeLoadedTabs, setCreativeLoadedTabs] = useState(new Set());
  const [creativeLoading, setCreativeLoading] = useState(false);

  // 将后端历史记录条目归一化为 picker 卡片格式
  function normalizeCreativeItem(item, type) {
    // 视频优先取 video_url，图片/音频取 original_url/file_url
    const rawUrl = type === 'video'
      ? (item.video_url || item.videoUrl || item.preview_video_url || item.previewVideoUrl || item.original_url || item.file_url || item.url || '')
      : (item.original_url || item.file_url || item.url || item.thumbnail_url || item.thumbnailUrl || '');
    const url = normalizeImageUrl(rawUrl) || null;

    // 视频封面：poster_url / thumbnail_url，用于静态预览
    const posterUrl = type === 'video'
      ? (normalizeImageUrl(item.poster_url || item.posterUrl || item.thumbnail_url || item.thumbnailUrl || '') || null)
      : null;

    return {
      id: item.id,
      name: item.name || item.prompt?.slice(0, 20) || '未命名',
      // AssetCard 渲染视频时优先用 posterUrl（封面图），无封面时 url 传视频地址让 <video> 加载
      url,
      posterUrl,
      // 悬浮预览大图用 fullUrl（视频类型可以用 poster）
      fullUrl: type === 'video' ? (posterUrl || url) : url,
      fileUrl: url,
      asset_type: type,
      starred: item.is_favorite ?? item.is_liked ?? item.isLiked ?? false,
      bgColor: '#252525',
    };
  }

  const creativeAssets = useMemo(() => {
    if (creativeAssetsProp) return creativeAssetsProp;
    // 优先使用弹窗内加载的数据；如果还没加载，降级到 store 数据
    if (localCreativeAssets) return localCreativeAssets;

    // 从 store 转换数据格式（store 由 CreationPage 初始化，可能为空）
    return {
      images: generationsToFlatList(generationsByTab.image || [], favorites).map(item => ({
        ...item,
        bgColor: item.bgColor || '#1F2324',
      })),
      videos: generationsToFlatList(generationsByTab.video || [], favorites).map(item => ({
        ...item,
        // 视频卡片封面：posterUrl 字段（不是 poster）
        url: item.posterUrl || item.url || null,
        bgColor: item.bgColor || '#1F2324',
      })),
      dubbing: generationsToFlatList(generationsByTab.dubbing || [], favorites).map(item => ({
        ...item,
        bgColor: item.bgColor || '#1F2324',
        type: 'audio',
      })),
    };
  }, [creativeAssetsProp, localCreativeAssets, generationsByTab, favorites]);

  const projectSubTabsAvail = accept === 'video' ? PROJECT_SUB_TABS_VIDEO : accept === 'image' ? PROJECT_SUB_TABS_IMAGE : accept === 'audio' ? PROJECT_SUB_TABS_AUDIO : PROJECT_SUB_TABS_ALL;
  const creativeSubTabsAvail = accept === 'video' ? CREATIVE_SUB_TABS_VIDEO : accept === 'image' ? CREATIVE_SUB_TABS_IMAGE : accept === 'audio' ? CREATIVE_SUB_TABS_AUDIO : CREATIVE_SUB_TABS_ALL;

  const [activeTab, setActiveTab] = useState('project');
  const [projectSubTab, setProjectSubTab] = useState(projectSubTabsAvail[0]);
  const [creativeSubTab, setCreativeSubTab] = useState(creativeSubTabsAvail[0]);
  const [favOnly, setFavOnly] = useState(false);
  const [finalOnly, setFinalOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const preSelectedSet = useMemo(() => new Set(preSelectedIds ?? []), [preSelectedIds]);
  // 主体ID集合（最可靠的跨来源匹配键：主体参考图与资产库为不同记录ID，但同属一个 subject_id）
  const preSelectedSubjectSet = useMemo(
    () => new Set((preSelectedSubjectIds ?? []).filter(Boolean)),
    [preSelectedSubjectIds]
  );
  // 预选URL → 文件名集合（兜底匹配：缩略图/原图协议或host不同，但文件名一致）
  const urlKey = (u) => {
    const n = normalizeImageUrl(u);
    if (!n) return null;
    // 取 path 最后一段（去掉 query），归一化协议/host/缩略图前缀差异
    const noQuery = n.split('?')[0].split('#')[0];
    const seg = noQuery.split('/').filter(Boolean).pop() || null;
    return seg;
  };
  const preSelectedUrlSet = useMemo(
    () => new Set((preSelectedUrls ?? []).map(urlKey).filter(Boolean)),
    [preSelectedUrls]
  );

  // 判断某张资产卡片是否为预选（不可取消）：subject_id 命中 / ID 命中 / URL文件名 命中
  const isPreSelected = (asset) => {
    if (!asset) return false;
    if (preSelectedSet.has(asset.id)) return true;
    if (asset.subject_id && preSelectedSubjectSet.has(asset.subject_id)) return true;
    const k1 = urlKey(asset.url);
    if (k1 && preSelectedUrlSet.has(k1)) return true;
    const k2 = urlKey(asset.fileUrl);
    if (k2 && preSelectedUrlSet.has(k2)) return true;
    return false;
  };

  // 每次弹窗打开时用 preSelectedIds 初始化选中状态，关闭时清空
  useEffect(() => {
    if (open) {
      setSelected(new Set(preSelectedIds ?? []));
    } else {
      setSelected(new Set());
      // 关闭时重置创作资产本地缓存，下次打开重新加载
      setLocalCreativeAssets(null);
      setCreativeLoadedTabs(new Set());
    }
  }, [open]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [closeHovered, setCloseHovered] = useState(false);
  const [previewImage, setPreviewImage] = useState(null); // { url, x, y }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef(null);
  const [cancelHovered, setCancelHovered] = useState(false);
  const [cancelPressed, setCancelPressed] = useState(false);
  const [confirmHovered, setConfirmHovered] = useState(false);
  const [confirmPressed, setConfirmPressed] = useState(false);
  const [favHovered, setFavHovered] = useState(false);
  const [finalHovered, setFinalHovered] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectHovIdx, setProjectHovIdx] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(projectId || null);
  const projectBtnRef = useRef(null);

  // ── 从后端拉取真实数据 ──────────────────────────────────────────────────
  const [apiProjects, setApiProjects] = useState(null);
  const [apiAssetsMap, setApiAssetsMap] = useState(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  // 已加载完成的 tab key 集合：key = `${projectId}__${tabKey}`
  const [loadedTabKeys, setLoadedTabKeys] = useState(new Set());

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setProjectsLoading(true);
        // 拉取所有项目列表
        const projList = await apiGetProjects();
        const projs = Array.isArray(projList) ? projList.map(p => ({ id: p.id, name: p.name })) : [];
        setApiProjects(projs);
      } catch (err) {
        console.error('[AssetPickerModal] 拉取项目列表失败:', err);
        setApiProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, [open]);

  const pickerTabKey = (pid, tabKey) => `${pid}__${tabKey}`;

  function normalizePickerAsset(a) {
    return {
      id: a.id,
      name: a.name || '未命名',
      url: normalizeImageUrl(a.thumbnail_url || a.file_url) || null,
      fullUrl: normalizeImageUrl(a.file_url) || null,
      fileUrl: normalizeImageUrl(a.file_url) || null,
      subject_id: a.subject_id ?? null,
      starred: a.is_starred ?? false,
      is_primary: a.is_primary ?? false,
      bgColor: '#252525',
      category: a.category,
      asset_type: a.asset_type,
    };
  }

  // 切换 Tab 时一次性拉取该 Tab 的全部数据（循环翻页直到 hasMore=false）
  useEffect(() => {
    if (!open || activeTab !== 'project') return;
    const pullProjectId = activeProjectId || projectId;
    if (!pullProjectId) return;

    const tabKey = SUB_TAB_KEY_MAP[projectSubTab];
    const pKey = pickerTabKey(pullProjectId, tabKey);
    // 已加载过该分类，跳过
    if (loadedTabKeys.has(pKey)) return;

    const categoryFilter = SUB_TAB_CATEGORY_MAP[projectSubTab];
    if (!categoryFilter) return;

    (async () => {
      try {
        setAssetsLoading(true);
        const categories = Array.isArray(categoryFilter.category) ? categoryFilter.category : [categoryFilter.category];
        const allItems = [];

        for (const cat of categories) {
          let cursor = undefined;
          let hasMore = true;

          while (hasMore) {
            const page = await apiGetAssetsPage({
              project_id: pullProjectId,
              scope: 'project',
              limit: 100,
              cursor,
              category: cat,
              ...(categoryFilter.asset_type ? { asset_type: categoryFilter.asset_type } : {}),
            });
            allItems.push(...page.list);
            hasMore = page.hasMore;
            cursor = page.nextCursor;
            if (!cursor) break;
          }
        }

        // 分镜 Tab 需要用分镜板数据交叉比对，补全 is_primary / ratio 字段
        const isStoryboardTab = tabKey === 'storyboard_img' || tabKey === 'storyboard_video';
        const enriched = await enrichWithStoryboards(pullProjectId, allItems, isStoryboardTab);
        const normalized = enriched.map(normalizePickerAsset);
        setApiAssetsMap(prev => ({
          ...prev,
          [pullProjectId]: { ...(prev?.[pullProjectId] ?? {}), [tabKey]: normalized },
        }));
        setLoadedTabKeys(prev => new Set([...prev, pKey]));
      } catch (err) {
        console.error('[AssetPickerModal] 拉取项目资产失败:', err);
      } finally {
        setAssetsLoading(false);
      }
    })();
  }, [open, activeTab, projectId, activeProjectId, projectSubTab]);

  // 切换到创作资产 tab 时，若 store 中对应数据未初始化则从后端拉取
  useEffect(() => {
    if (!open || activeTab !== 'creative' || creativeAssetsProp) return;

    // 确定当前 sub-tab 对应需要加载的类型
    const subTabTypeMap = { '图片': 'image', '视频': 'video', '配音': 'audio' };
    const type = subTabTypeMap[creativeSubTab];
    if (!type || creativeLoadedTabs.has(type)) return;

    // 如果 store 里已有数据（由 CreationPage 初始化），直接跳过
    const storeKey = type === 'audio' ? 'dubbing' : type;
    const storeData = generationsByTab[storeKey];
    if (storeData && storeData.length > 0) {
      setCreativeLoadedTabs(prev => new Set([...prev, type]));
      return;
    }

    (async () => {
      try {
        setCreativeLoading(true);
        let resp;
        if (type === 'image') {
          resp = await apiListCreationImages({ page: 1, page_size: 100 });
        } else if (type === 'video') {
          resp = await apiListCreationVideos({ page: 1, page_size: 100 });
        } else {
          resp = await apiListCreationAudios({ page: 1, page_size: 100 });
        }
        const list = Array.isArray(resp) ? resp : (resp?.list ?? resp?.items ?? resp?.data ?? []);
        const normalized = list.map(item => normalizeCreativeItem(item, type === 'audio' ? 'audio' : type));
        setLocalCreativeAssets(prev => ({
          images: prev?.images ?? [],
          videos: prev?.videos ?? [],
          dubbing: prev?.dubbing ?? [],
          [type === 'audio' ? 'dubbing' : type === 'video' ? 'videos' : 'images']: normalized,
        }));
        setCreativeLoadedTabs(prev => new Set([...prev, type]));
      } catch (err) {
        console.error('[AssetPickerModal] 拉取创作资产失败:', err);
      } finally {
        setCreativeLoading(false);
      }
    })();
  }, [open, activeTab, creativeSubTab, creativeAssetsProp]);

  const projects = apiProjects ?? [];
  const projectAssetsMap = apiAssetsMap ?? {};
  // 从 store 读取创作资产数据（当 prop 未传入时）

  // 当 projects 列表变化时，同步 activeProjectId（优先使用 projectId）
  useEffect(() => {
    if (projectId) {
      setActiveProjectId(projectId);
      return;
    }
    if (projects.length > 0 && !projects.find(p => p.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  // 当 accept 变化时，重置子 Tab 到第一个可用项
  useEffect(() => {
    setProjectSubTab(projectSubTabsAvail[0]);
    setCreativeSubTab(creativeSubTabsAvail[0]);
  }, [accept]);

  if (!open) return null;

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name ?? '选择项目';

  const toggle = (asset) => {
    if (isPreSelected(asset)) return; // 预选项不可取消
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(asset.id) ? next.delete(asset.id) : next.add(asset.id);
      return next;
    });
  };

  const handleConfirm = () => {
    // 构建全量 id→asset map，供按 ID 查完整对象
    const allAssets = [
      ...Object.values(projectAssetsMap).flatMap(p => Object.values(p).flat()),
      ...Object.values(creativeAssets).flat(),
    ];
    const assetMap = Object.fromEntries(allAssets.map(a => [a.id, a]));
    // 只返回本次新增选择的资产，排除上轮已存在的预选项（preSelectedIds），避免上游重复输入
    const selectedAssets = Array.from(selected)
      .filter(id => !preSelectedSet.has(id))
      .map(id => assetMap[id])
      .filter(Boolean);
    onConfirm?.(selectedAssets);
    onClose?.();
  };

  const handleSelectProject = (p) => {
    setActiveProjectId(p.id);
    setProjectOpen(false);
    setProjectHovIdx(null);
  };

  const getProjectBtnRect = () => projectBtnRef.current?.getBoundingClientRect() ?? null;
  const isCompactCard = activeTab === 'creative' && (creativeSubTab === '图片' || creativeSubTab === '视频');

  // 获取当前内容区资产列表
  const getCurrentAssets = () => {
    if (activeTab === 'project') {
      const projectData = projectAssetsMap[activeProjectId] ?? {};
      const key = SUB_TAB_KEY_MAP[projectSubTab];
      return projectData[key] ?? [];
    } else {
      const key = SUB_TAB_KEY_MAP[creativeSubTab];
      return creativeAssets[key] ?? [];
    }
  };

  const rawAssets = getCurrentAssets();
  const filteredAssets = rawAssets.filter(a => {
    if (activeTab === 'project' && finalOnly && !a.is_primary) return false;
    if (favOnly && !a.starred) return false;
    if (search && !(a.name || '').includes(search)) return false;
    return true;
  });


    // ── 资产卡片悬浮预览处理 ──────────────────────────────────────────────
  function handlePreviewEnter(e, asset) {
    if (!asset?.url) return;
    const { clientX, clientY } = e;
    setMousePos({ x: clientX, y: clientY });
    hoverTimerRef.current = setTimeout(() => {
      setPreviewImage({ url: asset.fullUrl || asset.url, x: clientX, y: clientY });
    }, 500);
  }

  function handlePreviewMove(e) {
    setMousePos({ x: e.clientX, y: e.clientY });
  }

  function handlePreviewLeave() {
    clearTimeout(hoverTimerRef.current);
    setPreviewImage(null);
  }

// ── 悬浮预览 ───────────────────────────────────────────────────────────────
  function AssetHoverPreview({ url, mouseX, mouseY }) {
    const [imgSize, setImgSize] = useState(null);
    const GAP = 16;

    useEffect(() => {
      setImgSize(null);
      const img = new Image();
      img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    }, [url]);

    if (!imgSize) return null;

    const maxW = window.innerWidth * 0.35;
    const maxH = window.innerHeight * 0.35;
    const ratio = imgSize.w / imgSize.h;

    let previewW, previewH;
    if (ratio >= 1) {
      previewW = maxW;
      previewH = previewW / ratio;
      if (previewH > maxH) { previewH = maxH; previewW = previewH * ratio; }
    } else {
      previewH = maxH;
      previewW = previewH * ratio;
      if (previewW > maxW) { previewW = maxW; previewH = previewW / ratio; }
    }

    let left = mouseX + GAP;
    let top = mouseY + GAP;
    if (left + previewW > window.innerWidth - GAP) left = mouseX - previewW - GAP;
    if (top + previewH > window.innerHeight - GAP) top = mouseY - previewH - GAP;
    left = Math.max(GAP, left);
    top = Math.max(GAP, top);

    return (
      <div
        style={{
          position: 'fixed', left, top,
          width: previewW, height: previewH,
          zIndex: 99999, pointerEvents: 'none',
          borderRadius: '8px', overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.12)',
          backgroundColor: '#111',
        }}
      >
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '800px', height: '600px', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#161616', border: '1px solid #FFFFFF14' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>从资产中选择</span>
          <button
            type="button"
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            style={{ background: closeHovered ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', transition: 'background 100ms', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke={closeHovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── 顶部大 Tab + 搜索框 ── */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '24px', paddingRight: '24px', gap: '24px', flexShrink: 0 }}>
          {['project', 'creative'].map((tab) => {
            const label = tab === 'project' ? '项目资产' : '创作资产';
            const isActive = activeTab === tab;
            return (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  paddingTop: '12px', paddingBottom: '6px',
                  borderBottom: '2px solid transparent',
                  cursor: 'pointer', flexShrink: 0, transition: 'border-color 100ms',
                }}
              >
                <span style={{
                  fontFamily: isActive ? FONT_MEDIUM : FONT,
                  fontWeight: isActive ? 500 : 400,
                  fontSize: '14px', lineHeight: '20px',
                  color: isActive ? '#2DC3E1' : '#FFFFFF99',
                  transition: 'color 100ms',
                }}>{label}</span>
              </div>
            );
          })}
          {/* 右侧：创作资产有收藏过滤，项目资产无 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', height: '48px' }}>
            {activeTab === 'creative' && (
              <div
                onClick={() => setFavOnly(v => !v)}
                onMouseEnter={() => setFavHovered(true)}
                onMouseLeave={() => setFavHovered(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}
              >
                <Checkbox checked={favOnly} hovered={favHovered} />
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF66', whiteSpace: 'nowrap' }}>仅显示收藏</span>
              </div>
            )}
            {/* 搜索框 */}
            <div style={{
              display: 'flex', alignItems: 'center', height: '36px', width: '232px',
              paddingLeft: '12px', paddingRight: '6px', borderRadius: '8px',
              justifyContent: 'space-between', flexShrink: 0,
              background: searchFocused ? 'rgba(45,195,225,0.04)' : '#1D1E1E',
              border: `1px solid ${searchFocused ? 'rgba(45,195,225,0.6)' : '#FFFFFF14'}`,
              outline: searchFocused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
              transition: 'border-color 120ms, background 120ms',
            }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索资产"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', caretColor: '#2DC3E1' }}
                className="placeholder:text-[rgba(255,255,255,0.4)]"
              />
              <div style={{ display: 'flex', alignItems: 'center', height: '24px', borderRadius: '6px', padding: '0 8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M7 12.667C10.13 12.667 12.667 10.13 12.667 7C12.667 3.87 10.13 1.333 7 1.333C3.87 1.333 1.333 3.87 1.333 7C1.333 10.13 3.87 12.667 7 12.667Z" stroke={searchFocused ? '#FFFFFF' : '#FFFFFF99'} strokeLinejoin="round" />
                  <path d="M11.074 11.074L13.902 13.902" stroke={searchFocused ? '#FFFFFF' : '#FFFFFF99'} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── 子 Tab 栏 ── */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '24px', paddingRight: '24px', paddingTop: '12px', gap: '24px', flexShrink: 0 }}>
          {activeTab === 'project' && (
            <>
              {/* 项目名称下拉 */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  ref={projectBtnRef}
                  onClick={() => setProjectOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0', height: '32px', paddingLeft: '16px', paddingRight: '8px', borderRadius: '8px', background: projectOpen ? '#FFFFFF1A' : '#FFFFFF0D', cursor: 'pointer', flexShrink: 0, transition: 'background 100ms' }}
                >
                  <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC', whiteSpace: 'nowrap' }}>{activeProjectName}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transition: 'transform 150ms', transform: projectOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFFCC" stroke="#FFFFFFCC" strokeWidth="1.333" strokeLinejoin="round" />
                  </svg>
                </div>
                {projectOpen && projects.length > 0 && (() => {
                  const rect = getProjectBtnRect();
                  return createPortal(
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 1200 }} onClick={() => { setProjectOpen(false); setProjectHovIdx(null); }} />
                      <div
                        style={{
                          position: 'fixed',
                          top: rect ? rect.bottom + 4 : 0,
                          left: rect ? rect.left : 0,
                          zIndex: 1201,
                          minWidth: rect ? rect.width : 120,
                          background: '#1C1C1C',
                          border: '1px solid #FFFFFF14',
                          borderRadius: '10px',
                          padding: '4px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0',
                        }}
                      >
                        {projects.map((p, i) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProject(p)}
                            onMouseEnter={() => setProjectHovIdx(i)}
                            onMouseLeave={() => setProjectHovIdx(null)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              height: '32px', paddingLeft: '12px', paddingRight: '12px', borderRadius: '7px',
                              cursor: 'pointer',
                              background: projectHovIdx === i ? '#FFFFFF0F' : 'transparent',
                              transition: 'background 80ms',
                            }}
                          >
                            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: activeProjectId === p.id ? '#FFFFFF' : '#FFFFFFB3', whiteSpace: 'nowrap' }}>{p.name}</span>
                            {activeProjectId === p.id && (
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginLeft: '8px' }}>
                                <path d="M3.333 8L6.667 11.333L13.333 4.667" stroke="#2DC3E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    </>,
                    document.body
                  );
                })()}
              </div>
              {/* 子 Tab */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                {projectSubTabsAvail.map((tab) => {
                  const isActive = projectSubTab === tab;
                  return (
                    <div
                      key={tab}
                      onClick={() => setProjectSubTab(tab)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <span style={{ fontFamily: isActive ? FONT_MEDIUM : FONT, fontWeight: isActive ? 500 : 400, fontSize: '14px', lineHeight: '18px', color: isActive ? '#FFFFFF' : '#FFFFFF99', transition: 'color 100ms', whiteSpace: 'nowrap' }}>{tab}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {activeTab === 'creative' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
              {creativeSubTabsAvail.map((tab) => {
                const isActive = creativeSubTab === tab;
                return (
                  <div
                    key={tab}
                    onClick={() => setCreativeSubTab(tab)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    <span style={{ fontFamily: isActive ? FONT_MEDIUM : FONT, fontWeight: isActive ? 500 : 400, fontSize: '14px', lineHeight: '18px', color: isActive ? '#FFFFFF' : '#FFFFFF99', transition: 'color 100ms', whiteSpace: 'nowrap' }}>{tab}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 内容区（可滚动） ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px', display: 'flex', flexDirection: 'column' }}>
          {filteredAssets.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', paddingTop: '8px', paddingBottom: '8px', alignContent: 'flex-start' }}>
              {filteredAssets.map((asset) => {
                const disabled = isPreSelected(asset);
                return (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selected.has(asset.id) || disabled}
                  isHovered={hoveredCard === asset.id}
                  isDisabled={disabled}
                  onMouseEnter={(e) => { setHoveredCard(asset.id); handlePreviewEnter(e, asset); }}
                  onMouseMove={handlePreviewMove}
                  onMouseLeave={() => { setHoveredCard(null); handlePreviewLeave(); }}
                  onClick={() => toggle(asset)}
                  compact={isCompactCard}
                />
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexShrink: 0, borderRadius: '0 0 16px 16px' }}>
          {activeTab === 'project' && (
            <div
              onClick={() => setFinalOnly(v => !v)}
              onMouseEnter={() => setFinalHovered(true)}
              onMouseLeave={() => setFinalHovered(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}
            >
              <Checkbox checked={finalOnly} hovered={finalHovered} />
              <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: finalHovered ? '#FFFFFF' : '#FFFFFF99', whiteSpace: 'nowrap' }}>仅显示定稿图</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={onClose}
            onMouseEnter={() => setCancelHovered(true)}
            onMouseLeave={() => { setCancelHovered(false); setCancelPressed(false); }}
            onMouseDown={() => setCancelPressed(true)}
            onMouseUp={() => setCancelHovered(true)}
            style={{ display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', padding: '0 16px', cursor: 'pointer', background: cancelPressed ? '#1A1A1A' : cancelHovered ? '#1D1D1D' : '#161616', border: '1px solid #FFFFFF0D', outline: '1px solid #00000080', boxShadow: '#00000066 3px 3px 8px', transition: 'background 100ms' }}
          >
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: cancelHovered ? '#FFFFFFCC' : '#FFFFFF99', whiteSpace: 'nowrap', transition: 'color 100ms' }}>取消</span>
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            onMouseEnter={() => setConfirmHovered(true)}
            onMouseLeave={() => { setConfirmHovered(false); setConfirmPressed(false); }}
            onMouseDown={() => setConfirmPressed(true)}
            onMouseUp={() => setConfirmHovered(true)}
            style={{ display: 'flex', flexDirection: 'column', height: '36px', borderRadius: '8px', outline: '1px solid #00000080', boxShadow: '#00000066 3px 3px 8px', padding: '1px', backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08))', cursor: 'pointer', border: 'none', transition: 'opacity 100ms', opacity: confirmPressed ? 0.75 : 1 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, borderRadius: '7px', padding: '0 15px', background: confirmPressed ? '#111111' : confirmHovered ? '#1A1A1A' : '#161616', transition: 'background 100ms' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>确定</span>
            </div>
          </button>
          </div>
        </div>
      </div>
      {previewImage && createPortal(
        <AssetHoverPreview url={previewImage.url} mouseX={mousePos.x} mouseY={mousePos.y} />,
        document.body
      )}
    </div>,
    document.body
  );
}
