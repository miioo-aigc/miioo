import { useEffect, useState } from 'react';
import { apiListModels } from '../api/config';
import { getAuthSessionGeneration } from '../api/request';
import { subscribeModelConfig } from '../api/ModelConfigEvents';

const EMPTY_MODELS = [];

// 2026-10-23：只管理可用目录，不修改提示词、素材或持久化选择。
export function useAvailableModels(category, active = true) {
  const [state, setState] = useState({ models: [], loading: true, error: '', category, generation: -1 });
  const [attempt, setAttempt] = useState(0);
  const generation = getAuthSessionGeneration();
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let revision = 0;
    const load = async () => {
      if (disposed || generation !== getAuthSessionGeneration()) return;
      const request = ++revision;
      const current = () => !disposed && request === revision && generation === getAuthSessionGeneration();
      setState({ models: [], loading: true, error: '', category, generation });
      try {
        const models = await apiListModels({ category, fresh: true, availableOnly: true });
        if (current()) setState({ models: models.filter(model => model.is_enabled === true), loading: false, error: '', category, generation });
      } catch {
        if (current()) setState({ models: [], loading: false, error: '模型读取失败，请重试；草稿已保留。', category, generation });
      }
    };
    const unsubscribe = subscribeModelConfig(auth => { if (auth === generation) void load(); });
    void load();
    return () => { disposed = true; unsubscribe(); };
  }, [category, active, attempt, generation]);
  const valid = active && state.category === category && state.generation === generation;
  return { models: valid ? state.models : EMPTY_MODELS, loading: active && (!valid || state.loading),
    error: valid ? state.error : '', retry: () => setAttempt(value => value + 1) };
}
