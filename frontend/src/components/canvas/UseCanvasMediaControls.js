/**
 * @file UseCanvasMediaControls.js
 * @structure-index
 * 2026-09-28：节点外壳持有媒体模型加载、能力适配及参数状态；不触发生成或持久化。
 */
import { useEffect, useMemo, useState } from 'react';
import { apiListModels } from '../../api/config';
import { adaptModels, getModelParams } from '../../utils/modelAdapter';
import { useCreationParamsState } from '../creation/useCreationParamsState';
import { selectCanvasMediaModel } from './CanvasMediaModels';

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
  return { ...params, model, creationParams, options: catalog.options, loading: catalog.loading, error: catalog.error, onModelChange };
}
