function TextNodeIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
    <path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="none" stroke="currentColor" />
    <path d="M10.667 5.333H5.333" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 11.333V5.333" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function ImageNodeIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M1.667 3.333C1.667 2.965 1.965 2.667 2.333 2.667H13.667C14.035 2.667 14.333 2.965 14.333 3.333V12.667C14.333 13.035 14.035 13.333 13.667 13.333H2.333C1.965 13.333 1.667 13.035 1.667 12.667V3.333Z" />
    <path fillRule="evenodd" clipRule="evenodd" d="M4.833 6C5.11 6 5.333 5.776 5.333 5.5C5.333 5.224 5.11 5 4.833 5C4.557 5 4.333 5.224 4.333 5.5C4.333 5.776 4.557 6 4.833 6Z" />
    <path d="M1.667 11.333L2.158 10.842L5 8L6.667 9.333L8.667 7L13.846 10.961L14.333 11.333" strokeLinecap="butt" />
  </svg>;
}

function VideoNodeIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
    <path d="M13 2H3C2.448 2 2 2.448 2 3V13C2 13.552 2.448 14 3 14H13C13.552 14 14 13.552 14 13V3C14 2.448 13.552 2 13 2Z" />
    <path d="M6.833 9.333V7.313L8.583 8.323L10.333 9.333L8.583 10.344L6.833 11.354V9.333Z" />
    <path d="M2.502 5L13.467 5" />
    <path d="M10.534 2.699L9.443 4.336" />
    <path d="M6.657 2.514L5.336 4.496" />
  </svg>;
}

function AudioNodeIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
    <path d="M3.333 12V8C3.333 5.423 5.423 3.333 8 3.333C10.577 3.333 12.667 5.423 12.667 8V12M3.333 8.667H2C1.632 8.667 1.333 8.965 1.333 9.333V12C1.333 12.368 1.632 12.667 2 12.667H3.333V8.667ZM12.667 8.667H14C14.368 8.667 14.667 8.965 14.667 9.333V12C14.667 12.368 14.368 12.667 14 12.667H12.667V8.667Z" />
    <path d="M5.333 10.667H6.667L7.333 8.667L8.667 12.667L9.333 10.667H10.667" />
  </svg>;
}

const ICONS = { text: TextNodeIcon, image: ImageNodeIcon, video: VideoNodeIcon, audio: AudioNodeIcon };

export default function CanvasNodeIcon({ nodeType }) {
  const Icon = ICONS[nodeType] || TextNodeIcon;
  return <Icon />;
}
