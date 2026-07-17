import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Toggle from '../Toggle';
import { Button, Select } from '../ui';
import { apiListModels } from '../../api/config';
import { normalizeStoryboardModelList } from '../../utils/storyboardModelAdapter';

/**
 * @file BatchGenerateModals.jsx
 * @structure-index
 *
 * ─── 批量生成弹窗 ──────────────────────────────────────────────────
 *   BatchImageModal  批量生成分镜图的模型、分辨率选择和确认区
 *   BatchVideoModal  批量生成分镜视频的模型、分辨率、时长、音效选择和确认区
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   仅通过 shotCount、shots、projectRatio、onClose、onConfirm 接收页面数据；
 *   页面继续负责生成 API、任务轮询、状态更新、持久化和 Toast。
 *   模型能力请求只服务于选择器展示，不读取页面 Store 或页面闭包。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-15  从 StoryboardPage 抽离批量生成图片/视频弹窗，选择器复用 ui/Select
 */

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function ModalOverlay({ onClose, children }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      {children}
    </div>,
    document.body,
  );
}

function ModalCloseButton({ onClick }) {
  return (
    <button
      type="button"
      aria-label="关闭"
      onClick={onClick}
      style={{
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 0, borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
        backgroundColor: 'transparent',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function ModalActions({ onClose, onConfirm }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px' }}>
      <Button variant="secondary" size="large" onClick={onClose}>取消</Button>
      <Button variant="accent" size="large" onClick={onConfirm}>开始生成</Button>
    </div>
  );
}

function ModelSelect({ modelList, model, loading, onChange }) {
  return (
    <Select
      label="选择模型"
      value={model}
      displayValue={loading ? '加载中...' : (modelList.find((item) => item.value === model)?.label || '请选择')}
      options={modelList}
      loading={loading}
      selectedOptionColor="#FFFFFF"
      selectedOptionBackground="rgba(255,255,255,0.08)"
      optionHoverBackground="rgba(255,255,255,0.05)"
      onChange={onChange}
    />
  );
}

function CapabilitySelect({ label, value, options, onChange }) {
  return (
    <Select
      label={label}
      value={value}
      options={options}
      selectedOptionColor="#FFFFFF"
      selectedOptionBackground="rgba(255,255,255,0.08)"
      optionHoverBackground="rgba(255,255,255,0.05)"
      onChange={onChange}
    />
  );
}

function ModalShell({ title, onClose, children, actions }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '400px', backgroundColor: '#161616', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.60)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', padding: '16px 24px' }}>
          <span style={{ flex: 1, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>{title}</span>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px' }}>{children}</div>
        {actions}
      </div>
    </ModalOverlay>
  );
}

function CountRow({ label, count }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignSelf: 'stretch', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, flexShrink: 0 }}>{count}个</span>
    </div>
  );
}


function resolutionOptionsFor(modelList, model, projectRatio) {
  const selected = modelList.find((item) => item.value === model);
  const resolutions = selected?.resolutions || [];
  if (!projectRatio || !selected?.resolutionSizeMap) return resolutions;
  return resolutions.filter((resolution) => {
    const ratios = selected.resolutionSizeMap[resolution] || {};
    return Object.keys(ratios).length === 0 || Object.keys(ratios).includes(projectRatio);
  });
}

function durationForModel(model, duration) {
  const range = model?.durationRange;
  if (!range) return duration;
  if (Array.isArray(range) && range.length === 2 && typeof range[0] === 'number') {
    const seconds = parseInt(duration, 10);
    return !Number.isNaN(seconds) && seconds >= range[0] && seconds <= range[1] ? duration : `${range[0]}s`;
  }
  return Array.isArray(range) && range.includes(duration) ? duration : range[0];
}

function durationOptionsFor(modelList, model) {
  const range = modelList.find((item) => item.value === model)?.durationRange;
  if (!range) return [];
  if (Array.isArray(range) && range.length === 2 && typeof range[0] === 'number' && typeof range[1] === 'number') {
    return Array.from({ length: range[1] - range[0] + 1 }, (_, index) => `${range[0] + index}s`);
  }
  return Array.isArray(range) ? range : [];
}

export function BatchImageModal({ shotCount, onClose, onConfirm, projectRatio }) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const merged = normalizeStoryboardModelList(await apiListModels({ category: 'image' }), 'image');
        if (!active) return;
        setModelList(merged);
        const first = merged.find((item) => item.is_default) || merged[0];
        if (first) { setModel(first.value); setResolution(first.resolutions[0] || ''); }
      } catch {
        if (active) setModelList([]);
      } finally {
        if (active) setModelsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const resolutionOptions = useMemo(() => resolutionOptionsFor(modelList, model, projectRatio), [model, modelList, projectRatio]);
  const handleModelChange = useCallback((nextModel) => {
    const selected = modelList.find((item) => item.value === nextModel);
    if (!selected) return;
    setModel(nextModel);
    setResolution(selected.resolutions.includes(resolution) ? resolution : (selected.resolutions[0] || ''));
  }, [modelList, resolution]);

  function confirm() { onConfirm?.({ model, resolution }); onClose?.(); }

  return (
    <ModalShell title="批量生成分镜图" onClose={onClose} actions={<ModalActions onClose={onClose} onConfirm={confirm} />}>
      <CountRow label="待生成的分镜图数量" count={shotCount} />
      <ModelSelect modelList={modelList} model={model} loading={modelsLoading} onChange={handleModelChange} />
      <CapabilitySelect label="分辨率" value={resolution} options={resolutionOptions} onChange={setResolution} />
    </ModalShell>
  );
}

export function BatchVideoModal({ shots, onClose, onConfirm, projectRatio }) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [resolution, setResolution] = useState('');
  const [duration, setDuration] = useState('');
  const [sound, setSound] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const merged = normalizeStoryboardModelList(await apiListModels({ category: 'video' }), 'video');
        if (!active) return;
        setModelList(merged);
        const first = merged.find((item) => item.is_default) || merged[0];
        if (first) {
          setModel(first.value);
          setResolution(first.resolutions[0] || '');
          const counts = {};
          (shots || []).forEach((shot) => {
            const raw = shot?.params?.duration;
            if (raw) { const value = String(raw).endsWith('s') ? String(raw) : `${raw}s`; counts[value] = (counts[value] || 0) + 1; }
          });
          const commonDuration = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
          setDuration(durationForModel(first, commonDuration || ''));
        }
      } catch {
        if (active) setModelList([]);
      } finally {
        if (active) setModelsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [shots]);

  const resolutionOptions = useMemo(() => resolutionOptionsFor(modelList, model, projectRatio), [model, modelList, projectRatio]);
  const durationOptions = useMemo(() => durationOptionsFor(modelList, model), [model, modelList]);
  const handleModelChange = useCallback((nextModel) => {
    const selected = modelList.find((item) => item.value === nextModel);
    if (!selected) return;
    setModel(nextModel);
    setResolution(selected.resolutions.includes(resolution) ? resolution : (selected.resolutions[0] || ''));
    setDuration(durationForModel(selected, duration));
  }, [duration, modelList, resolution]);

  function confirm() { onConfirm?.({ model, resolution, duration, sound }); onClose?.(); }

  return (
    <ModalShell title="批量生成分镜视频" onClose={onClose} actions={<ModalActions onClose={onClose} onConfirm={confirm} />}>
      <CountRow label="待生成的分镜视频数量" count={shots?.length || 0} />
      <ModelSelect modelList={modelList} model={model} loading={modelsLoading} onChange={handleModelChange} />
      <CapabilitySelect label="分辨率" value={resolution} options={resolutionOptions} onChange={setResolution} />
      <CapabilitySelect label="时长" value={duration} options={durationOptions} onChange={setDuration} />
      <div style={{ display: 'flex', gap: '8px', alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>音效</span>
        <Toggle value={sound} onChange={setSound} />
      </div>
    </ModalShell>
  );
}
