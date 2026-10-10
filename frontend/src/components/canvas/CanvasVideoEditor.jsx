import VideoUpscaleModal from '../video-edit/VideoUpscaleModal';
import VideoSubtitleModal from '../video-edit/VideoSubtitleModal';
import VideoFrameModal from '../video-edit/VideoFrameModal';
import VideoTrimModal from '../video-edit/VideoTrimModal';
import { VideoEditSubmissionContext } from '../video-edit/VideoEditSubmissionContext';

const EDITORS = { '智能超清': VideoUpscaleModal, '去字幕': VideoSubtitleModal, '选帧': VideoFrameModal, '剪辑': VideoTrimModal };

export default function CanvasVideoEditor({ editor, onClose }) {
  const Editor = EDITORS[editor.mode];
  if (!Editor) return null;
  return <VideoEditSubmissionContext.Provider value={editor.submit}>
    <Editor sourceAsset={editor.sourceAsset} videoUrl={editor.videoUrl} originalVideoUrl={editor.originalVideoUrl} posterUrl={editor.posterUrl} onClose={onClose} persistToCreation={false} />
  </VideoEditSubmissionContext.Provider>;
}
