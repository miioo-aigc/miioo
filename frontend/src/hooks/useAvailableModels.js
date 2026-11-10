import { useCallback, useEffect, useState } from 'react';
import { apiListModels } from '../api/config';
import { getAuthSessionGeneration } from '../api/request';
import { subscribeModelConfig } from '../api/ModelConfigEvents';
import { invalidate, peekCache, subscribe } from '../utils/cache';
import { K, MEDIUM } from '../utils/cacheKeys';

const EMPTY_MODELS = [];

function toEnabledModels(models) {
  return Array.isArray(models) ? models.filter(model => model.is_enabled === true) : EMPTY_MODELS;
}

// 同步读取本地缓存，首帧即可拿到上次的可用模型目录。
function readCachedModels(category) {
  return toEnabledModels(peekCache(K.modelsAvailable(category), MEDIUM.STATIC));
}

// 2026-10-23：只管理可用目录，不修改提示词、素材或持久化选择。
// 2026-11-09：目录改走本地缓存（SWR），刷新首帧直接复用缓存，后台静默校验，配置变更时失效重取。
export function useAvailableModels(category, active = true) {
  const generation = getAuthSessionGeneration();
  const [state, setState] = useState(() => {
    const models = readCachedModels(category);
    return { models, loading: models.length === 0, error: '', category, generation };
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let revision = 0;
    const load = async () => {
      if (disposed || generation !== getAuthSessionGeneration()) return;
      const request = ++revision;
      const current = () => !disposed && request === revision && generation === getAuthSessionGeneration();
      const seeded = readCachedModels(category);
      setState({ models: seeded, loading: seeded.length === 0, error: '', category, generation });
      try {
        const models = await apiListModels({ category, availableOnly: true });
        if (current()) setState({ models: toEnabledModels(models), loading: false, error: '', category, generation });
      } catch {
        if (current()) setState((previous) => ({ models: previous.models, loading: false,
          error: '模型读取失败，请重试；草稿已保留。', category, generation }));
      }
    };
    const unsubscribeConfig = subscribeModelConfig(auth => { if (auth === generation) void load(); });
    const unsubscribeCache = subscribe(K.modelsAvailable(category), (data) => {
      if (!disposed && generation === getAuthSessionGeneration()) {
        setState({ models: toEnabledModels(data), loading: false, error: '', category, generation });
      }
    });
    void load();
    return () => { disposed = true; revision += 1; unsubscribeConfig(); unsubscribeCache(); };
  }, [category, active, attempt, generation]);
  const valid = active && state.category === category && state.generation === generation;
  const retry = useCallback(() => {
    invalidate(K.modelsAvailable(category));
    setAttempt(value => value + 1);
  }, [category]);
  return { models: valid ? state.models : EMPTY_MODELS, loading: active && (!valid || state.loading),
    error: valid ? state.error : '', retry };
}
