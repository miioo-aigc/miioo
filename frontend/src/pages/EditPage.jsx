/** 分集剪辑路由与访问边界；2026-10-30 仅允许服务器已解锁的分集进入。 */
import { isEpisodeEditingUnlocked } from '../utils/EpisodeEditingProgress';
import EditWorkspace from '../components/edit/EditWorkspace';
import { useEffect, useState } from 'react';
import CompositionEditorPage from './CompositionEditorPage';

export default function EditPage(props) {
  const readEditor = () => {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path !== `/project/${encodeURIComponent(props.projectId)}/edit/editor`
      && path !== `/workspace/project/${encodeURIComponent(props.projectId)}/edit/editor`) return null;
    const query = new URLSearchParams(window.location.search);
    return { projectId: props.projectId, compId: query.get('comp_id') || undefined, episodeId: query.get('episode_id') };
  };
  const [editor, setEditor] = useState(readEditor);
  useEffect(() => {
    const handlePopState = () => setEditor(readEditor());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // The project page is remounted when switching projects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.projectId]);
  const openEditor = (compId, episode) => {
    const query = new URLSearchParams();
    if (compId) query.set('comp_id', compId);
    if (episode?.id) query.set('episode_id', episode.id);
    window.history.pushState({}, '', `/project/${encodeURIComponent(props.projectId)}/edit/editor${query.size ? `?${query}` : ''}`);
    setEditor({ projectId: props.projectId, compId, episodeId: episode?.id });
  };
  const backToDrafts = () => {
    const query = new URLSearchParams();
    if (editor?.episodeId) query.set('episode_id', editor.episodeId);
    window.history.pushState({}, '', `/project/${encodeURIComponent(props.projectId)}/edit${query.size ? `?${query}` : ''}`);
    setEditor(null);
  };
  const unlockedEpisodes = (props.episodes || []).filter(isEpisodeEditingUnlocked);
  const requestedId = editor?.episodeId || new URLSearchParams(window.location.search).get('episode_id') || props.initialEpisodeId;
  if (!unlockedEpisodes.length || (requestedId && !unlockedEpisodes.some(episode => String(episode.id) === String(requestedId)))) {
    return <div role="status" className="p-[24px] text-text-secondary">该分集尚未进入剪辑，请先从该集分镜页面点击“开始剪辑”。</div>;
  }
  if (editor?.projectId === props.projectId && !editor.episodeId) {
    return <div role="status" className="p-[24px] text-text-secondary">剪辑链接缺少分集信息，请从该集分镜页面重新进入。</div>;
  }
  if (editor?.projectId === props.projectId) {
    return <CompositionEditorPage key={editor.compId || 'new'} embedded projectId={props.projectId} compId={editor.compId}
      projectName={props.projectName} episodes={unlockedEpisodes} initialEpisode={props.episodes?.find((episode) => String(episode.id) === String(editor.episodeId))}
      showToast={props.showToast} onBack={backToDrafts} />;
  }
  return <EditWorkspace {...props} episodes={unlockedEpisodes} onOpenEditor={openEditor} />;
}
