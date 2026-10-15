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
    window.history.pushState({}, '', `/project/${encodeURIComponent(props.projectId)}/edit`);
    setEditor(null);
  };
  if (editor?.projectId === props.projectId) {
    return <CompositionEditorPage key={editor.compId || 'new'} embedded projectId={props.projectId} compId={editor.compId}
      projectName={props.projectName} episodes={props.episodes} initialEpisode={props.episodes?.find((episode) => String(episode.id) === String(editor.episodeId))}
      showToast={props.showToast} onBack={backToDrafts} />;
  }
  return <EditWorkspace {...props} onOpenEditor={openEditor} />;
}
