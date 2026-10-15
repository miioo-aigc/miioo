import { useEffect, useRef } from 'react';

const graphs = new WeakMap();
let context;

export default function PreviewAudioLayer({ active, cursor, playing, settings }) {
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

  const sync = () => {
    const audio = ref.current;
    if (!audio || !active) return;
    const speed = Number(active.seg.speed) || 1;
    const target = (Number(active.seg.offset) || 0) + (cursor - active.start) * speed;
    audio.playbackRate = speed;
    if (audio.readyState >= 1 && Math.abs(audio.currentTime - target) > 0.15) audio.currentTime = Math.max(0, target);
  };
  useEffect(() => {
    const audio = ref.current;
    if (!active) { audio.pause(); return; }
    const graph = graphRef.current;
    const volume = settings?.hidden ? 0 : (settings?.volume ?? 1) * (active.seg.volume ?? 1);
    graph?.gain.gain.setValueAtTime(Math.max(0, Math.min(2, volume)), graph.context.currentTime);
    sync();
    if (playing) {
      graph?.context.resume().catch(() => {});
      audio.play().catch(() => {});
    } else audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cursor, playing, settings]);
  return <audio ref={ref} src={active?.seg.sourceUrl || undefined} crossOrigin="anonymous" preload="auto" hidden onLoadedMetadata={sync} />;
}
