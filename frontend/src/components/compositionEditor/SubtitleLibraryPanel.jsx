import { useRef, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { readSubtitleFile } from '../../utils/SubtitleImport';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';

export default function SubtitleLibraryPanel() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const run = async (action) => {
    setMessage('');
    setBusy(true);
    try { await action(); } catch (error) { setMessage(error.message || '字幕处理失败'); }
    finally { setBusy(false); }
  };
  return <section className="flex min-h-0 flex-1 flex-col gap-[12px] overflow-y-auto">
    <div className="grid shrink-0 grid-cols-2 gap-[12px]">
      {[
        { label: '新建字幕', Icon: Plus },
        { label: '导入字幕', Icon: Upload, hint: '（支持srt/ass）' },
      ].map(({ label, Icon, hint }) => <button key={label} type="button" disabled={busy} onClick={() => {
        if (hint) input.current.click();
        else run(() => useCompositionEditorStore.getState().addSubtitle());
      }}
        className="flex h-[120px] min-w-0 flex-col items-center justify-center rounded-medium border border-dashed border-stroke-accent bg-transparent px-[8px] text-font-size-14 text-text-secondary hover:border-stroke-active hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40">
        <Icon size={20} className="mb-[8px] shrink-0" />
        <span>{label}</span>
        {hint && <span className="text-font-size-12 text-text-hint">{hint}</span>}
      </button>)}
      <input ref={input} type="file" accept=".srt,.ass" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) run(async () => {
          const project = useCompositionEditorStore.getState().compositionId;
          const { cues, warnings } = await readSubtitleFile(file);
          if (useCompositionEditorStore.getState().compositionId !== project) return;
          useCompositionEditorStore.getState().importSubtitles(cues);
          setMessage(`已导入 ${cues.length} 条字幕${warnings.length ? `。${warnings.join('；')}` : ''}`);
        });
      }} />
    </div>
    {message && <p role="status" className="text-font-size-12 text-text-secondary whitespace-pre-wrap">{message}</p>}
    {busy && <span className="text-text-hint text-font-size-12">正在读取字幕…</span>}
  </section>;
}
