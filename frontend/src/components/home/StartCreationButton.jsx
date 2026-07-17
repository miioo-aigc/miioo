import { useState } from 'react';
import { PulsingBorder } from '@paper-design/shaders-react';

const SECONDARY_TEXT = 'rgba(255, 255, 255, 0.60)';

function StartCreationButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const scale = pressed ? 1 : hovered ? 1.035 : 1;
  const contentColor = pressed ? SECONDARY_TEXT : '#FFFFFF';

  return (
    <div
      className="bottom-[80px] fixed w-[200px] h-[52px]"
      style={{
        left: '50vw',
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: '50% 50%',
        transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      role="button"
      tabIndex={0}
      onClick={onClick}
    >
      {/* outer shader bloom — subtle 8px spill onto bg image on hover */}
      <div
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: '-8px',
          opacity: hovered && !pressed ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(55% 70% at 18% 50%, rgba(0, 197, 239, 0.45) 0%, rgba(0, 197, 239, 0) 75%),' +
              'radial-gradient(55% 70% at 82% 50%, rgba(208, 78, 232, 0.4) 0%, rgba(208, 78, 232, 0) 75%),' +
              'radial-gradient(50% 60% at 50% 50%, rgba(255, 200, 22, 0.32) 0%, rgba(255, 200, 22, 0) 75%)',
            filter: 'blur(8px)',
          }}
        />
      </div>

      <PulsingBorder
        speed={1} roundness={1} thickness={1} softness={1}
        intensity={0.2} bloom={0.28} spots={4} spotSize={0.49}
        pulse={0.25} smoke={0.55} smokeSize={0.6}
        scale={1} rotation={0} aspectRatio="auto"
        colors={['#00C5EF', '#D04EE8', '#FFC816']}
        colorBack="#00000000"
        className="rounded-full absolute inset-0 bg-black"
      />
      <div
        className="flex absolute items-center gap-12 left-[50%] top-[50%] p-0"
        style={{
          translate: '-50% -50%',
          color: contentColor,
          transition: 'color 140ms ease',
        }}
      >
        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px', flexShrink: '0' }}>
          <path d="M643.346 393.248c6.186-18.779 9.279-28.114 14.361-29.826a10.715 10.715 0 0 1 6.849 0c5.081 1.712 8.175 11.047 14.361 29.826 25.739 78.432 38.664 117.648 62.966 148.689 11.212 14.306 24.137 27.23 38.443 38.443 31.041 24.303 70.257 37.227 148.689 62.966 18.779 6.186 28.114 9.279 29.826 14.361a10.771 10.771 0 0 1 0 6.849c-1.712 5.081-11.047 8.175-29.826 14.361-78.432 25.739-117.648 38.664-148.689 62.966-14.361 11.212-27.23 24.137-38.443 38.443-24.303 31.097-37.227 70.312-62.966 148.689-6.186 18.779-9.279 28.114-14.361 29.826a10.771 10.771 0 0 1-6.849 0c-5.081-1.712-8.175-11.047-14.361-29.826-25.739-78.432-38.664-117.648-62.966-148.689a225.077 225.077 0 0 0-38.443-38.387c-31.097-24.358-70.312-37.283-148.744-63.077-18.724-6.131-28.059-9.224-29.826-14.361a10.771 10.771 0 0 1 0-6.794c1.767-5.081 11.102-8.175 29.826-14.361 78.432-25.739 117.648-38.664 148.744-62.966 14.306-11.212 27.175-24.137 38.387-38.443 24.303-31.097 37.283-70.257 63.022-148.689zM251.629 233.954c4.087-12.483 6.131-18.724 9.555-19.884a7.18 7.18 0 0 1 4.529 0c3.424 1.16 5.468 7.401 9.555 19.884 17.178 52.306 25.794 78.432 41.978 99.144 7.512 9.555 16.128 18.172 25.684 25.628 20.713 16.239 46.838 24.855 99.089 41.978 12.483 4.143 18.779 6.186 19.884 9.611a7.18 7.18 0 0 1 0 4.529c-1.105 3.424-7.346 5.468-19.884 9.555-52.251 17.233-78.432 25.794-99.089 41.978a150.235 150.235 0 0 0-25.628 25.684c-16.239 20.713-24.855 46.838-41.978 99.144-4.143 12.483-6.186 18.724-9.611 19.884a7.18 7.18 0 0 1-4.529 0c-3.424-1.16-5.468-7.401-9.555-19.884-17.233-52.306-25.794-78.432-42.033-99.144a150.235 150.235 0 0 0-25.628-25.628c-20.713-16.239-46.838-24.855-99.144-41.978-12.483-4.143-18.724-6.186-19.884-9.611a7.18 7.18 0 0 1 0-4.529c1.16-3.424 7.401-5.468 19.884-9.555 52.306-17.233 78.432-25.794 99.144-42.033 9.555-7.457 18.172-16.073 25.628-25.628 16.239-20.713 24.855-46.838 41.978-99.144zM529.454 77.256c2.596-7.788 3.866-11.71 5.965-12.428a4.419 4.419 0 0 1 2.872 0c2.099 0.718 3.424 4.64 5.965 12.428 10.771 32.698 16.128 48.992 26.291 61.972 4.64 5.965 9.997 11.323 16.018 16.018 12.925 10.108 29.274 15.465 61.917 26.236 7.788 2.596 11.71 3.866 12.428 5.965a4.474 4.474 0 0 1 0 2.872c-0.718 2.099-4.64 3.369-12.428 5.965-32.643 10.771-48.992 16.128-61.972 26.236a94.063 94.063 0 0 0-16.018 16.018c-10.108 12.98-15.465 29.274-26.236 61.972-2.541 7.788-3.866 11.71-5.965 12.428a4.419 4.419 0 0 1-2.872 0c-2.099-0.718-3.369-4.64-5.965-12.428-10.715-32.698-16.128-48.992-26.236-61.972a93.897 93.897 0 0 0-16.018-16.018c-12.925-10.108-29.274-15.465-61.972-26.236-7.788-2.596-11.71-3.866-12.428-5.965a4.474 4.474 0 0 1 0-2.872c0.718-2.099 4.64-3.369 12.428-5.965 32.698-10.715 49.047-16.128 61.972-26.236a93.897 93.897 0 0 0 16.018-16.018c10.108-12.98 15.465-29.274 26.236-61.972z" fill="currentColor" />
        </svg>
        <span className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-base/5" style={{ color: 'currentColor' }}>开始创作</span>
      </div>
    </div>
  );
}

export default StartCreationButton;
