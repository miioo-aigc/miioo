/**
 * @file UseCanvasMediaControls.js
 * @structure-index
 * 2026-09-28：节点外壳持有媒体模型加载、能力适配及参数状态；不触发生成或持久化。
 * 2026-09-29：图片节点从后端能力字段 max_reference_images 读取图片参考上限。
 * 2026-09-30：Seedance 编辑仅覆盖画布对外参数，退出恢复底层选择；分辨率不变。
 */
import { useEffect, useMemo, useState } from 'react';
import { apiListModels } from '../../api/config';
import { adaptModels, getModelParams } from '../../utils/modelAdapter';
import { useCreationParamsState } from '../creation/useCreationParamsState';
import { selectCanvasMediaModel } from './CanvasMediaModels';
import { getImageReferenceLimit } from './CanvasImageGeneration';
import { adaptCanvasVideoModels, getCanvasVideoParams, getCanvasVideoControlValues, resolveCanvasVideoCapabilities, resolveCanvasVideoModel } from './CanvasVideoModels';

export function useCanvasMediaControls(nodeType, selectedModel, onModelChange, onGenerationModeChange) {
  const genType = nodeType === 'audio' ? 'dubbing' : nodeType;
  const [catalog, setCatalog] = useState({ models: [], options: [], capabilities: {}, loading: true, error: false });
  useEffect(() => {
    if (nodeType === 'text') return;
    let cancelled = false;
    apiListModels({ category: nodeType === 'audio' ? 'voice' : nodeType }).then((models) => {
      const { modelOptions, capabilitiesMap } = nodeType === 'video'
        ? (() => {
          const catalog = adaptCanvasVideoModels(models);
          return { modelOptions: catalog.options, capabilitiesMap: catalog.capabilitiesMap };
        })()
        : adaptModels(models, genType);
      if (!cancelled) setCatalog({ models, options: modelOptions, capabilities: capabilitiesMap, loading: false, error: false });
    }).catch(() => {
      if (!cancelled) setCatalog({ models: [], options: [], capabilities: {}, loading: false, error: true });
    });
    return () => { cancelled = true; };
  }, [nodeType, genType]);
  const model = selectCanvasMediaModel(catalog.options, catalog.models, selectedModel);
  const baseCreationParams = useMemo(() => {
    if (!model) return null;
    return nodeType === 'video' ? getCanvasVideoParams(catalog.capabilities?.[model], model) : getModelParams(genType, model, catalog.capabilities);
  }, [genType, model, catalog.capabilities, nodeType]);
  const params = useCreationParamsState({ creationParams: baseCreationParams, genType });
  const selectedOption = nodeType === 'video' ? catalog.options.find((option) => option.value === model) : null;
  const videoCapabilities = nodeType === 'video' && model
    ? resolveCanvasVideoCapabilities(selectedOption, catalog.capabilities?.[model], params.refMode)
    : undefined;
  const requestModel = nodeType === 'video' ? resolveCanvasVideoModel(selectedOption, params.refMode) : model;
  const creationParams = useMemo(() => {
    if (nodeType !== 'video' || !model) return baseCreationParams;
    const activeParams = getCanvasVideoParams(videoCapabilities, requestModel);
    return selectedOption?.modelByGenerationMode
      ? { ...activeParams, refModes: baseCreationParams?.refModes || [] }
      : activeParams;
  }, [baseCreationParams, model, nodeType, requestModel, selectedOption, videoCapabilities]);
  const controls = nodeType === 'video'
    ? getCanvasVideoControlValues(creationParams, model, params)
    : { ...params, creationParams };
  const imageReferenceLimit = nodeType === 'image' && model ? getImageReferenceLimit(catalog.capabilities?.[model]) : undefined;
  return { ...controls, model, requestModel, options: catalog.options, capabilities: catalog.capabilities, videoCapabilities, imageReferenceLimit, loading: catalog.loading, error: catalog.error, onModelChange, onGenerationModeChange };
}
