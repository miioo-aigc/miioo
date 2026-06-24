const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch } from './request.js';
import { cached } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

export async function apiGetVoices({ tab, gender, age_group, emotion_type } = {}) {
  return cached(
    K.voices({ tab, gender, age_group, emotion_type }),
    async () => {
      const params = new URLSearchParams();
      if (tab) params.append('tab', tab);
      if (gender) params.append('gender', gender);
      if (age_group) params.append('age_group', age_group);
      if (emotion_type) params.append('emotion_type', emotion_type);
      const query = params.toString();
      const url = query ? `${BASE}/api/voices?${query}` : `${BASE}/api/voices`;
      const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
      return res.json();
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

// 获取官方音色目录（优先使用，用户配了音频模型时可用）
export async function apiGetOfficialVoices({ provider, language } = {}) {
  return cached(
    K.officialVoices({ provider, language }),
    async () => {
      const params = new URLSearchParams();
      if (provider) params.append('provider', provider);
      if (language) params.append('language', language);
      const query = params.toString();
      const url = query
        ? `${BASE}/api/voices/official?${query}`
        : `${BASE}/api/voices/official`;
      const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
      return res.json();
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}
// 获取系统音色库
export async function apiGetVoiceLibrary({ provider, gender, age_group, language, emotion, keyword, skipCache } = {}) {
  const fetcher = async () => {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    if (gender) params.append('gender', gender);
    if (age_group) params.append('age_group', age_group);
    if (language) params.append('language', language);
    if (emotion) params.append('emotion', emotion);
    if (keyword) params.append('keyword', keyword);
    const query = params.toString();
    const url = query ? `${BASE}/api/voices/library?${query}` : `${BASE}/api/voices/library`;
    const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
    return res.json();
  };
  if (skipCache) return fetcher();
  return cached(
    K.voiceLibrary({ provider, gender, age_group, language, emotion, keyword }),
    fetcher,
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}
