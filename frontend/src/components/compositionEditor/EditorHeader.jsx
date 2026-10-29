import { useState } from 'react';
import { Tooltip } from '../ui';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const RESOLUTIONS = ['1080p', '720p'];
const ASPECTS = ['16:9', '9:16', '1:1'];

function selectClass() {
  return [
    'h-9 rounded-medium px-[12px] bg-input-bg-normal border border-input-border-normal',
    'text-input-text-content text-font-size-14 outline-none cursor-pointer',
  ].join(' ');
}

export default function EditorHeader() {
  const name = useCompositionEditorStore((s) => s.name);
  const setName = useCompositionEditorStore((s) => s.setName);
  const resolution = useCompositionEditorStore((s) => s.resolution);
  const setResolution = useCompositionEditorStore((s) => s.setResolution);
  const aspectRatio = useCompositionEditorStore((s) => s.aspectRatio);
  const setAspectRatio = useCompositionEditorStore((s) => s.setAspectRatio);
  const dirty = useCompositionEditorStore((s) => s.dirty);
  const saving = useCompositionEditorStore((s) => s.saving);
  const save = useCompositionEditorStore((s) => s.save);
  const segments = useCompositionEditorStore((s) => s.segments);
  const startExport = useCompositionEditorStore((s) => s.startExport);
  const exportState = useCompositionEditorStore((s) => s.exportState);

  const [editingName, setEditingName] = useState(name);
  const [prevName, setPrevName] = useState(name);
  // store.name 外部变化（如 init 载入工程）时，同步到本地编辑态
  if (prevName !== name) {
    setPrevName(name);
    setEditingName(name);
  }

  const exporting = exportState.status === 'exporting';
  const ready = useCompositionEditorStore((s) => s.loaded);
  const openExport = useCompositionEditorStore((s) => s.openExport);
  const exportDisabledReason = exporting ? '' : !ready ? '工程加载中，请稍候'
      : saving ? '正在保存，请等待保存完成'
        : !segments.length ? '请先向轨道添加素材再导出' : '';

  const commitName = () => {
    const trimmed = editingName.trim();
    setName(trimmed || '未命名成片');
    setEditingName(trimmed || name);
  };

  const handleSave = async () => {
    try {
      await save();
    } catch { /* 保存失败留给保存状态提示 */ }
  };

  return (
    <header className="flex items-center h-[60px] px-[24px] justify-between gap-[16px] flex-shrink-0 bg-surface-toolbar border-b border-stroke-normal">
      {/* 左侧：工程名 + 保存状态 */}
      <div className="flex items-center gap-[12px] min-w-0">
        <input
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder="未命名成片"
          className="h-9 rounded-medium px-[12px] bg-input-bg-normal border border-input-border-normal focus:border-input-border-focus text-input-text-content text-font-size-14 outline-none w-[220px]"
          style={{ fontFamily: FONT }}
        />

        <span className="text-text-hint text-font-size-12 whitespace-nowrap" style={{ fontFamily: FONT }}>
          {saving ? '保存中…' : dirty ? '有未保存修改' : '已保存'}
        </span>
      </div>

      {/* 右侧：分辨率 / 画幅 / 保存 / 导出 */}
      <div className="flex items-center gap-[12px]">
        <div className="flex items-center gap-[8px]">
          <span className="text-text-secondary text-font-size-12 whitespace-nowrap" style={{ fontFamily: FONT }}>
            分辨率
          </span>
          <select value={resolution} onChange={(e) => setResolution(e.target.value)} className={selectClass()} style={{ fontFamily: FONT }}>
            {RESOLUTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-[8px]">
          <span className="text-text-secondary text-font-size-12 whitespace-nowrap" style={{ fontFamily: FONT }}>
            画幅
          </span>
          <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className={selectClass()} style={{ fontFamily: FONT }}>
            {ASPECTS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center h-9 shrink-0 rounded-medium px-[16px] gap-[4px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border disabled:border-transparent disabled:bg-btn-primary-bg-disabled disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="text-btn-primary-text text-font-size-14 font-font-weight-regular shrink-0" style={{ fontFamily: FONT }}>
            保存草稿
          </span>
        </button>

        {exporting && (
          <span className="text-text-accent text-font-size-12 whitespace-nowrap" style={{ fontFamily: FONT }}>
            导出中 {Math.round(exportState.progress || 0)}%
          </span>
        )}

        <Tooltip label={exportDisabledReason || (exporting ? '查看导出进度' : '导出成片')} placement="bottom" offset={8}>
          <button
            type="button"
            onClick={() => { if (exporting) openExport(); else if (!exportDisabledReason) void startExport(); }}
            aria-disabled={Boolean(exportDisabledReason)}
            aria-description={exportDisabledReason || undefined}
            className="flex items-center h-9 shrink-0 rounded-medium px-[16px] gap-[4px] bg-btn-accent-bg-normal hover:bg-btn-accent-bg-hover active:bg-btn-accent-bg-active disabled:bg-btn-accent-bg-disabled border border-btn-accent-border disabled:border-transparent cursor-pointer disabled:cursor-not-allowed"
            style={{
              backgroundImage: 'linear-gradient(157.78deg, #7AE5B94D 2.88%, #7AE5B900 56.77%)',
              cursor: exportDisabledReason ? 'not-allowed' : 'pointer',
            }}
          >
            <span className="text-btn-accent-text text-font-size-14 font-font-weight-medium shrink-0" style={{ fontFamily: FONT_MEDIUM }}>
              {exporting ? '成片导出中' : '导出成片'}
            </span>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
