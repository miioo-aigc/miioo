import { useContext, useEffect, useRef } from 'react';
import { VideoEditSubmissionContext } from '../components/video-edit/VideoEditSubmissionContext';
import { EMPTY_VIDEO_EDIT, runVideoEdit, useVideoEditStore, videoEditKey } from '../stores/videoEditStore';

export default function useVideoEditSubmission(source, onComplete, mode = 'trim') {
  const submitFromHost = useContext(VideoEditSubmissionContext);
  const key = videoEditKey(source, mode);
  const state = useVideoEditStore((store) => store.tasks[key] || EMPTY_VIDEO_EDIT);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  async function submit(options, onStarted) {
    const result = await (submitFromHost || runVideoEdit)(source, options, onStarted);
    if (result && mounted.current) onComplete?.(result);
  }
  return { ...state, submit };
}
