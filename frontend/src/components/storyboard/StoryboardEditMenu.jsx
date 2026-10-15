import { useRef, useState } from 'react';
import { ChevronDown, Film, Upload } from 'lucide-react';
import { Button, DropdownMenu } from '../ui';
import { apiExportJianyingDraft } from '../../api/compositions';
import { downloadResponse } from '../../api/download';
import { getErrorMessage } from '../../api/error';
import { showGlobalToast } from '../../stores/toastStore';
import { prepareOnlineEditing } from '../../api/CompositionDraftCreation';

// 分镜域剪辑动作：独立管理导出请求与菜单状态，不读取页面闭包。
export default function StoryboardEditMenu({ projectId, projectName, episodeId, storyboardIds = [], onStartEdit, icon }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [opening, setOpening] = useState(false);
  const lock = useRef(false);

  async function startOnlineEditing() {
    if (lock.current || !projectId || !onStartEdit) return;
    lock.current = true;
    setOpening(true);
    try {
      const { draft, skipped } = await prepareOnlineEditing(projectId, episodeId);
      onStartEdit(draft?.id, episodeId);
      if (draft) showGlobalToast('新建剪辑成功', 'success');
      if (skipped) showGlobalToast(`${skipped} 个定稿视频缺少有效资产或时长，未自动加入轨道`, 'warning');
    } catch (error) {
      showGlobalToast(getErrorMessage(error, '进入在线剪辑失败，请重试'), 'error');
    } finally {
      lock.current = false;
      setOpening(false);
    }
  }

  async function exportDraft() {
    if (lock.current || !projectId || !storyboardIds.length) return;
    lock.current = true;
    setExporting(true);
    try {
      const response = await apiExportJianyingDraft(projectId, { storyboardIds, projectName });
      await downloadResponse(response, { mediaType: 'zip', contextLabel: '剪映工程包' });
    } catch (error) {
      showGlobalToast(getErrorMessage(error, '导出剪映工程包失败，请重试'), 'error');
    } finally {
      lock.current = false;
      setExporting(false);
    }
  }

  return (
    <div className="relative">
      <Button variant="accent" size="large" icon={icon || <Film size={16} />} loading={exporting || opening}
        aria-haspopup="menu" aria-expanded={open}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((value) => !value)}>
        开始剪辑<ChevronDown size={16} aria-hidden="true" />
      </Button>
      {open && <DropdownMenu style={{ top: '100%', bottom: 'auto', marginTop: '4px', marginBottom: 0 }}
        onClose={() => setOpen(false)} items={[
          { key: 'export', label: '导出剪映格式', icon: <Upload size={16} />, disabled: exporting || opening || !projectId || !storyboardIds.length, onClick: exportDraft },
          { key: 'online', label: '在线剪辑', icon: <Film size={16} />, disabled: exporting || opening || !projectId || !onStartEdit, onClick: startOnlineEditing },
        ]} />}
    </div>
  );
}
