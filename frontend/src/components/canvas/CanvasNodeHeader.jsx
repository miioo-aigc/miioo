import { Image, Music2, Video } from 'lucide-react';

function TextNodeIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
    <path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="none" stroke="var(--color-text-secondary)" />
    <path d="M10.667 5.333H5.333" fill="none" stroke="var(--color-text-secondary)" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 11.333V5.333" fill="none" stroke="var(--color-text-secondary)" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

const ICONS = { text: TextNodeIcon, image: Image, video: Video, audio: Music2 };

export default function CanvasNodeHeader({ nodeType, title }) {
  const Icon = ICONS[nodeType] || TextNodeIcon;
  return <div className="canvas-node__header"><Icon size={16} strokeWidth={1.7} /><span>{title}</span></div>;
}
