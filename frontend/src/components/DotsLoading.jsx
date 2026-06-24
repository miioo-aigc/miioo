import { useEffect } from 'react';

const STYLE_ID = 'dots-loading-style';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes dots-loading {
      0%, 60%, 100% { opacity: 0.2; transform: translateY(0px); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    .dots-loading-dot { animation: dots-loading 1.4s ease-in-out infinite; }
    .dots-loading-dot:nth-child(1) { animation-delay: 0s; }
    .dots-loading-dot:nth-child(2) { animation-delay: 0.2s; }
    .dots-loading-dot:nth-child(3) { animation-delay: 0.4s; }
  `;
  document.head.appendChild(style);
}

/**
 * @param {object} props
 * @param {number} [props.size=4] - dot size in px
 * @param {string} [props.color='#FFFFFF'] - dot color
 * @param {number} [props.gap=3] - gap between dots in px
 */
export default function DotsLoading({ size = 4, color = '#FFFFFF', gap = 3 }) {
  useEffect(() => { ensureStyle(); }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${gap}px` }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="dots-loading-dot"
          style={{ width: size, height: size, borderRadius: '9999px', background: color, flexShrink: 0 }}
        />
      ))}
    </div>
  );
}
