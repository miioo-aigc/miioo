import { useEffect, useRef } from 'react';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';

const graphs = new WeakMap();
let context;

export default function PreviewAudioLayer({ active, playing, settings, clock, track, seekEpoch }) {
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
    graph?.gain.gain.setValueAtTime(Math.max(0, Math.min(2, volume)), graph.context.currentTime);
    if (playing) graph?.context.resume().catch(() => {});
  }, [active, playing, settings]);
  const audible = !settings?.hidden && (settings?.volume ?? 1) * (active?.seg.volume ?? 1) > 0;
  useEffect(() => clock.register(track, ref.current, active, audible, playing,
    () => useCompositionEditorStore.getState().cursor,
    () => useCompositionEditorStore.getState().pause()),
  [clock, track, active, audible, playing, seekEpoch]);
  return <audio ref={ref} crossOrigin="anonymous" preload="auto" hidden />;
}
