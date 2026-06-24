const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch, authFetchForm } from './request.js';
import { cached, invalidate, setCache } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

export async function apiUploadProjectCover(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetchForm(`${BASE}/api/images/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  return data.url || data.file_url || data.uploaded_url || null;
}

export async function apiGetProjects({ search } = {}) {
  return cached(
    K.projects(search),
    async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const query = params.toString();
      const url = query ? `${BASE}/api/projects?${query}` : `${BASE}/api/projects`;
      const res = await authFetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },
    { medium: MEDIUM.LIST, ttl: TTL.LIST },
  );
}

export async function apiGetProject(projectId) {
  return cached(
    K.project(projectId),
    async () => {
      const res = await authFetch(`${BASE}/api/projects/${projectId}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
}

export async function apiCreateProject({ name, description, aspect_ratio, visual_style, project_type, cover_url }) {
  const res = await authFetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, aspect_ratio, visual_style, project_type, cover_url }),
  });
  invalidate(K.projectsPrefix()); // 项目列表已变
  return res.json();
}

export async function apiUpdateProject(projectId, data) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const updated = await res.json();
  // 回填项目详情缓存，失效列表（列表项含项目摘要）
  setCache(K.project(projectId), updated, { medium: MEDIUM.CONTENT });
  invalidate(K.projectsPrefix());
  return updated;
}

export async function apiDeleteProject(projectId) {
  await authFetch(`${BASE}/api/projects/${projectId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  // 清掉该项目所有相关缓存
  invalidate(K.project(projectId));
  invalidate(K.projectOverview(projectId));
  invalidate(K.subjectsPrefix(projectId));
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.episodes(projectId));
  invalidate(K.script(projectId));
  invalidate(K.projectsPrefix());
}

export async function apiDownloadProjectAssets(projectId) {
  await authFetch(`${BASE}/api/projects/${projectId}/assets/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiGetProjectOverview(projectId) {
  return cached(
    K.projectOverview(projectId),
    async () => {
      const res = await authFetch(`${BASE}/api/projects/${projectId}/overview`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
}
