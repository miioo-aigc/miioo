import { createElement } from 'react';
import CanvasVideoModeIcon from './CanvasVideoModeIcons';

export const CANVAS_VIDEO_MODE_ICONS = Object.fromEntries([
  'text_to_video', 'first_frame', 'last_frame', 'start_end',
  'reference_images', 'reference_subjects', 'video_ref', 'video_edit',
].map((mode) => [mode, {
  iconDefault: createElement(CanvasVideoModeIcon, { mode }),
  iconSelected: createElement(CanvasVideoModeIcon, { mode, active: true }),
}]));
