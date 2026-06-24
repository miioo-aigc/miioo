import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FONT, FONT_MEDIUM } from '../utils/fonts';
import { normalizeImageUrl } from '../utils/imageUrl';
import { buildPromptFromShot } from '../utils/storyboardHelpers';
import { apiUploadStoryboardVideo } from '../api/storyboard';
import { apiUploadCreationImage, apiUploadCreationVideo, apiUploadCreationAudio } from '../api/creation';
import { apiListModels } from '../api/config';
import { getVideoModelCapabilities } from '../config';
import PanelPromptInput from './PanelPromptInput';
import PanelSelect from './PanelSelect';
import FrameUploadSlot from './FrameUploadSlot';
import PanelUploadSlot from './PanelUploadSlot';
import VideoUploadCard from './VideoUploadCard';
import VideoItem from './VideoItem';
import ShotViewerModal from './ShotViewerModal';
import ModalCloseBtn from './ModalCloseBtn';
import SpinnerIcon from './SpinnerIcon';
import Toggle from './Toggle';

export default function GenerateVideoPanel({ shot, projectId, nextShot = null, chars = [], scenes = [], props = [], onClose, onGenerate, onShowToast, onSettleVideo, generatedVideos = [], onSetGeneratedVideos }) {
  const [tab, setTab] = useState('all');
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [frameModels, setFrameModels] = useState([]);
  const [allModels, setAllModels] = useState([]);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'video' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        const merged = list.map((m) => {
          const modelId = m.model_id || m.id;
          return { value: modelId, label: m.name || modelId, capabilities: m.capabilities || {}, is_default: m.is_default };
        });

        const frameModes = ['first_frame', 'last_frame', 'start_end', 'multiframe'];
        const isFrameModel = (m) => {
          const refs = m.capabilities?.reference_modes || [];
          return refs.some(r => frameModes.includes(r));
        };
        const frameModels = merged.filter(isFrameModel);
        const isAllRefModel = (m) => {
          const refs = m.capabilities?.reference_modes || [];
          if (refs.length === 0) return true;
          return refs.some(r => !frameModes.includes(r));
        };
        const allModels = merged.filter(isAllRefModel);

        setModelList(merged);
        setFrameModels(frameModels);
        setAllModels(allModels);

        if (allModels.length > 0) {
          const first = allModels.find(m => m.is_default) || allModels[0];
          setModel(first.value);
          const caps = first.capabilities;
          {
            const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
            if (resList.length > 0) setResolution(resList[0]);
          }
          {
            const durList = caps?.supported_durations;
            if (durList?.length > 0) setDuration(`${durList[0]}s`);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);
  const [duration, setDuration] = useState(null);
  const [sound, setSound] = useState(true);
  const [prompt, setPrompt] = useState(() => buildPromptFromShot(shot));
  const promptRef = useRef(null);
  const [refSubjects, setRefSubjects] = useState(() => {
    if (!shot?.mainRefs?.length) return [];
    return shot.mainRefs.map(ref => {
      if (ref?.url) return ref;
      if (ref?.type && ref?.id) {
        const subjects = ref.type === 'char' ? chars : ref.type === 'scene' ? scenes : props;
        const found = subjects?.find(s => s.id === ref.id);
        if (found?.imageUrl) return { ...ref, url: normalizeImageUrl(found.imageUrl), name: found.name };
      }
      return ref;
    }).filter(ref => ref?.url);
  });
  const [refImages, setRefImages] = useState([]);
  const [refVideo, setRefVideo] = useState(null);
  const [refAudio, setRefAudio] = useState(null);
  const [refFirstFrame, setRefFirstFrame] = useState(null);
  const [refLastFrame, setRefLastFrame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [btnHov, setBtnHov] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);
  const [viewerShot, setViewerShot] = useState(null);

  const tabModels = useMemo(() => {
    return tab === 'frame' ? frameModels : allModels;
  }, [tab, frameModels, allModels]);

  const currentVideoModel = useMemo(() => tabModels.find(m => m.value === model), [model, tabModels]);
  function handleTabChange(newTab) {
    setTab(newTab);
    const newList = newTab === 'frame' ? frameModels : allModels;
    if (newList.length > 0) {
      const inList = newList.some(m => m.value === model);
      let targetModel = model;
      if (!inList) {
        targetModel = newList[0].value;
        setModel(targetModel);
      }
      const target = newList.find(m => m.value === targetModel);
      {
        const caps = target?.capabilities;
        const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
        if (resList.length > 0) setResolution(resList[0]);
        const durList = caps?.supported_durations;
        if (durList?.length > 0) setDuration(`${durList[0]}s`);
      }
    }
  }

  const availableResolutions = (() => {
    const caps = currentVideoModel?.capabilities || {};
    return (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
  })();

  const availableDurations = useMemo(() => {
    const caps = currentVideoModel?.capabilities;
    if (caps?.supported_durations?.length > 0) {
      return caps.supported_durations.map(d => `${d}s`);
    }
    const range = caps?.supported_duration_range;
    if (range && range.length === 2) {
      const [min, max] = range;
      return Array.from({ length: max - min + 1 }, (_, i) => `${min + i}s`);
    }
    return [];
  }, [currentVideoModel]);

  const localVideoCaps = useMemo(() => getVideoModelCapabilities(model), [model]);
  const videoCaps = useMemo(() => currentVideoModel?.capabilities || {}, [currentVideoModel]);
  const maxRefImages = videoCaps.max_reference_images ?? null;
  const maxRefVideos = videoCaps.max_reference_videos ?? null;
  const maxRefAudios = videoCaps.max_reference_audios ?? null;
  const showRefVideo = maxRefVideos === null || maxRefVideos > 0;
  const showRefAudio = maxRefAudios === null || maxRefAudios > 0;
  const showRefImages = maxRefImages === null || maxRefImages > 0;
  const showRefSubjects = showRefImages && (
    videoCaps.supports_reference_subjects === true ||
    (videoCaps.supported_generation_modes || []).includes('full') ||
    (videoCaps.supported_generation_modes || []).includes('reference_subjects')
  );
  const imageCount = (showRefSubjects ? refSubjects.length : 0) + refImages.length;
  const canAddImage = maxRefImages === null || imageCount < maxRefImages;
  const imageCountLabel = maxRefImages != null ? `${imageCount}/${maxRefImages}` : null;
  const videoCountLabel = maxRefVideos != null ? `${refVideo ? 1 : 0}/${maxRefVideos}` : null;
  const audioCountLabel = maxRefAudios != null ? `${refAudio ? 1 : 0}/${maxRefAudios}` : null;

  useEffect(() => {
    if (availableResolutions.length > 0) {
      if (!availableResolutions.includes(resolution)) {
        setResolution(availableResolutions[0]);
      }
    }
    if (duration && availableDurations.length > 0 && !availableDurations.includes(duration)) {
      setDuration(availableDurations[0]);
    }
  }, [model, availableResolutions]);

  const videoReferenceItems = useMemo(() => {
    const items = [];
    refSubjects.forEach(s => {
      items.push({ id: s.id, name: s.name || '参考主体', _type: s._type || s.type || 'char' });
    });
    refImages.forEach(img => {
      items.push({ id: img.id, name: img.name || (img.url ? img.url.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图' : '参考图'), _type: 'image' });
    });
    if (refVideo) {
      items.push({ id: refVideo.id, name: refVideo.name || '参考视频', _type: 'video' });
    }
    if (refAudio) {
      items.push({ id: refAudio.id, name: refAudio.name || '参考音频', _type: 'audio' });
    }
    return items;
  }, [refSubjects, refImages, refVideo, refAudio]);

  async function handleRefMediaUpload(file, type = 'image') {
    try {
      const uploadFn = type === 'audio' ? apiUploadCreationAudio
                     : type === 'video' ? apiUploadCreationVideo
                     : apiUploadCreationImage;
      const result = await uploadFn({
        file,
        category: 'reference',
        project_id: projectId,
      });
      const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';
      return { id: result.id || result.asset_id || uploadedUrl, url: uploadedUrl, name: file.name, type: file.type };
    } catch (error) {
      console.error('参考媒体上传失败:', error);
      onShowToast?.('参考图上传失败', 'error');
      throw error;
    }
  }

  async function handleGenerate() {
    if (loading) return;
    setLoading(true);
    const placeholder = `pending-${Date.now()}`;
    onSetGeneratedVideos?.((prev) => [{ url: null, settled: false, id: placeholder }, ...prev]);
    try {
      const maxRefImages = currentVideoModel?.capabilities?.max_reference_images ?? null;
      const referenceImages = (maxRefImages === null || maxRefImages > 0)
        ? [...refSubjects, ...refImages].map(r => r.url).filter(Boolean).slice(0, maxRefImages ?? 99)
        : [];
      const result = await onGenerate?.({
        model,
        resolution,
        duration,
        sound,
        prompt,
        reference_images: referenceImages.length > 0 ? referenceImages : undefined,
        first_frame_url: refFirstFrame?.url,
        last_frame_url: refLastFrame?.url,
        reference_video_url: refVideo?.url,
        reference_audio_url: refAudio?.url,
      });
      onSetGeneratedVideos?.((prev) =>
        prev.map((item) => item.id === placeholder ? { ...item, url: result?.url ?? null } : item)
      );
      onShowToast?.('视频生成成功', 'success');
    } catch (err) {
      onSetGeneratedVideos?.((prev) => prev.filter((item) => item.id !== placeholder));
      const status = err?.status;
      const msg = err?.message || '';
      if (status === 502 || status === 504 || msg.includes('fetch') || msg.includes('Network')) {
        onShowToast?.('生成服务暂时不可用，请稍后重试', 'error');
      } else if (status === 429) {
        onShowToast?.('生成请求过于频繁，请稍后再试', 'error');
      } else if (status === 401 || status === 403) {
        onShowToast?.('登录已过期，请重新登录', 'error');
      } else if (status === 422) {
        onShowToast?.('生成参数有误，请检查后重试', 'error');
      } else if (status) {
        onShowToast?.(`生成失败（${status}），请稍后重试`, 'error');
      } else {
        onShowToast?.('生成失败，请检查网络连接后重试', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  const btnBg = loading ? 'rgba(45,195,225,0.60)' : btnPressed ? '#28b0cc' : btnHov ? '#32cde8' : '#2DC3E1';

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'auto' }}
        onMouseDown={onClose}
      />
      <div
        style={{
          position: 'fixed', right: '24px', top: '60px', bottom: '24px',
          width: '600px', zIndex: 901,
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#161616',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-10px 24px 64px rgba(0,0,0,0.60)',
          animation: 'slideInRight 220ms cubic-bezier(0.22,1,0.36,1) forwards',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>生成分镜视频</span>
          <ModalCloseBtn onClick={onClose} />
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '419px', flexShrink: 0, padding: '8px 12px 80px 24px', gap: '20px', overflowY: 'auto' }}>
            <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.80)", fontFamily: FONT }}>分镜{String(shot?.number ?? 1).padStart(2, "0")}</span>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', alignSelf: 'stretch' }}>
              <div
                onClick={() => handleTabChange('all')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <span style={{
                  fontSize: '14px', lineHeight: '18px',
                  color: tab === 'all' ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
                  fontFamily: tab === 'all' ? FONT_MEDIUM : FONT,
                  fontWeight: tab === 'all' ? 500 : 400,
                  transition: 'color 0.12s',
                }}>
                  全能参考
                </span>
                {tab === 'all' && (
                  <div style={{ height: '2px', alignSelf: 'stretch', backgroundColor: '#DDDDDD', flexShrink: 0 }} />
                )}
              </div>
              <div
                onClick={() => handleTabChange('frame')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <span style={{
                  fontSize: '14px', lineHeight: '18px',
                  color: tab === 'frame' ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
                  fontFamily: tab === 'frame' ? FONT_MEDIUM : FONT,
                  fontWeight: tab === 'frame' ? 500 : 400,
                  transition: 'color 0.12s',
                }}>
                  首尾帧
                </span>
                {tab === 'frame' && (
                  <div style={{ height: '2px', alignSelf: 'stretch', backgroundColor: '#DDDDDD', flexShrink: 0 }} />
                )}
              </div>
            </div>

            <PanelPromptInput ref={promptRef} value={prompt} onChange={setPrompt} referenceItems={videoReferenceItems} />

            <PanelSelect label="选择模型" value={modelsLoading ? '加载中...' : (tabModels.find(m => m.value === model)?.label || '请选择')} options={tabModels.map(m => m.label)} onChange={(label) => {
              const selected = tabModels.find(m => m.label === label);
              if (selected) setModel(selected.value);
            }} />

            {tab === 'all' && (
              <>
                {showRefSubjects && <PanelUploadSlot projectId={projectId} label="参考主体" countLabel={imageCountLabel} accept="image/*" mediaList={refSubjects} canAddMore={canAddImage} onUpload={async (media) => {
                  if (media.id?.startsWith('blob:')) {
                    try {
                      const response = await fetch(media.url);
                      const blob = await response.blob();
                      const file = new File([blob], media.name, { type: media.type });
                      const uploaded = await handleRefMediaUpload(file, 'image');
                      setRefSubjects(prev => [...prev, uploaded]);
                    } catch (error) {}
                  } else {
                    setRefSubjects(prev => [...prev, media]);
                  }
                }} onRemove={() => setRefSubjects([])} onRemoveItem={(idx) => setRefSubjects(prev => prev.filter((_, i) => i !== idx))} onAssetConfirm={(selectedAssets) => {
                  if (!selectedAssets?.length) return;
                  const newItems = selectedAssets.map(a => ({
                    id: a.id,
                    assetId: a.id,
                    url: normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url),
                    name: a.name || a.filename || '',
                  }));
                  setRefSubjects(prev => {
                    const merged = [...prev, ...newItems];
                    return maxRefImages != null ? merged.slice(0, maxRefImages) : merged;
                  });
                }} />}
                {showRefImages && <PanelUploadSlot projectId={projectId} label="参考图" countLabel={imageCountLabel} accept="image/*" mediaList={refImages} canAddMore={canAddImage} onUpload={async (media) => {
                  if (media.id?.startsWith('blob:')) {
                    try {
                      const response = await fetch(media.url);
                      const blob = await response.blob();
                      const file = new File([blob], media.name, { type: media.type });
                      const uploaded = await handleRefMediaUpload(file, 'image');
                      setRefImages(prev => [...prev, uploaded]);
                    } catch (error) {}
                  } else {
                    setRefImages(prev => [...prev, media]);
                  }
                }} onRemove={() => setRefImages([])} onRemoveItem={(idx) => setRefImages(prev => prev.filter((_, i) => i !== idx))} onAssetConfirm={(selectedAssets) => {
                  if (!selectedAssets?.length) return;
                  const newItems = selectedAssets.map(a => ({
                    id: a.id,
                    assetId: a.id,
                    url: normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url),
                    name: a.name || a.filename || '',
                  }));
                  setRefImages(prev => {
                    const merged = [...prev, ...newItems];
                    return maxRefImages != null ? merged.slice(0, maxRefImages) : merged;
                  });
                }} />}
                {showRefVideo && (
                <PanelUploadSlot projectId={projectId} label="参考视频" countLabel={videoCountLabel} accept="video/mp4,video/quicktime" media={refVideo} onUpload={async (media) => {
                  if (media.id?.startsWith('blob:')) {
                    try {
                      const response = await fetch(media.url);
                      const blob = await response.blob();
                      const file = new File([blob], media.name, { type: media.type });
                      const uploaded = await handleRefMediaUpload(file, 'video');
                      setRefVideo(uploaded);
                    } catch (error) {}
                  } else {
                    setRefVideo(media);
                  }
                }} onRemove={() => setRefVideo(null)} onAssetConfirm={(assets) => {
                  const a = assets[0];
                  if (!a) return;
                  setRefVideo({ id: a.id, url: a.fileUrl || a.url, name: a.name || '参考视频', type: 'video/mp4' });
                }} onInsert={(media) => {
                  const name = media.name || '参考视频';
                  promptRef.current?.insertMention(name, 'video');
                }} />
                )}
                {showRefAudio && (
                <PanelUploadSlot projectId={projectId} label="参考音频" countLabel={audioCountLabel} accept="audio/mpeg,audio/wav" media={refAudio} onUpload={async (media) => {
                  if (media.id?.startsWith('blob:')) {
                    try {
                      const response = await fetch(media.url);
                      const blob = await response.blob();
                      const file = new File([blob], media.name, { type: media.type });
                      const uploaded = await handleRefMediaUpload(file, 'audio');
                      setRefAudio(uploaded);
                    } catch (error) {}
                  } else {
                    setRefAudio(media);
                  }
                }} onRemove={() => setRefAudio(null)} onAssetConfirm={(assets) => {
                  const a = assets[0];
                  if (!a) return;
                  setRefAudio({ id: a.id, url: a.fileUrl || a.url, name: a.name || '参考音频', type: 'audio/mpeg' });
                }} onInsert={(media) => {
                  const name = media.name || '参考音频';
                  promptRef.current?.insertMention(name, 'audio');
                }} />
                )}
              </>
            )}

            {tab === 'frame' && (
              <>
                <FrameUploadSlot
                  label="首帧图"
                  media={refFirstFrame}
                  onUpload={setRefFirstFrame}
                  onRemove={() => setRefFirstFrame(null)}
                  shortcutLabel="使用当前分镜图"
                  shortcutImage={shot?.storyboardImage ?? null}
                  shortcutTooltip="当前分镜尚未生成分镜图"
                  projectId={projectId}
                />
                <FrameUploadSlot
                  label="尾帧图（可选）"
                  media={refLastFrame}
                  onUpload={setRefLastFrame}
                  onRemove={() => setRefLastFrame(null)}
                  shortcutLabel="使用下一分镜图"
                  shortcutImage={nextShot?.storyboardImage ?? null}
                  shortcutTooltip="下一分镜尚未生成分镜图"
                  projectId={projectId}
                />
              </>
            )}

            <PanelSelect label="时长" value={duration} options={availableDurations.length > 0 ? availableDurations : ['5s']} onChange={setDuration} />
            <PanelSelect label="分辨率" value={resolution} options={availableResolutions} onChange={setResolution} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>音效</span>
              <Toggle value={sound} onChange={setSound} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
            <VideoUploadCard
              projectId={projectId}
              onUpload={async (file) => {
                try {
                  const result = await apiUploadStoryboardVideo(projectId, shot.id, file);
                  const videoUrl = result.video_url || result.videoUrl;
                  if (videoUrl) { const nu = normalizeImageUrl(videoUrl); onSetGeneratedVideos?.((prev) => [{ url: nu, settled: false, id: result.id || nu }, ...prev]); onSettleVideo?.(nu, null); }
                } catch {
                  onShowToast?.('视频上传失败，请重试', 'error');
                }
              }}
              onAssetSelect={(assets) => {
                const newItems = assets.map(a => {
                  const url = normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.file_url || a.url);
                  return url ? { url, settled: false, id: a.id || a.asset_id || url } : null;
                }).filter(Boolean);
                onSetGeneratedVideos?.(prev => [...newItems, ...prev]);
              }}
            />
            {generatedVideos.map((vid, i) => (
              <VideoItem
                key={vid.id || vid.url || i}
                videoUrl={vid.url}
                settled={vid.settled}
                onSettledChange={(newSettled) => {
                  onSetGeneratedVideos?.((prev) =>
                    prev.map((item, idx) => idx === i ? { ...item, settled: newSettled } : { ...item, settled: newSettled ? false : item.settled })
                  );
                  if (newSettled && vid.url) onSettleVideo?.(vid.url);
                }}
                onView={(url) => setViewerShot({
                  videoUrl: url,
                  filename: vid.name,
                  label: `镜头 ${String(shot?.number ?? 1).padStart(2, '0')}`,
                  prompt,
                  model,
                  resolution,
                  duration: undefined,
                  aspectRatio: '16:9',
                  finalized: vid.settled,
                })}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '419px',
            padding: '16px 24px',
            background: '#161616',
            borderBottomLeftRadius: '16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            onClick={loading ? undefined : handleGenerate}
            onMouseEnter={() => !loading && setBtnHov(true)}
            onMouseLeave={() => { setBtnHov(false); setBtnPressed(false); }}
            onMouseDown={() => !loading && setBtnPressed(true)}
            onMouseUp={() => setBtnPressed(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', height: '36px', borderRadius: '8px', paddingInline: '16px', gap: '4px',
              backgroundColor: btnBg,
              backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
              backgroundOrigin: 'border-box',
              border: '1px solid #FFFFFF33', outline: '1px solid #00000080',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.10s',
              flexShrink: 0,
            }}
          >
            {loading ? (
              <SpinnerIcon color="#090909" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12.333 2.333H3.667V13.667H12.333V2.333Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.667 3.667H1.333V12.333H3.667V3.667Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14.667 3.667H12.333V12.333H14.667V3.667Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7.333 6.667L9.333 8L7.333 9.333V6.667Z" fill="#090909" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: FONT_MEDIUM, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {loading ? '生成中…' : '生成分镜视频'}
            </span>
          </div>
        </div>
      </div>
      {viewerShot && <ShotViewerModal shot={viewerShot} onClose={() => setViewerShot(null)} />}
    </>,
    document.body
  );
}
