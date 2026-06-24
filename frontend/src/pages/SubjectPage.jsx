import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import DotsLoading from '../components/DotsLoading';
import BatchGenerateModal from '../components/BatchGenerateModal';
import AssetPickerModal from '../components/AssetPickerModal';
import { apiCreateSubject, apiUpdateSubject, apiDeleteSubject, apiGenerateSubjectImage, apiGetSubjects, apiBatchGenerateStream, apiGetSubjectDetail, apiGetSubjectImages, apiBindSubjectReferenceImages, apiUploadSubjectReferenceImage, apiDownloadSubjectImage, apiSetPrimarySubjectImage } from '../api/subject';
// 模型能力直接从后端 capabilities 获取
import { apiGetProjects } from '../api/project';
import { apiGetAssets } from '../api/assets';
import { apiListModels } from '../api/config';
import { apiGetVoices, apiGetVoiceLibrary } from '../api/voices';
import placeholderImg from '../assets/placeholder-img.webp';
import scenePlaceholderImg from '../assets/Mountain landscape.avif';
import propPlaceholderImg from '../assets/Tool box silhouette.avif';
import { normalizeImageUrl } from '../utils/imageUrl';
import { subscribe } from '../utils/cache';
import { K } from '../utils/cacheKeys';
import ConfirmDialog from '../components/ConfirmDialog';
import Checkbox from '../components/Checkbox';
import SubjectRefHoverPreview from './subject/SubjectRefHoverPreview';
import TabNav from './subject/TabNav';
import VoiceSelectModal from './subject/VoiceSelectModal';
import CharCard from './subject/CharCard';
import ImageItemUpload from './subject/ImageItemUpload';
import ImageViewModal from './subject/ImageViewModal';
import ImageItem from './subject/ImageItem';
import RefImageItem from './subject/RefImageItem';
import RefImageUploadCard from './subject/RefImageUploadCard';
import RefImageField from './subject/RefImageField';
import MoreMenu from './subject/MoreMenu';
import Toolbar from './subject/Toolbar';
import AddCard from './subject/AddCard';
import IconBtn from './subject/IconBtn';
import UploadBtn from './subject/UploadBtn';
import RadioOption from './subject/RadioOption';
import EditSubjectPanel from './subject/EditSubjectPanel';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// ── 工具：触发浏览器下载 Blob ──────────────────────────────────────────
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Ghost button (添加角色 / 批量生成角色) ─────────────────────────────────

// ── Primary button (开始智能分镜) ──────────────────────────────────────────

// ── Confirm storyboard modal (二次确认弹窗) ────────────────────────────────

// ── Tab nav ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'char', label: '角色' },
  { key: 'scene', label: '场景' },
  { key: 'prop', label: '道具' },
];

// ── Voice select modal ─────────────────────────────────────────────────────

const GENDER_OPTIONS = ['不限', '男', '女'];
const AGE_OPTIONS = ['不限', '幼年', '青年', '中年', '老年'];

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
  </svg>
);

const HeadphoneIcon = ({ color = '#2DC3E1' }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M3.333 12V8C3.333 5.423 5.423 3.333 8 3.333C10.577 3.333 12.667 5.423 12.667 8V12M3.333 8.667H2C1.632 8.667 1.333 8.965 1.333 9.333V12C1.333 12.368 1.632 12.667 2 12.667H3.333V8.667ZM12.667 8.667H14C14.368 8.667 14.667 8.965 14.667 9.333V12C14.667 12.368 14.368 12.667 14 12.667H12.667V8.667Z" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.333 10.667H6.667L7.333 8.667L8.667 12.667L9.333 10.667H10.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlayingWaveIcon = ({ color = '#2DC3E1', size = 16 }) => (
  <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flexShrink: 0 }}>
    {[
      { anim: 'voice-bar-1 0.8s ease-in-out infinite', h: 4 },
      { anim: 'voice-bar-2 0.8s ease-in-out infinite 0.15s', h: 8 },
      { anim: 'voice-bar-3 0.8s ease-in-out infinite 0.3s', h: 5 },
      { anim: 'voice-bar-4 0.8s ease-in-out infinite 0.45s', h: 10 },
    ].map((bar, i) => (
      <div
        key={i}
        style={{
          width: '2px', height: `${bar.h}px`, borderRadius: '1px',
          backgroundColor: color, animation: bar.anim,
        }}
      />
    ))}
  </div>
);

// ── Delete confirm modal ───────────────────────────────────────────────────

// DeleteConfirmModal 已迁移至 ConfirmDialog 共享组件

// ── Character card ─────────────────────────────────────────────────────────

// ── Mock data ──────────────────────────────────────────────────────────────

const INITIAL_CHARS = [
  { id: 1, name: '虎大', desc: '森林里最年长的老虎，性格沉稳，是两兄弟中的大哥，负责保护弟弟虎二。', imageUrl: null, voice: '霸气威武' },
  { id: 1, name: '虎大', desc: '森林里最年长的老虎，性格沉稳，是两兄弟中的大哥，负责保护弟弟虎二。', imageUrl: null, voice: null },
  { id: 2, name: '虎二', desc: '活泼好动的小老虎，总是惹麻烦，但心地善良，对哥哥虎大十分依赖。', imageUrl: null, voice: null },
  { id: 3, name: '狐狸阿九', desc: '狡猾却重情义的狐狸，表面上爱耍小聪明，关键时刻总会挺身而出。', imageUrl: null, voice: null },
  { id: 4, name: '老猫头鹰', desc: '森林里的智者，见过无数风雨，总在两只老虎迷路时给出关键指引。', imageUrl: null, voice: null },
  { id: 5, name: '小松鼠', desc: '话多又热心的小松鼠，是森林里的消息灵通人士，喜欢收集各种坚果和秘密。', imageUrl: null, voice: null },
  { id: 6, name: '大灰狼', desc: '看似凶猛的反派，实则只是想找人一起玩，孤独是他最大的秘密。', imageUrl: null, voice: null },
];

const MOCK_PROPS = [];

// Icon button with hover/press states for image overlays

// Upload button with hover/press states

// Upload card — only item shown by default; hover state on card

// Modal for viewing an uploaded image full-size

// Uploaded image card — interactive: hover highlights border, click toggles settled

// Interactive radio option

// Per-model upload limits


// 模块级缓存：跨弹窗打开/关闭保留生成中的图片状态
// key: subjectId, value: { placeholderId, status: 'pending'|'done', imageUrl?, rawUrl? }
const pendingGenerations = new Map();

// ── Main export ────────────────────────────────────────────────────────────

export default function SubjectPage({ projectId, projectName = '两只老虎的奇遇', onBack, onUnlockStep, onStartStoryboard, onExtractSubjects, extractError = null, isStoryboardGenerated = false, initialTab = 'char', projectRatio, chars: externalChars, onCharsChange, scenes: externalScenes, onScenesChange, props: externalProps, onPropsChange, onLoadMoreChars, onLoadMoreScenes, onLoadMoreProps, hasMoreChars = false, hasMoreScenes = false, hasMoreProps = false }) {

  const [activeTab, setActiveTab] = useState(initialTab);
  const [batchGenOpen, setBatchGenOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const extractingRef = useRef(false);
  const subjectListRef = useRef(null);
  const subjectSentinelRef = useRef(null);

  // 仅从剧本页「开始提取主体」触发（Home.jsx 传入 onExtractSubjects 回调），
  // 浏览器刷新 / tab 切换等场景不触发提取
  useEffect(() => {
    if (!onExtractSubjects) return;
    if (extractingRef.current) return;
    extractingRef.current = true;
    setIsExtracting(true);
    onExtractSubjects().finally(() => {
      setIsExtracting(false);
      extractingRef.current = false;
    });
  }, [onExtractSubjects]);

  // 循环 loading 文案
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingTexts = ['正在抽取剧本灵魂', '正在抽取剧本主角', '正在抽取剧本配角', '正在抽取场景', '正在抽取道具'];

  useEffect(() => {
    if (!isExtracting) return;
    const timer = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % loadingTexts.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [isExtracting]);

  const [batchGeneratingByTab, setBatchGeneratingByTab] = useState({});
  const [batchToast, setBatchToast] = useState(null);
  const batchToastTimerRef = useRef(null);
  // 批量生成加载状态：{ [subjectId]: true }
  const [batchLoadingSubjects, setBatchLoadingSubjects] = useState({});
  // 批量生成前的封面 URL 快照
  const prevCoverUrlsRef = useRef({});
  // 批量生成 AbortController，组件卸载时取消
  const batchAbortRef = useRef(null);

  function showBatchToast(msg, type = 'success') {
    if (batchToastTimerRef.current) clearTimeout(batchToastTimerRef.current);
    setBatchToast({ msg, type });
    batchToastTimerRef.current = setTimeout(() => setBatchToast(null), 3000);
  }

  // 归一化后端返回的主体数据（对齐 Home.jsx 的 normalizeSubjects）
  function normalizeSubjectList(items) {
    const list = (items || []).map(item => ({
      ...item,
      desc: item.description ?? item.desc ?? '',
      imageUrl: normalizeImageUrl(item.primary_image_url ?? item.image_url ?? item.imageUrl),
    }));
    list.sort((a, b) => {
      const timeA = a.created_at || a.createdAt || a.create_time || '';
      const timeB = b.created_at || b.createdAt || b.create_time || '';
      if (timeA && timeB) return timeA.localeCompare(timeB);
      return (a.name || '').localeCompare(b.name || '');
    });
    return list;
  }

  const handleBatchGenerate = async (params) => {
    // 收集当前 tab 下的主体 ID 列表
    const currentSubjects = activeTab === 'char' ? chars : activeTab === 'scene' ? scenes : props;
    const subjectIds = (currentSubjects || []).map(s => s.id).filter(Boolean);
    if (subjectIds.length === 0) {
      showBatchToast('当前没有可生成的主体', 'error');
      return;
    }

    // 防止重复触发（已有加载中的主体）
    if (Object.keys(batchLoadingSubjects).length > 0) {
      showBatchToast('批量生成进行中，请等待当前任务完成', 'error');
      return;
    }

    // 关闭弹窗
    setBatchGenOpen(false);

    // 保存当前 tab 引用（stream 期间 tab 不会变）
    const captureTab = activeTab;
    // 根据 tab 确定 setter 函数
    const targetSetter =
      captureTab === 'char' ? setChars :
      captureTab === 'scene' ? setScenes :
      setProps;

    // 快照当前所有封面 URL
    prevCoverUrlsRef.current = {};
    (currentSubjects || []).forEach(s => {
      prevCoverUrlsRef.current[s.id] = s.imageUrl;
    });

    // 所有卡片进入 loading 状态
    const loadingMap = {};
    subjectIds.forEach(id => { loadingMap[id] = true; });
    setBatchLoadingSubjects(loadingMap);

    setBatchGeneratingByTab(prev => ({ ...prev, [captureTab]: true }));

    // 创建 AbortController，用于组件卸载时取消
    const controller = new AbortController();
    batchAbortRef.current = controller;

    // 统计成功/失败数
    let successCount = 0;
    let failCount = 0;

    try {
      await apiBatchGenerateStream(projectId, { model: params.model, ratio: params.ratio, resolution: params.resolution, generation_mode: params.mode, subject_ids: subjectIds }, {
        signal: controller.signal,
        onSubjectImage: (subjectId, imageUrl) => {
          successCount++;
          const fullUrl = normalizeImageUrl(imageUrl);
          // 更新对应 tab 的主体封面
          targetSetter(prev => prev.map(s =>
            s.id === subjectId ? { ...s, imageUrl: fullUrl } : s
          ));
          // 该主体退出 loading
          setBatchLoadingSubjects(prev => {
            const next = { ...prev };
            delete next[subjectId];
            return next;
          });
        },
        onSubjectError: (subjectId, errorMsg) => {
          failCount++;
          console.error(`[SubjectPage] 主体 ${subjectId} 批量生成失败:`, errorMsg);
          // Toast 提示单个失败
          const sub = (currentSubjects || []).find(s => s.id === subjectId);
          const label = sub?.name || subjectId;
          showBatchToast(`「${label}」生成失败: ${errorMsg || '未知错误'}`, 'error');
          // 该主体退出 loading（封面恢复为之前的图片或占位图）
          setBatchLoadingSubjects(prev => {
            const next = { ...prev };
            delete next[subjectId];
            return next;
          });
        },
       onComplete: () => {
         if (successCount > 0) {
           showBatchToast(successCount === subjectIds.length
             ? '批量生成全部完成'
             : `批量生成完成（成功 ${successCount}，失败 ${failCount}）`, 'success');
         }
          else if (failCount > 0) {
            showBatchToast('批量生成失败，可能是调用服务商模型失败了，请换个模型再试下', 'error');
          }
          else {
            showBatchToast('批量生成失败，未能接收到任何结果', 'error');
          }
       },
      });
    } catch (err) {
      // 忽略用户主动取消的错误
      if (err?.name === 'AbortError') return;

      console.error('[SubjectPage] 批量生成流失败:', err);
      // 网络断开或整体请求失败 — toast 后统一恢复
      const errMsg = err?.isNetworkError
        ? '网络连接失败，请检查网络后重试'
        : (err?.message || '批量生成失败，请重试');
      showBatchToast(errMsg, 'error');

      // 生图失败后重新从后端获取主体数据，恢复真实封面
      try {
        const _spAvailW = window.innerWidth - 48;
        const _spAvailH = window.innerHeight - 60 - 48;
        const _spCols = Math.max(1, Math.floor((_spAvailW + 16) / (200 + 16)));
        const _spRows = Math.max(1, Math.ceil(_spAvailH / (246 + 16))) + 1;
        const _spLimit = _spCols * _spRows;
        const [newChars, newScenes, newProps] = await Promise.all([
          apiGetSubjects(projectId, { type: 'character', limit: _spLimit }),
          apiGetSubjects(projectId, { type: 'scene', limit: _spLimit }),
          apiGetSubjects(projectId, { type: 'prop', limit: _spLimit }),
        ]);
        setChars(normalizeSubjectList(newChars));
        setScenes(normalizeSubjectList(newScenes));
        setProps(normalizeSubjectList(newProps));
      } catch (refetchErr) {
        console.error('[SubjectPage] 失败后刷新主体数据也失败:', refetchErr);
      }

      // 整体失败时，所有卡片的 loading 都会由于 finally 清除而消失，
      // 封面自然恢复为之前的图片（因为我们没有修改过 imageUrl）
    } finally {
      // 清空所有 loading 状态
      setBatchLoadingSubjects({});
      setBatchGeneratingByTab(prev => { const next = { ...prev }; delete next[captureTab]; return next; });
      batchAbortRef.current = null;
    }
  };

  const [confirmStoryboardOpen, setConfirmStoryboardOpen] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedProp, setSelectedProp] = useState(null);
  const [subjectDetailRefreshToken, setSubjectDetailRefreshToken] = useState(0);
  const [voiceModalChar, setVoiceModalChar] = useState(null);
  const [voiceList, setVoiceList] = useState([]);
  const [internalChars, setInternalChars] = useState(INITIAL_CHARS);
  const chars = (externalChars !== undefined && externalChars !== null) ? externalChars : internalChars;
  const hasExternalChars = externalChars !== undefined && externalChars !== null;
  function setChars(updater) {
    if (typeof updater === 'function') {
      if (hasExternalChars) {
        onCharsChange?.(updater);
      } else {
        setInternalChars(prev => {
          const next = updater(prev);
          onCharsChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalChars) {
        onCharsChange?.(updater);
      } else {
        setInternalChars(updater);
        onCharsChange?.(updater);
      }
    }
  }
  const [internalScenes, setInternalScenes] = useState([]);
  const scenes = (externalScenes !== undefined && externalScenes !== null) ? externalScenes : internalScenes;
  const hasExternalScenes = externalScenes !== undefined && externalScenes !== null;
  function setScenes(updater) {
    if (typeof updater === 'function') {
      if (hasExternalScenes) {
        onScenesChange?.(updater);
      } else {
        setInternalScenes(prev => {
          const next = updater(prev);
          onScenesChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalScenes) {
        onScenesChange?.(updater);
      } else {
        setInternalScenes(updater);
        onScenesChange?.(updater);
      }
    }
  }
  const [internalProps, setInternalProps] = useState([]);
  const props = (externalProps !== undefined && externalProps !== null) ? externalProps : internalProps;
  const hasExternalProps = externalProps !== undefined && externalProps !== null;
  function setProps(updater) {
    if (typeof updater === 'function') {
      if (hasExternalProps) {
        onPropsChange?.(updater);
      } else {
        setInternalProps(prev => {
          const next = updater(prev);
          onPropsChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalProps) {
        onPropsChange?.(updater);
      } else {
        setInternalProps(updater);
        onPropsChange?.(updater);
      }
    }
  }
  const [charVoices, setCharVoices] = useState(() =>
    Object.fromEntries(INITIAL_CHARS.map((c) => [c.id, c.voice]))
  );

  // 从后端数据同步 voice_id 到本地 charVoices（仅当本地无记录时）
  useEffect(() => {
    if (!externalChars || externalChars.length === 0) return;
    setCharVoices((prev) => {
      const next = { ...prev };
      let changed = false;
      externalChars.forEach((c) => {
        if (c.voice_id && prev[c.id] === undefined) {
          next[c.id] = c.voice_id;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [externalChars]);

  useEffect(() => {
    apiGetVoices({ tab: 'all' }).then((data) => {
      const list = Array.isArray(data) ? data : data?.items ?? data?.voices ?? [];
      setVoiceList(list);
    }).catch(() => {});
  }, []);

  // 组件卸载时取消进行中的批量生成流
  useEffect(() => {
    return () => {
      batchAbortRef.current?.abort();
    };
  }, []);

  // 初始化时把内部默认数据同步给父组件（仅当父组件尚未持有数据时）
  useEffect(() => {
    if (externalChars === null || externalChars === undefined) onCharsChange?.(INITIAL_CHARS);
    if (externalScenes === null || externalScenes === undefined) onScenesChange?.([]);
    if (externalProps === null || externalProps === undefined) onPropsChange?.([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 订阅主体数据后台更新（角色、场景、道具）
  useEffect(() => {
    if (!projectId) return;

    const unsubscribers = [];

    // 订阅角色缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'character'), (data) => {
      if (Array.isArray(data)) {
        const normalized = normalizeSubjectList(data);
        setChars(normalized);
      }
    }));

    // 订阅场景缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'scene'), (data) => {
      if (Array.isArray(data)) {
        const normalized = normalizeSubjectList(data);
        setScenes(normalized);
      }
    }));

    // 订阅道具缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'prop'), (data) => {
      if (Array.isArray(data)) {
        const normalized = normalizeSubjectList(data);
        setProps(normalized);
      }
    }));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [projectId]);

  // 监听资产库删除事件，刷新已打开的主体详情弹窗
  useEffect(() => {
    function handleAssetsDeleted(e) {
      if (e.detail?.projectId && e.detail.projectId !== projectId) return;
      setSubjectDetailRefreshToken(t => t + 1);
    }
    window.addEventListener('project-assets:deleted', handleAssetsDeleted);
    return () => window.removeEventListener('project-assets:deleted', handleAssetsDeleted);
  }, [projectId]);

  const counts = {
    char: chars.length,
    scene: scenes.length,
    prop: props.length,
  };

  const handleAdd = async () => {
    const type = activeTab; // 'char' | 'scene' | 'prop'
    const typeMap = { char: 'character', scene: 'scene', prop: 'prop' };
    const labelMap = { char: '角色', scene: '场景', prop: '道具' };
    const actualType = typeMap[type];
    const labelPrefix = labelMap[type];
    const num = counts[type] + 1;
    const defaultName = `${labelPrefix}${String(num).padStart(3, '0')}`;
    const defaultDesc = '自定义描述';

    const { id } = await apiCreateSubject(projectId, { type: actualType, name: defaultName, description: defaultDesc });
    if (activeTab === 'char') {
      setChars((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null, voice: null }]);
    } else if (activeTab === 'scene') {
      setScenes((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null }]);
    } else if (activeTab === 'prop') {
      setProps((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null }]);
    }
  };

  // ── 下载主体封面图 ────────────────────────────────────────────
  const handleDownloadSubjectImage = async (subjectId) => {
    try {
      // 获取主体图片列表，找到主图
      const imgRes = await apiGetSubjectImages(projectId, subjectId);
      const imgs = Array.isArray(imgRes) ? imgRes : (imgRes?.images || imgRes?.items || []);
      const primaryImg = imgs.find((img) => img.is_primary);
      const targetImg = primaryImg || imgs[0];
      if (!targetImg?.id) {
        console.warn('[SubjectPage] 没有可下载的图片');
        return;
      }
      // 调用下载 API
      const blob = await apiDownloadSubjectImage(projectId, subjectId, targetImg.id);
      triggerBlobDownload(blob, `subject-${subjectId}.jpg`);
    } catch (err) {
      console.error('[SubjectPage] 下载图片失败:', err);
    }
  };

  // ── 删除主体 ──────────────────────────────────────────────────
  const handleDeleteSubject = async (subjectId) => {
    try {
      await apiDeleteSubject(projectId, subjectId);
      setChars((prev) => prev.filter((c) => c.id !== subjectId));
      setScenes((prev) => prev.filter((s) => s.id !== subjectId));
      setProps((prev) => prev.filter((p) => p.id !== subjectId));
      setSelectedChar(null);
      setSelectedScene(null);
      setSelectedProp(null);
    } catch (err) {
      console.error('[SubjectPage] 删除主体失败:', err);
    }
  };

  useEffect(() => {
    if (chars.length > 0) onUnlockStep?.('subject');
  }, [chars.length]);

  // 滚动触底加载更多主体
  useEffect(() => {
    if (!subjectSentinelRef.current || !subjectListRef.current) return;
    const loadMore = () => {
      if (activeTab === 'char') onLoadMoreChars?.();
      else if (activeTab === 'scene') onLoadMoreScenes?.();
      else if (activeTab === 'prop') onLoadMoreProps?.();
    };
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { root: subjectListRef.current, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(subjectSentinelRef.current);
    return () => observer.disconnect();
  }, [activeTab, onLoadMoreChars, onLoadMoreScenes, onLoadMoreProps]);

  // 开始智能分镜：跳转到分镜页（由 Home 处理解锁和导航）
  const handleStartStoryboardRequest = () => {
    if (isStoryboardGenerated) {
      setConfirmStoryboardOpen(true);
      return;
    }
    onStartStoryboard?.();
  };

  // 判断是否显示 loading / 错误态
  const allEmpty = (!externalChars || externalChars.length === 0) && (!externalScenes || externalScenes.length === 0) && (!externalProps || externalProps.length === 0);
  const showLoading = isExtracting;
  const showError = !!extractError && allEmpty;

  if (showLoading) {
    return (
      <div
        style={{
          position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px',
          backgroundColor: '#161616', borderRadius: '16px',
          border: '1px solid #FFFFFF14',
        }}
      >
        <DotsLoading size={4} color="#2DC3E1" gap={4} />
        <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '12px', color: '#FFFFFF99' }}>
          {loadingTexts[loadingTextIndex]}
        </span>
      </div>
    );
  }

  if (showError) {
    return (
      <div
        style={{
          position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '24px',
          backgroundColor: '#161616', borderRadius: '16px',
          border: '1px solid #FFFFFF14',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="16" cy="16" r="15" stroke="#FFFFFF66" strokeWidth="1.5" />
          <circle cx="10" cy="13" r="2" fill="#FFFFFF66" />
          <circle cx="22" cy="13" r="2" fill="#FFFFFF66" />
          <path d="M10 23 Q16 19 22 23" stroke="#FFFFFF66" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '14px', color: '#FFFFFF99' }}>
          糟糕，提取主体失败了，待会儿再试试吧！
        </span>
        <button
          type="button"
          onClick={() => {
            setIsExtracting(true);
            onExtractSubjects?.().finally(() => setIsExtracting(false));
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '36px', borderRadius: '8px', paddingInline: '16px',
            backgroundColor: '#2DC3E1', border: '1px solid #FFFFFF33',
            cursor: 'pointer', outline: '1px solid #00000080',
            fontFamily: "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif",
            fontSize: '14px', lineHeight: '18px', color: '#090909',
          }}
        >
          重新提取主体
        </button>
      </div>
    );
  }

  return (
    <div
      className="bg-neutral-200 rounded-[16px] border border-solid border-[#FFFFFF14] overflow-hidden"
      style={{
        position: 'absolute',
        inset: 0,
        marginBottom: '24px',
        marginRight: '32px',
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Toolbar
        projectName={projectName}
        onBack={onBack}
        addLabel={`添加${TABS.find((t) => t.key === activeTab)?.label ?? '主体'}`}
        onAddChar={handleAdd}
        onBatchGen={() => setBatchGenOpen(true)}
        onStartStoryboard={handleStartStoryboardRequest}
        tabLabel={TABS.find((t) => t.key === activeTab)?.label ?? '主体'}
      />

      <TabNav
        activeTab={activeTab}
        counts={counts}
        onChange={(tab) => {
          setActiveTab(tab);
          setSelectedChar(null);
          setSelectedScene(null);
          setSelectedProp(null);
        }}
      />

      {/* card grid */}
      <div
        ref={subjectListRef}
        className="flex-1 self-stretch overflow-auto min-h-0"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', alignContent: 'flex-start', padding: '16px 2px 2px 2px' }}
      >
        {activeTab === 'char' && chars.map((char) => (
          <CharCard
            key={char.id}
            name={char.name}
            desc={char.desc}
            imageUrl={char.imageUrl}
            voice={charVoices[char.id]}
            voiceName={(() => { const v = voiceList.find(x => x.voice_id === charVoices[char.id]); return v ? v.name : undefined; })()}
            voicePreviewUrl={voiceList.find((v) => v.voice_id === charVoices[char.id])?.preview_url}
            onVoiceClick={() => setVoiceModalChar(char)}
            onClick={() => setSelectedChar(char)}
            onDownloadImage={() => handleDownloadSubjectImage(char.id)}
            onDeleteSubject={() => handleDeleteSubject(char.id)}
            loading={!!batchLoadingSubjects[char.id]}
            selected={selectedChar?.id === char.id}
          />
        ))}
        {activeTab === 'char' && <AddCard onClick={handleAdd} />}
        {activeTab === 'scene' && scenes.map((scene) => (
          <CharCard
            key={scene.id}
            name={scene.name}
            desc={scene.desc}
            imageUrl={scene.imageUrl}
            placeholderImg={scenePlaceholderImg}
            onClick={() => setSelectedScene(scene)}
            onDownloadImage={() => handleDownloadSubjectImage(scene.id)}
            onDeleteSubject={() => handleDeleteSubject(scene.id)}
            loading={!!batchLoadingSubjects[scene.id]}
            selected={selectedScene?.id === scene.id}
          />
        ))}
        {activeTab === 'scene' && <AddCard onClick={handleAdd} />}
        {activeTab === 'prop' && props.map((prop) => (
          <CharCard
            key={prop.id}
            name={prop.name}
            desc={prop.desc}
            imageUrl={prop.imageUrl}
            placeholderImg={propPlaceholderImg}
            onClick={() => setSelectedProp(prop)}
            onDownloadImage={() => handleDownloadSubjectImage(prop.id)}
            onDeleteSubject={() => handleDeleteSubject(prop.id)}
            loading={!!batchLoadingSubjects[prop.id]}
            selected={selectedProp?.id === prop.id}
          />
        ))}
        {activeTab === 'prop' && <AddCard onClick={handleAdd} />}
        {/* 滚动加载哨兵 */}
        <div ref={subjectSentinelRef} style={{ gridColumn: '1 / -1', height: '1px' }} />
        {((activeTab === 'char' && hasMoreChars) || (activeTab === 'scene' && hasMoreScenes) || (activeTab === 'prop' && hasMoreProps)) && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: '13px', color: '#FFFFFF40', fontFamily: "'AlibabaPuHuiTi_2_55_Regular',system-ui,sans-serif" }}>加载中…</span>
          </div>
        )}
      </div>

      {/* edit panel */}
      {selectedChar && (
        <EditSubjectPanel
          key={selectedChar.id}
          projectId={projectId}
          projectRatio={projectRatio}
          char={selectedChar}
          tabLabel="角色"
          refreshToken={subjectDetailRefreshToken}
          setBatchLoadingSubjects={setBatchLoadingSubjects}
          onClose={() => setSelectedChar(null)}
          onCommit={(name, desc) => {
            setChars((prev) => prev.map((c) => c.id === selectedChar.id ? { ...c, name, desc } : c));
            setSelectedChar((prev) => ({ ...prev, name, desc }));
            apiUpdateSubject(projectId, selectedChar.id, { name, description: desc });
          }}
          onCoverChange={(imageUrl) => {
            // imageUrl: 原始相对路径，用于 API；同时存储完整 URL 用于卡片展示
            const fullUrl = normalizeImageUrl(imageUrl);
            setChars((prev) => prev.map((c) => c.id === selectedChar.id ? { ...c, imageUrl: fullUrl } : c));
            apiUpdateSubject(projectId, selectedChar.id, { image_url: imageUrl });
          }}
        />
      )}
      {selectedScene && (
        <EditSubjectPanel
          key={selectedScene.id}
          projectId={projectId}
          projectRatio={projectRatio}
          char={selectedScene}
          tabLabel="场景"
          refreshToken={subjectDetailRefreshToken}
          setBatchLoadingSubjects={setBatchLoadingSubjects}
          onClose={() => setSelectedScene(null)}
          onCommit={(name, desc) => {
            setScenes((prev) => prev.map((s) => s.id === selectedScene.id ? { ...s, name, desc } : s));
            setSelectedScene((prev) => ({ ...prev, name, desc }));
            apiUpdateSubject(projectId, selectedScene.id, { name, description: desc });
          }}
          onCoverChange={(imageUrl) => {
            const fullUrl = normalizeImageUrl(imageUrl);
            setScenes((prev) => prev.map((s) => s.id === selectedScene.id ? { ...s, imageUrl: fullUrl } : s));
            apiUpdateSubject(projectId, selectedScene.id, { image_url: imageUrl });
          }}
        />
      )}
      {selectedProp && (
        <EditSubjectPanel
          key={selectedProp.id}
          projectId={projectId}
          projectRatio={projectRatio}
          char={selectedProp}
          tabLabel="道具"
          refreshToken={subjectDetailRefreshToken}
          setBatchLoadingSubjects={setBatchLoadingSubjects}
          onClose={() => setSelectedProp(null)}
          onCommit={(name, desc) => {
            setProps((prev) => prev.map((p) => p.id === selectedProp.id ? { ...p, name, desc } : p));
            setSelectedProp((prev) => ({ ...prev, name, desc }));
            apiUpdateSubject(projectId, selectedProp.id, { name, description: desc });
          }}
          onCoverChange={(imageUrl) => {
            const fullUrl = normalizeImageUrl(imageUrl);
            setProps((prev) => prev.map((p) => p.id === selectedProp.id ? { ...p, imageUrl: fullUrl } : p));
            apiUpdateSubject(projectId, selectedProp.id, { image_url: imageUrl });
          }}
        />
      )}

      {/* voice select modal */}
      {voiceModalChar && (
        <VoiceSelectModal preloadedVoices={voiceList}
          open
          currentVoice={charVoices[voiceModalChar.id]}
          onClose={() => setVoiceModalChar(null)}
          onVoicesLoaded={setVoiceList}
          onConfirm={async (voiceId) => {
            const normalizedVoiceId = voiceId || null;
            try {
              await apiUpdateSubject(projectId, voiceModalChar.id, { voice_id: normalizedVoiceId });
              setCharVoices((prev) => ({ ...prev, [voiceModalChar.id]: normalizedVoiceId }));
              setVoiceModalChar(null);
              showBatchToast('音色保存成功', 'success');
            } catch (err) {
              console.error('[SubjectPage] 更新主体音色失败:', err);
              showBatchToast(err?.message || '音色保存失败，请重试', 'error');
            }
          }}
        />
      )}

      <BatchGenerateModal
        projectRatio={projectRatio}
        open={batchGenOpen}
        onClose={() => { if (!batchGeneratingByTab[activeTab]) setBatchGenOpen(false); }}
        onConfirm={handleBatchGenerate}
        generating={!!batchGeneratingByTab[activeTab]}
        activeTab={activeTab}
      />

      {confirmStoryboardOpen && (
        <ConfirmDialog
          title="确定要重新生成分镜吗？"
          description="本次智能分镜会覆盖之前的分镜内容，一旦生成不可撤销，请谨慎操作！"
          confirmText="确定覆盖"
          cancelText="取消"
          confirmVariant="orange"
          width="360px"
          showClose={false}
          onConfirm={() => {
            setConfirmStoryboardOpen(false);
            onStartStoryboard?.();
          }}
          onCancel={() => setConfirmStoryboardOpen(false)}
        />
      )}

      {/* 批量生成 toast */}
      {batchToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
          <div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]" style={{ whiteSpace: 'nowrap' }}>
            {batchToast.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
                <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {batchToast.type === 'warning' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#EB8B14" stroke="#EB8B14" strokeWidth="1.333" strokeLinejoin="round" />
                <path fillRule="evenodd" clipRule="evenodd" d="M8 12.333C8.46 12.333 8.833 11.96 8.833 11.5C8.833 11.04 8.46 10.667 8 10.667C7.54 10.667 7.167 11.04 7.167 11.5C7.167 11.96 7.54 12.333 8 12.333Z" fill="#FFFFFF" />
                <path d="M8 4V9.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {batchToast.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round" />
                <path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
              </svg>
            )}
            <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>
              {batchToast.msg}
            </span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
