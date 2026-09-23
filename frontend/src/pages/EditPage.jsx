import EditWorkspace from '../components/edit/EditWorkspace';
import { useState } from 'react';
import CompositionEditorPage from './CompositionEditorPage';

export default function EditPage(props) {
  const [editor, setEditor] = useState(null);
  if (editor?.projectId === props.projectId) {
    return <CompositionEditorPage embedded projectId={props.projectId} compId={editor.compId}
      projectName={props.projectName} episodes={props.episodes} initialEpisode={editor.episode}
      showToast={props.showToast} onBack={() => setEditor(null)} />;
  }
  return <EditWorkspace {...props} onOpenEditor={(compId, episode) => setEditor({ projectId: props.projectId, compId, episode })} />;
}
