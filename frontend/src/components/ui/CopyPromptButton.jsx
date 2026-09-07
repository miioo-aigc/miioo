import { useState } from 'react';

export default function CopyPromptButton({ text, prompt, onCopy, onError, disabled = false, title = '复制提示词' }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const color = disabled ? '#FFFFFF1F' : (pressed ? '#FFFFFF99' : '#FFFFFFCC');

  async function handleClick() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(text ?? prompt ?? '');
      onCopy?.();
    } catch (error) {
      onError?.(error);
    }
  }

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      style={{
        width: '24px', minWidth: '24px', height: '24px', padding: 0, margin: 0,
        border: 0, borderRadius: '6px', background: hovered && !disabled ? '#FFFFFF14' : 'transparent',
        cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color, transition: 'color 120ms ease, background 120ms ease', flexShrink: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={handleClick}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="currentColor" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
