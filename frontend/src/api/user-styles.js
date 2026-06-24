import { authFetch } from './request.js';
import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

const BASE = import.meta.env.VITE_API_BASE_URL;

const MOCK_BUILTIN = [
  { id: 'b1', value: 'xianxia-3d', label: '3D东方仙侠', prompt: '3D东方仙侠风格', color: '#1C1A2E', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b2', value: 'suspense-anime-2d', label: '2D悬疑动漫', prompt: '2D悬疑动漫风格', color: '#141824', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b3', value: 'cyberpunk-3d', label: '3D赛博朋克', prompt: '3D赛博朋克风格', color: '#0D1020', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b4', value: 'pixar-style', label: '皮克斯风格', prompt: '皮克斯风格', color: '#12112A', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b5', value: 'wuxia-cg', label: 'CG武侠', prompt: 'CG武侠风格', color: '#12112A', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b6', value: 'ghibli-style', label: '宫崎骏风格', prompt: '宫崎骏动画风格', color: '#12112A', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b7', value: 'shinkai-style', label: '新海诚风格', prompt: '新海诚动画风格', color: '#1A1529', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b8', value: 'ancient-chinese-live-action', label: '真人古风写实', prompt: '真人古风写实风格', color: '#16120A', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b9', value: 'urban-workplace', label: '都市职场', prompt: '都市职场真人风格', color: '#111820', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b10', value: 'post-apocalyptic-modern', label: '末日废土', prompt: '末日废土风格', color: '#1A120A', description: null, badge: null, is_builtin: true, is_custom: false },
  { id: 'b11', value: 'live-action-suspense', label: '真人悬疑', prompt: '真人悬疑惊悚风格', color: '#0F0F18', description: null, badge: null, is_builtin: true, is_custom: false },
];

let mockCustomStyles = [];

export async function apiGetVisualStyleOptions() {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return [
      ...MOCK_BUILTIN,
      ...mockCustomStyles.map(s => ({
        id: s.id, value: s.id, label: s.name, prompt: s.prompt,
        color: s.color, description: null, badge: null, is_builtin: false, is_custom: true,
      })),
    ];
  }
  return cached(
    K.visualStyles(),
    async () => {
      const res = await authFetch(`${BASE}/api/user-styles/options`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

export async function apiCreateUserStyle({ name, prompt, color }) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const style = { id: `c${Date.now()}`, name, prompt, color: color ?? null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    mockCustomStyles = [...mockCustomStyles, style];
    return style;
  }
  const res = await authFetch(`${BASE}/api/user-styles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, prompt, color }),
  });
  invalidate(K.visualStyles());
  return res.json();
}

export async function apiUpdateUserStyle(styleId, { name, prompt, color }) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    mockCustomStyles = mockCustomStyles.map(s =>
      s.id === styleId ? { ...s, name: name ?? s.name, prompt: prompt ?? s.prompt, color: color ?? s.color, updated_at: new Date().toISOString() } : s
    );
    return mockCustomStyles.find(s => s.id === styleId);
  }
  const res = await authFetch(`${BASE}/api/user-styles/${styleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, prompt, color }),
  });
  invalidate(K.visualStyles());
  return res.json();
}

export async function apiDeleteUserStyle(styleId) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    mockCustomStyles = mockCustomStyles.filter(s => s.id !== styleId);
    return;
  }
  await authFetch(`${BASE}/api/user-styles/${styleId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  invalidate(K.visualStyles());
}
