import { useCanvasAudioWaveform } from '../canvas/UseCanvasAudioWaveform';

const BAR_COUNT = 19;

/** 参考蓝色发光波形：居中显示，以真实声音驱动上下对称伸缩。 */
export default function CreationAudioVisualizer({ audioRef, url, playing }) {
  const { waveformRef } = useCanvasAudioWaveform({ url, playing, audioRef, centered: true });
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '24px' }}>
      <div ref={waveformRef} style={{ width: '320px', maxWidth: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const distance = Math.abs(index - (BAR_COUNT - 1) / 2);
          const color = distance < 3 ? '#A5F3FF' : distance < 6 ? '#36BFFF' : '#164BFF';
          return <div key={index} style={{ width: '6px', flexShrink: 0, height: '6px', borderRadius: '999px', background: color, boxShadow: '0 0 7px ' + color + '80', transition: 'height 100ms ease-out' }} />;
        })}
      </div>
    </div>
  );
}
