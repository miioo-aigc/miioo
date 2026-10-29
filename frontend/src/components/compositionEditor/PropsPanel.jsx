import PropertySlider from './PropertySlider';
import AudioVolumeControl from './AudioVolumeControl';
import SubtitleProperties from './SubtitleProperties';
import ProjectInfo from './ProjectInfo';
import { RectangleHorizontal, RectangleVertical, Square } from 'lucide-react';
import {
  formatTime,
  durationClampOf,
  useCompositionEditorStore,
} from '../../stores/compositionEditorStore';
import VisualSizeControl from './VisualSizeControl';
import ConfirmDialog from '../ConfirmDialog';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const RESOLUTIONS = ['1080p', '720p'];
const ASPECTS = [
  { key: '16:9', label: '16:9', Icon: RectangleHorizontal },
  { key: '9:16', label: '9:16', Icon: RectangleVertical },
  { key: '1:1', label: '1:1', Icon: Square },
];

const settingOptionClass = (active) => `flex h-[40px] min-w-0 flex-1 items-center justify-center gap-[8px] rounded-medium border text-font-size-14 cursor-pointer ${active ? 'border-white-20 bg-white-10 text-white-100' : 'border-transparent bg-white-5 text-text-secondary hover:text-text-primary'} `;

const TYPE_LABEL = {
  video: '视频片段',
  image: '图片片段',
  audio: '音频片段',
};

function SectionTitle({ children }) {
  return (
    <span className="text-font-size-14 font-font-weight-medium text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
      {children}
    </span>
  );
}

export default function PropsPanel() {
  const segments = useCompositionEditorStore((s) => s.segments);
  const selectedId = useCompositionEditorStore((s) => s.selectedId);
  const selectedIds = useCompositionEditorStore((s) => s.selectedIds);
  const setSpeed = useCompositionEditorStore((s) => s.setSpeed);
  const resolution = useCompositionEditorStore((s) => s.resolution);
  const setResolution = useCompositionEditorStore((s) => s.setResolution);
  const aspectRatio = useCompositionEditorStore((s) => s.aspectRatio);
  const requestAspectRatio = useCompositionEditorStore((s) => s.requestAspectRatio);
  const confirmAspectRatio = useCompositionEditorStore((s) => s.confirmAspectRatio);
  const cancelAspectRatio = useCompositionEditorStore((s) => s.cancelAspectRatio);
  const aspectConfirmation = useCompositionEditorStore((s) => s.aspectConfirmation);
  const updateSegment = useCompositionEditorStore((s) => s.updateSegment);

  const selected = segments.find((s) => s.id === selectedId) || null;

  if (!selected) {
    return (
      <aside className="timeline-scrollbar w-full min-w-0 min-h-0 flex flex-col bg-neutral-200 overflow-y-auto overflow-x-hidden px-[20px] py-[16px] gap-[16px]">
        {aspectConfirmation && <ConfirmDialog title="切换画面比例" description="切换画面比例将重置素材构图，是否继续？" confirmText="继续" onConfirm={confirmAspectRatio} onCancel={cancelAspectRatio} />}
        {segments.length === 0 ? (
          <div className="text-text-hint text-font-size-14" style={{ fontFamily: FONT }}>
            请从素材库添加素材
          </div>
        ) : (
          <>
            <div>
              <SectionTitle>成片设置</SectionTitle>
            </div>

            <div className="flex flex-col gap-[8px]">
              <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT }}>分辨率</span>
              <div className="flex gap-[8px]">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResolution(r)}
                    aria-pressed={resolution === r}
                    className={settingOptionClass(resolution === r)}
                    style={{ fontFamily: FONT }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-[8px]">
              <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT }}>画面比例</span>
              <div className="flex gap-[8px]">
                {ASPECTS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => requestAspectRatio(a.key)}
                    aria-pressed={aspectRatio === a.key}
                    className={settingOptionClass(aspectRatio === a.key)}
                    style={{ fontFamily: FONT }}
                  >
                    <span>{a.label}</span>
                    <a.Icon size={16} className="shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <ProjectInfo segments={segments} />
          </>
        )}
      </aside>
    );
  }

  if (selected.type === 'subtitle') return <SubtitleProperties key={selected.id} segment={selected} />;
  const typeLabel = TYPE_LABEL[selected.type] || '片段';
  const dc = durationClampOf(selected);
  const srcDurationText = selected.sourceDuration ? formatTime(selected.sourceDuration, 2) : '未知';

  const isVideo = selected.type === 'video';
  const isImage = selected.type === 'image';
  // 倍速操作仅适用于视频与音频段（图片 offset 恒 0、不受 speed 影响）
  const isMedia = isVideo || selected.type === 'audio';

  // 有效倍速（图片恒 1；缺省 / 非法值回退 1）
  const speed = isImage || !(Number(selected.speed) > 0) ? 1 : Number(selected.speed);

  return (
    <aside className="timeline-scrollbar w-full min-w-0 min-h-0 flex flex-col bg-neutral-200 overflow-y-auto overflow-x-hidden px-[20px] py-[16px] gap-[20px] [&>div]:shrink-0">
      <div className="flex items-center gap-[8px]">
        {selected.type === 'video' && selected.posterUrl && (
          <img src={selected.posterUrl} alt="" className="w-[48px] h-[48px] rounded-medium object-cover shrink-0 border border-stroke-normal" />
        )}
        <div className="flex-1 min-w-0">
          <SectionTitle>{typeLabel}</SectionTitle>
          <div className="truncate text-font-size-12 text-text-secondary mt-[2px]" style={{ fontFamily: FONT }} title={selected.name}>
            {selected.name}
          </div>
        </div>
      </div>

      <PropertySlider key={`duration-${selected.id}`} label="片段时长"
        value={selected.duration} min={dc.min} max={dc.max} step={1} sliderStep="any" precision={2}
        hint={isImage ? undefined : `素材时长 ${srcDurationText}`}
        onChange={(duration) => updateSegment(selected.id, { duration })}
        onCommit={(duration) => updateSegment(selected.id, { duration })} />

      {selected.type === 'audio' && <AudioVolumeControl key={selected.id} segment={selected} />}

      {/* 倍速（仅视频 / 音频段；store 保持源窗口不变并重算时间线时长） */}
      {isMedia && (
        <PropertySlider key={`speed-${selected.id}`} label="倍速"
          value={speed} min={0.5} max={4} step={0.1} unit="x"
          onChange={(value) => setSpeed(selected.id, value)}
          onCommit={(value) => setSpeed(selected.id, value)} />
      )}
      {(isVideo || isImage) && selectedIds.length <= 1 && <VisualSizeControl key={selected.id} segment={selected} />}

    </aside>
  );
}
