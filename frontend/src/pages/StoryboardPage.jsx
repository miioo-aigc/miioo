import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useModalSize } from '../utils/useModalSize';
import BatchDownloadModal from '../components/BatchDownloadModal';
import BatchImageModal from '../components/BatchImageModal';
import BatchVideoModal from '../components/BatchVideoModal';
import ShotViewerModal from '../components/ShotViewerModal';
import Toggle from '../components/Toggle';
import Checkbox from '../components/Checkbox';
import AssetPickerModal from '../components/AssetPickerModal';
import { apiUploadFile, apiUploadImage, apiUploadStoryboardVideo, apiUpdateStoryboard, apiGetStoryboards, apiGetTask } from '../api/storyboard';
import { apiUploadCreationImage, apiUploadCreationVideo, apiUploadCreationAudio } from '../api/creation';
import { apiListModels } from '../api/config';
import DotsLoading from '../components/DotsLoading';
import { apiGetEpisodes } from '../api/subject';
import { getImageModelParams, getVideoModelParams, getVideoModelCapabilities } from '../config';
import { normalizeImageUrl } from '../utils/imageUrl';
import ConfirmDialog from '../components/ConfirmDialog';
import { subscribe, peekCache } from '../utils/cache';
import { K, MEDIUM } from '../utils/cacheKeys';

import { FONT, FONT_MEDIUM } from '../utils/fonts';


import FrameUploadSlot from '../components/FrameUploadSlot';
import PanelUploadSlot from '../components/PanelUploadSlot';
import PanelPromptInput from '../components/PanelPromptInput';
import GenerateImagePanel from '../components/GenerateImagePanel';
import GenerateVideoPanel from '../components/GenerateVideoPanel';
import MainRefCol from '../components/MainRefCol';
import MainRefModal from '../components/MainRefModal';
import MediaCol from '../components/MediaCol';
import { getEpisodeId } from '../utils/episodeUtils';
import ShotRow from '../components/ShotRow';
import { normalizeStoryboard, toBackendStoryboard, urlPathKey, enrichMainRefs, buildPromptFromShot } from '../utils/storyboardHelpers';

import { EPISODES } from '../utils/storyboardUtils';
import EpisodeSelector from '../components/EpisodeSelector';
import GhostBtn from '../components/GhostBtn';
import PrimaryBtn from '../components/PrimaryBtn';
import SecondaryBtn from '../components/SecondaryBtn';
import { IconDownload, IconBatchImage, IconBatchVideo, IconEdit, IconPlus } from '../components/StoryboardIcons';
import { GeneratingLoadingState } from './storyboard/components';
import { GeneratingErrorState } from './storyboard/components';
import { ToastPortal } from './storyboard/components';

// ─── 集数选择器（面包屑下拉）─────────────────────────────────────────────────
import { StoryboardToolbar } from "./storyboard/components";
import { AddShotButton } from './storyboard/components';
import { GeneratingProgressBar } from './storyboard/components';
import { useDownloadMode } from './storyboard/hooks';
import { useShotOperations } from './storyboard/hooks';
import { useBatchGeneration } from './storyboard/hooks';



export default function StoryboardPage({ projectId, projectName = '两只老虎的奇遇', projectRatio, chars = [], scenes = [], props = [], episodes = EPISODES, initialEpisodeIndex = null, onUnlockStep, onVideoGenerated, onGenerateStoryboards, generateError = null, isGenerating: homeIsGenerating = false, completedEpisodesCount = 0 }) {

  const activeEpisodes = episodes.length > 0 ? episodes : EPISODES;
  // 用 peekCache 同步读取缓存，第一次渲染直接呈现旧数据，避免空状态闪烁
  const [shots, setShots] = useState(() => {
    if (!projectId) return [];
    const cachedEpisodes = episodes.length > 0
      ? episodes
      : (peekCache(K.episodes(projectId), MEDIUM.CONTENT) ?? []);
    const targetIdx = (initialEpisodeIndex != null && initialEpisodeIndex >= 0 && initialEpisodeIndex < cachedEpisodes.length)
      ? initialEpisodeIndex : 0;
    const initialEpisode = cachedEpisodes[targetIdx];
    if (!initialEpisode || typeof initialEpisode === 'string') return [];
    const episodeId = initialEpisode?.id ?? '';
    if (!episodeId) return [];
    // 先找 episode 级缓存，找不到 fallback 到 :all（:all 是项目全量分镜，同样可用）
    const raw =
      peekCache(K.storyboards(projectId, episodeId), MEDIUM.CONTENT) ??
      peekCache(K.storyboards(projectId), MEDIUM.CONTENT);
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map(be => enrichMainRefs(normalizeStoryboard(be), chars));
  });
  const [globalVoiceParams, setGlobalVoiceParams] = useState({});
  const [episode, setEpisode] = useState(() => {
    const idx = (initialEpisodeIndex != null && initialEpisodeIndex >= 0 && initialEpisodeIndex < activeEpisodes.length)
      ? initialEpisodeIndex : 0;
    return activeEpisodes[idx] ?? '第一集';
  });
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 用户是否手动操作过（添加/删除分镜），如果操作过就不再展示智能分镜失败的错误态
  const hasManuallyInteracted = useRef(false);

  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingTexts = ['正在智能分镜中', '请稍等', '等待时间大约5分钟', '请耐心等待'];

  useEffect(() => {
    if (!isGenerating && !homeIsGenerating) return;
    const timer = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % loadingTexts.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isGenerating, homeIsGenerating]);

  const [toast, setToast] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [batchExpanded, setBatchExpanded] = useState(false);
  const batchBtnRef = useRef(null);
  const { downloadMode, selectedShotIds, showDownloadModal, setShowDownloadModal, enterDownloadMode, exitDownloadMode, toggleSelectAll, toggleShotSelection, handleDownloadImages, handleDownloadVideos, handleBatchDownload } = useDownloadMode({ shots, projectId, showToast });
  const { updateShot, addShotAfter, copyShot, deleteShot, addNewShot, handleDrop } = useShotOperations({ projectId, episode, shots, setShots, chars, hasManuallyInteracted, dragId, setDragId, setOverId });
  const { generatingImages, generatingVideos, generatingImageShotIds, generatingVideoShotIds, startBatchGenImages, startBatchGenVideos, generateShotImage, generateShotVideo } = useBatchGeneration({ projectId, episode, shots, setShots, projectRatio, showToast, onVideoGenerated, activeEpisodes });
  // 单镜头生成面板
  const [imagePanel, setImagePanel] = useState(null); // { shot }
  const [videoPanel, setVideoPanel] = useState(null); // { shot }
  const [genImageHistoryMap, setGenImageHistoryMap] = useState({}); // { [shotId]: generatedImages[] }
  const [genVideoHistoryMap, setGenVideoHistoryMap] = useState({}); // { [shotId]: generatedVideos[] }

  // 页面加载时从后端获取剧本数据
  useEffect(() => {
    if (!projectId) return;
    if (typeof episode === 'string') return;

    const episodeId = getEpisodeId(episode);
    if (!episodeId) return;

    // 优先订阅带 episodeId 的 key，fallback 订阅 :all
    const cacheKey = K.storyboards(projectId, episodeId);
    const cacheKeyAll = K.storyboards(projectId);

    const normalizeShots = (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(be => enrichMainRefs(normalizeStoryboard(be), chars))
        .map((s, i) => ({ ...s, number: i + 1 }));
    };

    apiGetStoryboards(projectId, { episode_id: episodeId })
      .then((data) => {
        if (!Array.isArray(data)) return;
        const normalized = normalizeShots(data);
        if (normalized.length > 0) {
          // 有数据：直接覆盖（正常加载 / 刷新场景）
          setShots(normalized);
        } else {
          // 空数组：只有在当前 shots 也为空时才清空，避免剧本定稿后
          // episode ID 变更导致 API 用新 ID 查不到数据而误清已有分镜
          setShots((prev) => (prev.length > 0 ? prev : normalized));
        }
      })
      .catch((err) => {
        console.error('[StoryboardPage] 加载剧本失败:', err);
      });

    const unsub1 = subscribe(cacheKey, (data) => {
      if (!Array.isArray(data)) return;
      const normalized = normalizeShots(data);
      if (normalized.length > 0) {
        setShots(normalized);
      } else {
        setShots((prev) => (prev.length > 0 ? prev : normalized));
      }
    });
    const unsub2 = subscribe(cacheKeyAll, (data) => {
      if (!Array.isArray(data)) return;
      const normalized = normalizeShots(data);
      if (normalized.length > 0) {
        setShots(normalized);
      } else {
        setShots((prev) => (prev.length > 0 ? prev : normalized));
      }
    });

    return () => { unsub1(); unsub2(); };
  }, [projectId, episode?.id, chars]);

  useEffect(() => {
    if (activeEpisodes.length > 0 && !activeEpisodes.some(ep => getEpisodeId(ep) === getEpisodeId(episode))) {
      setEpisode(activeEpisodes[0]);
    }
  }, [activeEpisodes]);

  // episode 还是字符串（episodes prop 尚未到位）时，订阅 :all key
  // 一旦有数据写入就尝试把 episode 切换到真实对象
  useEffect(() => {
    if (typeof episode !== 'string') return;
    if (!projectId) return;
    const unsub = subscribe(K.storyboards(projectId), (data) => {
      if (activeEpisodes.length > 0) {
        setEpisode(activeEpisodes[0]);
      }
    });
    return unsub;
  }, [projectId, episode, activeEpisodes]);

  useEffect(() => {
    if (!batchExpanded) return;
    function handleMouseDown(e) {
      if (batchBtnRef.current && !batchBtnRef.current.contains(e.target)) {
        setBatchExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [batchExpanded]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // 轮询任务直到完成或超时

  function handleStartEdit() {
    showToast('剪辑功能即将上线', 'warning');
  }

  useEffect(() => {
    if (shots.length > 0) onUnlockStep?.('storyboard');
  }, [shots.length]);

  // 判断是否显示 loading / 错误态
  // homeIsGenerating 期间如果已有分镜数据，直接展示数据，不再显示全屏 loading
  const showGeneratingLoading = (isGenerating || homeIsGenerating) && shots.length === 0;
  const showGeneratingError = !!generateError && shots.length === 0 && !hasManuallyInteracted.current;

  if (showGeneratingLoading) {
    return (<GeneratingLoadingState loadingText={loadingTexts[loadingTextIndex]} />);
  }

  if (showGeneratingError) {
    return (
      <GeneratingErrorState
        onRetry={() => {
          setIsGenerating(true);
          onGenerateStoryboards?.().finally(() => setIsGenerating(false));
        }}
        onAddManual={addNewShot}
      />
    );
  }

  return (
    <>
    <div style={{
      position: 'absolute',
      inset: 0,
      marginBottom: '24px',
      marginRight: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      backgroundColor: '#161616',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '24px',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      <StoryboardToolbar
        projectName={projectName}
        activeEpisodes={activeEpisodes}
        episode={episode}
        setEpisode={setEpisode}
        homeIsGenerating={homeIsGenerating}
        shotsLength={shots.length}
        completedEpisodesCount={completedEpisodesCount}
        totalEpisodes={activeEpisodes.length}
        batchBtnRef={batchBtnRef}
        downloadMode={downloadMode}
        selectedShotIds={selectedShotIds}
        toggleSelectAll={toggleSelectAll}
        handleDownloadImages={handleDownloadImages}
        handleDownloadVideos={handleDownloadVideos}
        exitDownloadMode={exitDownloadMode}
        batchExpanded={batchExpanded}
        setBatchExpanded={setBatchExpanded}
        setShowImageModal={setShowImageModal}
        setShowVideoModal={setShowVideoModal}
        generatingImages={generatingImages}
        generatingVideos={generatingVideos}
        enterDownloadMode={enterDownloadMode}
        handleStartEdit={handleStartEdit}
      />
      {/* 分镜列表 */}
      <div
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}
        onDragEnd={() => { setDragId(null); setOverId(null); }}
      >
        {/* top sentinel — drop zone for placing before the first card */}
        {dragId && (
          <div
            style={{ height: '8px', flexShrink: 0, marginBottom: '-8px' }}
            onDragOver={(e) => { e.preventDefault(); setOverId('__before_first'); }}
            onDrop={(e) => { e.preventDefault(); handleDrop('__before_first'); }}
          />
        )}
        {shots.map((shot, idx) => (
          <ShotRow
            key={shot.id}
            shot={shot}
            projectId={projectId}
            onChange={(next) => updateShot(shot.id, next)}
            onAdd={() => addShotAfter(shot.id)}
            onCopy={() => copyShot(shot.id)}
            onDelete={() => deleteShot(shot.id)}
            chars={chars}
            isDragging={dragId === shot.id}
            insertBefore={(overId === shot.id || (overId === '__before_first' && idx === 0)) && dragId !== shot.id}
            insertAfter={overId === '__after_last' && idx === shots.length - 1 && dragId !== shot.id}
            onDragStart={() => setDragId(shot.id)}
            onDragOver={() => { if (dragId && dragId !== shot.id) setOverId(shot.id); }}
            onDrop={() => handleDrop(shot.id)}
            onGenerateImage={() => {
              // 打开面板前，检查历史列表是否已初始化，若为空则用定稿结果初始化
              setGenImageHistoryMap((prev) => {
                const shotId = shot.id;
                if (!prev[shotId] || prev[shotId].length === 0) {
                  const initialized = { ...prev };
                  if (shot.storyboardImage?.url) {
                    initialized[shotId] = [{ url: shot.storyboardImage.url, settled: true, id: shot.storyboardImage.id }];
                  } else {
                    initialized[shotId] = [];
                  }
                  return initialized;
                }
                return prev;
              });
              setImagePanel({ shot });
            }}
            onGenerateVideo={() => {
              // 打开面板前，检查历史列表是否已初始化，若为空则用定稿结果初始化
              setGenVideoHistoryMap((prev) => {
                const shotId = shot.id;
                if (!prev[shotId] || prev[shotId].length === 0) {
                  const initialized = { ...prev };
                  if (shot.storyboardVideo?.url) {
                    initialized[shotId] = [{ url: shot.storyboardVideo.url, settled: true, id: shot.storyboardVideo.id }];
                  } else {
                    initialized[shotId] = [];
                  }
                  return initialized;
                }
                return prev;
              });
              setVideoPanel({ shot, nextShot: shots[idx + 1] ?? null });
            }}
            globalVoiceParams={globalVoiceParams}
            onSaveGlobalVoice={(role, params) => setGlobalVoiceParams((prev) => ({ ...prev, [role]: params }))}
            generatingImage={generatingImageShotIds.has(shot.id)}
            generatingVideo={generatingVideoShotIds.has(shot.id)}
            isSelectMode={downloadMode}
            isSelected={selectedShotIds.has(shot.id)}
            onToggleSelect={() => toggleShotSelection(shot.id)}
          />
        ))}
        {/* bottom sentinel — drop zone for placing after the last card */}
        {dragId && (
          <div
            style={{ height: '40px', flexShrink: 0 }}
            onDragOver={(e) => { e.preventDefault(); setOverId('__after_last'); }}
            onDrop={(e) => { e.preventDefault(); handleDrop('__after_last'); }}
          />
        )}

        <AddShotButton onClick={addNewShot} />
      </div>
    </div>
    {showImageModal && (
      <BatchImageModal
        shotCount={shots.length}
        onClose={() => setShowImageModal(false)}
        onConfirm={(params) => startBatchGenImages(params)}
      />
    )}
    {showVideoModal && (
      <BatchVideoModal
        shotCount={shots.length}
        onClose={() => setShowVideoModal(false)}
        onConfirm={(params) => startBatchGenVideos(params)}
      />
    )}
    {showDownloadModal && (
      <BatchDownloadModal
        shots={shots}
        onClose={() => setShowDownloadModal(false)}
        onConfirm={(items) => {
          items.forEach(({ url, name }) => {
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          });
          if (items.length > 0) showToast(`已下载 ${items.length} 个素材`, 'success');
        }}
      />
    )}
    {imagePanel && (
      <GenerateImagePanel
        shot={imagePanel.shot}
        chars={chars}
        projectId={projectId}
        scenes={scenes}
        props={props}
        generatedImages={genImageHistoryMap[imagePanel.shot?.id] ?? []}
        onSetGeneratedImages={(updater) => {
          const shotId = imagePanel.shot?.id;
          setGenImageHistoryMap((prev) => ({
            ...prev,
            [shotId]: typeof updater === 'function' ? updater(prev[shotId] ?? []) : updater,
          }));
        }}
        onClose={() => setImagePanel(null)}
        onShowToast={showToast}
       onSettleImage={(imageUrl) => {
         const n = normalizeImageUrl(imageUrl);
         setShots((prev) => {
           const updated = prev.map((s) => s.id === imagePanel.shot.id
             ? { ...s, storyboardImage: { id: n, url: n, name: '分镜图', type: 'image/jpeg' } }
             : s
           );
           apiUpdateStoryboard(projectId, imagePanel.shot.id, toBackendStoryboard(updated.find(s => s.id === imagePanel.shot.id))).catch(console.error);
           return updated;
         });
       }}
      onGenerate={async (params) => {
        return generateShotImage(imagePanel.shot.id, {
          model: params.model, resolution: params.resolution, prompt: params.prompt,
          refImages: params.refImages,
        });
      }}
      />
    )}
    {videoPanel && (
      <GenerateVideoPanel
        shot={videoPanel.shot}
        projectId={projectId}
        nextShot={videoPanel.nextShot}
        chars={chars}
        scenes={scenes}
        props={props}
        generatedVideos={genVideoHistoryMap[videoPanel.shot?.id] ?? []}
        onSetGeneratedVideos={(updater) => {
          const shotId = videoPanel.shot?.id;
          setGenVideoHistoryMap((prev) => ({
            ...prev,
            [shotId]: typeof updater === 'function' ? updater(prev[shotId] ?? []) : updater,
          }));
        }}
        onClose={() => setVideoPanel(null)}
        onShowToast={showToast}
        onSettleVideo={(videoUrl) => {
          const n = normalizeImageUrl(videoUrl);
          const shotId = videoPanel.shot.id;
          setShots((prev) => {
            const updated = prev.map((s) => s.id === shotId
              ? { ...s, storyboardVideo: { id: n, url: n, name: 'generated.mp4', type: 'video/mp4' } }
              : s
            );
            return updated;
          });
          // API 调用放在 setShots 外面，避免在 state updater 内产生副作用
          apiUpdateStoryboard(projectId, shotId, { video_url: n })
            .then((res) => console.log('[onSettleVideo] video_url 保存成功，后端返回:', JSON.stringify(res)))
            .catch((err) => console.error('[onSettleVideo] video_url 保存失败', err));
        }}
       onGenerate={async (params) => {
        return generateShotVideo(videoPanel.shot.id, {
          model: params.model, resolution: params.resolution, duration: params.duration,
          sound: params.sound, prompt: params.prompt, refImages: params.refImages,
          firstFrameUrl: params.first_frame_url, lastFrameUrl: params.last_frame_url,
          refVideoUrl: params.reference_video_url, refAudioUrl: params.reference_audio_url,
        });
      }}
      />
    )}
    <ToastPortal toast={toast} />
  </>
  );
}
