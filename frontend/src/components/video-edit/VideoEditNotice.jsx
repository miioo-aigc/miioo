import ConfirmDialog from '../ConfirmDialog';
import { useVideoEditStore } from '../../stores/videoEditStore';

export default function VideoEditNotice() {
  const notice = useVideoEditStore((state) => state.notices[0]);
  const dismiss = useVideoEditStore((state) => state.dismissNotice);
  if (!notice) return null;
  return <ConfirmDialog title={notice.title} description={notice.message}
    confirmText="确认" showCancel={false} onConfirm={dismiss} onCancel={dismiss} zIndex={12000} />;
}
