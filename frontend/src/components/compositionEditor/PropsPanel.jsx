import { useState } from 'react';
import {
  formatTime,
  computeVisualWindows,
  computeAudioWindows,
  durationClampOf,
  offsetClampOf,
  useCompositionEditorStore,
} from '../../stores/compositionEditorStore';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const RESOLUTIONS = ['1080p', '720p'];
const ASPECTS = [
  { key: '16:9', label: '16:9', w: 48, h: 27 },
  { key: '9:16', label: '9:16', w: 27, h: 48 },
  { key: '1:1', label: '1:1', w: 40, h: 40 },
];

const TYPE_LABEL = {
  video: '视频片段',
  image: '图片片段',
  audio: '音频片段',
};

// 倍速预设（与协议 0.5~4 区间对齐；段当前倍速不在预设时动态补入选项）
const SPEED_PRESETS = [0.5, 1, 1.5, 2, 3, 4];

// 图片段转场选项
const TRANSITION_OPTIONS = [
  { value: 'fade', label: '淡入淡出 (fade)' },
  { value: 'none', label: '无 (none)' },
];

function SectionTitle({ children }) {
  return (
    <span className="text-font-size-14 font-font-weight-medium text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
      {children}
    </span>
  );
}

/** 数值格式化：保留 1 位小数 */
function formatSeconds(value) {
  return (Number(value) || 0).toFixed(1);
}

/**
 * 精确数值输入框：本地草稿字符串 state，blur / Enter 时提交（避免每键入触发 store 钳制回写跳动）。
 * 未编辑（draft 为 null）时展示 store 值的 1 位小数格式化，滑块 / 拖拽 / store 钳制结果即时同步；
 * 提交后回落到 store 收敛值。min/max 同时作为 HTML 属性与本地预钳制边界（与 store 钳制口径一致）。
 */
function NumberField({ value, min, max, step = 0.1, disabled, onCommit }) {
  // 编辑中的本地草稿（null = 未编辑，回落到格式化的 store 值）
  const [draft, setDraft] = useState(null);
  const text = draft ?? formatSeconds(value);

  const commit = () => {
    const trimmed = String(text).trim();
    const num = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(num)) {
      const clamped = Math.min(Math.max(num, min), max);
      // 值未变化时不触发 store 更新（避免无意义 dirty / 暂停播放）
      if (clamped !== Number(value)) onCommit(clamped);
    }
    setDraft(null);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={text}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        // Enter 统一经 blur 触发提交，避免双路径
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className="flex-1 h-8 rounded-medium px-[8px] bg-input-bg-normal border border-input-border-normal text-input-text-content text-font-size-14 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ fontFamily: FONT }}
    />
  );
}

export default function PropsPanel() {
  const segments = useCompositionEditorStore((s) => s.segments);
  const selectedId = useCompositionEditorStore((s) => s.selectedId);
  const cursor = useCompositionEditorStore((s) => s.cursor);
  const updateSegment = useCompositionEditorStore((s) => s.updateSegment);
  const removeSegment = useCompositionEditorStore((s) => s.removeSegment);
  const setSpeed = useCompositionEditorStore((s) => s.setSpeed);
  const setTransition = useCompositionEditorStore((s) => s.setTransition);
  const detachAudio = useCompositionEditorStore((s) => s.detachAudio);
  const hasDetachedAudio = useCompositionEditorStore((s) => s.hasDetachedAudio);
  const resolution = useCompositionEditorStore((s) => s.resolution);
  const setResolution = useCompositionEditorStore((s) => s.setResolution);
  const aspectRatio = useCompositionEditorStore((s) => s.aspectRatio);
  const setAspectRatio = useCompositionEditorStore((s) => s.setAspectRatio);

  const selected = segments.find((s) => s.id === selectedId) || null;
  const { total } = computeVisualWindows(segments);

  const sliderClass = 'w-full accent-brand-main';

  if (!selected) {
    return (
      <aside className="w-full min-w-0 flex flex-col bg-neutral-200 overflow-y-auto px-[20px] py-[16px] gap-[24px]">
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
                    className="flex-1 h-9 rounded-medium border cursor-pointer"
                    style={{
                      fontFamily: FONT,
                      background: resolution === r ? 'var(--color-brand-main)' : 'transparent',
                      borderColor: 'var(--color-stroke-normal)',
                      color: resolution === r ? '#090909' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-[8px]">
              <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT }}>画幅</span>
              <div className="flex gap-[16px]">
                {ASPECTS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAspectRatio(a.key)}
                    className="flex flex-col items-center gap-[6px] cursor-pointer"
                  >
                    <span
                      className="rounded-medium border"
                      style={{
                        width: a.w,
                        height: a.h,
                        borderColor: aspectRatio === a.key ? 'var(--color-stroke-active)' : 'var(--color-stroke-normal)',
                        background: aspectRatio === a.key ? 'rgba(45,195,225,0.18)' : 'transparent',
                      }}
                    />
                    <span className="text-font-size-12" style={{ fontFamily: FONT, color: aspectRatio === a.key ? 'var(--color-text-primary)' : 'var(--color-text-hint)' }}>
                      {a.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-[8px]">
              <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT }}>工程信息</span>
              <div className="text-font-size-14 text-text-secondary flex flex-col gap-[4px]" style={{ fontFamily: FONT }}>
                <span>总时长：{formatTime(total)}</span>
                <span>片段数：{segments.length}</span>
              </div>
            </div>
          </>
        )}
      </aside>
    );
  }

  const typeLabel = TYPE_LABEL[selected.type] || '片段';
  const dc = durationClampOf(selected);
  const oc = offsetClampOf(selected);
  const srcDurationText = selected.sourceDuration ? formatTime(selected.sourceDuration) : '未知';

  const isVideo = selected.type === 'video';
  const isImage = selected.type === 'image';
  // 倍速 / 入出点操作仅适用于视频与音频段（图片 offset 恒 0、不受 speed 影响）
  const isMedia = isVideo || selected.type === 'audio';

  // 有效倍速（图片恒 1；缺省 / 非法值回退 1）
  const speed = isImage || !(Number(selected.speed) > 0) ? 1 : Number(selected.speed);
  const speedOptions = SPEED_PRESETS.includes(speed)
    ? SPEED_PRESETS
    : [...SPEED_PRESETS, speed].sort((a, b) => a - b);

  // 选中段时间线窗口：视频 / 图片取 V1 可视化窗口，音频取 A1 窗口（「设为入点」判定依据）
  const { windows: visualWindows } = computeVisualWindows(segments);
  const { windows: audioWindows } = computeAudioWindows(segments);
  const segWindow = selected.type === 'audio'
    ? audioWindows.find((w) => w.seg.id === selected.id)
    : visualWindows.find((w) => w.seg.id === selected.id);
  const cursorInSegment = Boolean(segWindow) && cursor >= segWindow.start && cursor < segWindow.end;

  // 设为入点：段内时间线位置 t 对应源位置 offset + t × speed，故 offset ← offset + (cursor − 窗口起点) × speed（store 钳制收敛）
  const handleSetInPoint = () => {
    if (!segWindow || !cursorInSegment) return;
    updateSegment(selected.id, { offset: (Number(selected.offset) || 0) + (cursor - segWindow.start) * speed });
  };

  // 重置入出点：offset=0、时长=源时长÷speed；源时长未知时仅重置 offset
  const handleResetPoints = () => {
    const srcD = Number(selected.sourceDuration);
    if (Number.isFinite(srcD) && srcD > 0) {
      updateSegment(selected.id, { offset: 0, duration: srcD / speed });
    } else {
      updateSegment(selected.id, { offset: 0 });
    }
  };

  // 已分离判定（A1 存在同素材且起点对齐的音频段）；已分离时视觉禁用并以 title 提示
  const audioDetached = isVideo && hasDetachedAudio(selected.id);

  return (
    <aside className="w-full min-w-0 flex flex-col bg-neutral-200 overflow-y-auto px-[20px] py-[16px] gap-[20px]">
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

      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center justify-between">
          <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT }}>片段时长</span>
          <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT }}>素材时长 {srcDurationText}</span>
        </div>
        <input
          type="range"
          min={dc.min}
          max={dc.max}
          step={0.5}
          value={Math.min(Math.max(selected.duration, dc.min), dc.max)}
          onChange={(e) => updateSegment(selected.id, { duration: Number(e.target.value) })}
          className={sliderClass}
        />
        <div className="flex items-center gap-[8px]">
          <NumberField
            key={`duration-${selected.id}`}
            value={selected.duration}
            min={dc.min}
            max={dc.max}
            onCommit={(v) => updateSegment(selected.id, { duration: v })}
          />
          <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT }}>秒</span>
        </div>
      </div>

      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center justify-between">
          <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT }}>入点</span>
          {isImage && (
            <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT }}>图片不支持</span>
          )}
        </div>
        <input
          type="range"
          disabled={oc.max <= 0}
          min={oc.min}
          max={oc.max || 1}
          step={0.5}
          value={Math.min(Math.max(selected.offset, oc.min), oc.max || 1)}
          onChange={(e) => updateSegment(selected.id, { offset: Number(e.target.value) })}
          className={`${sliderClass} disabled:opacity-40`}
        />
        <div className="flex items-center gap-[8px]">
          <NumberField
            key={`offset-${selected.id}`}
            value={selected.offset}
            min={oc.min}
            max={oc.max || 1}
            disabled={oc.max <= 0}
            onCommit={(v) => updateSegment(selected.id, { offset: v })}
          />
          <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT }}>秒</span>
        </div>
      </div>

      {/* 倍速（仅视频 / 音频段；store 保持源窗口不变并重算时间线时长） */}
      {isMedia && (
        <div className="flex flex-col gap-[8px]">
          <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT }}>倍速</span>
          <select
            value={String(speed)}
            onChange={(e) => setSpeed(selected.id, Number(e.target.value))}
            className="w-full h-8 rounded-medium px-[8px] bg-input-bg-normal border border-input-border-normal text-input-text-content text-font-size-14 outline-none cursor-pointer"
            style={{ fontFamily: FONT }}
          >
            {speedOptions.map((v) => (
              <option key={v} value={String(v)}>{`${v}x`}</option>
            ))}
          </select>
        </div>
      )}

      {/* 转场（仅图片段） */}
      {isImage && (
        <div className="flex flex-col gap-[8px]">
          <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT }}>转场</span>
          <select
            value={selected.transition === 'none' ? 'none' : 'fade'}
            onChange={(e) => setTransition(selected.id, e.target.value)}
            className="w-full h-8 rounded-medium px-[8px] bg-input-bg-normal border border-input-border-normal text-input-text-content text-font-size-14 outline-none cursor-pointer"
            style={{ fontFamily: FONT }}
          >
            {TRANSITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* 设为入点 / 重置入出点（仅视频 / 音频段；播放头不在段内时「设为入点」禁用） */}
      {isMedia && (
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            disabled={!cursorInSegment}
            onClick={handleSetInPoint}
            className="flex items-center justify-center flex-1 h-9 rounded-medium px-[12px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border disabled:border-transparent disabled:bg-btn-primary-bg-disabled disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="text-btn-primary-text text-font-size-14 font-font-weight-medium whitespace-nowrap" style={{ fontFamily: FONT_MEDIUM }}>
              设为入点
            </span>
          </button>
          <button
            type="button"
            onClick={handleResetPoints}
            className="flex items-center justify-center flex-1 h-9 rounded-medium px-[12px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border cursor-pointer"
          >
            <span className="text-btn-primary-text text-font-size-14 font-font-weight-medium whitespace-nowrap" style={{ fontFamily: FONT_MEDIUM }}>
              重置入出点
            </span>
          </button>
        </div>
      )}

      {/* 分离音频（仅视频段；已分离则视觉禁用 + title 提示，视频段本身不变） */}
      {isVideo && (
        <div className="flex flex-col gap-[4px]">
          <button
            type="button"
            title={audioDetached ? '已分离' : undefined}
            onClick={() => {
              if (!audioDetached) detachAudio(selected.id);
            }}
            className={`flex items-center self-start h-9 rounded-medium px-[16px] border ${
              audioDetached
                ? 'bg-btn-primary-bg-disabled border-transparent cursor-not-allowed'
                : 'bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border-btn-primary-border cursor-pointer'
            }`}
          >
            <span className="text-btn-primary-text text-font-size-14 font-font-weight-medium whitespace-nowrap" style={{ fontFamily: FONT_MEDIUM }}>
              分离音频
            </span>
          </button>
          {audioDetached && (
            <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT }}>
              音频已分离到 A1 轨道
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => removeSegment(selected.id)}
        className="self-start flex items-center h-9 shrink-0 rounded-medium px-[16px] gap-[4px] bg-btn-danger-bg-normal hover:bg-btn-danger-bg-hover active:bg-btn-danger-bg-active border border-btn-danger-border cursor-pointer"
      >
        <span className="text-btn-danger-text text-font-size-14 font-font-weight-medium" style={{ fontFamily: FONT_MEDIUM }}>
          删除片段
        </span>
      </button>
    </aside>
  );
}
