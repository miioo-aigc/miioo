import AudioCanvasNode from './AudioCanvasNode';
import ImageCanvasNode from './ImageCanvasNode';
import TextCanvasNode from './TextCanvasNode';
import VideoCanvasNode from './VideoCanvasNode';
import CanvasGroupNode from './CanvasGroupNode';

export const canvasNodeTypes = {
  canvasGroup: CanvasGroupNode,
  text: TextCanvasNode,
  image: ImageCanvasNode,
  video: VideoCanvasNode,
  audio: AudioCanvasNode,
};
