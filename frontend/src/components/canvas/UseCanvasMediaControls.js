/**
 * @file UseCanvasMediaControls.js
 * @structure-index
 * 2026-09-28：节点外壳持有媒体模型加载、能力适配及参数状态；不触发生成或持久化。
 * 2026-09-29：图片节点从后端能力字段 max_reference_images 读取图片参考上限。
 */
import { useEffect, useMemo, useState } from 'react';
import { apiListModels } from '../../api/config';
import { adaptModels, getModelParams } from '../../utils/modelAdapter';
import { useCreationParamsState } from '../creation/useCreationParamsState';
import { selectCanvasMediaModel } from './CanvasMediaModels';
import { getImageReferenceLimit } from './CanvasImageGeneration';

export function useCanvasMediaControls(nodeType, selectedModel, onModelChange) {
  const genType = nodeType === 'audio' ? 'dubbing' : nodeType;
  const [catalog, setCatalog] = useState({ models: [], options: [], capabilities: {}, loading: true, error: false });
  useEffect(() => {
    if (nodeType === 'text') return;
    let cancelled = false;
    apiListModels({ category: nodeType === 'audio' ? 'voice' : nodeType }).then((models) => {
      const { modelOptions, capabilitiesMap } = adaptModels(models, genType);
      if (!cancelled) setCatalog({ models, options: modelOptions, capabilities: capabilitiesMap, loading: false, error: false });
    }).catch(() => {
      if (!cancelled) setCatalog({ models: [], options: [], capabilities: {}, loading: false, error: true });
    });
    return () => { cancelled = true; };
  }, [nodeType, genType]);
  const model = selectCanvasMediaModel(catalog.options, catalog.models, selectedModel);
  const creationParams = useMemo(() => model ? getModelParams(genType, model, catalog.capabilities) : null, [genType, model, catalog.capabilities]);
  const params = useCreationParamsState({ creationParams, genType });
  const imageReferenceLimit = nodeType === 'image' && model ? getImageReferenceLimit(catalog.capabilities?.[model]) : undefined;
  return { ...params, model, creationParams, options: catalog.options, capabilities: catalog.capabilities, imageReferenceLimit, loading: catalog.loading, error: catalog.error, onModelChange };
}
