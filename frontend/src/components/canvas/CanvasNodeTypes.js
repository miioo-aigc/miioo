import AudioCanvasNode from './AudioCanvasNode';
import ImageCanvasNode from './ImageCanvasNode';
import TextCanvasNode from './TextCanvasNode';
import VideoCanvasNode from './VideoCanvasNode';

export const canvasNodeTypes = {
  text: TextCanvasNode,
  image: ImageCanvasNode,
  video: VideoCanvasNode,
  audio: AudioCanvasNode,
};
