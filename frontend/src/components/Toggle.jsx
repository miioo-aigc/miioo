import { useState } from 'react';

export default function Toggle({ value, onChange }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    onChange(!value);
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="flex items-center shrink-0 h-[20px] justify-start w-[36px] rounded-[10px] p-[2px] cursor-pointer transition-all duration-150"
      style={{
        backgroundColor: value ? '#4ADE80' : 'rgba(255,255,255,0.12)',
        border: `1px solid ${value ? '#4ADE80' : 'rgba(255,255,255,0.15)'}`,
        opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
        justifyContent: value ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        className="shrink-0 rounded-[50%] w-[16px] h-[16px] transition-all duration-150"
        style={{
          backgroundColor: value ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
        }}
      />
    </div>
  );
}
