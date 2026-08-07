// 创作页选择器共享常量。独立于 React 组件，避免页面和组件之间形成隐式闭包依赖。
export const DEFAULT_EMOTIONS = ['中性', '愤怒', '开心', '悲伤', '恐惧', '冷漠', '惊讶', '温柔'];

const EMOTION_DISPLAY_MAP = {
  happy: '开心',
  sad: '悲伤',
  angry: '愤怒',
  fearful: '恐惧',
  fear: '恐惧',
  disgusted: '厌恶',
  disgust: '厌恶',
  surprised: '惊讶',
  surprise: '惊讶',
  calm: '平静',
  neutral: '中性',
  gentle: '温柔',
  warm: '温暖',
};

export function getEmotionDisplayLabel(value) {
  const text = String(value ?? '').trim();
  return EMOTION_DISPLAY_MAP[text.toLowerCase()] || text;
}
