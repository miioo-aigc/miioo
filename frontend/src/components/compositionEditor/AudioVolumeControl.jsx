import { useEffect, useRef } from 'react';
import PropertySlider from './PropertySlider';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';

export default function AudioVolumeControl({ segment }) {
  const beforeRef = useRef(null);
  const percent = Math.round((segment.volume ?? 1) * 100);
  const begin = () => {
    if (!beforeRef.current) {
      const state = useCompositionEditorStore.getState();
      beforeRef.current = { segments: state.segments, selectedId: state.selectedId };
    }
  };
  const preview = (value) => {
    begin();
    useCompositionEditorStore.getState().previewAudioVolume(segment.id, value / 100);
  };
  const commit = () => {
    useCompositionEditorStore.getState().commitAudioVolume(beforeRef.current);
    beforeRef.current = null;
  };
  const cancel = () => {
    if (beforeRef.current) useCompositionEditorStore.setState({ segments: beforeRef.current.segments });
    beforeRef.current = null;
  };
  useEffect(() => () => {
    useCompositionEditorStore.getState().commitAudioVolume(beforeRef.current);
  }, []);
  return (
    <PropertySlider label="音量" min={0} max={200} step={1} value={percent} unit="%"
      onChange={preview} onCommit={(value) => { preview(value); commit(); }}
      sliderProps={{
        onPointerDown: (event) => { begin(); event.currentTarget.setPointerCapture(event.pointerId); },
        onPointerUp: commit, onPointerCancel: cancel, onKeyUp: commit, onBlur: commit,
      }} />
  );
}
