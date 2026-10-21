import { apiCreateProject, apiGetProjects } from './project';
import { apiListCanvasDocuments } from './canvas';

export async function apiCreateCanvasProject() {
  const project = await apiCreateProject({
    name: '未命名项目', project_type: 'canvas', create_first_canvas: true, first_canvas_title: '画布1',
  });
  if (!project?.id || !project?.first_canvas_id || project.project_type !== 'canvas') {
    throw new Error('项目创建响应缺少正式项目或首张画布编号，请刷新项目列表核对，勿重复创建');
  }
  if (['visual_style', 'visual_style_label', 'visual_style_prompt'].some((key) => project[key] != null)) {
    throw new Error('后端为画布项目绑定了视觉风格，与约定不符；请刷新项目列表核对，勿重复创建');
  }
  return project;
}

export async function apiListCanvasProjects({ isCurrent = () => true } = {}) {
  const projects = new Map();
  const limit = 200;
  for (let offset = 0; ; offset += limit) {
    if (!isCurrent()) return [];
    const page = await apiGetProjects({ limit, offset });
    if (!Array.isArray(page)) throw new Error('项目列表响应格式不符合约定');
    let added = 0;
    for (const project of page) {
      if (!projects.has(project.id)) added++;
      projects.set(project.id, project);
    }
    if (page.length < limit) break;
    if (!added) throw new Error('项目列表分页未推进，请重试');
  }
  return [...projects.values()].filter((project) => project.project_type === 'canvas');
}

export async function apiGetCanvasProjectEntry(projectId, { isCurrent = () => true } = {}) {
  for (let page = 1; ; page++) {
    if (!isCurrent()) return null;
    const data = await apiListCanvasDocuments({ projectId, status: 'active', page, pageSize: 100 });
    if (!Array.isArray(data?.items)) throw new Error('项目画布列表响应格式不符合约定');
    const canvas = data.items.find((item) => item.project_id === projectId && item.id && item.status !== 'archived');
    if (canvas) return canvas.id;
    if (!data.items.length || page * 100 >= data.total) break;
  }
  throw new Error('项目中没有可打开的画布，请核对后端首张画布创建结果');
}
