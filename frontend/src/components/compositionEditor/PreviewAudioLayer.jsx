import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCompositionMediaSource } from './UseCompositionMediaSource';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';

const graphs = new WeakMap();
let context;

export default function PreviewAudioLayer({ active, playing, settings, clock, track, seekEpoch, outputVolume = 1, onError }) {
  const playback = useCompositionMediaSource(active?.seg.sourceUrl);
  const playbackActive = useMemo(() => active
    ? { ...active, seg: { ...active.seg, sourceUrl: playback.source } } : active, [active, playback.source]);
  const id = active?.seg.id;
  const reportError = useCallback(() => {
    if (id) onError(id, '音频加载失败，请检查资源访问或重新添加素材');
  }, [id, onError]);
  useEffect(() => {
    if (playback.error) reportError();
  }, [playback.error, reportError]);
  useEffect(() => () => { if (id) onError(id, null); }, [id, playback.source, onError]);
  const ref = useRef(null);
  const graphRef = useRef(null);
  useEffect(() => {
    const audio = ref.current;
    context ??= new AudioContext();
    let graph = graphs.get(audio);
    if (!graph) {
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      source.connect(gain);
      graph = { gain, context };
      graphs.set(audio, graph);
    }
    graphRef.current = graph;
    graph.gain.connect(context.destination);
    const resume = () => context.resume().catch(() => {});
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      audio.pause();
      graph.gain.disconnect();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    const volume = settings?.hidden ? 0 : (settings?.volume ?? 1) * (active?.seg.volume ?? 1);
    graph?.gain.gain.setValueAtTime(Math.max(0, Math.min(2, volume * outputVolume)), graph.context.currentTime);
    if (playing) graph?.context.resume().catch(() => {});
  }, [active, playing, settings, outputVolume]);
  const audible = !settings?.hidden && (settings?.volume ?? 1) * (active?.seg.volume ?? 1) > 0;
  useEffect(() => clock.register(track, ref.current, playbackActive, audible, playing,
    () => useCompositionEditorStore.getState().cursor, reportError),
  [clock, track, playbackActive, audible, playing, seekEpoch, reportError]);
  return <audio ref={ref} crossOrigin="anonymous" preload="auto" hidden />;
}
