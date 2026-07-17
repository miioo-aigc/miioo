import { useEffect, useRef } from 'react';

const SLOGAN_LINES = ['无订阅费用', '一键配置API，开启漫剧创作之旅'];
const SOFT_BLUR_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SOFT_BLUR_DURATION = 900;
const SOFT_BLUR_STAGGER = 25;
const SOFT_BLUR_LINE_DELAY = 400;

function HomeSloganText() {
  const ref0 = useRef(null);
  const ref1 = useRef(null);

  useEffect(() => {
    const refs = [ref0, ref1];
    refs.forEach((ref, lineIdx) => {
      const container = ref.current;
      if (!container) return;
      const units = Array.from(container.querySelectorAll('[data-char]'));
      const lineStart = lineIdx * SOFT_BLUR_LINE_DELAY;
      units.forEach((span, i) => {
        span.animate(
          [
            { opacity: 0, transform: 'translateY(16px)', filter: 'blur(12px)' },
            { opacity: 1, transform: 'translateY(0px)',  filter: 'blur(0px)'  },
          ],
          {
            duration: SOFT_BLUR_DURATION,
            delay: lineStart + i * SOFT_BLUR_STAGGER,
            easing: SOFT_BLUR_EASING,
            fill: 'both',
          }
        );
      });
    });
  }, []);

  const outerCharStyle = {
    display: 'inline-block',
    willChange: 'transform, opacity, filter',
  };

  const lineStyles = [
    {
      // 第一行
      opacity: 0.7,
      fontFamily: '"Source Sans 3",system-ui,sans-serif',
      fontWeight: 200,
      fontSize: '52px',
      lineHeight: '64px',
      whiteSpace: 'nowrap',
    },
    {
      // 第二行
      opacity: 0.7,
      fontFamily: '"Source Sans 3",system-ui,sans-serif',
      fontWeight: 200,
      fontSize: '52px',
      lineHeight: '64px',
      whiteSpace: 'nowrap',
    },
  ];

  const innerCharStyles = [
    {
      display: 'inline-block',
      backgroundImage: 'linear-gradient(in oklab 180deg, oklab(100% 0 0) 50%, oklab(70.1% 0.003 -0.043 / 10%) 115.99%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      WebkitTextStroke: '1px #FFFFFF80',
    },
    {
      display: 'inline-block',
      backgroundImage: 'linear-gradient(in oklab 180deg, oklab(100% 0 0) 50%, oklab(70.1% 0.003 -0.043 / 20%) 115.99%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      WebkitTextStroke: '1px #FFFFFF80',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '33.333%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        pointerEvents: 'none',
        zIndex: 1,
        whiteSpace: 'nowrap',
        overflow: 'visible',
      }}
    >
      <div ref={ref0} style={lineStyles[0]}>
        {Array.from(SLOGAN_LINES[0]).map((char, i) => (
          <span key={i} data-char style={outerCharStyle}>
            <span style={innerCharStyles[0]}>{char}</span>
          </span>
        ))}
      </div>
      <div ref={ref1} style={{ ...lineStyles[1], marginLeft: '-38px' }}>
        {Array.from(SLOGAN_LINES[1]).map((char, i) => (
          <span key={i} data-char style={outerCharStyle}>
            <span style={innerCharStyles[1]}>{char}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default HomeSloganText;
