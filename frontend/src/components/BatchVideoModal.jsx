import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { FONT, FONT_MEDIUM } from '../utils/fonts';
import { apiListModels } from '../api/config';
import { getVideoModelCapabilities } from '../config';
import ModalOverlay from './ModalOverlay';
import ModalCloseBtn from './ModalCloseBtn';
import ModalSelect from './ModalSelect';
import ModalPrimaryBtn from './ModalPrimaryBtn';
import ModalGhostBtn from './ModalGhostBtn';
import Toggle from './Toggle';

function BatchVideoModal({ shotCount, onClose, onConfirm }) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [resolution, setResolution] = useState('');
  const [duration, setDuration] = useState('');
  const [sound, setSound] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'video' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        const merged = list.map((m) => {
          const modelId = m.model_id || m.id;
          const name = m.name || '';
          const caps = m.capabilities || {};
          const resolutions = (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
          let durationRange = null;
          const durArr = caps.supported_durations || [];
          if (durArr.length > 0) durationRange = durArr.map(d => String(d).endsWith('s') ? String(d) : String(d) + 's');
          if (!durationRange) durationRange = caps.supported_duration_range || null;
          if (!durationRange) {
            const localCaps = getVideoModelCapabilities(modelId);
            if (localCaps?.outputVideo?.durationRange) durationRange = localCaps.outputVideo.durationRange;
          }
          return { value: modelId, label: name || modelId, capabilities: caps, resolutions, durationRange, is_default: m.is_default };
        });
        setModelList(merged);
        if (merged.length > 0) {
          const first = merged.find(m => m.is_default) || merged[0];
          setModel(first.value);
          if (first.resolutions.length > 0) {
            setResolution(first.resolutions[0]);
          }
          if (first.durationRange) {
            setDuration(Array.isArray(first.durationRange) ? first.durationRange[0] : `${first.durationRange[0]}s`);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);

  const resolutionOptions = useMemo(() => {
    const selected = modelList.find(m => m.value === model);
    return selected?.resolutions || [];
  }, [model, modelList]);

  const durationOptions = useMemo(() => {
    const selected = modelList.find(m => m.value === model);
    if (!selected?.durationRange) return [];
    if (Array.isArray(selected.durationRange)) return selected.durationRange;
    const [min, max] = selected.durationRange;
    return Array.from({ length: max - min + 1 }, (_, i) => `${min + i}s`);
  }, [model, modelList]);

  const handleModelChange = useCallback((label) => {
    const selected = modelList.find(m => m.label === label);
    if (!selected) return;
    setModel(selected.value);
    const resList = selected.resolutions;
    if (resList.length > 0) {
      setResolution(resList.includes(resolution) ? resolution : resList[0]);
    }
    if (selected.durationRange) {
      if (Array.isArray(selected.durationRange)) {
        if (!selected.durationRange.includes(duration)) setDuration(selected.durationRange[0]);
      } else {
        const durSec = parseInt(duration);
        const [minDur, maxDur] = selected.durationRange;
        if (!isNaN(durSec) && durSec >= minDur && durSec <= maxDur) {
          setDuration(duration);
        } else {
          setDuration(`${minDur}s`);
        }
      }
    }
  }, [modelList, resolution, duration]);

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{
        display: 'flex', flexDirection: 'column', width: '400px',
        backgroundColor: '#161616', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
      }}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', padding: '16px 24px' }}>
          <span style={{ flex: 1, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>批量生成分镜视频</span>
          <ModalCloseBtn onClick={onClose} />
        </div>
        {/* 内容 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px' }}>
          <div style={{ display: 'flex', gap: '8px', alignSelf: 'stretch', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>待生成的分镜视频数量</span>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, flexShrink: 0 }}>{shotCount}个</span>
          </div>
          <ModalSelect
            label="选择模型"
            value={modelsLoading ? '加载中...' : (modelList.find(m => m.value === model)?.label || '请选择')}
            options={modelList.map(m => m.label)}
            onChange={handleModelChange}
          />
          <ModalSelect label="分辨率" value={resolution} options={resolutionOptions} onChange={setResolution} />
          <ModalSelect label="时长" value={duration} options={durationOptions} onChange={setDuration} />
          {/* 音效 toggle */}
          <div style={{ display: 'flex', gap: '8px', alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>音效</span>
            <Toggle value={sound} onChange={setSound} />
          </div>
        </div>
        {/* 底部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px' }}>
          <ModalGhostBtn onClick={onClose}>取消</ModalGhostBtn>
          <ModalPrimaryBtn onClick={() => { onConfirm({ model, resolution, duration, sound }); onClose(); }}>开始生成</ModalPrimaryBtn>
        </div>
      </div>
    </ModalOverlay>
  );
}
export default memo(BatchVideoModal);
